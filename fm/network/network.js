/* Radio House network registry reader: preserve independent source authority.
 * No third-party playback, proxying, scraping, station approval or uploads.
 */
(function(root) {
"use strict";
const ID=/^[a-z][a-z0-9-]{1,40}$/;
function https(value){
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash?
    u.href:null;
 }catch{return null}
}
function validate(registry){
 if(registry?.schema_version!=="humkin.radio-house.sources/v1"||
   !registry.editorial_contract?.no_partner_claim||
   !registry.editorial_contract?.require_explicit_license_before_rebroadcast||
   !Array.isArray(registry.worlds)||registry.worlds.length!==3)
  throw Error("Unexpected or unauthorized source registry.");
 const ids=new Set();
 return registry.worlds.map(x=>{
  if(!ID.test(x.id)||ids.has(x.id)||!https(x.site)||
    !["this_station","independent_source_world"].includes(x.relationship)||
    !Array.isArray(x.adaptations)||!x.adaptations.length)
   throw Error("Invalid source world.");
  ids.add(x.id);
  if(x.relationship==="independent_source_world" &&
      (x.rebroadcast_permission!=="not_granted"||x.live_audio!==null))
   throw Error("Third-party audio requires an explicitly verified source license.");
  return {...x,site:https(x.site),
   sources:Array.isArray(x.sources)?x.sources.filter(s=>s.label&&https(s.url)).map(s=>
       ({label:String(s.label),url:https(s.url)})):[]};
 });
}
function render(target,worlds,doc=document){
 target.replaceChildren();
 for(const w of worlds){
  const section=doc.createElement("article");section.className="world";
  const eyebrow=doc.createElement("small");
  eyebrow.textContent=w.relationship==="this_station"?"HUMKIN — OUR OWN DIAL":"INDEPENDENT SOURCE / OWN EDITOR";
  const header=doc.createElement("h3");header.textContent=w.name;
  const owner=doc.createElement("p");owner.className="source-owner";owner.textContent=w.owner;
  const summary=doc.createElement("p");summary.textContent=w.contribution;
  const list=doc.createElement("ul");
  for(const item of w.adaptations){
   const li=doc.createElement("li");li.textContent=item;list.append(li);
  }
  const anchor=doc.createElement("a");anchor.href=w.site;
  anchor.textContent=w.relationship==="this_station"?"TUNE IN TO HUMKIN ↗":"OPEN INDEPENDENT OFFICIAL SITE ↗";
  anchor.rel="noopener noreferrer";anchor.target="_blank";anchor.className="button";
  section.append(eyebrow,header,owner,summary,list,anchor);
  if(w.relationship==="independent_source_world"){
   const notice=doc.createElement("p");notice.className="rights";
   notice.textContent="Official link only · No imported audio, media license, or partnership asserted.";
   section.append(notice);
  }
  target.append(section);
 }
}
const api=Object.freeze({https,validate,render});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_RADIO_HOUSE=api;
})(typeof window!=="undefined"?window:globalThis);
