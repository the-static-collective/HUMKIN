import {danceContenders} from "./feedback-signals.mjs";
/* HUMKIN Listener Weather — anonymous expression, not Top 42 chart points. */
(()=>{"use strict";
 const WEATHER="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-resonance";
 const LEAGUE="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-league";
 const PHRASES={
  hope:"GAVE HOPE",tears:"BROUGHT TEARS",seen:"LESS ALONE",
  laugh:"MADE ME LAUGH",move:"MADE ME MOVE",stayed:"STAYED WITH ME"
 };
 const $=id=>document.getElementById(id);
 let catalog=[],selected=null,feeling=null,writing=false;
 function randomListener(){
   const key="humkin-weather-listener-v1";
   let value="";
   try{value=localStorage.getItem(key)||""}catch{}
   if(!/^[0-9a-f-]{36}$/i.test(value)){
     value=typeof crypto.randomUUID==="function"?crypto.randomUUID():
       "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
         const n=crypto.getRandomValues(new Uint8Array(1))[0]&15;
         return (c==="x"?n:(n&3|8)).toString(16);
       });
     try{localStorage.setItem(key,value)}catch{}
   }
   return value;
 }
 function ready(){
   const button=$("weather-send");
   if(button)button.disabled=!selected||!feeling||writing;
 }
 function findSongs(){
   const target=$("weather-matches"),input=$("weather-search");
   if(!target||!input)return;
   target.replaceChildren();
   if(!catalog.length){target.append(text("p","The record crate is unavailable."));return;}
   const q=input.value.trim().toLocaleLowerCase().slice(0,80);
   if(!q){target.append(text("p","Search for a title or artist to find your song.","small"));return;}
   const matching=catalog.filter(t=>
       (String(t.title||"")+" "+String(t.artist||"")+" "+String(t.album||""))
       .toLocaleLowerCase().includes(q)).slice(0,8);
   if(!matching.length){target.append(text("p","No recording under that name.","small"));return;}
   for(const song of matching){
     const button=text("button",String(song.title||song.id),"weather-result");
     button.type="button";
     button.setAttribute("aria-pressed",String(selected===song.id));
     button.addEventListener("click",()=>{
       selected=song.id;
       $("weather-selected").textContent="YOUR RECORD: "+String(song.title||song.id);
       findSongs();ready();
     });
     target.append(button);
   }
 }
 async function send(){
   if(!selected||!feeling||writing)return;
   writing=true;ready();
   const status=$("weather-reply-status");
   status.textContent="Sending your little piece of the weather…";
   try{
     const response=await fetch(WEATHER,{method:"POST",cache:"no-store",
       headers:{"Content-Type":"application/json"},
       body:JSON.stringify({action:"react",listener:randomListener(),
         track_id:selected,feeling})});
     const data=await response.json();
     if(!response.ok||!data.accepted)throw Error(data.error||"The desk couldn't receive your response.");
     status.textContent="Received. Your response lives with this song; choosing again will change it, not add a vote.";
     await load();
   }catch(error){
     status.textContent=error.message||"The response couldn't be sent. Try again.";
   }finally{writing=false;ready();}
 }
 function text(tag,value,className){
   const n=document.createElement(tag);n.textContent=String(value);
   if(className)n.className=className;
   return n;
 }
 async function json(url){
   const response=await fetch(url,{cache:"no-store"});
   if(!response.ok)throw Error("Listener Weather offline");
   return response.json();
 }
 let lastBoard=null;
 function drawDanceContenders(){
   const target=$("dance-contender-list"),status=$("dance-contender-status");
   if(!target||!status||!lastBoard)return;
   target.replaceChildren();
   const result=danceContenders(catalog,lastBoard,new Date(),3);
   if(result.status!=="PROVISIONAL"){
     target.append(text("li","The Listener Weather is incomplete; contenders are on hold.","waiting"));
     status.textContent="No reliable weekly contender list available.";
     return;
   }
   for(const candidate of result.contenders.slice(0,12)){
     const li=text("li","","weather-song");
     li.append(text("strong",candidate.title),
       text("small",candidate.move_count+" MADE ME MOVE"));
     target.append(li);
   }
   if(!result.contenders.length)
     target.append(text("li","No songs have received three movement responses yet.","waiting"));
   status.textContent=result.week_start+" · "+result.contenders.length+
      " provisional candidates · 0 additional Top 42 votes.";
 }
 function drawWeather(){
   const list=$("weather-list");
   if(!lastBoard||!list)return;
   const names=new Map(catalog.map(t=>[t.id,String(t.title||t.id)]));
   const choice=$("weather-filter")?.value||"all";
   const focus=Object.prototype.hasOwnProperty.call(PHRASES,choice)?choice:"all";
   const rows=lastBoard.tracks.filter(t=>names.has(t.id)&&t.total>0&&
       (focus==="all"||Number(t.feelings?.[focus]||0)>0))
     .sort((a,b)=>focus==="all"
       ?b.total-a.total||a.id.localeCompare(b.id)
       :Number(b.feelings?.[focus]||0)-Number(a.feelings?.[focus]||0)
         ||b.total-a.total||a.id.localeCompare(b.id)).slice(0,12);
   list.replaceChildren();
   drawDanceContenders();
   if(!rows.length){
     list.append(text("li",focus==="all"
       ?"Nobody has sent a song's feeling yet. The room is listening."
       :"Nobody has shared that feeling for a song yet.","waiting"));
     return;
   }
   for(const song of rows){
     const row=text("li","","weather-song");
     const name=text("div","","weather-name");
     name.append(text("strong",names.get(song.id)),text("small",song.total+
           (song.total===1?" RESPONSE":" RESPONSES")));
     const reactions=text("div","","weather-feelings");
     const top=Object.entries(song.feelings||{})
       .sort((a,b)=>(a[0]===focus?-1000000:0)-(b[0]===focus?-1000000:0)
        ||Number(b[1])-Number(a[1])).slice(0,3);
     for(const [code,count] of top){
       if(!Object.prototype.hasOwnProperty.call(PHRASES,code)||!(Number(count)>0))continue;
       reactions.append(text("span",PHRASES[code]+" · "+count,"weather-tag"));
     }
     row.append(name,reactions);list.append(row);
   }
 }
 async function load(){
  const status=$("weather-status"),list=$("weather-list");
  if(!status||!list)return;
  try{
    const [board,league]=await Promise.all([json(WEATHER),json(LEAGUE)]);
    if(board.schema!=="humkin.listener-weather/v1"||league.schema!=="humkin.top42/v1"||
       !Array.isArray(board.tracks)||!Array.isArray(league.catalog))throw Error("Unknown response");
    catalog=league.catalog.filter(t=>t&&typeof t.id==="string"&&
       /^[a-z0-9-]{3,90}$/i.test(t.id)).slice(0,1000);
    findSongs();
    lastBoard=board;
    drawWeather();
    status.textContent=(board.week_start||"THIS WEEK")+
       " / ANONYMOUS SONG RESPONSES / SELF-REPORTED, PROVISIONAL"+
       (board.truncated?" / DISPLAY MAY BE INCOMPLETE":"");
  }catch(error){
    status.textContent="The song feelings are unavailable. The regular Top 42 is unaffected.";
    list.replaceChildren(text("li","The little weather station is resting.","waiting"));
  }
 }
 $("weather-refresh")?.addEventListener("click",load);
 $("weather-filter")?.addEventListener("change",drawWeather);
 $("weather-open")?.addEventListener("click",()=>{
   const booth=$("weather-booth"),trigger=$("weather-open");
   const opening=booth.hidden;
   booth.hidden=!opening;
   trigger.setAttribute("aria-expanded",String(opening));
   if(opening)$("weather-search")?.focus();
 });
 $("weather-search")?.addEventListener("input",findSongs);
 for(const input of document.querySelectorAll('input[name="weather-feeling"]')){
   input.addEventListener("change",()=>{
     feeling=input.value in PHRASES?input.value:null;
     ready();
   });
 }
 $("weather-send")?.addEventListener("click",send);
 ready();
 load();
})();
