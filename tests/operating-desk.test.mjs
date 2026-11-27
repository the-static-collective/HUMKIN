import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("fm/manage/index.html"), manager=read("fm/manage/manager.js"),script=read("fm/manage/operating-desk.js");
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,"No duplicate control IDs");
for(const match of manager.matchAll(/\$\("([^"]+)"\)/g))assert(ids.includes(match[1]),"Missing manager control: "+match[1]);
const names=["overview","library","programming","automation","production","infrastructure"];
const listeners={},location={hash:""},panels=names.map(name=>({dataset:{deskView:name},id:"desk-"+name,hidden:false,contains(t){return t===this||t.parent===this},closest(){return this},querySelector(){return {focus(){}}},scrollIntoView(){}}));
const links=names.map(name=>({dataset:{deskLink:name},hash:"#desk-"+name,attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(){}}));
const art={parent:panels[1],closest(){return this.parent},scrollIntoView(){}};
const document={querySelectorAll(s){return s==="[data-desk-view]"?panels:links},getElementById(id){return id==="art-library"?art:panels.find(p=>p.id===id)||null}};
runInNewContext(script,{document,location,window:{addEventListener(k,fn){listeners[k]=fn}}});
function selected(name){assert.deepEqual(panels.filter(p=>!p.hidden).map(p=>p.dataset.deskView),[name]);assert.deepEqual(links.filter(a=>a.attrs["aria-current"]==="page").map(a=>a.dataset.deskLink),[name]);}
selected("overview");
for(const name of names){assert(html.includes('data-desk-view="'+name+'"'));assert(html.includes('data-desk-link="'+name+'"'));location.hash="#desk-"+name;listeners.hashchange();selected(name);}
location.hash="#art-library";listeners.hashchange();selected("library");
location.hash="#missing";listeners.hashchange();selected("overview");
assert(html.indexOf('id="preview"')<html.indexOf('class="desk-stage"'),"Preview persists outside workspace");
assert(html.includes('id="r2-cleanup"')&&html.includes('id="r2-migrate"'));
console.log("Operating Desk: control IDs, all departments, legacy links and persistent audition checked");
