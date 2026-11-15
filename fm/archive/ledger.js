/* HUMKIN RADIO // Department of Records
 * Fictional station continuity. The ledger is not a history of real broadcasts.
 * Static prose only: no audio mutation, no network requests, no listener tracking.
 */
(function(root){
"use strict";
const entries=Object.freeze([
 {code:"BOX 001 · LEAF 02",era:"DATE UNRECORDED",title:"The Missing First Page",
  text:"The oldest station log begins on page two. According to management, page one is still being used to hold a window open."},
 {code:"BOX 004 · CARBON COPY",era:"DATE DISPUTED",title:"An Excellent Purchase",
  text:"A receipt for a transmitter was discovered eleven years before its purchase order. Accounting has filed the difference under Successful Foresight."},
 {code:"BOX 009 · REQUEST SLIP",era:"BEFORE THE REQUEST LINE",title:"The First Request",
  text:"The first listener asked for a song we did not own. A woman in the next room played it on the piano. Nobody wrote down her name."},
 {code:"BOX 013 · NIGHT REGISTER",era:"YEAR UNKNOWN",title:"The Kettle",
  text:"The night operator kept the kettle warm for a visitor who never arrived. Someone left two biscuits at the door by morning."},
 {code:"BOX 018 · PERSONNEL",era:"IN THE MIDDLE YEARS",title:"The Previous Manager",
  text:"Every employee remembers a previous station manager. None of their descriptions agree, but all remember the same enormous key ring."},
 {code:"BOX 021 · ENGINEERING",era:"DATE ERASED",title:"The Tower Inspection",
  text:"The inspector wrote that the tower was sound and the ladder was questionable. The next inspector could only find the ladder."},
 {code:"BOX 027 · ON-AIR LOG",era:"SOMETIME AFTER SUPPER",title:"An Interrupted Announcement",
  text:"The announcer began, 'We regret to inform you—' and was interrupted by a perfectly good song. The announcement was never completed."},
 {code:"BOX 032 · FARM DESK",era:"SEASON UNCERTAIN",title:"A Visit from the Goat",
  text:"A goat was admitted as a temporary newsroom guest. The word temporary appears only on the first three forms."},
 {code:"BOX 036 · ENGINEERING",era:"AFTER THE REPAIRS",title:"A Modest Improvement",
  text:"The control-room light began working again. Staff agreed not to investigate why it had been on for twenty years."},
 {code:"BOX 041 · SIGN-OFF",era:"UNSPECIFIED EVENING",title:"The Station Closed",
  text:"The records say the station closed twice. No corresponding record of its opening has been found. The music continued."},
 {code:"BOX 047 · ARCHIVE ENVELOPE",era:"NO RETURN ADDRESS",title:"A Note from a Listener",
  text:"Inside an empty envelope: 'I found you where the road bends toward home.' The envelope was filed under Directions."},
 {code:"BOX 052 · CURRENT FILE",era:"ALWAYS PENDING",title:"An Ordinary Tuesday",
  text:"The Department of Records has requested one uneventful day for reference. The request remains under consideration."}
]);
function todayIndex(now){
 const day=Math.floor((Number(now)||Date.now())/86400000);
 return ((day%entries.length)+entries.length)%entries.length;
}
function make(tag,cls,content){
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 e.textContent=content;
 return e;
}
function render(){
 if(typeof document==="undefined")return;
 const current=entries[todayIndex(Date.now())];
 const ids={"archive-ticket-code":current.code,
 "archive-ticket-era":current.era,
 "archive-ticket-title":current.title,
 "archive-ticket-copy":current.text};
 for(const [id,content] of Object.entries(ids)){
  const target=document.getElementById(id);
  if(target)target.textContent=content;
 }
 const shelf=document.getElementById("archive-ledger");
 if(!shelf)return;
 shelf.replaceChildren();
 for(const item of entries){
  const card=make("article","archive-card","");
  const line=make("div","archive-card-top","");
  line.append(make("span","archive-code",item.code),
    make("span","archive-era",item.era));
  card.append(line,make("h2","archive-card-title",item.title),
   make("p","archive-card-text",item.text));
  shelf.append(card);
 }
}
if(typeof document!=="undefined"){
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});
 else render();
}
const api=Object.freeze({entries,todayIndex});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_ARCHIVE=api;
})(typeof window!=="undefined"?window:globalThis);
