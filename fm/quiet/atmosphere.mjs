/* Browser adaptation of Haunted Toaster atmosphere.cjs deterministicField,
 * drawingRainField and smokeEvents (3652c2a96b6b287cda316d1c92daadf7c7417eaf).
 * Low-energy, fixed seed, masked particles; no audio mutation or network. */
export function deterministicField(seed=0x9e3779b9) {
  let state=(seed>>>0)||0x9e3779b9;
  return {next(){state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/0x100000000;},
    between(min,max){return min+(max-min)*this.next();}};
}
export function rainField(seed=42,count=34) {
  const rng=deterministicField(seed);
  return Array.from({length:Math.max(0,Math.min(78,count))},()=>({
    x:rng.next(),y:rng.next(),length:rng.between(.025,.075),
    speed:rng.between(.18,.34),opacity:rng.between(.08,.18),slant:rng.between(-.34,-.13)
  }));
}
export function mountAtmosphere(canvas) {
  const ctx=canvas.getContext("2d"); if(!ctx)return {setEnabled(){},stop(){}};
  const particles=rainField();const preference=matchMedia("(prefers-reduced-motion: reduce)");
  let enabled=!preference.matches,frame=0,last=0,elapsed=0;
  function draw(t) {
    frame=0;if(!enabled||document.hidden||preference.matches)return;
    elapsed+=last?Math.min(.05,(t-last)/1000):0;last=t;
    const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
    // Confine rain to the window on the original 16:9 artwork.
    ctx.save();ctx.beginPath();ctx.rect(w*.055,h*.035,w*.34,h*.55);ctx.clip();
    for(const p of particles){
      const y=((p.y+elapsed*p.speed)%1)*h*.55;
      const x=w*(.055+((p.x+elapsed*p.slant*.07)%1+1)%1*.34);
      ctx.strokeStyle="rgba(194,222,255,"+p.opacity+")";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+p.slant*p.length*h,y+p.length*h);ctx.stroke();
    }ctx.restore();
    // Slow rising steam and warm meter glow: visual-only, never audio-driven.
    for(let i=0;i<3;i++){const phase=(elapsed*.12+i/3)%1;const x=w*(.302+.009*Math.sin(phase*6.28+i));const y=h*(.79-phase*.1);
      ctx.fillStyle="rgba(255,235,210,"+(.08*Math.sin(phase*Math.PI))+")";ctx.beginPath();ctx.ellipse(x,y,5+phase*9,10+phase*12,0,0,Math.PI*2);ctx.fill();}
    const glow=ctx.createRadialGradient(w*.405,h*.565,0,w*.405,h*.565,w*.038);
    glow.addColorStop(0,"rgba(255,190,75,"+(.035+.02*Math.sin(elapsed*.7))+")");glow.addColorStop(1,"transparent");ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    frame=requestAnimationFrame(draw);
  }
  function sync(){cancelAnimationFrame(frame);frame=0;last=0;ctx.clearRect(0,0,canvas.width,canvas.height);if(enabled&&!document.hidden&&!preference.matches)frame=requestAnimationFrame(draw);}
  const change=()=>sync();document.addEventListener("visibilitychange",change);preference.addEventListener("change",change);sync();
  return {setEnabled(value){enabled=Boolean(value);sync();},stop(){enabled=false;sync();document.removeEventListener("visibilitychange",change);preference.removeEventListener("change",change);}};
}
