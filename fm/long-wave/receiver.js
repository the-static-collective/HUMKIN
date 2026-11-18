/* HUMKIN LONG WAVE — one native <audio> src, not a per-song JS playlist. */
export function validLiveUrl(value){
 try{
   const url=new URL(value);
   if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)return null;
   if(url.pathname!=="/live.mp3")return null;
   const host=url.hostname.toLowerCase();
   // Keep private-network URLs, arbitrary streaming proxies and credential
   // leakage out of this operator-facing receiver. The dedicated live host
   // can be added when DNS is configured.
   if(!(host.endsWith(".workers.dev")&&host.split(".").length>=4)
       &&host!=="stream.abundent.org")return null;
   return url.href;
 }catch{return null}
}
if(typeof document!=="undefined") {
const $=id=>document.getElementById(id);
const audio=$("receiver"),form=$("connect-form"),input=$("stream-url"),status=$("status");
const KEY="humkin-long-wave-live-url-v1";
function setStatus(s){status.textContent=s}
function connect(url){
 const good=validLiveUrl(url);
 if(!good){setStatus("INVALID SIGNAL. USE HTTPS /live.mp3 FROM A CLOUDFLARE WORKER.");return false}
 audio.pause();audio.removeAttribute("src");audio.load();
 audio.src=good;
 input.value=good;
 setStatus("SIGNAL SAVED. PRESS PLAY ON THE RADIO BELOW.");
 if(navigator.mediaSession){
   try{navigator.mediaSession.metadata=new MediaMetadata({title:"HUMKIN LONG WAVE",artist:"HUMKIN RADIO",album:"One continuous signal"})}catch{}
 }
 return true;
}
form.addEventListener("submit",event=>{
 event.preventDefault();const url=validLiveUrl(input.value);
 if(!url){setStatus("ENTER YOUR DEPLOYED CLOUDFLARE WORKER'S /live.mp3 ADDRESS.");return}
 try{localStorage.setItem(KEY,url)}catch{}
 connect(url);
});
$("clear-url").addEventListener("click",()=>{
 try{localStorage.removeItem(KEY)}catch{}
 input.value="";audio.pause();audio.removeAttribute("src");audio.load();
 setStatus("SIGNAL CLEARED. YOUR REGULAR RADIO IS UNAFFECTED.");
});
audio.addEventListener("playing",()=>setStatus("LONG WAVE · LIVE / SCREEN-OFF TEST"));
audio.addEventListener("waiting",()=>setStatus("BUFFERING THE LONG WAVE…"));
audio.addEventListener("error",()=>setStatus("TRANSMITTER NOT REACHABLE. CHECK THE WORKER AND BUCKET BINDING."));
audio.addEventListener("ended",()=>setStatus("THE LONG WAVE DISCONNECTED. PRESS PLAY TO RECONNECT."));
try{const old=localStorage.getItem(KEY);if(old)connect(old)}catch{}

}
