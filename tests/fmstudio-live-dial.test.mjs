import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync("fmstudio/dial.js","utf8");
const html=readFileSync("fmstudio/index.html","utf8");
const URL_ROOT="https://humkin.abundent.org/fmstudio/";
const REGISTRY="https://humkin-long-wave.joyvolcanomusic.workers.dev/hls/stations";

function fixture(payload) {
  const els=new Map(), events=[];
  class Element {
    constructor(tag,id) {
      this.tagName=tag;this.id=id||"";this.children=[];this.handlers={};
      this.dataset={};this.attributes={};this.hidden=false;this.disabled=false;
      this.href="";this.src="";this.textContent="";this.className="";
      this.removed=false;this.parent=null;this.focused=false;
      this.style={};
      this.classList={_keys:new Set(),add: x=>this.classList._keys.add(x),
        remove: x=>this.classList._keys.delete(x),
        toggle: x=>{if(this.classList._keys.has(x)){this.classList._keys.delete(x);return false;}
          this.classList._keys.add(x);return true;}};
    }
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
    setAttribute(name,value){this.attributes[name]=value;}
    getAttribute(name){return this.attributes[name]||null;}
    querySelector(selector){
      if(selector===".station-state")return this.children.find(c=>c.className==="station-state")||null;
      return null;
    }
    addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
    dispatch(name,props={}){
      let prevented=false;
      const event={button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,
        currentTarget:this,preventDefault(){prevented=true;},...props};
      for(const fn of this.handlers[name]||[])fn(event);
      return prevented;
    }
    scrollIntoView() {}
    focus(){this.focused=true;}
    remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  }
  for(const id of ["stations","station-tune","station-detail","station-announcement",
    "station-registry-status","refresh-stations","station-status","station-name",
    "station-copy","listening-room","receiver-mount","full-receiver",
    "receiver-title","close-receiver","motion","monitor"]) {
    els.set(id,new Element("div",id));
  }
  els.get("station-tune").href="https://humkin.abundent.org/fm/";
  const hero=new Element("a","hero-tune");hero.href="https://humkin.abundent.org/fm/";
  const listeners={};
  let current=payload,networkError=false,fetches=[],interval=null;
  const document={
    baseURI:URL_ROOT,
    getElementById:id=>els.get(id)||null,
    createElement:tag=>new Element(tag),
    querySelectorAll: query=>query==="[data-tune]"?[hero,els.get("station-tune")]:[],
    addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn);},
    dispatchEvent:event=>{events.push(event.type);for(const fn of listeners[event.type]||[])fn(event);}
  };
  const ctx={document,URL,AbortController,Event:class {constructor(type){this.type=type;}},
    matchMedia:()=>({matches:false,addEventListener(){}}),
    setTimeout:()=>1,clearTimeout(){},setInterval:fn=>{interval=fn;return 2;},
    fetch:async url=>{fetches.push(url);if(url!==REGISTRY)throw Error("Unapproved fetch");
      if(networkError)throw Error("Worker unavailable");
      return {ok:true,json:async()=>current};}
  };
  new vm.Script(source,{filename:"fmstudio/dial.js"}).runInNewContext(ctx,{timeout:2000});
  return {els,events,hero,fetches,document,refresh:()=>interval(),
    setPayload:p=>{current=p;},setError:v=>{networkError=v;},
    station:id=>els.get("stations").children.find(el=>el.dataset.station===id),
    click:id=>els.get(id).dispatch("click"),
    flush:async()=>{await new Promise(resolve=>setImmediate(resolve));
      await new Promise(resolve=>setImmediate(resolve));}
  };
}
const state=(...ids)=>({schema:"humkin.fm.station-registry/v1",
  stations:[{id:"station-one",on_air:true},
    ...ids.map(id=>({id,on_air:true}))]});

test("FM Studio keeps classic receiver and Compost while live station lookup is absent", async()=>{
  const f=fixture(state());
  f.setError(true);await f.flush();
  assert.ok(f.station("station-one"));
  assert.ok(f.station("compost"));
  assert.ok(f.station("night-drive"));
  assert.equal(f.els.get("station-tune").hidden,false);
  assert.match(f.els.get("station-registry-status").textContent,/unavailable/i);
  assert.equal(f.els.get("receiver-mount").children.length,0);
  assert.equal(f.els.get("station-name").textContent,"Station One");
  assert.equal(f.fetches[0],REGISTRY);
});
test("discovers one live Acer frequency and supports single embedded player switching",async()=>{
  const f=fixture(state("talk","strange-hour"));
  await f.flush();
  assert.equal(f.station("talk").children[0].textContent,"Talk");
  assert.match(f.station("talk").querySelector(".station-state").textContent,/On air/);
  assert.equal(f.station("night-drive").querySelector(".station-state").textContent,"In development");
  f.station("talk").dispatch("click");
  assert.equal(f.els.get("station-tune").href,"https://humkin.abundent.org/fm/?frequency=talk");
  assert.equal(f.els.get("receiver-mount").children.length,0,"Selecting tile must not autoplay");
  const intercepted=f.click("station-tune");
  assert.equal(intercepted,true);
  const first=f.els.get("receiver-mount").children[0];
  assert.equal(first.src,"https://humkin.abundent.org/fm/?frequency=talk");
  assert.equal(first.title,"Talk audio player");
  assert.equal(f.els.get("receiver-title").textContent,"Talk receiver");
  assert.equal(f.els.get("listening-room").hidden,false);
  assert.equal(f.els.get("full-receiver").href,first.src);
  f.station("strange-hour").dispatch("click");
  f.click("station-tune");
  assert.equal(first.removed,true,"Old iframe/audio must be removed before retune");
  assert.equal(f.els.get("receiver-mount").children.length,1);
  assert.equal(f.els.get("receiver-mount").children[0].src,
    "https://humkin.abundent.org/fm/?frequency=strange-hour");
  assert.equal(f.els.get("station-name").textContent,"The Strange Hour");
  assert.ok(f.events.includes("humkin:station-one"),"Existing Compost audio pause event must remain");
  f.click("close-receiver");
  assert.equal(f.els.get("receiver-mount").children.length,0);
  assert.equal(f.els.get("listening-room").hidden,true);
});
test("refresh retires stale broadcast entry without interrupting an open receiver",async()=>{
  const f=fixture(state("talk"));
  await f.flush();
  f.station("talk").dispatch("click");
  f.click("station-tune");
  const iframe=f.els.get("receiver-mount").children[0];
  f.setPayload(state());
  await f.refresh();await f.flush();
  assert.equal(iframe.removed,false,"Directory refresh must not cut audio");
  assert.equal(f.els.get("station-tune").hidden,true,"Offline dynamic frequency must not advertise tuning");
  assert.match(f.station("talk").querySelector(".station-state").textContent,/Not broadcasting/);
  f.document.dispatchEvent({type:"humkin:compost-playing"});
  assert.equal(iframe.removed,true,"Compost must stop live iframe audio");
});
test("untrusted registry URLs or invalid frequency IDs cannot redirect the receiver",async()=>{
  const f=fixture({schema:"humkin.fm.station-registry/v1",stations:[
    {id:"station-one",on_air:false}, {id:"evil/../../",on_air:true},
    {id:"talk",on_air:true,receiver:"https://evil.example/steal"}]});
  await f.flush();
  assert.equal(f.station("evil/../../"),undefined);
  f.station("talk").dispatch("click");
  assert.equal(f.els.get("station-tune").href,
    "https://humkin.abundent.org/fm/?frequency=talk");
  assert.equal(f.hero.dispatch("click"),true,"Hero must still open original Station One");
  assert.equal(f.els.get("receiver-mount").children[0].src,"https://humkin.abundent.org/fm/");
  assert.match(f.els.get("station-status").textContent,/Not broadcasting/);
});
test("static FM Studio structure remains complete and uses one dedicated dial script",()=>{
  for(const id of ["stations","station-tune","station-detail","station-registry-status",
    "refresh-stations","listening-room","receiver-mount","close-receiver","compost-audio",
    "compost-rating","monitor","motion"])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/<script src="\.\/dial\.js"><\/script>/);
  assert.match(html,/<script src="\.\/compost\.js"><\/script>/);
  assert.doesNotMatch(source,/window\.location\.replace|localStorage\.setItem|\.play\(\)/);
});
