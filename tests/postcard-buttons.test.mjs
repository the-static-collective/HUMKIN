import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

// Runs actual postcard JS against a small DOM to catch failures that syntax/ID
// checks miss, especially when a removed field prevents button binding.
const source=readFileSync("gifts.js","utf8");
const art=[
  {id:"mutant-pop",title:"Original",src:"cover.jpg"},
  {id:"rainy-song",title:"Rainy Song",src:"postcards/rainy-song.webp"},
  {id:"basil",title:"Basil",src:"postcards/basil.webp"}
];
function boot(href){
  const elements=new Map(),known=new Set([
    "mix-one","mix-two","mix-three","mix-message","mix-status",
    "mix-preview","mix-preview-art-wrap","mix-preview-art",
    "mix-preview-message","mix-preview-tracks","mix-play","mix-copy",
    "mix-share","mix-link-fallback","received-postcard","received-art-wrap",
    "received-art","received-message","received-tracks","received-play",
    "received-remix","received-status"
  ]);
  class Element {
    constructor(id="generated"){
      this.id=id;this.value="";this.hidden=false;this.dataset={};this.children=[];
      this.listeners={};this.classes=new Set();
      this.classList={toggle:(name,enabled)=>{if(enabled)this.classes.add(name);else this.classes.delete(name)}};
    }
    addEventListener(name,listener){this.listeners[name]=listener}
    replaceChildren(...children){this.children=children}
    append(...children){this.children.push(...children)}
    querySelector(selector){assert.equal(selector,".postcard-paper");return get("received-paper")}
    click(){assert(this.listeners.click,"No click handler bound for #"+this.id);return this.listeners.click({preventDefault(){}})}
    focus(){}
    select(){}
  }
  function get(id){
    if(!elements.has(id))elements.set(id,new Element(id));
    return elements.get(id);
  }
  const document={
    baseURI:"https://humkin.abundent.org/",
    getElementById:id=>known.has(id)?get(id):null,
    createElement:()=>new Element(),
    querySelectorAll:()=>[]
  };
  const log={mixtapes:[],copies:[],shares:[]};
  const player={
    tracks:Array.from({length:12},(_,i)=>({number:i+1,title:"Song "+(i+1)})),
    playMixtape:ids=>{log.mixtapes.push(Array.from(ids));return true},
    playTrack:()=>true,currentTrack:1
  };
  const window={HUMKIN_PLAYER:player,addEventListener(){},isSecureContext:true};
  const navigator={
    clipboard:{writeText:async link=>{log.copies.push(link)}},
    share:async payload=>{log.shares.push(payload)}
  };
  const location=new URL(href);
  const fetch=async()=>({ok:true,json:async()=>({published:art})});
  runInNewContext(source,{document,window,navigator,location,fetch,URL,console});
  return {get,log};
}
const main=boot("https://humkin.abundent.org/");
for(const id of ["mix-play","mix-copy","mix-share"]){
  assert.equal(typeof main.get(id).listeners.click,"function","Broken postcard button: "+id);
}
await new Promise(resolve=>setImmediate(resolve));
assert(art.some(a=>main.get("mix-preview-art").src.endsWith(a.src)),"Preview lacks published artwork");
main.get("mix-play").click();
assert.deepEqual(main.log.mixtapes,[[1,5,9]],"Three-song preview must play");
main.get("mix-message").value="Thinking of you";
await main.get("mix-copy").click();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(main.log.copies.length,1,"Copy button must write a postcard URL");
const link=new URL(main.log.copies[0]);
assert.equal(link.searchParams.get("mix"),"1.5.9");
assert(art.some(a=>a.id===link.searchParams.get("art")),"Link must contain actual image ID");
assert(["sun","rose","sky"].includes(link.searchParams.get("card")),"Link must contain paper color");
assert.equal(link.searchParams.get("note"),"Thinking of you");
await main.get("mix-share").click();
assert.equal(main.log.shares.length,1,"Share button must call native share");
assert.equal(main.log.shares[0].url,link.href,"Share and copy must send the same postcard");
const received=boot(link.href);
await new Promise(resolve=>setImmediate(resolve));
assert.equal(received.get("received-postcard").hidden,false,"Received postcard must be visible");
assert.equal(received.get("received-message").textContent,"Thinking of you");
assert(received.get("received-art").src.endsWith(art.find(a=>a.id===link.searchParams.get("art")).src));
assert(received.get("received-paper").classes.has("color-"+link.searchParams.get("card")));
received.get("received-play").click();
assert.deepEqual(received.log.mixtapes,[[1,5,9]],"Recipient should be able to play the postcard");
const legacy=boot("https://humkin.abundent.org/?mix=01.05.09&card=rose&art=basil&note=Hello");
await new Promise(resolve=>setImmediate(resolve));
assert(legacy.get("received-art").src.endsWith("postcards/basil.webp"),"Older links must keep their image");
assert(legacy.get("received-paper").classes.has("color-rose"),"Older links must keep their color");
console.log("Postcard button smoke test passed: play, share, copy, preview, recipient and legacy links.");
