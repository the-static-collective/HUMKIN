/* HUMKIN Pocket Receiver · iOS 14 home-screen shell.
   The real radio.js drives the ONLY audio element. This file adds no independent
   rotation, tracking, audio player, account, or server state. */
(function(){
"use strict";
function el(id){return document.getElementById(id);}
var audio=el("air");
var radio=window.HUMKIN_RADIO;
var albumScreen=el("album-screen");
var albumList=el("album-list");
var radioTab=el("tab-radio");
var albumTab=el("tab-albums");
var oldTitle="",oldArtist="",history=[];
var root=new URL("../../",document.baseURI);
function picture(album,artwork){
  var name=String(album||"").toLowerCase();
  if(name==="everywhere;near you")return new URL("releases/everywhere-near-you/cover.jpg",root).href;
  if(name==="mutant pop")return new URL("cover.jpg",root).href;
  try{
    var url=new URL(artwork);
    if(url.protocol==="https:"&&url.username===""&&url.password==="")return url.href;
  }catch(e){}
  return new URL("cover.jpg",root).href;
}
function addText(parent,tag,content,cls){
  var node=document.createElement(tag);
  node.textContent=content;
  if(cls)node.className=cls;
  parent.appendChild(node);
  return node;
}
function showShelf(open){
  albumScreen.hidden=!open;
  albumTab.classList.toggle("active",open);
  radioTab.classList.toggle("active",!open);
  if(open){
    albumTab.setAttribute("aria-current","page");
    radioTab.removeAttribute("aria-current");
    albumScreen.scrollIntoView();
  }else{
    radioTab.setAttribute("aria-current","page");
    albumTab.removeAttribute("aria-current");
    window.scrollTo(0,0);
  }
}
function buildShelf(){
  if(!radio || !radio.albumCatalog)return false;
  var all=radio.albumCatalog();
  if(!all.length)return false;
  var grouping=Object.create(null),names=[];
  all.forEach(function(song){
    var album=String(song.album||"HUMKIN RADIO").trim();
    if(!grouping[album]){grouping[album]=[];names.push(album);}
    grouping[album].push(song);
  });
  var first=["MUTANT POP","everywhere;near you"];
  names.sort(function(a,b){
    var ai=first.indexOf(a),bi=first.indexOf(b);
    if(ai>=0||bi>=0)return (ai<0?99:ai)-(bi<0?99:bi);
    return a.localeCompare(b);
  });
  albumList.textContent="";
  names.forEach(function(name){
    var songs=grouping[name],cover=picture(name,songs[0].artwork);
    var button=document.createElement("button");
    button.type="button";button.className="album-tile";
    button.setAttribute("aria-label","Play "+name+"; "+songs.length+" tracks");
    var img=document.createElement("img");
    img.src=cover;img.alt="";img.width=67;img.height=67;img.loading="lazy";
    img.addEventListener("error",function(){img.onerror=null;img.src=new URL("cover.jpg",root).href;});
    button.appendChild(img);
    var details=addText(button,"span","","info");
    addText(details,"b",name);
    addText(details,"small",songs.length+" "+(songs.length===1?"RECORDING":"RECORDINGS")+" · PLAY FROM START");
    addText(button,"span","→","arrow");
    button.addEventListener("click",function(){
      if(!window.HUMKIN_RADIO || !window.HUMKIN_RADIO.playAlbum(name)){
        el("playback-message").textContent="This album is not available on the dial right now.";
        return;
      }
      showShelf(false);
      el("current-title").scrollIntoView();
    });
    albumList.appendChild(button);
  });
  return true;
}
function recordingChange(){
  var title=el("current-title").textContent.trim();
  var artist=el("current-artist").textContent.trim();
  if(title===oldTitle)return;
  if(oldTitle && oldTitle!=="FINDING A SONG…" && oldTitle!=="THE RADIO NEEDS A SIGNAL"){
    history.unshift({title:oldTitle,artist:oldArtist});
    history=history.slice(0,3);
    var ol=el("just-heard");ol.textContent="";
    history.forEach(function(item){addText(ol,"li",item.title);});
  }
  oldTitle=title;oldArtist=artist;
}
function wave(){
  el("waveform").classList.toggle("is-playing",!audio.paused && !audio.ended);
}
function homeScreenHelp(){
  var isApple=/iPad|iPhone|iPod/.test(navigator.userAgent);
  var standalone=navigator.standalone===true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  var dismissed=false;
  try{dismissed=sessionStorage.getItem("humkin-iphone-install-dismissed")==="yes";}catch(e){}
  if(isApple&&!standalone&&!dismissed)el("install-help").hidden=false;
}
el("dismiss-install").addEventListener("click",function(){
  el("install-help").hidden=true;
  try{sessionStorage.setItem("humkin-iphone-install-dismissed","yes");}catch(e){}
});
el("tab-albums").addEventListener("click",function(){showShelf(!albumScreen.hidden);});
el("close-albums").addEventListener("click",function(){showShelf(false);});
el("tab-radio").addEventListener("click",function(){
  showShelf(false);
  if(window.HUMKIN_RADIO && window.HUMKIN_RADIO.state.mode==="album"){
    window.HUMKIN_RADIO.changeMode("clock");
  }
});
audio.addEventListener("play",wave);audio.addEventListener("playing",wave);
audio.addEventListener("pause",wave);audio.addEventListener("ended",wave);
var observer=new MutationObserver(recordingChange);
observer.observe(el("current-title"),{childList:true,characterData:true,subtree:true});
recordingChange();
homeScreenHelp();
var tries=0,timer=setInterval(function(){
  tries++;
  if(buildShelf()||tries>=35)clearInterval(timer);
},700);
if("serviceWorker" in navigator){
  window.addEventListener("load",function(){
    navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(function(){});
  });
}
})();