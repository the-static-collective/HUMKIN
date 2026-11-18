import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../fm/long-wave/hls.html", import.meta.url), "utf8");
const match = /<script>\s*([\s\S]*?)<\/script>/.exec(html);
assert.ok(match, "Receiver has its own executable script");
const script = new vm.Script(match[1], { filename: "hls-receiver-inline.js" });

function fixture(initialOnline = true) {
  const elements = new Map();
  for (const id of ["receiver","url","status","auto-rescue","backup","retry-live","connect"]) {
    elements.set(id,{ handlers:{}, value:"", textContent:"", checked:id==="auto-rescue",
      addEventListener(name,fn){this.handlers[name]=fn;} });
  }
  const audio=elements.get("receiver");
  audio.paused=true;
  audio.pause=()=>{audio.paused=true;};
  audio.load=()=>{};
  audio.removeAttribute=()=>{audio.src="";};
  audio.canPlayType=()=>""; // force hls.js path, as in desktop Chromium
  audio.play=async()=>{audio.paused=false;audio.handlers.playing?.();};
  let hlsPlayer, monitoring, online=initialOnline, calls=0;
  class FakeHls {
    static isSupported(){return true}
    static Events={ERROR:"error"}
    constructor(){hlsPlayer=this;this.destroyed=false}
    loadSource(url){this.source=url}
    attachMedia(media){this.audio=media}
    on(event,fn){if(event==="error")this.onError=fn}
    destroy(){this.destroyed=true}
  }
  const context={
    document:{querySelector:id=>elements.get(id.replace(/^#/,""))},
    window:{Hls:FakeHls}, URL, AbortController, Promise,
    localStorage:{setItem(){},getItem(){return ""}},
    fetch:async()=>{calls++;return new Response("",{status:online?200:503})},
    Response,
    setTimeout:()=>1,clearTimeout:()=>{},
    setInterval:fn=>{monitoring=fn;return 2}
  };
  script.runInNewContext(context,{timeout:1000});
  const click=id=>elements.get(id).handlers.click();
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
  return {elements,audio,click,flush,setOnline:v=>{online=v},
    monitor:()=>monitoring(),hls:()=>hlsPlayer,calls:()=>calls};
}

test("invalid endpoint never fetches remote audio", async()=>{
  const f=fixture();
  f.elements.get("url").value="http://evil.example/hls/live.m3u8";
  f.click("connect");
  await f.flush();
  assert.equal(f.calls(),0);
  assert.match(f.elements.get("status").textContent,/public HTTPS/);
});

test("fresh shared station does not autoplay and can be rescued on fatal HLS failure",async()=>{
  const f=fixture();
  f.elements.get("url").value="https://humkin-long-wave.example.workers.dev/hls/live.m3u8";
  f.click("connect");
  await f.flush();
  assert.equal(f.audio.paused,true,"connection must not start sound");
  assert.equal(f.hls().source,f.elements.get("url").value);
  await f.audio.play(); // User presses play
  f.hls().onError("error",{fatal:true,type:"networkError"});
  await f.flush();
  assert.equal(f.audio.src,"https://humkin-long-wave.example.workers.dev/live.mp3");
  assert.equal(f.audio.paused,false,"resume after user-started audio");
  assert.equal(f.hls().destroyed,true);
  assert.match(f.elements.get("status").textContent,/Long Wave/);
});

test("two stale status checks rescue instead of abandoning a playing listener",async()=>{
  const f=fixture();
  f.elements.get("url").value="https://humkin-long-wave.example.workers.dev/hls/live.m3u8";
  f.click("connect");await f.flush();
  await f.audio.play();
  f.setOnline(false);
  await f.monitor();
  assert.notEqual(f.audio.src,"https://humkin-long-wave.example.workers.dev/live.mp3");
  await f.monitor();await f.flush();
  assert.equal(f.audio.src,"https://humkin-long-wave.example.workers.dev/live.mp3");
});

test("offline station selects backup without autoplay",async()=>{
  const f=fixture(false);
  f.elements.get("url").value="https://humkin-long-wave.example.workers.dev/hls/live.m3u8";
  f.click("connect");await f.flush();
  assert.equal(f.audio.src,"https://humkin-long-wave.example.workers.dev/live.mp3");
  assert.equal(f.audio.paused,true);
});
