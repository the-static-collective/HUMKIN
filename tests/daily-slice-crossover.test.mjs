import assert from 'node:assert/strict';
import { test } from 'node:test';
import { digest, preview } from '../tools/crossover/daily-slice.mjs';

const candidate = {
  schema: 'static-collective.crossover-record/v1', kind: 'story',
  source: {
    repository: 'the-static-collective/the-daily-slice',
    revision: 'a'.repeat(40), path: 'slices/2026/09/2026-09-17/example.md', sha256: 'b'.repeat(64),
  },
  posture: 'SPECULATION', credit: 'The Daily Slice', title: 'Example', script: 'A possible reading.',
};
const encode = value => Buffer.from(JSON.stringify(value));
const bytes = encode(candidate);
const review = {
  schema: 'humkin.editorial-review/v1', candidateSha256: digest(bytes),
  decision: 'APPROVED', scope: 'PRIVATE_TEXT_PREVIEW', reviewerRef: 'editor-001',
  optInRef: 'consent-001', rightsRef: 'rights-001',
  reviewedAt: '2026-11-18T10:00:00.000Z', expiresAt: '2026-11-18T12:00:00.000Z',
};
const options = { enabled: true, now: Date.parse('2026-11-18T11:00:00.000Z') };

test('returns a deterministic, attributable HOLD rundown with speculation in spoken copy', () => {
  const result = preview(bytes, review, options);
  assert.deepEqual(result, preview(bytes, review, options));
  assert.match(result.rundown, /PRIVATE EDITORIAL PREVIEW \| HOLD/);
  assert.match(result.rundown, /The Daily Slice on HUMKIN\. SPECULATION\. A possible reading\./);
  assert.ok(result.rundown.includes(candidate.source.revision + '/' + candidate.source.path));
  assert.deepEqual(result.receipt.source, candidate.source);
  assert.equal(result.receipt.rundownSha256, digest(result.rundown));
  assert.equal(result.receipt.broadcastAuthorized, false);
  assert.doesNotMatch(JSON.stringify(result), /editor-001|consent-001|rights-001/);
});

test('defaults off and denies missing, revoked, expired, future, wrong-scope or stale review', () => {
  assert.throws(() => preview(bytes, review), /disabled/);
  for (const value of [undefined, { ...review, decision: 'REVOKED' },
    { ...review, scope: 'RADIO' }, { ...review, rightsRef: '' }, { ...review, optInRef: '' },
    { ...review, expiresAt: '2026-11-18T11:00:00.000Z' },
    { ...review, reviewedAt: '2026-11-18T11:00:01.000Z' }]) {
    assert.throws(() => preview(bytes, value, options), /operator review/);
  }
  assert.throws(() => preview(encode({ ...candidate, script: 'Changed' }), review, options), /exact bytes/);
});

test('rejects injected metadata, unsafe text and invalid or mutable source pointers', () => {
  for (const value of [{ ...candidate, audioUrl: 'https://example.test/private.wav' },
    { ...candidate, script: 'Safe\nforged heading' }, { ...candidate, posture: 'TRUE' },
    { ...candidate, source: { ...candidate.source, revision: 'main' } },
    { ...candidate, source: { ...candidate.source, path: 'slices/2026/09/2026-09-17/../secret.md' } }]) {
    const invalid = encode(value);
    assert.throws(() => preview(invalid, { ...review, candidateSha256: digest(invalid) }, options),
      /Invalid (Daily Slice story|source pointer)/);
  }
});
