import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';

const catalog=JSON.parse(readFileSync('releases/catalog.json','utf8'));
assert.equal(catalog.version,1);
assert(Array.isArray(catalog.albums) && catalog.albums.length>0);
const ids=new Set();
for(const album of catalog.albums) {
  assert.match(album.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert(!ids.has(album.id),`duplicate album ${album.id}`);ids.add(album.id);
  assert.equal(album.status,'published','the public catalog must never include drafts');
  assert(album.title && album.detail,'a released record needs an actual title and description');
  const prefix=album.id==='mutant-pop'?'/':`/releases/${album.id}/`;
  assert.equal(album.manifest,`${prefix}tracks.json`);
  assert.equal(album.page,prefix);
  assert.equal(album.cover,`${prefix}cover.jpg`);
  for(const address of [album.manifest,album.cover,album.page]) {
    assert(!address.includes('..') && !address.includes('?') && !address.includes('#'));
  }
  const local=album.manifest.replace(/^\//,'');
  const cover=album.cover.replace(/^\//,'');
  const page=album.page==='/'?'index.html':`${album.page.slice(1)}index.html`;
  assert(existsSync(local),`missing published track manifest ${local}`);
  assert(existsSync(cover),`missing published cover ${cover}`);
  assert(existsSync(page),`missing published album page ${page}`);
  const tracks=JSON.parse(readFileSync(local,'utf8'));
  assert.equal(tracks.album,album.title);
  assert(Array.isArray(tracks.tracks)&&tracks.tracks.length>0);
  for(const track of tracks.tracks) {
    assert.match(track.url,/^audio\/[a-zA-Z0-9_.-]+\.mp3$/);
    const full=path.posix.join(path.posix.dirname(local),track.url);
    assert(existsSync(full),`missing released audio ${full}`);
  }
}
assert(ids.has('mutant-pop') && ids.has('everywhere-near-you'));
console.log('HUMKIN published record shelf: live-only index, linked art and playable local previews pass.');
