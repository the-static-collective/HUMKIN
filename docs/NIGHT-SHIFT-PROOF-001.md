# NIGHT SHIFT PROOF 001 — HUMKIN cloud radio, Acer-off acceptance

**Scope:** source + read-only public checks; existing /fm/ and /hls/ listener behavior are unchanged. This is not evidence of an on-air Cloud Autopilot show until audio and the Acer-off case pass.

## Observed November 20, 2026 (public HTTP read)
- `https://humkin-long-wave.joyvolcanomusic.workers.dev/health`: 200, Long Wave healthy, 188 public R2 catalog entries, **personal continuous MP3**, not a shared clock.
- `/hls/status`: 503 during the observed check (regular Acer-published HLS not currently healthy).
- `/autopilot/station-one/status`: 404 (deployed Worker lacks the expected cloud route; compare merged `cloud-autopilot.mjs` and `worker.mjs` source). Do not interpret a healthy Long Wave as a healthy shared Cloud Autopilot.
- These public checks do not verify receiver sound, overnight uptime, Cloudflare cost, or actual R2 Autopilot assets.

## 1. Deploy the existing Worker code, without changing the main website player
**Owner action / explicit approval:** after review and merge, open GitHub **Actions → HUMKIN Cloud Autopilot — manual Long Wave Worker deploy → Run workflow → main → DEPLOY_LONG_WAVE**. This deployment updates the *existing* `humkin-long-wave` Worker, so it may affect Long Wave listeners; run during a safe maintenance window. It does not publish a show or flip the browser's default audio URL.

Prerequisites: GitHub repository Actions secrets named `CLOUDFLARE_API_TOKEN` (account-scoped, minimal Worker edit/R2 binding deploy permissions) and `CLOUDFLARE_ACCOUNT_ID`. These are never added to code, workflow output, or this document. The action uses the already-configured `wrangler.toml` R2 bindings `RADIO_MEDIA` and `RADIO_LIVE`; do not redirect the permanent archive or use an unrestricted token.

The workflow runs current Long Wave / HLS / Autopilot tests before deploy. The postdeploy read-only check requires existing `/health` to respond and the new Autopilot route to return a typed 200 or 503, rather than a 404. This proves **route deploy**, not a scheduled broadcast.

Expected next state without media:
- HTTP 503 with `mode: cloud_autopilot_unpublished`: Worker route deployed; no approved program pointer.
- HTTP 503 `NO_AUTOPILOT_BINDING`: `RADIO_LIVE` binding missing; fix Worker deployment, not public music page.
- HTTP 503 `PROGRAM_MEDIA_INCOMPLETE`: published schedule references R2 segments not available; investigate the publisher, do not promote the receiver.
- HTTP 200 `on_air:true`: schedule exists; still test playlist, segments, actual receiver and Acer-off continuity.

## 2. Publish one small, approved HOUSE schedule only after review
Source manual: [CLOUD-AUTOPILOT-LAB.md](CLOUD-AUTOPILOT-LAB.md), [Acer Tower](ACER-TOWER.md). Use two **owner-approved actual recordings**; do not invent MP3 paths, stage private files publicly, or assume a Source PR equals published media.

- On the Acer, preview the plan with `tools\radio-broadcast\windows\cloud-autopilot.ps1 -Plan <your-reviewed-plan.json>` and inspect exact song identity, order, lengths and generated AAC/TS output. Preview performs no cloud write.
- Once the selected recordings/rights and any R2 costs are approved, the owner can deliberately run the same command with `-Publish` and type `PUBLISH AUTOPILOT`. It uses the Acer's existing DPAPI R2 vault. Published media is immutable and the future schedule pointer is committed last.
- Do **not** use an unreviewed Signal/Gambit deck as publish authority. Do **not** flip the existing `/fm/` listener to the new route yet.
- After the HOUSE schedule proves itself, a second exact-order Tower guest show can be previewed; the publisher should insert it at a safe existing track boundary, then restore HOUSE (source #175). Remote-only tracks without local copies remain a held draft capability (#177) until independently validated.

## 3. Remote read-only aircheck — run even while the Acer is off
After the public status says on-air, from GitHub Actions choose **HUMKIN Night Shift public aircheck (read-only)**, select `station-one` and `300` seconds. It runs on a GitHub-hosted runner: no Mac/Windows dependency, no Cloudflare token, no player or Tower intervention. It saves the `humkin-night-shift-receipt` artifact even on a blocked run.

Alternatively, on a Node 22+ computer:
```sh
node tools/radio-broadcast/cloudflare/night-shift-aircheck.mjs --watch-seconds 300
```

The tool fetches the real `status`, `live.m3u8`, `now-playing` and one actual `video/mp2t` segment; checks same-origin path safety, manifest sequence and clock advance; never prints credentials. **API_MEDIA_VERIFIED** means those remote HTTP/media conditions passed, not that a person heard radio.

## 4. The physical Night Shift proof (separate human receipt)
1. Start two independent HLS-capable receivers with the exact Autopilot URL: `https://humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/live.m3u8`. Do not assume the normal HUMKIN site already points there.
2. Confirm both hear actual audio from the same published track at broadly the same station-clock position; log their device/browser and observed offset. Test lock-screen and a full real **track boundary**, not only one segment.
3. After preparing the program and confirming it is on-air, turn the Acer completely off; **rerun the GitHub-hosted 300-second aircheck while it stays off**. Keep both receivers listening. If the signal stops, record precise times and HTTP receipts.
4. From the restored Acer, separately submit an owner-approved future guest show. Power it off again after publishing. Confirm at least one track boundary from HOUSE → GUEST → HOUSE, with monotonic HLS media/discontinuity sequences and proper titles.
5. Attach the GitHub Actions receipt and note: timestamp, station/revision, actual audio heard on each receiver, each real track boundary, Acer power state, return-to-HOUSE, audible glitches, and rollback decision.

**Pass threshold:** the independent cloud Worker and R2 serve real, uninterrupted scheduled music while Acer is off; two receivers share the schedule; approved guest programming starts and returns on boundaries; no main listener change and no unreviewed community material airs. Only then consider changing the primary listener's fallback source.

## Rollback
The experimental `/autopilot/` path is independent of `/hls/` and `/live.mp3`. A bad program must be restored to a previously valid HOUSE pointer through the owner-controlled publisher, not via a browser change. A bad Worker deployment requires redeploying the previously known-good Worker version. Preserve both revision identity and R2 media until buffered receivers no longer need it.

**Provenance:** merged source PRs #171, #173, #174, #175; pending remote-media PR #177; public HTTP observations on November 20, 2026. The added scripts are proof instrumentation, not a transmitter.
