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
    const names=new Map(catalog.map(t=>[t.id,String(t.title||t.id)]));
    list.replaceChildren();
    const rows=board.tracks.filter(t=>names.has(t.id)&&t.total>0).slice(0,12);
    if(rows.length===0){
       list.append(text("li","Nobody has sent a song's feeling yet. The room is listening.","waiting"));
    }else for(const song of rows){
      const row=text("li","","weather-song");
      const name=text("div","","weather-name");
      name.append(text("strong",names.get(song.id)),text("small",song.total+
           (song.total===1?" RESPONSE":" RESPONSES")));
      const reactions=text("div","","weather-feelings");
      for(const [code,count] of Object.entries(song.feelings||{}).sort((a,b)=>b[1]-a[1]).slice(0,3)){
       if(!Object.prototype.hasOwnProperty.call(PHRASES,code)||!(Number(count)>0))continue;
       reactions.append(text("span",PHRASES[code]+" · "+count,"weather-tag"));
      }
      row.append(name,reactions);list.append(row);
    }
    status.textContent=(board.week_start||"THIS WEEK")+
       " / ANONYMOUS SONG RESPONSES / SELF-REPORTED, PROVISIONAL"+
       (board.truncated?" / DISPLAY MAY BE INCOMPLETE":"");
  }catch(error){
    status.textContent="The song feelings are unavailable. The regular Top 42 is unaffected.";
    list.replaceChildren(text("li","The little weather station is resting.","waiting"));
  }
 }
 $("weather-refresh")?.addEventListener("click",load);
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
