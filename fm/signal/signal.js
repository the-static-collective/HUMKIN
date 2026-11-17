/* HUMKIN Signal 001: three-song programs from the real published rotation.
 * No autoplay, uploads, tracking, credits, background compute, or edits to any Orchard/network save.
 */
(function(){
"use strict";
const M=window.HumkinSignal,S=window.HumkinStationSeed,$=id=>document.getElementById(id);
if(!M||!S)return;
const audio=$("signal-audio");
const manifestURL=new URL("../rotation.json",document.baseURI);
const store=(()=>{try{return localStorage}catch{return null}})();
let tracks=[],draft=null,guest=false,position=0,rootSeed=null,receivedOrigin=null;
function node(tag,text,cls){
  const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);
  if(cls)e.className=cls;return e;
}
function notice(text){$("message").textContent=text}
function seedDisplay(){
  const existing=!!rootSeed;
  $("play").textContent=guest?"▶ HEAR THIS SIGNAL":existing?"▶ HEAR MY SIGNAL":"▶ START MY STATION";
  $("backup-seed").disabled=!existing;
  $("seed-summary").textContent=existing?"MY STATION SEED · SAVED":"MY STATION SEED · NOT YET PLANTED";
  $("seed-status").textContent=guest?"This is a visiting signal. Make it yours to save a founding seed locally.":existing?
    "Founded with "+rootSeed.founding.tracks.map(t=>t.title||t.id).join(" · ")+". These first choices stay remembered while your station evolves.":
    "Your first three songs, their order and your programming rule become the origin of your station when you start. Later changes won't erase it.";
}
function establishSeed(){
  if(guest)return false;
  if(rootSeed)return true;
  try{
    const candidate=S.make(draft,tracks,{parent:receivedOrigin});
    if(!S.plant(store,candidate))throw Error("Seed storage unavailable or already contains a station. Use Restore rather than overwriting it.");
    rootSeed=S.read(store);
    if(!rootSeed)throw Error("Could not verify the saved station.");
    seedDisplay();return true;
  }catch(e){notice("Couldn't preserve your station seed: "+e.message);return false;}
}
function safeCatalog(rows){
  return M.catalog(rows).map(t=>{
    try{
      const src=new URL(t.src,manifestURL),art=new URL(t.artwork||"../cover.jpg",manifestURL);
      if(src.origin!==location.origin||art.origin!==location.origin||!src.pathname.toLowerCase().endsWith(".mp3"))return null;
      return {...t,src:src.href,artwork:art.href};
    }catch{return null;}
  }).filter(Boolean);
}
function storedDraft(){
  if(!store)return null;
  try{return JSON.parse(store.getItem(M.KEY))}catch{return null}
}
function storeDraft(){
  if(guest||!store)return;
  try{store.setItem(M.KEY,JSON.stringify(draft))}catch{notice("This browser could not save the draft. Share a link to keep a copy.")}
}
function profileName(){
  if(!store)return null;
  try{return store.getItem("humkin-orchard-room-name-v1")}catch{return null}
}
function readInputs(){
  draft.name=M.clean($("station-name").value,48)||"My Little Station";
  draft.intro=M.clean($("station-intro").value,160);
  draft.mode=M.mode($("station-mode").value);
  storeDraft();
}
function showTrack(){
  const id=draft?.tracks?.[position],song=tracks.find(t=>t.id===id);
  if(!song)return;
  $("art").src=song.artwork;
  $("art").alt="Artwork for "+song.album;
  $("now-title").textContent=song.title;
  $("now-meta").textContent=(song.artist||"HUMKIN")+" · "+(song.album||"HUMKIN RADIO");
  $("now-position").textContent=String(position+1).padStart(2,"0")+" / 03";
}
function clearPlayback(){
  audio.pause();audio.removeAttribute("src");audio.load();position=0;showTrack();
}
function renderChoices(){
  const host=$("track-choices");host.replaceChildren();
  for(let i=0;i<3;i++){
    const wrapper=node("label",undefined,"song-choice"),label=node("span",String(i+1).padStart(2,"0")+" / SONG"),select=node("select");
    select.setAttribute("aria-label","Song "+(i+1));label.className="song-label";
    tracks.forEach(t=>{
      const option=node("option",t.title+" — "+(t.album||"HUMKIN RADIO"));
      option.value=t.id;select.append(option);
    });
    select.value=draft.tracks[i];
    select.addEventListener("change",()=>{
      if(draft.tracks.some((id,j)=>j!==i&&id===select.value)){
        select.value=draft.tracks[i];notice("Each song gets one spot. Choose a different recording.");return;
      }
      draft.tracks[i]=select.value;storeDraft();clearPlayback();notice(guest?"Preview changed. Make it yours to keep a local copy.":"Your station draft was saved on this device.");
    });
    wrapper.append(label,select);host.append(wrapper);
  }
}
function render(){
  $("station-name").value=draft.name;
  $("station-intro").value=draft.intro;
  $("station-mode").value=draft.mode;
  $("receive").hidden=!guest;
  $("play").disabled=draft.tracks.length!==3;
  $("share").disabled=draft.tracks.length!==3;
  renderChoices();showTrack();seedDisplay();
}
async function startSong(index){
  const song=tracks.find(t=>t.id===draft.tracks[index]);
  if(!song){notice("This song is no longer in the published rotation.");return;}
  position=index;showTrack();audio.src=song.src;
  try{await audio.play();notice("You're hearing "+song.title+" · song "+(index+1)+" of three.");}
  catch{notice("Playback needs a tap. Use the play button in the player.");}
}
$("play").addEventListener("click",()=>{
  readInputs();
  if(!guest&&!establishSeed())return;
  startSong(0);
});
audio.addEventListener("ended",()=>{
  if(position<2){startSong(position+1);}
  else notice("Your three-song signal has finished. A good place for a little silence.");
});
audio.addEventListener("error",()=>notice("That recording could not load. Check the connection or choose another song."));
$("find").addEventListener("click",()=>{
  if(tracks.length<3)return;
  readInputs();draft.tracks=M.pick(tracks,draft.mode);
  storeDraft();clearPlayback();renderChoices();
  notice(guest?"Another arrangement is ready. Make it yours to save it.":"Three real recordings, ready to listen to or rearrange.");
});
for(const key of ["station-name","station-intro","station-mode"]){
  $(key).addEventListener("change",()=>{readInputs();notice(guest?"This is still a guest signal. Make it yours to save a copy.":"Your changes were saved on this device.");});
}
$("inherit").addEventListener("click",()=>{
  guest=false;
  if(!establishSeed()){guest=true;return;}
  const url=new URL(location.href);url.search="";url.hash="";
  history.replaceState(null,"",url.href);
  storeDraft();render();
  notice("This is your local copy now. The original link is unchanged.");
});
$("share").addEventListener("click",async()=>{
  readInputs();
  if(!guest&&!establishSeed())return;
  let url;
  try{url=M.toUrl(location.href,draft,tracks)}catch(e){notice(e.message);return;}
  $("fallback").hidden=true;$("share-url").value=url;
  try{
    if(navigator.share){
      await navigator.share({title:draft.name+" · HUMKIN RADIO",text:"Three songs from my little signal.",url});
      notice("Signal prepared for sharing. Other listeners can make their own version.");return;
    }
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(url);
      notice("A shareable listening link is copied. You decide where it goes.");return;
    }
  }catch(e){if(e.name==="AbortError"){notice("Sharing cancelled. Your program is still here.");return;}}
  $("fallback").hidden=false;$("share-url").focus();$("share-url").select();
  notice("Copy the link shown below. Nothing has been posted automatically.");
});
$("backup-seed").addEventListener("click",()=>{
  if(!rootSeed)return;
  try{
    const data=S.backup(rootSeed,draft,tracks);
    const bytes=JSON.stringify(data,null,2);
    const blob=new Blob([bytes],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="humkin-station-seed-backup.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    notice("Your station seed and current draft were backed up. Keep the file somewhere safe.");
  }catch(e){notice("Backup failed: "+e.message);}
});
$("restore-seed").addEventListener("change",async event=>{
  const file=event.target.files?.[0];event.target.value="";
  if(!file)return;
  if(file.size>30000){notice("That station backup is unexpectedly large.");return;}
  try{
    const result=S.restore(JSON.parse(await file.text()),tracks);
    const changing=rootSeed?.stationId!==result.station.stationId;
    if(changing&&!confirm(rootSeed?
      "Restore another station? This REPLACES your current local station seed and draft. Back up the existing one first.":
      "Restore this saved station and replace your current draft on this device?"))return;
    if(!store)throw Error("Local save storage is unavailable.");
    // Keep both store writes explicit; this never touches the Orchard or Network keys.
    store.setItem(S.KEY,JSON.stringify(result.station));
    store.setItem(M.KEY,JSON.stringify(result.current));
    rootSeed=S.read(store);draft=M.normalize(result.current,tracks);
    guest=false;receivedOrigin=null;
    const url=new URL(location.href);url.search="";url.hash="";
    history.replaceState(null,"",url.href);
    clearPlayback();render();
    notice("Your original station seed and current arrangement were restored.");
  }catch(e){notice("Restore failed: "+e.message);}
});
async function boot(){
  try{
    const response=await fetch(manifestURL.href,{cache:"no-store"});
    if(!response.ok)throw Error("station catalog unavailable");
    const data=await response.json();
    tracks=safeCatalog(data.tracks);
    if(tracks.length<3)throw Error("too few playable recordings");
    const shared=M.fromUrl(location.search,tracks);
    // The receiver hands over a single published song, not a finished share
    // link. This choice becomes the first song of a new editable arrangement.
    const seeded=shared?null:M.fromSeed(location.search,tracks);
    receivedOrigin=shared?{...shared,tracks:shared.tracks.slice()}:null;
    guest=!!shared;
    rootSeed=S.read(store);
    const stored=storedDraft();
    draft=shared||seeded||M.normalize(stored,tracks);
    if(!shared&&!stored){
      draft.name=M.clean(profileName(),48)||draft.name;
      storeDraft();
    }
    if(seeded){
      // Never replace an existing immutable station origin; this updates only
      // the mutable local draft. Remove the handoff query after saving it.
      storeDraft();
      if(store){
        const cleanUrl=new URL(location.href);
        cleanUrl.searchParams.delete("seed");
        history.replaceState(null,"",cleanUrl.href);
      }
    }
    render();
    notice(guest?"Someone sent you three real songs. Play them, or make a copy.":
      seeded?"That song became the first seed of your new arrangement. Shape the other two, then start your station.":
      rootSeed?"Your station remembers its beginning. The current arrangement can keep evolving.":"Your selections will become your station's permanent starting seed when you begin.");
  }catch(e){
    $("track-choices").textContent="The published music list is unavailable. Try again when you're connected.";
    notice("The station catalog could not load. No saved progress was changed.");
  }
}
boot();
})();