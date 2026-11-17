
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>readFileSync(p,'utf8');
for(const p of ['fm/index.html','fm/radio.js','fm/receiver.css','fm/receiver.js','docs/RECEIVER-002.md'])assert(existsSync(p),'missing receiver file '+p);
execFileSync(process.execPath,['--check','fm/receiver.js']);
const html=read('fm/index.html'),js=read('fm/receiver.js'),css=read('fm/receiver.css');
assert(html.includes('id="living-receiver"'),'new receiver must be the visible home of /fm/');
assert(html.includes('<script defer src="./radio.js"></script>'),'canonical radio engine must remain wired');
assert(html.includes('<script defer src="./receiver.js"></script>'),'receiver controller must load');
assert(html.includes('<link rel="stylesheet" href="./receiver.css">'),'receiver styling must load');
assert(css.includes('body>main')&&css.includes('display:none!important'),'old presentation must not compete with the new receiver');
assert(html.includes('id="air"'),'preserve the canonical audio node');
assert(!/<audio[^>]*\sautoplay(?:\s|>)/i.test(html),'never autoplay');
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
for(const match of js.matchAll(/\$\('([^']+)'\)/g))assert(ids.has(match[1]),'new receiver references missing element '+match[1]);
for(const key of [
 'receiver-tuning','receiver-needle','receiver-volume','receiver-band','receiver-mono','receiver-boost',
 'receiver-signal','receiver-current-title','receiver-current-art','receiver-clock','receiver-shuffle',
 'receiver-tunein','receiver-workshop','receiver-workshop-close','receiver-workshop-dismiss'
])assert(ids.has(key),'missing user-facing control '+key);
assert(js.includes('delegate.click()'),'TUNE IN must delegate to the real radio engine');
assert(js.includes('original.click()'),'listening modes must delegate to real engine');
assert(js.includes("audio.pause()"),'tuning off the existing virtual station should stop playback');
assert(js.includes('addEventListener(\'pointerdown\''),'dial must be pointer-operable');
assert(js.includes('addEventListener(\'keydown\''),'dial and workshop must be keyboard-operable');
assert(js.includes('aria-valuetext'),'tuning must be announced accessibly');
assert(js.includes('localStorage.setItem'),'volume adjustment must persist locally');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'respect reduced-motion');
assert(css.includes('@media(max-width:420px)'),'small mobile layout required');
assert(html.includes('Virtual')||html.includes('virtual'),'must label this as virtual frequencies');
assert(!js.includes('new Audio('),'no competing audio engine');
console.log('Receiver 002: new hardware display, active controls, retained engine, mobile/accessibility and virtual station boundary checked.');
