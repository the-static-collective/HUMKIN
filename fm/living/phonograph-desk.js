/* Private local candidate reception. No remote APIs or automatic publication. */
(async function () {
'use strict';
const KEY = 'humkin.phonograph-held/v1';
const $ = id => document.getElementById(id);
const catalogResponse = await fetch('../rotation.json', { cache: 'no-store' });
if (!catalogResponse.ok) { $('message').textContent = 'Could not load published catalog.'; return; }
const data = await catalogResponse.json();
const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
let candidates = [];
function say(s) { $('message').textContent = s; }
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(saved)) {
      for (const entry of saved.slice(0, 50)) {
        try { candidates.push(window.HUMKIN_PHONOGRAPH.validate({
          ...entry, editorialStatus: entry.status,
        }, tracks)); } catch {}
      }
    }
  } catch { say('Local storage unavailable; imports still work for this session.'); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(candidates)); }
  catch { say('Could not save local state; export a backup.'); }
}
function el(tag, string) {
  const node = document.createElement(tag);
  if (string !== undefined) node.textContent = String(string);
  return node;
}
function render() {
  const host = $('candidates');
  host.replaceChildren();
  if (!candidates.length) { host.append(el('p', 'Nothing in HOLD yet.')); return; }
  for (const candidate of [...candidates].reverse()) {
    const card = el('article');
    card.append(el('strong', candidate.title + ' · HOLD'));
    card.append(el('p', 'Source songs: ' + candidate.sourceSongTitles.join(' + ')));
    card.append(el('small', 'Candidate: ' + candidate.candidateId));
    card.append(el('small', 'Output: ' + candidate.outputSha256));
    card.append(el('small', 'Receipt: ' + candidate.receiptSha256));
    card.append(el('small', 'Private object: ' + (candidate.privateR2Key || 'not yet uploaded')));
    card.append(el('small', 'Manifest only · NO AIR AUTHORIZATION'));
    const remove = el('button', 'REMOVE LOCAL NOTE');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      candidates = candidates.filter(c => c.candidateId !== candidate.candidateId);
      save(); render();
    });
    card.append(el('p')).lastChild.append(remove);
    host.append(card);
  }
}
function download(data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'humkin-phonograph-held.json';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('handoff').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 100000) throw Error('Import exceeds 100 KB');
    const manifest = JSON.parse(await file.text());
    const entry = window.HUMKIN_PHONOGRAPH.validate(manifest, tracks);
    if (candidates.some(c => c.candidateId === entry.candidateId)) throw Error('Candidate already in this browser');
    if (candidates.length >= 50) throw Error('Export/remove an older item before adding more');
    candidates.push(entry); save(); render();
    say('Imported ' + entry.candidateId + ' in HOLD. No stream or catalog change.');
  } catch (error) {
    say('HOLD: ' + error.message);
  } finally { event.target.value = ''; }
});
$('export').addEventListener('click', () => download({ schema: KEY, status: 'private_producer_review_only', candidates }));
load(); render();
})();
