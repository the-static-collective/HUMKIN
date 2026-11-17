/* iOS14 compatibility: pure media-element playback, no extra Web Audio bed.
   Older WebKit may suspend AudioContext when screen locks; preserve native audio.
   This affects only the /fm/iphone/ receiver. Desktop /fm/ keeps its radio bed. */
(function(root){
  "use strict";
  function QuietSignal(){this.enabled=false;}
  QuietSignal.prototype.enable=function(){this.enabled=true;return Promise.resolve();};
  QuietSignal.prototype.setPlayback=function(){};
  QuietSignal.prototype.status=function(){return {enabled:false,reason:"iOS14 media-only compatibility"};};
  root.HUMKIN_WARM_SIGNAL={WarmSignal:QuietSignal};
})(window);
