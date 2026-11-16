/* HUMKIN TOP 42 — public record league, client v1.
 * The actual scoreboard comes from the server. Never synthesize chart plays.
 * A device-local random key is used only to rate-limit provisional listens.
 */
(()=>{"use strict";
const API="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-league";
const WORDS=["Almost","Blue","Bloom","Broken","Distant","First","Golden","Home","Kettle","Little","Long","Midnight","Morning","Noontime","Radio","Road","Rose","Second","Signal","Somewhere","Static","Strange","Sunday","Sun","Warm","Window","Yesterday"];
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
let state=null,kind="ep",filter="all",draft=[],queue=[],playingRecord=null,playIndex=-1;
let heard=0,lastTick=0,sent=false,requesting=false,refreshing=false;
const audio=$("league-audio");
function getListener(){
  let key="";
  try{key=localStorage.getItem("humkin-league-listener-v1")||"";}catch{}
  if(!/^[0-9a-f-]{36}$/i.test(key)){
    key=typeof crypto.randomUUID==="function"?crypto.randomUUID():
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
        const x=crypto.getRandomValues(new Uint8Array(1))[0]&15;
        return (c==="x"?x:(x&3|8)).toString(16);
      });
    try{localStorage.setItem("humkin-league-listener-v1",key)}catch{}
  }
  return key;
}
const listener=getListener();
function status(message){$("system-status").textContent=message;}
function builderStatus(message){$("builder-message").textContent=message;}
function api(path="",options={}){
  return fetch(API+path,{cache:"no-store",...options}).then(async response=>{
    let data;
    try{data=await response.json()}catch{throw Error("The scoreboard sent an unreadable response.");}
    if(!response.ok||data.error)throw Error(data.error||"HTTP "+response.status);
    return data;
  });
}
function post(body){return api("",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,listener})});}
function allTracks(){return state?.catalog||[]}
function byId(id){return allTracks().find(t=>t.id===id)}
function quota(){return kind==="ep"?{total:6,radio:4,released:2}:{total:12,radio:8,released:4}}
function counts(){return draft.reduce((a,id)=>{const t=byId(id);if(t)a[t.featured?"released":"radio"]++;return a},{released:0,radio:0})}
function makeButton(label,action,disabled=false,cls=""){
 const b=el("button",cls,label);b.type="button";b.disabled=disabled;b.addEventListener("click",action);return b;
}
function populateWords(){
 for(const id of ["word-one","word-two"]){
   const select=$(id);
   WORDS.forEach(w=>{const option=el("option","",w);option.value=w;select.append(option)});
 }
 $("word-one").value="Midnight";$("word-two").value="Bloom";
}
function setKind(next){
 if(kind===next)return;
 kind=next;draft=[];
 $("choose-ep").setAttribute("aria-pressed",String(kind==="ep"));
 $("choose-album").setAttribute("aria-pressed",String(kind==="album"));
 renderDraft();renderCatalog();
 builderStatus(kind==="ep"?"Daily EP: pick four radio-only and two released recordings.":
    "Weekly album: pick eight radio-only and four released recordings.");
}
function renderDraft(){
 const needed=quota(),have=counts();
 $("roster-rule").textContent=needed.radio+" RADIO-ONLY + "+needed.released+" RELEASED";
 $("roster-progress").textContent=draft.length+" / "+needed.total+" SELECTED";
 $("tracklist-count").textContent="("+have.radio+"/"+needed.radio+" RADIO · "+have.released+"/"+needed.released+" RELEASED)";
 $("release-record").disabled=!state||requesting||draft.length!==needed.total||
   have.radio!==needed.radio||have.released!==needed.released;
 const list=$("draft-list");list.replaceChildren();
 draft.forEach((id,i)=>{
   const song=byId(id);if(!song)return;
   const li=el("li");
   const text=el("div");text.append(el("strong","",(i+1)+". "+song.title));
   text.append(el("small","",song.featured?"RELEASED / SINGLE":"RADIO ONLY"));
   const actions=el("div","draft-actions");
   actions.append(makeButton("↑",()=>move(i,-1),i===0));
   actions.append(makeButton("↓",()=>move(i,1),i===draft.length-1));
   actions.append(makeButton("×",()=>{draft.splice(i,1);renderDraft();renderCatalog()}));
   li.append(text,actions);list.append(li);
 });
 if(!draft.length)list.append(el("li","placeholder","THE SONGS GO HERE. MAKE THEM MAKE SENSE."));
}
function move(index,step){const next=index+step;if(next<0||next>=draft.length)return;[draft[index],draft[next]]=[draft[next],draft[index]];renderDraft()}
function addSong(id){
 const song=byId(id),limits=quota(),have=counts();
 if(!song||draft.includes(id)||draft.length>=limits.total)return;
 const type=song.featured?"released":"radio";
 if(have[type]>=limits[type])return;
 draft.push(id);renderDraft();renderCatalog();
}
function renderCatalog(){
 const list=$("catalog-list");list.replaceChildren();
 const query=$("catalog-search").value.trim().toLowerCase();
 let catalog=allTracks().filter(t=>
   (filter==="all"||(filter==="released")===Boolean(t.featured)) &&
   (!query||[t.title,t.artist,t.album].join(" ").toLowerCase().includes(query)));
 $("catalog-count").textContent=allTracks().length+" RECORDINGS";
 if(!catalog.length){list.append(el("p","small",state?"No matching records in this crate.":"The crate is not connected."));return}
 catalog=catalog.slice(0,110);
 const limits=quota(),have=counts();
 for(const track of catalog){
   const row=el("div","crate-song"),labels=el("div");
   labels.append(el("b","",track.title));
   labels.append(el("small","",(track.album||"HUMKIN RADIO")+" · "+(track.featured?"RELEASED / SINGLE":"RADIO ONLY")));
   const type=track.featured?"released":"radio",included=draft.includes(track.id);
   const button=makeButton(included?"✓ ADDED":"＋ ADD",()=>addSong(track.id),
     included||draft.length>=limits.total||have[type]>=limits[type]||!state);
   row.append(labels,button);list.append(row);
 }
}
function number(n){return Number(n||0).toLocaleString("en-US")}
function renderChart(){
 const list=$("chart-list");list.replaceChildren();
 const ranked=(state?.chart||[]).filter(x=>x.plays>0);
 $("chart-caption").textContent=state?
  state.station_day+" / "+ranked.length+" TRACK"+(ranked.length===1?"":"S")+" CHARTING / CENTRAL TIME":
  "Live scores currently unavailable.";
 $("play-chart").disabled=!ranked.length;
 if(!ranked.length){
   list.append(el("li","waiting","NO QUALIFIED PLAYS YET. The Top 42 begins when somebody listens."));
   return;
 }
 ranked.forEach((track,i)=>{
   const li=el("li");
   const song=el("div","song-identity");
   song.append(el("span","rank-number",String(i+1).padStart(2,"0")));
   const identity=el("div","song-name");
   identity.append(makeButton(track.title,()=>playSongs(ranked.map(x=>x.id),null,"THE TOP 42",i)));
   identity.append(el("small","",track.featured?"HUMKIN · RELEASED":"HUMKIN · RADIO ONLY"));
   song.append(identity);
   li.append(song,el("span","metric",number(track.radio)),
     el("span","metric",number(track.playlist)),
     el("span","metric total",number(track.plays)));
   list.append(li);
 });
}
function renderRecords(id,rows){
 const target=$(id);target.replaceChildren();
 if(!rows.length){target.append(el("p","",id==="ep-standings"?"No EPs released today. Be the first.":"No albums released this week. The shelf is open."));return}
 rows.forEach((record,i)=>{
   const div=el("div","record-row");
   div.append(el("span","place",i+1));
   const detail=el("div","details");
   detail.append(el("strong","",record.title));
   detail.append(el("small","",record.curator+" · "+record.radio+" RADIO + "+record.playlist+" PLAYLIST"));
   div.append(detail,el("span","points",number(record.plays)));
   div.append(makeButton("▶",()=>playRecord(record)));
   div.append(makeButton("↗",()=>shareRecord(record)));
   target.append(div);
 });
}
function render(){
 $("daily-issue").textContent=state?.station_day||"TODAY";
 $("weekly-issue").textContent=state?.week_start||"THIS WEEK";
 renderChart();renderRecords("ep-standings",state?.eps||[]);
 renderRecords("album-standings",state?.albums||[]);
 renderDraft();renderCatalog();
}
async function refresh(first=false){
 if(refreshing)return;refreshing=true;
 if(first)status("Opening the record office…");
 try{
   const record=new URLSearchParams(location.search).get("record");
   const data=await api(record&&/^[0-9a-f-]{36}$/i.test(record)?"?record="+encodeURIComponent(record):"");
   if(data.schema!=="humkin.top42/v1"||!Array.isArray(data.catalog))throw Error("Unknown scoreboard format");
   state=data;render();status("✳ LIVE BOARD · "+data.station_day+" · "+data.catalog.length+" ON THE DIAL");
   if(first&&data.selected){playRecord(data.selected,false);$("playbar").scrollIntoView({block:"end"});}
 }catch(e){
   status("SCOREBOARD OFFLINE · THE REGULAR RADIO IS STILL AVAILABLE");
   if(first)builderStatus("The league can't accept submissions right now. Try Refresh.");
   console.warn("Top 42 unavailable",e);
 }finally{refreshing=false}
}
async function release(){
 if(!state||requesting)return;
 const q=quota(),have=counts();
 if(draft.length!==q.total||have.radio!==q.radio||have.released!==q.released)return;
 requesting=true;renderDraft();builderStatus("Pressing the record…");
 try{
   const result=await post({action:"release",kind,word_one:$("word-one").value,
     word_two:$("word-two").value,tracks:[...draft]});
   builderStatus("RELEASED: "+result.record.title+" · "+result.record.curator+". You can play it or share it from the standings.");
   draft=[];await refresh();
   const list=kind==="ep"?state?.eps:state?.albums;
   const created=list?.find(r=>r.id===result.record.id);
   if(created)shareRecord(created,false);
 }catch(error){builderStatus(error.message||"The pressing failed.");}
 finally{requesting=false;renderDraft();renderCatalog();}
}
async function shareRecord(record,offer=true){
 const url=new URL("./",location.href);url.searchParams.set("record",record.id);
 const text=record.title+" — a HUMKIN "+(record.kind==="ep"?"daily EP":"weekly album")+".";
 if(offer&&navigator.share){
   try{await navigator.share({title:text,text,url:url.href});return}catch(e){if(e?.name==="AbortError")return}
 }
 if(navigator.clipboard){
   try{await navigator.clipboard.writeText(url.href);
     builderStatus("Record link copied: "+record.title);return;}catch{}
 }
 builderStatus("Share this record: "+url.href);
}
function playSongs(ids,recordId,label,start=0){
 const valid=ids.filter(id=>byId(id));
 if(!valid.length){builderStatus("This record's audio isn't on the current public dial.");return}
 queue=valid;playingRecord=recordId;playIndex=Math.max(0,Math.min(start,valid.length-1));
 $("playbar").hidden=false;$("player-record").textContent=label;
 loadCurrent(true);
}
function playRecord(record,autoplay=true){
 playSongs(record.tracks,record.id,record.title);
 if(!autoplay)audio.pause();
}
function loadCurrent(autoplay){
 const track=byId(queue[playIndex]);
 if(!track)return;
 heard=0;sent=false;lastTick=performance.now();
 audio.src=track.src;audio.load();
 $("player-track").textContent=(playIndex+1)+"/"+queue.length+" · "+track.title;
 $("player-state").textContent="Playing "+track.title;
 if(autoplay)audio.play().catch(()=>{$("player-state").textContent="Tap Play on the record player to start."});
}
function next(delta){
 if(!queue.length)return;
 const nextIndex=playIndex+delta;
 if(nextIndex<0||nextIndex>=queue.length){if(delta>0){audio.pause();$("player-state").textContent="End of record.";}return}
 playIndex=nextIndex;loadCurrent(true);
}
function tick(){
 const now=performance.now(),elapsed=Math.max(0,Math.min(5,(now-lastTick)/1000));
 lastTick=now;
 if(audio.paused||audio.readyState<2||!queue.length)return;
 heard+=elapsed;
 if(heard>=30&&!sent){
   sent=true;
   const id=queue[playIndex];
   post({action:"play",source:"playlist",record_id:playingRecord,track_id:id,
     seconds:Math.floor(heard)}).then(()=>{
       $("player-state").textContent="Qualified listen sent for "+(byId(id)?.title||id);
     }).catch(e=>{console.debug("Listen not counted:",e.message)});
 }
}
populateWords();
$("choose-ep").addEventListener("click",()=>setKind("ep"));
$("choose-album").addEventListener("click",()=>setKind("album"));
$("catalog-search").addEventListener("input",renderCatalog);
for(const b of document.querySelectorAll("[data-filter]"))
 b.addEventListener("click",()=>{
   filter=b.dataset.filter;
   document.querySelectorAll("[data-filter]").forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.filter===filter)));
   renderCatalog();
 });
$("release-record").addEventListener("click",release);
$("refresh").addEventListener("click",()=>refresh());
$("play-chart").addEventListener("click",()=>{
 const songs=(state?.chart||[]).filter(x=>x.plays>0);
 playSongs(songs.map(x=>x.id),null,"TODAY'S TOP 42");
});
$("player-previous").addEventListener("click",()=>next(-1));
$("player-next").addEventListener("click",()=>next(1));
$("player-close").addEventListener("click",()=>{audio.pause();audio.removeAttribute("src");audio.load();
 queue=[];playingRecord=null;playIndex=-1;$("playbar").hidden=true});
audio.addEventListener("timeupdate",tick);
audio.addEventListener("pause",()=>{lastTick=performance.now()});
audio.addEventListener("play",()=>{lastTick=performance.now()});
audio.addEventListener("ended",()=>next(1));
setInterval(tick,1000);
setInterval(()=>{if(document.visibilityState==="visible")refresh()},60000);
render();refresh(true);
})();