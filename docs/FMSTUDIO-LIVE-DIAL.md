# FM Studio · Live TOWER dial (network crossing 001)

**Status:** source is in a reviewable PR. The site and Cloudflare Worker must
both be deployed before dynamic frequency discovery works on the public page.
Creating a local TOWER frequency **does not** itself publish an internet radio
station.

## New listener behavior

- [FM Studio](https://humkin.abundent.org/fmstudio/) keeps the existing ten
  Season Two concepts, including the original Station One player, Compost Heap
  with ratings, record shelf, and late screen.
- A new read-only `GET /hls/stations` endpoint on the existing
  `humkin-long-wave` Cloudflare Worker lists R2 live playlist prefixes.
  A secondary frequency appears **only** if its
  `live/<frequency>/live.m3u8` playlist was freshly published (within 90
  seconds, allowing at most 30 seconds of clock lead). Old R2 segments and
  local-only plans do not count. Station One stays selectable even while the
  live stream is offline, because its classic receiver retains fallback modes.
- A fresh new frequency such as `talk` appears on the FM Studio dial as
  **Talk · Acer frequency**. Known concept slugs such as `night-drive` also
  light up the matching existing dial tile.
- Select a tile, then deliberately press **Tune to [station]**. The familiar
  HUMKIN artwork-first receiver opens inside FM Studio and uses its existing
  `?frequency=<id>` route, per-frequency HLS and playhead-timed artwork.
  The receiver's **Listen Live** button still requires the listener to
  start audio. No autoplay is added.
- Selecting a new frequency and pressing Tune removes the previous iframe
  before opening another; no duplicate live audio. The Compost Heap continues
  to pause automatically when a receiver is opened, and selecting Compost
  closes the live iframe.
- The directory refreshes every 30 seconds, or with the new manual **Refresh
  frequencies** control. Refresh never interrupts currently playing audio.
  Previously live frequencies that go offline are kept on the dial but marked
  **Not broadcasting** and cannot be newly tuned until live again.
- If the registry is unavailable or the old Worker is still deployed, FM
  Studio reports **Live frequency directory unavailable**. Station One and
  Compost remain usable; no offline station is fabricated as live.
- Receiver URLs are created locally from a strict frequency slug. The browser
  ignores arbitrary URLs or private details in the directory response.

## Publish and smoke-test in order

1. Review and merge this PR only after GitHub Actions passes. No R2, Supabase,
   playlist, website deployment or Acer changes occur by opening the PR.
2. GitHub Pages must finish publishing the updated `/fmstudio/` page and
   `/fmstudio/dial.js`.
3. Deploy the **whole** existing Worker directory from
   `tools/radio-broadcast/cloudflare` with the authorized Cloudflare account:
   `npx wrangler deploy`. Preserve `RADIO_MEDIA` and `RADIO_LIVE` bindings.
   `/live.mp3`, `/hls/status`, and all existing HLS routes must remain
   compatible. The new directory only lists R2 metadata and never writes it.
4. Confirm `https://humkin-long-wave.joyvolcanomusic.workers.dev/hls/stations`
   returns schema `humkin.fm.station-registry/v1`. Only Station One may
   appear when secondary frequencies are not broadcasting.
5. On the Acer, start a **distinct approved** secondary frequency using the
   existing TOWER launcher, for example the documented `talk` frequency:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\\radio-broadcast\\windows\\station-one.ps1 -Action StartR2 -Frequency talk`.
   Confirm it is actually publishing and there are no errors. Avoid
   starting a second publisher on the same frequency.
6. Refresh FM Studio; a new **Talk** tile should appear. Select it and click
   Tune. On a second device, deliberately click **Listen Live** and verify
   actual talk-frequency audio and the correct song title/art. Retune to
   Station One and check that there is only one active receiver.
7. Stop the test frequency using its documented `StopR2` action. Wait until
   the Worker sees its playlist as stale; FM Studio should show
   **Not broadcasting**, without falsely presenting its stream as live.
   Test the original Station One → Long Wave → Same-Time chain and Compost.
8. If the Worker deploy is delayed, do **not** claim the dynamic station
   registry is live. The page remains safe and shows its existing classic
   listening options.

## Tests and bounds

```sh
node --check fmstudio/dial.js
node --check tools/radio-broadcast/cloudflare/station-registry.mjs
node --test tests/fmstudio-live-dial.test.mjs tests/fmstudio-station-registry.test.mjs
```

- No new database, playlist writes, service secrets, automatic rights grants,
  public recording uploads, or station publishing permissions.
- Dynamic **programming previews** for owner-only inactive drafts are *not*
  broadcast to the internet. Listener-facing FM Studio sees only public live
  frequencies; private rehearsal stays inside the owner workstation.
- Auto Disco and Counterpoint on-demand modes remain separate draft PRs, and
  this release does not claim those are deployed.
- R2 fresh playlist status is **not** listener analytics or proof someone heard
  a recording.

## Rollback

Revert the website PR to restore the original static FM Studio dial. The
Worker endpoint is additive and can be redeployed with the previous Worker
version. No change to the R2 media bucket, station keys, current frequency
objects or Acer programming state is required.
