/* HUMKIN Listener Weather — anonymous expression, not Top 42 chart points. */
(()=>{"use strict";
 const WEATHER="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-resonance";
 const LEAGUE="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-league";
 const PHRASES={
  hope:"GAVE HOPE",tears:"BROUGHT TEARS",seen:"LESS ALONE",
  laugh:"MADE ME LAUGH",move:"MADE ME MOVE",stayed:"STAYED WITH ME"
 };
 const $=id=>document.getElementById(id);
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
    const names=new Map(league.catalog.map(t=>[t.id,String(t.title||t.id)]));
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
 load();
})();
