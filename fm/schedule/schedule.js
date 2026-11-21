/* HUMKIN Radio House: published cloud plan, not a transmitter or listening receipt.
 * The browser only reads a sanitized Cloudflare Worker projection.
 */
export const CLOUD_SCHEDULE_URL =
  "https://humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/schedule";

function short(value,limit=160) {
  return typeof value==="string" ? value.trim().slice(0,limit) : "";
}
function utcStamp(value) {
  if(typeof value!=="string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))return "";
  const date=new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : "";
}
function safeArt(value) {
  try {
    const url=new URL(value);
    return url.protocol==="https:" && !url.username && !url.password ? url.href : "";
  }catch{return "";}
}
export function normalizeSchedule(raw) {
  if(raw?.schema!=="humkin.autopilot.public-schedule/v1" ||
     raw?.mode!=="cloud_autopilot_schedule" || raw?.station_id!=="station-one" ||
     typeof raw.revision!=="string" || !raw.revision ||
     !Number.isInteger(raw.rotation_track_count) || raw.rotation_track_count<1 ||
     !Number.isFinite(raw.cycle_duration_ms) || raw.cycle_duration_ms<=0 ||
     !utcStamp(raw.as_of_utc) ||
     !Array.isArray(raw.upcoming) || !raw.upcoming.length || raw.upcoming.length>1000 ||
     !Array.isArray(raw.pending_revisions) || raw.pending_revisions.length>32)return null;
  const upcoming=[];
  for(const item of raw.upcoming) {
    if(!item || !item.track || !short(item.track.id,80) ||
       !utcStamp(item.start_at_utc) || !utcStamp(item.end_at_utc))return null;
    const start=Date.parse(item.start_at_utc),end=Date.parse(item.end_at_utc);
    if(end<=start || (upcoming.length && Date.parse(upcoming.at(-1).end_at_utc)>start))return null;
    upcoming.push({
      revision:short(item.revision,80),
      is_current:item.is_current===true,
      start_at_utc:utcStamp(item.start_at_utc),
      end_at_utc:utcStamp(item.end_at_utc),
      track:{id:short(item.track.id,80),
        title:short(item.track.title)||"Untitled recording",
        artist:short(item.track.artist)||"HUMKIN",
        album:short(item.track.album),
        artwork_url:safeArt(item.track.artwork_url)}
    });
  }
  const pending_revisions=[];
  for(const item of raw.pending_revisions) {
    if(!item || !short(item.revision,80) || !utcStamp(item.effective_at_utc))return null;
    pending_revisions.push({revision:short(item.revision,80),
      effective_at_utc:utcStamp(item.effective_at_utc),
      track_count:Number.isInteger(item.track_count)?item.track_count:0});
  }
  return {
    station_id:"station-one",revision:short(raw.revision,80),
    on_air:raw.on_air===true,reason:short(raw.reason,120),
    as_of_utc:utcStamp(raw.as_of_utc),
    rotation_track_count:raw.rotation_track_count,
    cycle_duration_ms:raw.cycle_duration_ms,
    truncated:raw.truncated===true,
    pending_revisions,upcoming
  };
}
export function formatWhen(iso,zone="local") {
  if(!utcStamp(iso))return "Time unavailable";
  const options={hour:"numeric",minute:"2-digit",hour12:true};
  if(zone==="UTC")options.timeZone="UTC";
  const display=new Intl.DateTimeFormat("en-US",options).format(new Date(iso));
  return zone==="UTC"?display+" UTC":display;
}
function formatDay(iso,zone="local"){
  const options={weekday:"short",month:"short",day:"numeric"};
  if(zone==="UTC")options.timeZone="UTC";
  return new Intl.DateTimeFormat("en-US",options).format(new Date(iso));
}
function durationText(milliseconds) {
  const minutes=Math.round(milliseconds/60000);
  const hours=Math.floor(minutes/60),remainder=minutes%60;
  return hours?hours+" hr "+remainder+" min":minutes+" min";
}

if(typeof document!=="undefined"){
  const get=id=>document.getElementById(id);
  const state=get("schedule-state"),list=get("schedule-list"),refresh=get("refresh");
  const zoneButton=get("time-zone");
  let latest=null,zone="local",requesting=false;
  const setText=(id,value)=>{get(id).textContent=value;};
  function render(plan) {
    setText("revision-label","REVISION "+plan.revision);
    setText("record-count",String(plan.rotation_track_count));
    setText("loop-length",durationText(plan.cycle_duration_ms));
    setText("updated-at","SOURCE CHECKED "+formatWhen(plan.as_of_utc,zone)+" · "+formatDay(plan.as_of_utc,zone));
    state.textContent=plan.on_air?
      "PUBLISHED CLOUD PLAN · CURRENT MEDIA SEGMENTS REPORTED PRESENT":
      plan.reason==="PROGRAM_MEDIA_INCOMPLETE"?
        "PLAN PUBLISHED · CLOUD AUDIO SEGMENTS MISSING — DO NOT ASSUME ON AIR":
        "PLAN PUBLISHED · PROGRAM NOT YET ON AIR";
    get("signal-indicator").dataset.status=plan.on_air?"ready":"hold";
    const next=plan.pending_revisions[0];
    const notice=get("revision-notice");
    if(next){
      notice.hidden=false;
      notice.textContent="PUBLISHED CHANGE SCHEDULED · "+next.revision+
        " · "+formatDay(next.effective_at_utc,zone)+" "+formatWhen(next.effective_at_utc,zone)+
        " · "+next.track_count+" tracks";
    }else notice.hidden=true;
    list.replaceChildren();
    for(const [index,item] of plan.upcoming.entries()){
      const row=document.createElement("li");
      row.className="schedule-item"+(item.is_current?" current":"");
      const artwork=document.createElement("div");artwork.className="item-art";
      if(item.track.artwork_url) {
        const image=document.createElement("img");image.src=item.track.artwork_url;
        image.alt="";image.loading="lazy";image.referrerPolicy="no-referrer";
        artwork.append(image);
      }else artwork.textContent="✳";
      const timing=document.createElement("div");timing.className="item-time";
      const time=document.createElement("time");time.dateTime=item.start_at_utc;
      time.textContent=formatWhen(item.start_at_utc,zone);
      const day=document.createElement("small");day.textContent=formatDay(item.start_at_utc,zone);
      timing.append(time,day);
      const details=document.createElement("div");details.className="item-details";
      const title=document.createElement("strong");title.textContent=item.track.title;
      const artist=document.createElement("span");artist.textContent=item.track.artist;
      const album=document.createElement("small");album.textContent=item.track.album;
      details.append(title,artist,album);
      const badge=document.createElement("span");badge.className="item-badge";
      badge.textContent=item.is_current?"CLOUD CLOCK":index===1?"UP NEXT":"#"+(index+1);
      if(item.revision!==plan.revision){
        const change=document.createElement("small");change.className="item-revision";
        change.textContent="REVISION "+item.revision;
        details.append(change);
      }
      row.append(artwork,timing,details,badge);
      list.append(row);
    }
    setText("schedule-footnote",
      plan.upcoming.length+" scheduled track appearances displayed"+
      (plan.truncated?" · additional entries omitted by safety limit":"")+
      ". Times are planned from the published cloud clock, not confirmed listening times.");
    zoneButton.textContent=zone==="UTC"?"SHOW MY LOCAL TIME":"SHOW UTC";
    zoneButton.setAttribute("aria-pressed",zone==="UTC"?"true":"false");
  }
  async function load(){
    if(requesting)return;
    requesting=true;refresh.disabled=true;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try {
      const response=await fetch(CLOUD_SCHEDULE_URL,{cache:"no-store",signal:controller.signal});
      const raw=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(response.status===404?"Schedule service not deployed yet.":
        "Cloud schedule unavailable ("+response.status+").");
      const plan=normalizeSchedule(raw);
      if(!plan)throw new Error("Cloud response did not match the published schedule contract.");
      latest=plan;
      render(plan);
    }catch(error){
      state.textContent=(latest?"LAST KNOWN PLAN — REFRESH FAILED. ":"NO SCHEDULE AVAILABLE. ")+
        (error instanceof Error?error.message:"Network unavailable")+
        " The original radio is unchanged.";
    }finally{clearTimeout(timeout);refresh.disabled=false;requesting=false;}
  }
  refresh.addEventListener("click",()=>{void load();});
  zoneButton.addEventListener("click",()=>{
    zone=zone==="local"?"UTC":"local";
    if(latest)render(latest);
  });
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden)void load();
  });
  setInterval(()=>{if(!document.hidden)void load();},30000);
  void load();
}
