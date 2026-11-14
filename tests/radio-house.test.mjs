import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const read=p=>readFileSync(p,"utf8");
const H=require("../fm/network/network.js");
const N=require("../fm/hosted-nowplaying.js");
const source=JSON.parse(read("fm/network/sources.json"));
const worlds=H.validate(source);
assert.equal(worlds.length,3);
assert.deepEqual(worlds.map(w=>w.id),["humkin","kinship","rock-impact"]);
assert.equal(worlds[0].relationship,"this_station");
assert(worlds.slice(1).every(w=>w.relationship==="independent_source_world"&&
  w.live_audio===null&&w.rebroadcast_permission==="not_granted"),
  "Rock Impact and Kinship must never be rebroadcast without permission");
assert.equal(H.https("http://fake.invalid/"),null);
assert.equal(H.https("javascript:alert(1)"),null);
assert.throws(()=>H.validate({...source,worlds:[...source.worlds.slice(0,2),
  {...source.worlds[2],live_audio:"https://rockimpactmakersglobal.org/stream.mp3"}]}),
  /Third-party audio/);
assert.throws(()=>H.validate({...source,editorial_contract:
  {...source.editorial_contract,no_partner_claim:false}}),/Unauthorized|unauthorized/);
execFileSync(process.execPath,["--check","fm/network/network.js"]);
execFileSync(process.execPath,["--check","fm/network/page.js"]);
execFileSync(process.execPath,["--check","fm/hosted-nowplaying.js"]);
const np=N.parse({
  is_online:true,
  now_playing:{played_at:1790000000,song:{title:"Home With You",
  artist:"HUMKIN",art:"https://radio.example.org/cover.jpg"}},
  listeners:{current:13}
});
assert(np.online&&np.title==="Home With You"&&np.artist==="HUMKIN"&&np.listeners===13);
assert.equal(np.artwork,"https://radio.example.org/cover.jpg");
assert.equal(N.parse({is_online:false,now_playing:{song:{title:"X",art:"javascript:evil()"}},
 listeners:{current:-10}}).artwork,null);
assert.equal(N.parse(null),null);
const page=read("fm/network/index.html"),radio=read("fm/radio.js"),html=read("fm/index.html"),sw=read("sw.js");
assert(page.includes('id="worlds"')&&page.includes('id="transmitter"'));
assert(page.includes("not a merger")||page.includes("not a merger of ministries"));
assert(page.includes("no")||page.includes("No"));
assert(html.includes('href="./network/"'),"Main radio must link Radio House");
assert(html.indexOf('hosted-nowplaying.js')<html.indexOf('radio.js'),
 "Hosted metadata helper must precede radio bootstrap");
assert(radio.includes("refreshHostedMetadata"),"Radio should update hosted now playing");
assert(radio.includes("live_nowplaying_url"),"Stream metadata must use configured public source");
const config=JSON.parse(read("fm/rotation.json"));
assert.equal(config.live_stream_url,null,"No unverified host or stream should be published");
assert.equal(config.live_nowplaying_url,null,"No unverified metadata endpoint should be published");
for(const path of ["./fm/network/sources.json","./fm/network/network.js","./fm/network/page.js","./fm/hosted-nowplaying.js"])
 assert(sw.includes('"'+path+'"'),"New browser assets must be precached: "+path);
console.log("Radio House test passed: independent rights, live-stream gate, UI, now-playing metadata and config defaults.");
