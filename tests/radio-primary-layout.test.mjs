import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../fm/index.html",import.meta.url),"utf8");
const legacy=html.indexOf('<details class="classic-dial"');
const live=html.indexOf('id="live-station-heading"');

test("the true shared live receiver is the primary station and never autoplays",()=>{
  assert(live>=0 && legacy>live,"Real HLS player must appear before optional browser modes");
  assert(html.includes('id="live-air" controls preload="none"'));
  assert(html.includes('id="live-signal"'));
  assert(html.includes('id="live-source"'));
  assert(html.includes("Song-level now-playing metadata is not transmitted yet"));
  assert(!html.includes("not yet a dedicated broadcast stream"));
});

test("browser-built players remain available behind an explicit separate dial",()=>{
  const end=html.indexOf("</details>",legacy);
  assert(end>legacy,"Legacy browser mode should be collapsible");
  const panel=html.slice(legacy,end);
  for(const id of ["current-art","station-status","desk-heading","current-title",
    "current-artist","mode-clock","mode-shuffle","listen","air","on-deck"]) {
    assert(panel.includes('id="'+id+'"'),"Missing preserved browser dial: "+id);
    assert.equal([...html.matchAll(new RegExp('id="'+id+'"',"g"))].length,1,
      "Duplicate browser dial id: "+id);
  }
  assert(panel.includes("NOT THE ACER BROADCAST"));
  assert(html.includes('id="station-cover"'));
  assert(!html.includes("Now spinning 21 songs:"));
});

test("the main page does not imply that Long Wave shares the live playlist",()=>{
  assert(html.includes("Long Wave plays a different, independent rotation"));
  assert(html.includes("devices may join at different buffered positions"));
  assert(html.includes("The browser playlist below is a separate program"));
});
