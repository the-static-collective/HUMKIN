import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveAutopilot } from "./cloud-autopilot.mjs";

const epoch = "2026-11-21T12:00:00.000Z";
const seedPath = "garden/radio-house/seeds/fellowship.json";
const publisher = "tools/radio-broadcast/station_seed.py";
const read = path => JSON.parse(readFileSync(path, "utf8"));
const run = (seed, out) => spawnSync(process.env.PYTHON || "python",
  [publisher, seed, "--effective-at", epoch, "--output", out], {encoding: "utf8"});

test("FELLOWSHIP seeds an independent playable schedule using the existing Worker", t => {
  const folder = mkdtempSync(join(tmpdir(), "station-seed-"));
  t.after(() => rmSync(folder, {recursive: true, force: true}));
  const out = join(folder, "fellowship");
  const result = run(seedPath, out);
  assert.equal(result.status, 0, result.stderr);
  return verifySignals(out);
});

async function verifySignals(out) {
  const plan = read(join(out, "program.json"));
  const receipt = read(join(out, "receipt.json"));
  const revision = plan.revisions[0];
  assert.equal(plan.station_id, "fellowship");
  assert.equal(revision.effective_at, epoch);
  assert.equal(receipt.revision, revision.id);
  assert.equal(receipt.stage, "prepared");
  assert.deepEqual(read(join(out, "crate.json")).tracks.map(track => track.id),
    ["fellowship-tone-a", "fellowship-tone-b"]);

  const houseSha = "a".repeat(64);
  const housePlan = {
    schema: "humkin.cloud-autopilot/v1", station_id: "station-one",
    revisions: [{id: "existing-house", effective_at: epoch, tracks: [{
      id: "existing-track", title: "Existing HOUSE track", artist: "HUMKIN",
      asset_sha: houseSha, durations_ms: [5000, 5000]
    }]}]
  };
  const stored = new Map([
    ["autopilot/programs/station-one.json", Buffer.from(JSON.stringify(housePlan))],
    ["autopilot/programs/fellowship.json", Buffer.from(JSON.stringify(plan))]
  ]);
  for (const track of revision.tracks) {
    track.durations_ms.forEach((_, index) => {
      const name = "segment-" + String(index).padStart(6, "0") + ".ts";
      const bytes = readFileSync(join(out, "cache", track.asset_sha, name));
      stored.set(`autopilot/segments/${track.asset_sha}/${name}`, bytes);
    });
  }
  stored.set(`autopilot/segments/${houseSha}/segment-000000.ts`, Buffer.of(0x47));
  stored.set(`autopilot/segments/${houseSha}/segment-000001.ts`, Buffer.of(0x47));
  const env = {RADIO_LIVE: {
    get: async key => stored.has(key) ? {
      body: stored.get(key), text: async () => stored.get(key).toString("utf8")
    } : null,
    head: async key => stored.has(key) ? {size: stored.get(key).length} : null
  }};
  // The Worker projects a clock 15 seconds behind wall time.
  const now = Date.parse(epoch) + 35000;
  const get = (station, route, time = now) => serveAutopilot(
    new Request(`https://radio.test/autopilot/${station}/${route}`), env, time);
  const schedule = await (await get("fellowship", "schedule")).json();
  const playing = await (await get("fellowship", "now-playing")).json();
  assert.equal(schedule.on_air, true);
  assert.equal(schedule.revision, revision.id);
  assert.equal(playing.track.id, "fellowship-tone-b");
  assert.equal(playing.track.id, schedule.upcoming[0].track.id);
  assert.equal((await (await get("station-one", "now-playing")).json()).revision, "existing-house");
  const playlist = await (await get("fellowship", "live.m3u8")).text();
  const segment = playlist.split("\n").find(line => line.startsWith("./segments/")).slice(2);
  const transport = await get("fellowship", segment);
  assert.equal(transport.status, 200);
  assert.equal(new Uint8Array(await transport.arrayBuffer())[0], 0x47);
  assert.equal((await get("station-one", segment)).status, 404);

  const key = "autopilot/" + segment;
  const saved = stored.get(key);
  stored.delete(key);
  assert.equal((await get("fellowship", "status")).status, 503);
  assert.equal((await get("station-one", "status")).status, 200);
  stored.set(key, saved);
  assert.equal((await get("fellowship", "status")).status, 200);

  // Rehearse restoring this station's previous snapshot after a bad candidate.
  const pointer = "autopilot/programs/fellowship.json";
  const previous = stored.get(pointer);
  const cutover = Date.parse(epoch) + revision.tracks
    .flatMap(track => track.durations_ms).reduce((total, duration) => total + duration, 0);
  const candidate = {...plan, revisions: [revision, {
    id: "failed-candidate", effective_at: new Date(cutover).toISOString(),
    tracks: [{...revision.tracks[0], asset_sha: "b".repeat(64)}]
  }]};
  const afterCutover = cutover + 16000;
  const readStatus = station => get(station, "status", afterCutover);
  const intact = await (await readStatus("station-one")).json();
  stored.set(pointer, Buffer.from(JSON.stringify(candidate)));
  assert.deepEqual(await (await readStatus("fellowship")).json(),
    {on_air: false, error: "PROGRAM_MEDIA_INCOMPLETE"});
  stored.set(pointer, previous);
  assert.equal((await (await readStatus("fellowship")).json()).revision, revision.id);
  assert.deepEqual(await (await readStatus("station-one")).json(), intact);
}

test("a rehearsal seed cannot target Station One", t => {
  rejectSeed(t, seed => { seed.station_id = "station-one"; }, /reserved station/i);
});

test("unreviewed sources cannot enter the program", t => {
  rejectSeed(t, seed => { seed.media_sources[0].approval = "pending"; }, /source approval/i);
});

test("external source URLs cannot enter the rehearsal crate", t => {
  rejectSeed(t, seed => { seed.media_sources[0].url = "https://example.org/music.mp3"; }, /media source/i);
});

function rejectSeed(t, edit, message) {
  const folder = mkdtempSync(join(tmpdir(), "invalid-station-seed-"));
  t.after(() => rmSync(folder, {recursive: true, force: true}));
  const input = join(folder, "seed.json");
  const out = join(folder, "output");
  const seed = read(seedPath);
  edit(seed);
  writeFileSync(input, JSON.stringify(seed));
  const result = run(input, out);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, message);
  assert.equal(existsSync(out), false);
}
