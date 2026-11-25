import { createHash } from 'node:crypto';

import {
  canonicalStringify,
  createEvidence,
  createProposal,
  hashCanonical,
  recordRealization,
} from './provenance.mjs';
import { encodeMidi } from './midi.mjs';

const REQUEST_SCHEMA = 'haunted-phonograph/field-answer-request/v0';
const RESULT_SCHEMA = 'haunted-phonograph/field-answer-result/v0';
const SAMPLE_RATE = 44_100;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_FRAME = 4;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function fail(code, message) {
  const error = new TypeError(message);
  error.code = code;
  throw error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys, code) {
  if (!isPlainObject(value)) fail(code, 'expected plain JSON object');
  const actual = Object.keys(value).sort().join('|');
  const expected = [...keys].sort().join('|');
  if (actual !== expected) fail(code, 'unexpected fields');
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256Text(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseCanonicalWav(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44 || bytes.length > MAX_AUDIO_BYTES) {
    fail('INVALID_FIELD_ANSWER_AUDIO', 'bounded canonical WAV bytes required');
  }
  if (
    bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    fail('INVALID_FIELD_ANSWER_AUDIO', 'RIFF/WAVE carrier required');
  }

  let offset = 12;
  let format = null;
  let pcm = null;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (body + size > bytes.length) {
      fail('INVALID_FIELD_ANSWER_AUDIO', 'WAV chunk exceeds carrier');
    }
    if (id === 'fmt ' && size >= 16) {
      format = {
        audioFormat: bytes.readUInt16LE(body),
        channels: bytes.readUInt16LE(body + 2),
        sampleRate: bytes.readUInt32LE(body + 4),
        bitsPerSample: bytes.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      pcm = bytes.subarray(body, body + size);
    }
    offset = body + size + (size % 2);
  }

  if (
    !format
    || !pcm
    || format.audioFormat !== 1
    || format.channels !== CHANNELS
    || format.sampleRate !== SAMPLE_RATE
    || format.bitsPerSample !== BITS_PER_SAMPLE
    || pcm.length === 0
    || pcm.length % BYTES_PER_FRAME !== 0
  ) {
    fail(
      'INVALID_FIELD_ANSWER_AUDIO',
      'field answer requires canonical 44.1kHz stereo 16-bit PCM WAV',
    );
  }
  return { pcm, frameCount: pcm.length / BYTES_PER_FRAME };
}

function q15(value) {
  return Math.max(0, Math.min(32767, Math.round(value * 32767)));
}

function signalProfile(pcm, frameCount) {
  const quarterEnergy = [0, 0, 0, 0];
  const quarterSamples = [0, 0, 0, 0];
  let peak = 0;
  let zeroCrossings = 0;
  let previous = null;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const left = pcm.readInt16LE(frame * BYTES_PER_FRAME);
    const right = pcm.readInt16LE(frame * BYTES_PER_FRAME + 2);
    const leftNormalized = left / 32768;
    const rightNormalized = right / 32768;
    const quarter = Math.min(3, Math.floor((frame * 4) / frameCount));
    quarterEnergy[quarter] += (
      leftNormalized * leftNormalized
      + rightNormalized * rightNormalized
    ) / 2;
    quarterSamples[quarter] += 1;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    if (
      previous !== null
      && ((previous < 0 && left >= 0) || (previous >= 0 && left < 0))
    ) {
      zeroCrossings += 1;
    }
    previous = left;
  }

  const rmsQuartilesQ15 = quarterEnergy.map((sum, index) => {
    const count = quarterSamples[index];
    return q15(Math.sqrt(sum / Math.max(1, count)));
  });
  const zeroCrossingPpm = frameCount > 1
    ? Math.round((zeroCrossings / (frameCount - 1)) * 1_000_000)
    : 0;

  return {
    frameCount,
    durationMs: (frameCount * 1000) / SAMPLE_RATE,
    rmsQuartilesQ15,
    peakQ15: q15(peak / 32768),
    zeroCrossingPpm,
  };
}

function proposalFromProfile({ profile, audioSha256, seed, evidenceHash }) {
  const digest = createHash('sha256')
    .update(`field-answer/v0\0${seed}\0${audioSha256}`, 'utf8')
    .digest();

  const base = 48 + (digest[0] % 12);
  const pitches = [base];
  for (let index = 1; index < 4; index += 1) {
    const delta = profile.rmsQuartilesQ15[index] - profile.rmsQuartilesQ15[index - 1];
    let interval;
    if (Math.abs(delta) < 500) {
      interval = digest[index] % 2 === 0 ? 2 : -2;
    } else if (delta > 0) {
      interval = [2, 3, 5][digest[index] % 3];
    } else {
      interval = -[2, 3, 5][digest[index] % 3];
    }
    pitches.push(Math.max(36, Math.min(84, pitches[index - 1] + interval)));
  }

  const activity = Math.max(0, Math.min(1, profile.zeroCrossingPpm / 300_000));
  const tempoBpm = 76 + Math.round(activity * 40);
  const durationsQuarter = profile.rmsQuartilesQ15.map((value, index) => {
    const next = profile.rmsQuartilesQ15[Math.min(3, index + 1)];
    return next > value + 1000 ? 0.5 : value > 8000 ? 0.75 : 1;
  });
  const velocities = profile.rmsQuartilesQ15.map((value) =>
    Math.max(48, Math.min(112, 48 + Math.round((value / 32767) * 64)))
  );

  return createProposal({
    subject: 'field-answer-musical-object',
    value: {
      tempoBpm,
      pitches,
      durationsQuarter,
      velocities,
      synthesis: 'sine-plus-second-harmonic/v0',
    },
    parentRefs: [evidenceHash],
    proposer: { id: 'field-answer-001' },
    policy: {
      id: 'bounded-signal-contour-to-musical-proposal',
      version: '0',
    },
  });
}

function performanceFromProposal({ sourceHash, proposal, seed }) {
  const score = {
    schema: 'haunted-phonograph/field-answer-score/v0',
    sourceHash,
    proposal,
    law: 'signal-contour-answer/v0',
  };
  const scoreHash = hashCanonical(score);
  const ppq = 480;
  let tick = 0;
  const events = proposal.value.pitches.map((note, index) => {
    const durationTicks = Math.max(
      1,
      Math.round(proposal.value.durationsQuarter[index] * ppq),
    );
    const event = {
      tick,
      durationTicks,
      note,
      velocity: proposal.value.velocities[index],
      channel: 0,
      provenance: recordRealization({
        sourceClaim: proposal,
        value: note,
        resolver: { id: 'field-answer-performance-resolver', version: '0' },
      }),
    };
    tick += durationTicks;
    return event;
  });
  return {
    schema: 'haunted-phonograph/resolved-performance/v1',
    sourceHash,
    scoreHash,
    tempoBpm: proposal.value.tempoBpm,
    ppq,
    mutation: {
      law: 'signal-contour-answer/v0',
      stream: 'field-station/musical-answer/v0',
      seed,
      selectedOffset: 0,
    },
    events,
    retainedUncertaintyRefs: [],
  };
}

function wavHeader(dataBytes) {
  const buffer = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * BYTES_PER_FRAME;
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(BYTES_PER_FRAME, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

function renderAudition(performance) {
  const secondsPerQuarter = 60 / performance.tempoBpm;
  const eventEnds = performance.events.map((event) =>
    ((event.tick + event.durationTicks) / performance.ppq) * secondsPerQuarter
  );
  const durationSeconds = Math.max(...eventEnds) + 0.08;
  const frameCount = Math.ceil(durationSeconds * SAMPLE_RATE);
  const pcm = Buffer.alloc(frameCount * BYTES_PER_FRAME);

  for (const event of performance.events) {
    const startSeconds = (event.tick / performance.ppq) * secondsPerQuarter;
    const noteSeconds = (event.durationTicks / performance.ppq) * secondsPerQuarter;
    const start = Math.floor(startSeconds * SAMPLE_RATE);
    const end = Math.min(frameCount, Math.floor((startSeconds + noteSeconds) * SAMPLE_RATE));
    const frequency = 440 * (2 ** ((event.note - 69) / 12));
    const gain = (event.velocity / 127) * 0.26;

    for (let frame = start; frame < end; frame += 1) {
      const local = (frame - start) / SAMPLE_RATE;
      const remaining = (end - frame) / SAMPLE_RATE;
      const attack = Math.min(1, local / 0.012);
      const release = Math.min(1, remaining / 0.045);
      const envelope = Math.min(attack, release);
      const sampleValue = (
        Math.sin(2 * Math.PI * frequency * local)
        + 0.22 * Math.sin(4 * Math.PI * frequency * local)
      ) * gain * envelope;
      const sample = Math.max(-32767, Math.min(32767, Math.round(sampleValue * 32767)));
      pcm.writeInt16LE(sample, frame * BYTES_PER_FRAME);
      pcm.writeInt16LE(sample, frame * BYTES_PER_FRAME + 2);
    }
  }

  return Buffer.concat([wavHeader(pcm.length), pcm]);
}

export function buildFieldAnswer(request) {
  exactKeys(request, ['schema', 'window', 'seed'], 'INVALID_FIELD_ANSWER_REQUEST');
  if (request.schema !== REQUEST_SCHEMA) {
    fail('INVALID_FIELD_ANSWER_REQUEST', 'unsupported field-answer request schema');
  }
  if (typeof request.seed !== 'string' || request.seed.trim().length === 0) {
    fail('INVALID_FIELD_ANSWER_SEED', 'non-empty deterministic seed required');
  }
  exactKeys(
    request.window,
    [
      'window_id',
      'audio_sha256',
      'source_sha256',
      'requested_bounds',
      'duration_ms',
      'media_type',
      'base64',
    ],
    'INVALID_FIELD_ANSWER_WINDOW',
  );
  if (
    typeof request.window.window_id !== 'string'
    || !request.window.window_id.startsWith('autodisco-audio-window-v0:')
    || !/^[0-9a-f]{64}$/.test(request.window.audio_sha256)
    || !/^[0-9a-f]{64}$/.test(request.window.source_sha256)
    || request.window.media_type !== 'audio/wav'
    || typeof request.window.base64 !== 'string'
  ) {
    fail('INVALID_FIELD_ANSWER_WINDOW', 'invalid audio-window identity');
  }
  exactKeys(
    request.window.requested_bounds,
    ['start_ms', 'end_ms'],
    'INVALID_FIELD_ANSWER_BOUNDS',
  );

  let bytes;
  try {
    bytes = Buffer.from(request.window.base64, 'base64');
  } catch {
    fail('INVALID_FIELD_ANSWER_AUDIO', 'invalid base64');
  }
  if (sha256Bytes(bytes) !== request.window.audio_sha256) {
    fail('FIELD_ANSWER_AUDIO_DIGEST_MISMATCH', 'audio bytes do not match window digest');
  }

  const { pcm, frameCount } = parseCanonicalWav(bytes);
  const profile = signalProfile(pcm, frameCount);
  if (
    !Number.isFinite(request.window.duration_ms)
    || Math.abs(profile.durationMs - request.window.duration_ms) > (1000 / SAMPLE_RATE) + 1e-9
  ) {
    fail('FIELD_ANSWER_DURATION_MISMATCH', 'declared duration does not match canonical frames');
  }

  const sourceHash = `sha256:${request.window.audio_sha256}`;
  const signalEvidence = createEvidence({
    subject: 'bounded-pcm-signal-profile',
    value: profile,
    sourceRefs: [sourceHash],
    method: { id: 'canonical-pcm-signal-profile', version: '0' },
  });
  const signalEvidenceHash = hashCanonical(signalEvidence);
  const proposal = proposalFromProfile({
    profile,
    audioSha256: request.window.audio_sha256,
    seed: request.seed,
    evidenceHash: signalEvidenceHash,
  });
  const performance = performanceFromProposal({
    sourceHash,
    proposal,
    seed: request.seed,
  });
  const midiBytes = encodeMidi(performance);
  const auditionBytes = renderAudition(performance);

  const receiptBody = {
    schema: 'haunted-phonograph/field-answer-receipt/v0',
    status: 'proposal-ready',
    source_window: {
      window_id: request.window.window_id,
      audio_sha256: request.window.audio_sha256,
      source_sha256: request.window.source_sha256,
      requested_bounds: request.window.requested_bounds,
      duration_ms: request.window.duration_ms,
    },
    signal_evidence_hash: signalEvidenceHash,
    proposal_hash: hashCanonical(proposal),
    resolved_performance_hash: hashCanonical(performance),
    seed: request.seed,
    midi: {
      sha256: `sha256:${sha256Bytes(midiBytes)}`,
      byte_length: midiBytes.length,
      profile: 'smf0-ppq480/v1',
    },
    audition: {
      sha256: `sha256:${sha256Bytes(auditionBytes)}`,
      byte_length: auditionBytes.length,
      media_type: 'audio/wav',
      renderer: 'sine-plus-second-harmonic/v0',
    },
    laws: [
      'SIGNAL FACT != MUSICAL MEANING',
      'PROPOSAL != SOURCE EVIDENCE',
      'RESPONSE != REMIX',
      'AUDITION != ADMISSION',
      'DIGEST-SEEDED CHOICE != HEARD PITCH',
    ],
  };
  const receipt = {
    ...receiptBody,
    receipt_hash: hashCanonical(receiptBody),
  };

  return {
    schema: RESULT_SCHEMA,
    status: 'proposal-ready',
    source_window_ref: receipt.source_window,
    evidence: {
      signal_profile: signalEvidence,
      signal_profile_hash: signalEvidenceHash,
    },
    proposal,
    performance,
    midi: {
      ...receipt.midi,
      base64: midiBytes.toString('base64'),
    },
    audition: {
      ...receipt.audition,
      base64: auditionBytes.toString('base64'),
    },
    receipt,
    laws: [
      ...receipt.laws,
      'FIELD ANSWER != HOUSE CROSSING',
      'MUSICAL POSSIBILITY != RECOMMENDATION',
    ],
  };
}

export function canonicalFieldAnswer(result) {
  return canonicalStringify(result);
}
