function fail(code, message) {
  const error = new TypeError(message);
  error.code = code;
  throw error;
}

function encodeVlq(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) {
    fail('INVALID_MIDI_DELTA', 'MIDI delta must be an integer in 0..0x0fffffff');
  }
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return Buffer.from(bytes);
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16BE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}

export function encodeMidi(performance) {
  if (performance?.schema !== 'haunted-phonograph/resolved-performance/v1') {
    fail('INVALID_PERFORMANCE', 'MIDI exporter requires ResolvedPerformance v1');
  }
  if (!Number.isInteger(performance.ppq) || performance.ppq <= 0 || performance.ppq > 0x7fff) {
    fail('INVALID_PERFORMANCE', 'ppq must be a positive metrical division');
  }
  const mpqn = Math.round(60_000_000 / performance.tempoBpm);
  if (!Number.isInteger(mpqn) || mpqn <= 0 || mpqn > 0xffffff) {
    fail('INVALID_PERFORMANCE', 'tempo cannot be represented as MIDI tempo meta event');
  }

  const timeline = [{
    tick: 0,
    priority: 0,
    bytes: Buffer.from([0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff]),
  }];
  for (const event of performance.events) {
    const { tick, durationTicks, note, velocity, channel } = event;
    if (![tick, durationTicks, note, velocity, channel].every(Number.isInteger)
      || tick < 0 || durationTicks <= 0 || note < 0 || note > 127
      || velocity < 1 || velocity > 127 || channel < 0 || channel > 15) {
      fail('INVALID_PERFORMANCE_EVENT', 'resolved note event is not MIDI-projectable');
    }
    timeline.push({ tick, priority: 2, bytes: Buffer.from([0x90 | channel, note, velocity]) });
    timeline.push({ tick: tick + durationTicks, priority: 1, bytes: Buffer.from([0x80 | channel, note, 0]) });
  }
  timeline.sort((a, b) => a.tick - b.tick || a.priority - b.priority);

  let previousTick = 0;
  const trackParts = [];
  for (const event of timeline) {
    trackParts.push(encodeVlq(event.tick - previousTick), event.bytes);
    previousTick = event.tick;
  }
  trackParts.push(Buffer.from([0x00, 0xff, 0x2f, 0x00]));
  const track = Buffer.concat(trackParts);
  const header = Buffer.concat([
    Buffer.from('MThd', 'ascii'),
    u32(6),
    u16(0),
    u16(1),
    u16(performance.ppq),
  ]);
  return Buffer.concat([
    header,
    Buffer.from('MTrk', 'ascii'),
    u32(track.length),
    track,
  ]);
}
