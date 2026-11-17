import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path,"utf8");
const html=read("fm/iphone/index.html"),ui=read("fm/iphone/iphone.js");
const compat=read("fm/iphone/compat.js"),engine=read("fm/radio.js");
const manifest=JSON.parse(read("fm/iphone/manifest.webmanifest"));
const sw=read("fm/iphone/sw.js"),css=read("fm/iphone/iphone.css");

test("iOS14 standalone install and deliberate listening",()=>{
  for(const meta of [
    'name="apple-mobile-web-app-capable" content="yes"',
    'name="apple-mobile-web-app-title" content="HUMKIN RADIO"',
    'rel="apple-touch-icon"','viewport-fit=cover'
  ])assert.ok(html.includes(meta),meta);
  assert.equal((html.match(/<audio\b/g)||[]).length,1,"one persistent native media element");
  assert.match(html,/<audio id="air" controls preload="metadata"/);
  assert.doesNotMatch(html,/<audio[^>]*\bautoplay\b/);
  assert.equal(manifest.display,"standalone");
  assert.equal(manifest.start_url,"./");
  assert.equal(manifest.scope,"./");
  assert.equal(manifest.icons[0].src,"../../cover.jpg");
});

test("the existing radio engine has all its required DOM IDs",()=>{
  const engineIds=new Set([...engine.matchAll(/\$\(["']([\w-]+)["']\)/g)].map(m=>m[1]));
  const pageIds=new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]));
  const missing=[...engineIds].filter(i=>!pageIds.has(i));
  assert.deepEqual(missing,[]);
  assert.ok(html.indexOf('src="./compat.js"')<html.indexOf('src="../radio.js"'));
});

test("the entire album shelf uses one radio-owned player",()=>{
  assert.match(engine,/function playAlbum\(name,firstId\)/);
  assert.match(engine,/function nextAlbum\(shouldPlay\)/);
  assert.match(engine,/playAlbum,albumCatalog,/);
  assert.match(ui,/\.playAlbum\(name\)/);
  assert.match(ui,/\.changeMode\("clock"\)/);
  assert.match(ui,/MutationObserver\(recordingChange\)/);
  assert.doesNotMatch(ui,/new Audio\s*\(/);
});

test("iOS14 compatibility and network-safe offline shell",()=>{
  assert.match(compat,/HUMKIN_WARM_SIGNAL=/);
  assert.doesNotMatch(compat,/new\\s+(?:window\\.)?(?:AudioContext|webkitAudioContext)\\s*\\(/);
  assert.doesNotMatch(css,/aspect-ratio\s*:/);
  assert.doesNotMatch(css,/\bgap\s*:/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(sw,/pocketreceiver-shell-v1/);
  assert.match(sw,/Always stream songs directly/);
  assert.doesNotMatch(sw,/SAVE_HUMKIN_ALBUM/);
});
