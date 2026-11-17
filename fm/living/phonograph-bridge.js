/* Receipted Phonograph candidate -> HUMKIN editorial HOLD boundary.
 * This consumer never promotes a musical proposal to public radio.
 */
(function (root) {
'use strict';
const SCHEMA = 'humkin.phonograph-candidate/v1';
const SHA = /^sha256:[a-f0-9]{64}$/;
const ID = /^hp-[a-f0-9]{16}$/;
const safeKey = /^candidates\/hp-[a-f0-9]{16}\/mix\.wav$/;
function assert(ok, label) { if (!ok) throw Error('Phonograph handoff refused: ' + label); }
function validate(candidate, tracks) {
  assert(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'invalid JSON object');
  assert(candidate.schema === SCHEMA, 'unrecognized schema');
  assert(ID.test(candidate.candidateId), 'invalid candidate ID');
  assert(typeof candidate.title === 'string' && candidate.title.trim() && candidate.title.length <= 180, 'invalid title');
  assert(candidate.artist === 'HUMKIN', 'not a HUMKIN source candidate');
  assert(SHA.test(candidate.sourcePlanId) && SHA.test(candidate.receiptSha256) && SHA.test(candidate.outputSha256), 'missing provenance hashes');
  assert(candidate.candidateId === 'hp-' + candidate.sourcePlanId.slice(7, 23), 'plan / candidate identity mismatch');
  assert(candidate.editorialStatus === 'HOLD' && candidate.broadcastingAuthorized === false, 'not held for review');
  assert(candidate.publicUrl === null, 'public playback is not authorized by this bridge');
  assert(candidate.privateR2Key === null || safeKey.test(candidate.privateR2Key), 'unrecognized private R2 object key');
  assert(Array.isArray(candidate.sourceSongIds) && candidate.sourceSongIds.length >= 2 && candidate.sourceSongIds.length <= 8,
    'must cite at least two source songs');
  const catalog = new Map((tracks || []).map(t => [t.id, t]));
  const songIds = new Set();
  for (const id of candidate.sourceSongIds) {
    assert(typeof id === 'string' && catalog.has(id) && !songIds.has(id), 'source recording not in HUMKIN published catalog');
    songIds.add(id);
  }
  assert(Array.isArray(candidate.rightsRefs) && candidate.rightsRefs.length > 0 && candidate.rightsRefs.length <= 8,
    'missing owner rights references');
  for (const ref of candidate.rightsRefs) assert(typeof ref === 'string' && ref.trim() && ref.length <= 240, 'invalid rights reference');
  return {
    schema: SCHEMA, candidateId: candidate.candidateId, title: candidate.title.trim(),
    artist: 'HUMKIN', sourcePlanId: candidate.sourcePlanId,
    sourceSongIds: [...candidate.sourceSongIds], sourceSongTitles: [...songIds].map(id => catalog.get(id).title),
    receiptSha256: candidate.receiptSha256, outputSha256: candidate.outputSha256,
    rightsRefs: [...candidate.rightsRefs], privateR2Key: candidate.privateR2Key,
    status: 'HOLD', publicUrl: null, broadcastingAuthorized: false,
    caveat: 'Imported manifest only; audio bytes and receipt hash not independently checked here.',
  };
}
const api = Object.freeze({ SCHEMA, validate });
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.HUMKIN_PHONOGRAPH = api;
})(typeof window !== 'undefined' ? window : globalThis);
