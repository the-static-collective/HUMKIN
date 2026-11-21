import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeSchedule,formatWhen} from "../fm/schedule/schedule.js";

const root=new URL("../",import.meta.url);
const get=path=>readFileSync(new URL(path,root),"utf8");
const valid={
  schema:"humkin.autopilot.public-schedule/v1",mode:"cloud_autopilot_schedule",
  station_id:"station-one",revision:"first",on_air:true,
  as_of_utc:"2026-11-21T12:00:00.000Z",rotation_track_count:2,
  cycle_duration_ms:20000,pending_revisions:[],
  upcoming:[{
    revision:"first",is_current:true,start_at_utc:"2026-11-21T11:59:50.000Z",
    end_at_utc:"2026-11-21T12:00:10.000Z",
    track:{id:"song-a",title:"One",artist:"HUMKIN",album:"NIGHT SHIFT",artwork_url:"https://humkin.abundent.org/cover.jpg"}
  }]
};
test("viewer accepts only the published Cloud HOUSE schedule contract",()=>{
  const result=normalizeSchedule(valid);
  assert.equal(result.upcoming[0].track.title,"One");
  assert.equal(normalizeSchedule({...valid,mode:"personal_continuous_mp3"}),null);
  assert.equal(normalizeSchedule({...valid,schema:"wrong"}),null);
  assert.equal(normalizeSchedule({...valid,station_id:"other-station"}),null);
  assert.equal(normalizeSchedule({...valid,upcoming:[]}),null);
});

test("display fields are bounded and timestamps are required",()=>{
  const bad=structuredClone(valid);
  bad.upcoming[0].start_at_utc="not-time";
  assert.equal(normalizeSchedule(bad),null);
  const long=structuredClone(valid);
  long.upcoming[0].track.title="Z".repeat(600);
  assert.equal(normalizeSchedule(long).upcoming[0].track.title.length,160);
  assert.match(formatWhen("2026-11-21T20:00:00.000Z","UTC"),/8:00/);
});

test("schedule is reachable from both Night Shift and the radio station",()=>{
  const html=get("fm/schedule/index.html");
  assert.match(html,/<title>HUMKIN .* SCHEDULE/);
  assert.match(html,/id="schedule-list"/);
  assert.match(html,/id="schedule-state"/);
  assert.match(html,/id="refresh"/);
  assert.match(html,/src="\.\/schedule\.js"/);
  assert.match(get("fm/night-shift/index.html"),/href="\.\.\/schedule\/"/);
  assert.match(get("fm/index.html"),/href="\.\/schedule\/"/);
});

test("viewer is read-only, text safe, and pinned to the existing Worker",()=>{
  const js=get("fm/schedule/schedule.js");
  const html=get("fm/schedule/index.html");
  assert.match(js,/https:\/\/humkin-long-wave\.joyvolcanomusic\.workers\.dev/);
  assert.match(js,/\/autopilot\/station-one\/schedule/);
  assert.match(js,/textContent/);
  assert.doesNotMatch(js,/\binnerHTML\b/);
  assert.doesNotMatch(js,/localStorage|serviceWorker|fetch\([^)]*method:\s*["'](?:POST|PUT|DELETE|PATCH)/);
  assert.doesNotMatch(html,/API[_ -]?KEY|CLOUDFLARE_API_TOKEN/);
});
