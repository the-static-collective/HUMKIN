import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {rankCandidates,classify,eligibleTrack,compostLink,proposalReceipt} from "../fm/manage/signal-relay-model.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const tracks=Array.from({length:26},(_,i)=>({
  id:"song-"+String(i+1).padStart(2,"0"),kind:"song",title:"Track "+(i+1),artist:"Artist"
}));
const library=tracks.map(t=>({...t,album:"Album",published:true,enabled:true}));
const scores=tracks.map((t,i)=>({id:t.id,plays:i,ratings:0,stars:null,dance:0}));

test("Compost relay prioritizes genuinely less-heard works and cannot duplicate slots",()=>{
  const ranked=rankCandidates(tracks,scores,library,20);
  assert.equal(ranked.length,20);
  assert.equal(new Set(ranked.map(t=>t.id)).size,20);
  assert.equal(ranked[0].id,"song-01");
  assert.equal(ranked[13].id,"song-14");
  assert.equal(ranked[0].lane,"UNDERHEARD");
});
test("response-supported songs may enter minority candidate seats, but need minimum evidence",()=>{
  const s=scores.map(x=>({...x}));
  s[25]={id:"song-26",plays:1000,ratings:2,stars:5,dance:2};
  const ranked=rankCandidates(tracks,s,library,20);
  assert.ok(ranked.some(t=>t.id==="song-26"&&t.lane==="DANCE CONTENDER"));
  const lowEvidence=s.map(x=>({...x}));
  lowEvidence[25]={id:"song-26",plays:1000,ratings:1,stars:5,dance:1};
  assert.ok(!rankCandidates(tracks,lowEvidence,library,20).some(t=>t.id==="song-26"));
  assert.equal(classify({plays:1,ratings:3,stars:4.5,dance:0}).lane,"RETURN LISTEN");
});
test("unpublished, hidden, spoken, stale or bogus IDs are not candidates or shareable",()=>{
  const altered=library.map(t=>({...t}));
  altered[0].enabled=false;
  altered[1].published=false;
  altered[2].kind="bumper";
  assert.ok(!rankCandidates(tracks,scores,altered,20).some(t=>["song-01","song-02","song-03"].includes(t.id)));
  assert.equal(eligibleTrack({id:"../secrets",kind:"song"}),false);
  assert.throws(()=>compostLink("https://humkin.abundent.org/fm/manage/","../secrets"));
  assert.equal(rankCandidates([{id:"x",kind:"song"}],[],[],20).length,0);
});
test("permalink is catalog-ID based, with no source URL or auto-play flag",()=>{
  const link=compostLink("https://humkin.abundent.org/fm/manage/","song-01");
  assert.equal(link,"https://humkin.abundent.org/fmstudio/?compost=song-01");
  const js=read("fmstudio/compost.js");
  assert.match(js,/linkedPending/);
  assert.match(js,/listen\.addEventListener\("click"/);
  assert.match(js,/const linked = linkedPending \? tracks\.find/);
  assert.doesNotMatch(link,/autoplay|media\.abundent\.org/);
});
test("editorial receipt never claims publication, votes or physical fulfillment",()=>{
  const row=rankCandidates(tracks,scores,library,20)[0];
  const receipt=proposalReceipt(row,"opened_paused_editor","2026-11-18T20:30:00.000Z");
  assert.equal(receipt.schema,"humkin.signal-relay.proposal/v1");
  assert.equal(receipt.broadcast_status,"not_published_by_relay");
  assert.match(receipt.verification,/operator-local/);
  assert.throws(()=>proposalReceipt(row,"published"));
});
test("only the existing owner-authorized manager mounts relay and retains explicit inactive show draft",()=>{
  const manager=read("fm/manage/manager.js"),html=read("fm/manage/index.html"),ui=read("fm/manage/signal-relay-ui.js");
  assert.ok(manager.indexOf("await requireOwner()")<manager.indexOf("void mountSignalRelay({library,preparePausedShow})"));
  assert.match(manager,/\$\("show-active"\)\.checked=false; \/\/ Explicit owner activation/);
  assert.match(ui,/preparePausedShow\(row\)/);
  assert.match(ui,/source:"public humkin-compost aggregate/);
  assert.match(html,/id="signal-relay-results"/);
  assert.match(html,/id="signal-relay-export"/);
  assert.doesNotMatch(ui,/\.from\("humkin_radio_programs"\).*insert/);
  assert.doesNotMatch(read("fmstudio/compost.js"),/window\.location\.replace/);
});
