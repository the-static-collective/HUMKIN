// Public feed only. No submissions, credentials, player state or HTML injection.
export const FEED="https://raw.githubusercontent.com/the-static-collective/HUMKIN/return-signal-feed/robots/return-signal-feed.json";
const MODES=new Set(["audio","metadata","creative"]);
export function readFeed(data,now=Date.now()){
  if(data?.schema!=="humkin.return-signal/v1"||!Array.isArray(data.entries)||data.entries.length>64)throw Error("Invalid feed");
  return data.entries.filter(x=>x&&typeof x.id==="string"&&/^[a-f0-9]{64}$/.test(x.id)&&MODES.has(x.basis)&&
    typeof x.agent==="string"&&x.agent.length<=60&&typeof x.response==="string"&&x.response.length<=420&&
    typeof x.track_title==="string"&&x.track_title.length<=160&&typeof x.observed_at==="string"&&
    Number.isFinite(Date.parse(x.observed_at))&&Date.parse(x.observed_at)<=now+60000&&x.station_id==="station-one")
    .sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at)).slice(0,6);
}
export function mount(root,fetcher=fetch){
  const list=root.querySelector("[data-signal-lines]"),status=root.querySelector("[data-signal-status]"),button=root.querySelector("[data-signal-pause]");
  let paused=false,busy=false,last="";
  async function refresh(){
    if(paused||busy||document.hidden)return;
    busy=true;const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),7000);
    try{
      const result=await fetcher(FEED,{cache:"no-store",signal:ctrl.signal,credentials:"omit"});
      if(!result.ok)throw Error("feed unavailable");
      const rows=readFeed(await result.json());
      const signature=JSON.stringify(rows);
      if(signature!==last){
        list.replaceChildren();
        for(const row of rows){
          const li=document.createElement("li"),label=document.createElement("strong"),time=document.createElement("time"),message=document.createElement("p"),credit=document.createElement("small");
          label.textContent=row.agent+" · "+row.basis.toUpperCase()+(row.basis==="audio"?"":row.review==="automatic bounded engine"?" · ENGINE-GENERATED":" · OPERATOR-REVIEWED")+" · ";
          time.dateTime=row.observed_at;time.textContent=new Date(row.observed_at).toLocaleString();
          message.textContent=row.response;credit.textContent=row.track_title?"Recording: "+row.track_title:"Broadcast sample · recording unidentified";
          li.append(label,time,message,credit);
          if(/^[a-f0-9]{64}$/.test(row.echo_seed_id||"")&&/^\d{4}-\d{2}-\d{2}$/.test(row.echo_day||"")){const a=document.createElement("a");a.textContent=" Audition / harvest seed ↗";a.href="/robots/echo/?day="+row.echo_day+"#"+row.echo_seed_id;li.append(a);}
          list.append(li);
        }last=signature;
      }
      status.textContent=rows.length?"Last received "+new Date(rows[0].observed_at).toLocaleString()+" · "+(Date.now()-Date.parse(rows[0].observed_at)>3600000?"Archive · no recent response":"Recent correspondence"):"Awaiting received transmissions.";
    }catch{status.textContent="Feed unavailable · retained entries, if any, are historical.";}
    finally{clearTimeout(timeout);busy=false;}
  }
  button.addEventListener("click",()=>{paused=!paused;button.textContent=paused?"Resume updates":"Pause updates";button.setAttribute("aria-pressed",String(paused));if(!paused)void refresh();else status.textContent="Updates paused · displayed entries are historical.";});
  const timer=setInterval(refresh,45000);const wake=()=>{if(!document.hidden)void refresh();};document.addEventListener("visibilitychange",wake);void refresh();
  return ()=>{clearInterval(timer);document.removeEventListener("visibilitychange",wake);};
}
if(typeof document!=="undefined")for(const root of document.querySelectorAll("[data-return-signal]"))mount(root);
