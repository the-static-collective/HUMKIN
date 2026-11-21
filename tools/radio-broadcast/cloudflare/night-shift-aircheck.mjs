import {pathToFileURL} from "node:url";
#!/usr/bin/env node
// Read-only public Cloud Autopilot aircheck. No credentials, R2 writes or playout changes.
const TS_PATH = /^\/autopilot\/([a-z0-9-]+)\/segments\/[a-f0-9]{64}\/segment-[0-9]{6}\.ts$/;
const MAX_RESPONSE_BYTES = 2_000_000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function insist(condition, code) {
  if (!condition) throw new Error(code);
}
async function take(fetcher, url) {
  const result = await fetcher(url, {redirect:"error", headers:{Accept:"*/*"},
    signal: AbortSignal.timeout(12000)});
  return result;
}
async function json(fetcher, url) {
  const res = await take(fetcher,url);
  let data = {};
  try { data = await res.json(); } catch {}
  return {status:res.status,data};
}
function getOrigin(value) {
  const parsed = new URL(value);
  insist(parsed.protocol === "https:" && !parsed.username && !parsed.password &&
    parsed.search === "" && parsed.hash === "" && parsed.pathname === "/",
    "EXPECTED_WORKER_HTTPS_ORIGIN");
  return parsed.origin;
}
export async function inspectWorker(origin, station="station-one", fetcher=fetch) {
  const host = getOrigin(origin);
  insist(/^[a-z0-9][a-z0-9-]{0,31}$/.test(station), "BAD_STATION_ID");
  const base=host+"/autopilot/"+station+"/";
  const status=await json(fetcher,base+"status");
  if(status.status !== 200 || status.data.on_air !== true) {
    return {ok:false, stage:"status", http_status:status.status,
      reason:status.status===404?"AUTOPILOT_ROUTE_NOT_DEPLOYED":
        status.data.error || status.data.mode || "AUTOPILOT_NOT_READY",
      worker_origin:host,station};
  }
  const path=base+"live.m3u8";
  const list=await take(fetcher,path);
  if(list.status !== 200) return {ok:false,stage:"playlist",http_status:list.status,station};
  insist((list.headers.get("content-type")||"").includes("mpegurl"),"NOT_HLS_CONTENT");
  const playlist=await list.text();
  insist(playlist.length < 100_000 && playlist.startsWith("#EXTM3U"),
    "INVALID_PLAYLIST");
  const lines=playlist.split(/\r?\n/);
  const seq=lines.find(x=>x.startsWith("#EXT-X-MEDIA-SEQUENCE:"));
  const sequence=Number(seq?.split(":")[1]);
  insist(Number.isSafeInteger(sequence) && sequence>=0, "INVALID_MEDIA_SEQUENCE");
  const segments=lines.filter(x=>x && !x.startsWith("#"));
  insist(segments.length>=1 && segments.length<=20,"INVALID_SEGMENT_WINDOW");
  insist(lines.filter(x=>x.startsWith("#EXTINF:")).length===segments.length,
    "MISSING_SEGMENT_DURATIONS");
  const segmentUrls=segments.map(item=>{
    const url=new URL(item,path);
    insist(url.origin===host && TS_PATH.test(url.pathname) &&
      !url.search && !url.hash && url.pathname.startsWith("/autopilot/"+station+"/"),
      "UNSAFE_SEGMENT_REFERENCE");
    return url.href;
  });
  const playing=await json(fetcher,base+"now-playing");
  insist(playing.status===200 && playing.data.on_air===true &&
    typeof playing.data.track?.id==="string", "NOW_PLAYING_UNAVAILABLE");
  // Request one real media object, not merely a published playlist.
  const res=await take(fetcher,segmentUrls[segmentUrls.length-1]);
  insist(res.status===200 && (res.headers.get("content-type")||"").includes("mp2t"),
    "SEGMENT_UNAVAILABLE");
  const declared=Number(res.headers.get("content-length")||0);
  insist(!declared || declared<=MAX_RESPONSE_BYTES, "SEGMENT_TOO_LARGE");
  const bytes=new Uint8Array(await res.arrayBuffer());
  insist(bytes.length>=188 && bytes.length<=MAX_RESPONSE_BYTES && bytes[0]===0x47,
    "NOT_MPEG_TS_MEDIA");
  return {ok:true,stage:"api-and-media",station,worker_origin:host,
    revision:status.data.revision,media_sequence:sequence,
    segments_in_window:segments.length,track_id:playing.data.track.id,
    track_title:playing.data.track.title,media_bytes_checked:bytes.length,
    sampled_at:new Date().toISOString(),receiver_audio_verified:false,
    acer_off_verified:false};
}
export async function watchWorker(origin,station,seconds=0,intervalSeconds=15,fetcher=fetch) {
  insist(Number.isInteger(seconds) && seconds>=0 && seconds<=3600,"INVALID_WATCH_DURATION");
  insist(Number.isInteger(intervalSeconds) && intervalSeconds>=5 && intervalSeconds<=120,
    "INVALID_WATCH_INTERVAL");
  const samples=[];
  const start=Date.now();
  while (true) {
    const sample=await inspectWorker(origin,station,fetcher);
    samples.push(sample);
    if(!sample.ok) break;
    if(Date.now()-start>=seconds*1000)break;
    await pause(Math.min(intervalSeconds*1000,seconds*1000-(Date.now()-start)));
  }
  const successful=samples.every(s=>s.ok);
  const monotonic=successful && samples.every((x,i)=>i===0 ||
    x.media_sequence>=samples[i-1].media_sequence);
  const advanced=successful && samples.length>=2 &&
    samples[samples.length-1].media_sequence>samples[0].media_sequence;
  return {schema:"humkin.night-shift-aircheck/v1",read_only:true,
    verdict:!successful?"BLOCKED":!monotonic?"FAILED_CLOCK":
      seconds>0 && !advanced?"CLOCK_NOT_PROVEN":"API_MEDIA_VERIFIED",
    samples,monotonic,clock_advanced:advanced,
    receiver_audio_verified:false,acer_off_verified:false};
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const args=process.argv.slice(2);
  function arg(flag,fallback) {
    const i=args.indexOf(flag);
    return i===-1?fallback:args[i+1];
  }
  const origin=arg("--origin", "https://humkin-long-wave.joyvolcanomusic.workers.dev/");
  const station=arg("--station", "station-one");
  const seconds=Number(arg("--watch-seconds","0"));
  const interval=Number(arg("--interval-seconds","15"));
  watchWorker(origin,station,seconds,interval).then(receipt=>{
    process.stdout.write(JSON.stringify(receipt,null,2)+"\n");
    if(receipt.verdict!=="API_MEDIA_VERIFIED")process.exitCode=1;
  }).catch(error=>{
    process.stderr.write(JSON.stringify({verdict:"FAILED",error:error.message,
      receiver_audio_verified:false,acer_off_verified:false})+"\n");
    process.exitCode=1;
  });
}
