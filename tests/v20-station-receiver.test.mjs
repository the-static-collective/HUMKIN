import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const html=fs.readFileSync("fm/v20/index.html","utf8");
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
const url="https://humkin-long-wave.joyvolcanomusic.workers.dev/stations/autodisco-v20";
function harness(response,fail=false){
  const listeners={};
  const elements={status:{textContent:""},tune:{disabled:true,
    addEventListener(k,fn){listeners["tune:"+k]=fn}},
    audio:{src:"",hidden:true,loaded:false,plays:0,
      addEventListener(k,fn){listeners["audio:"+k]=fn},
      load(){this.loaded=true},
      async play(){this.plays++}}};
  const urls=[];
  const context={
    document:{getElementById:id=>elements[id]},
    AbortController,URL,
    setTimeout:()=>1,clearTimeout:()=>{},
    fetch:async (request)=>{urls.push(request);if(fail)throw Error("offline");return{
      ok:response.ok,json:async()=>response.payload}},
  };
  new vm.Script(script,{filename:"fm/v20/index.html"}).runInNewContext(context);
  const flush=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r))};
  return {elements,listeners,urls,flush};
}
test("receiver refuses to play other stations while original V20 program is absent",async()=>{
  assert.ok(script);
  const h=harness({ok:false,payload:{ok:false,error:"STATION_UNPROGRAMMED",approved_tracks:0}});
  await h.flush();
  assert.equal(h.elements.tune.disabled,true);
  assert.match(h.elements.status.textContent,/first broadcast master|reserved for authentic/i);
  assert.equal(h.elements.audio.src,"");
  assert.equal(h.urls[0],url+"/health");
  assert.equal(html.includes("fm/autodisco/"),false); // link is relative, not an audio fallback
  assert.doesNotMatch(script,/\/stations\/eclectic|\/stations\/spotlight|\/live\.mp3.*\|\|/);
});
test("approved V20-only stream is the exclusive receiver source",async()=>{
  const h=harness({ok:true,payload:{ok:true,station:"autodisco-v20",
    mode:"personal",approved_tracks:2,synchronized:false}});
  await h.flush();
  assert.equal(h.elements.tune.disabled,false);
  h.listeners["tune:click"]();
  await h.flush();
  assert.equal(h.elements.audio.src,url+"/live.mp3");
  assert.equal(h.elements.audio.plays,1);
});
test("missing/deployed wrong service produces honest not-ready state",async()=>{
  const h=harness({},true);
  await h.flush();
  assert.equal(h.elements.tune.disabled,true);
  assert.match(h.elements.status.textContent,/not deployed|unreachable/i);
});
