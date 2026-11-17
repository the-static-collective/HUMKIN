import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const B = require('../fm/living/phonograph-bridge.js');
const tracks = JSON.parse(readFileSync('fm/rotation.json', 'utf8')).tracks;
const plan = 'sha256:' + 'a'.repeat(64);
const example = {
  schema: B.SCHEMA, candidateId: 'hp-' + 'a'.repeat(16), title: 'Two songs remember',
  artist: 'HUMKIN', sourceSongIds: [tracks[0].id, tracks[1].id], sourcePlanId: plan,
  receiptSha256: 'sha256:' + 'b'.repeat(64), outputSha256: 'sha256:' + 'c'.repeat(64),
  rightsRefs: ['owner-HUMKIN-2026-11-17'], privateR2Key: 'candidates/hp-' + 'a'.repeat(16) + '/mix.wav',
  publicUrl: null, editorialStatus: 'HOLD', broadcastingAuthorized: false,
};
const candidate = B.validate(example, tracks);
assert.equal(candidate.status, 'HOLD');
assert.equal(candidate.broadcastingAuthorized, false);
assert.equal(candidate.publicUrl, null);
assert.deepEqual(candidate.sourceSongTitles, [tracks[0].title, tracks[1].title]);
for (const [wrong, expected] of [
  [{ ...example, broadcastingAuthorized: true }, /held for review/],
  [{ ...example, publicUrl: 'https://example.org/fake.wav' }, /public playback/],
  [{ ...example, sourceSongIds: [tracks[0].id, 'not-a-track'] }, /not in HUMKIN/],
  [{ ...example, privateR2Key: '../secrets' }, /private R2/],
  [{ ...example, candidateId: 'hp-' + 'f'.repeat(16) }, /identity mismatch/],
  [{ ...example, outputSha256: 'unverified' }, /provenance hashes/],
  [{ ...example, rightsRefs: [] }, /rights/],
]) assert.throws(() => B.validate(wrong, tracks), expected);
for (const path of ['fm/living/phonograph-bridge.js', 'fm/living/phonograph-desk.js']) {
  execFileSync(process.execPath, ['--check', path]);
}
const page = readFileSync('fm/living/phonograph.html', 'utf8');
assert(page.includes('id="handoff"'));
assert(page.includes('./phonograph-bridge.js'));
assert(!page.includes('autoplay') && !page.includes('supabase.co'));
console.log('HUMKIN Phonograph HOLD bridge checks pass.');
