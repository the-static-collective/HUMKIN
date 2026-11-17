/* iOS14 Pocket Receiver: cache the application shell, never auto-cache music.
   Distinct namespace protects from the root HUMKIN service worker's cleanup. */
var CACHE="pocketreceiver-shell-v1";
var SHELL=[
  "./","./index.html","./iphone.css","./iphone.js","./compat.js",
  "./manifest.webmanifest","../../cover.jpg",
  "../scheduler.js","../autodj.js","../bumper-brain.js",
  "../art-library.js","../rotation-memory.js","../fair-rotation.js",
  "../clock-sync.js","../hosted-nowplaying.js","../chart-rotation.js",
  "../radio.js"
];
self.addEventListener("install",function(event){
  event.waitUntil(caches.open(CACHE).then(function(cache){return cache.addAll(SHELL);})
    .then(function(){return self.skipWaiting();}));
});
self.addEventListener("activate",function(event){
  event.waitUntil(caches.keys().then(function(names){
    return Promise.all(names.filter(function(name){
      return name.indexOf("pocketreceiver-shell-")===0&&name!==CACHE;
    }).map(function(name){return caches.delete(name);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener("fetch",function(event){
  var request=event.request;
  if(request.method!=="GET")return;
  var url=new URL(request.url);
  if(url.origin!==location.origin)return;
  // Always stream songs directly from their original URL, including byte ranges.
  if(/\/(audio|recordings)\//.test(url.pathname)||/\.(mp3|m4a|aac)(?:$|[?#])/i.test(url.pathname))return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).catch(function(){
      return caches.open(CACHE).then(function(c){
        return c.match("./index.html").then(function(r){
          return r || new Response("Offline. Connect to the internet to tune in.",{
            status:503,headers:{"Content-Type":"text/plain"}
          });
        });
      });
    }));
    return;
  }
  event.respondWith(fetch(request).then(function(fresh){
    if(fresh.ok&&SHELL.some(function(part){
      return new URL(part,self.registration.scope).pathname===url.pathname;
    })){
      var copy=fresh.clone();
      caches.open(CACHE).then(function(c){c.put(url.href,copy);}).catch(function(){});
    }
    return fresh;
  }).catch(function(){
    return caches.open(CACHE).then(function(c){return c.match(url.href);});
  }));
});
