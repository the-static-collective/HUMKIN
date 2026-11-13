/* HUMKIN Pocket Player. Static first; no tracking, no automatic audio downloads. */
const SHELL="humkin-shell-v10";
const MUSIC="humkin-music-v1";
const FILES=["./","./index.html","./styles.css","./gifts.css","./approved-look.css","./player.js","./gifts.js","./signup.js","./cover.jpg","./tracks.json","./privacy.html","./poster.html","./manifest.webmanifest","./somewhere.html","./somewhere.css","./somewhere.js","./embed.html","./embed.css","./embed.js","./discovery.json","./relay.html","./surprise.html","./surprise.css","./surprise.js","./commons.html","./commons.css","./commons.mjs","./commons/catalog.json"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith("humkin-")&&n!==SHELL&&n!==MUSIC).map(n=>caches.delete(n)));await self.clients.claim()})())});
async function respondFromCache(request,response){
 const range=request.headers.get("range");
 if(!range||!/^bytes=\d*-\d*$/.test(range))return response;
 const bytes=await response.blob(),total=bytes.size;
 const [a,b]=range.slice(6).split("-");
 let start=a===""?Math.max(total-Number(b),0):Number(a);
 let end=a===""?total-1:(b===""?total-1:Number(b));
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=total||start>end)return new Response(null,{status:416,headers:{"Content-Range":"bytes */"+total}});
 end=Math.min(total-1,end);
 return new Response(bytes.slice(start,end+1),{status:206,headers:{"Content-Type":response.headers.get("Content-Type")||"audio/mpeg","Accept-Ranges":"bytes","Content-Length":String(end-start+1),"Content-Range":"bytes "+start+"-"+end+"/"+total}});
}
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==location.origin)return;
 if(url.pathname.includes("/audio/")){
   event.respondWith((async()=>{const cached=await (await caches.open(MUSIC)).match(url.href);return cached?respondFromCache(request,cached):fetch(request)})());return;
 }
 if(request.mode==="navigate"){
   event.respondWith(fetch(request).catch(async()=>{const shell=await caches.open(SHELL);return await shell.match(new URL(url.pathname,location.origin).href)||await shell.match("./index.html")||Response.error()}));return;
 }
 // Keep interface scripts and markup in sync. Older cache-first workers could
 // serve an obsolete gifts.js alongside freshly deployed HTML, disabling buttons.
 // Match by path (ignoring a script's cache-busting query) and fetch online first.
 const shellPath=FILES.find(p=>new URL(p,self.registration.scope).pathname===url.pathname);
 if(shellPath){
   event.respondWith((async()=>{
     const cache=await caches.open(SHELL);
     const key=new URL(shellPath,self.registration.scope);
     try{
       const fresh=await fetch(request,{cache:"no-cache"});
       if(fresh.ok)await cache.put(key.href,fresh.clone());
       return fresh;
     }catch{
       return await cache.match(key.href)||Response.error();
     }
   })());
 }
});
self.addEventListener("message",event=>{
 if(event.data?.type!=="SAVE_HUMKIN_ALBUM"||!event.ports?.[0])return;
 const port=event.ports[0];
 event.waitUntil((async()=>{
   let success=0,failed=0;
   try{
     const tracks=await (await fetch(new URL("tracks.json",self.registration.scope),{cache:"no-store"})).json();
     const cache=await caches.open(MUSIC);
     for(const song of tracks.tracks){
       try{
         const url=new URL(song.url,self.registration.scope).href;
         const response=await fetch(url,{cache:"no-store"});
         if(!response.ok||response.status!==200)throw Error("MP3 not available");
         await cache.put(url,response);
         success++;
       }catch{failed++}
       port.postMessage({type:"progress",success,failed,total:tracks.tracks.length});
     }
     port.postMessage({type:"done",success,failed,total:tracks.tracks.length});
   }catch(err){port.postMessage({type:"error",message:"Couldn't save the album. Check your connection and free space."})}
 })());
});