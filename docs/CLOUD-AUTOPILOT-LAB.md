# HUMKIN Cloud Autopilot — Shared Air laboratory

**Source/implementation status:** opt-in pilot on a feature branch. The public
`/fm/`, `/fmstudio/`, `/hls/` and personal `/live.mp3` sources are not
repointed. Do **not** advertise this as an active station before a real phone
playback test and a reviewed upload. The Acer can prepare a published schedule,
then turn off; the Cloudflare Worker computes the same playhead for every
listener using UTC and R2. This is a **scheduled cloud broadcast**, not a live
audio feed from the Acer.

## The roles

- **Acer** — approve source recordings, encode each once to AAC/TS segments,
  upload immutable approved segments and publish a future-effective program
  revision. It can go offline after successful publication.
- **R2** — durable `autopilot/programs/<frequency>.json` and
  `autopilot/segments/<SHA256>/segment-XXXXXX.ts` objects in the existing
  `humkin-radio-live` bucket. These prefixes **must not** be included in
  short-lived `live/` cleanup policies. An existing R2 write credential may
  need a scope allowing this new prefix; do not expose it or broaden the
  permanent archive bucket unnecessarily.
- **Cloudflare Worker** — read-only interpretation of published schedule and
  immutable segments; responds to listener playlists and segment requests
  independently of the Acer. The Worker must itself be deployed and R2 remain
  available. It does not execute a continuously running server process.
- **Receivers** — all use the same rolling HLS manifest and can buffer and
  rejoin from the current edge. Transport buffering means phones may hear the
  same program at slightly different playback offsets.

## Safe operator flow

1. Build a complete HUMKIN checkout and ensure FFmpeg, Python 3 and (for
   publication) `boto3` are installed on the Acer. Keep all original MP3s and
   source WAVs unchanged.
2. Create a plan JSON using the example below, replacing the paths with
   **owner-approved local recordings**. Only pre-reviewed music should go
   into this *public* autopilot frequency. It is separate from the private
   staging bucket.
3. On Windows run preview (no credentials or cloud changes):

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\cloud-autopilot.ps1 -Plan .\my-cloud-plan.json
   ```

4. Review titles, lengths, frequency, rights and the exact filenames. Upload
   only when ready:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\cloud-autopilot.ps1 -Plan .\my-cloud-plan.json -Publish
   ```

   Type `PUBLISH AUTOPILOT` only after confirming. The wrapper reuses the
   existing Windows-user DPAPI R2 live vault, loads credentials into temporary
   child-process environment, and removes them afterward. The initial upload
   will consume R2 storage and operations. Media is uploaded *before* the
   schedule pointer; an interrupted upload must not change the on-air plan.
   A subsequent publication schedules a new revision at the next **track**
   boundary at least 120 seconds in the future. The old schedule keeps running
   until then. No client-side JavaScript song transition is required.

Example `my-cloud-plan.json`:

```json
{
  "schema": "humkin.autopilot.crate/v1",
  "station_id": "station-one",
  "tracks": [
    {
      "path": "C:\\HUMKIN\\approved\\song-one.mp3",
      "title": "Song One",
      "artist": "HUMKIN",
      "album": "Approved Demonstration",
      "artwork": "https://humkin.abundent.org/cover.jpg"
    },
    {
      "path": "C:\\HUMKIN\\approved\\song-two.mp3",
      "title": "Song Two",
      "artist": "HUMKIN",
      "album": "Approved Demonstration"
    }
  ]
}
```

Once the Cloudflare Worker is deployed (from `tools/radio-broadcast/cloudflare`,
run `npx wrangler deploy` with owner credentials) and the scheduled start
time passes, the read-only endpoints are:

- `/autopilot/station-one/status` — active schedule/revision, or a 503 with
  a **real** reason (unpublished, missing media, program not started).
- `/autopilot/station-one/live.m3u8` — rolling live HLS manifest, same
  UTC program for all listeners; use VLC or an HLS-compatible receiver to
  listen during the lab. Not wired to the main player yet.
- `/autopilot/station-one/now-playing` — published cloud schedule metadata,
  **not an Acer transmitter cue**.
- `/autopilot/station-one/segments/<digest>/segment-NNNNNN.ts` — published,
  schema-approved immutable media only.

## What a successful experiment proves

Two devices joining at different times should hear the same song, with normal
HLS buffer offset. Lock the phone and keep listening across a track boundary.
Stop the Acer and repeat. Publish a revised order from the Acer and turn it
off: verify the old program continues until the scheduled next track boundary
and then both listeners receive the revised clock program, without re-tuning.

Important limits: this first lab pre-encodes one AAC copy of each approved
input in the *live* bucket; it does not yet reuse the full media archive's
existing MP3 bytes. This costs storage and is intentionally limited to a
small demonstration crate. Independent AAC track encodes are joined at HLS
discontinuities; gaps/clicks, device behavior, level matching and live
revision changes must be field-tested. A preview/test success is not proof
of public broadcast or an Android background audio result.

**Not yet delivered:** graph/Tower visual editor for this cloud schedule,
instant DJ live-microphone takeover, automated fallback between actual Acer
hot HLS and autonomous HLS, and in-place streaming changes during the current
song. The first cloud intervention is effective at the next safe track
boundary. Further work should reuse the existing Tower controls and central
catalog permissions rather than create a second uncontrolled source of truth.

## Shared-clock invariants

- Authoritative track selection: versioned program JSON, not request-start
  random seed and not browser wall clock.
- At most one active program revision at a given UTC instant.
- A new revision starts exactly at an old **segment/track** boundary; old
  segments remain fetchable for receivers already buffering the prior window.
- HLS media/discontinuity sequence counters are monotonic across revisions.
- An unpublished or incompletely uploaded crate never masquerades as on-air.
- The rest of HUMKIN's station/fallback paths remain unchanged until a
  deliberate, verified cutover.
