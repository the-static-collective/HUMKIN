# Auto Disco V20 — a **real producer-owned station**, not an Accident Lab alias

**Branch:** `feature/autodisco-v20-real-dial-station` atop `integration/radio-tower-council-20261118` (review before merging those dependencies). **Status:** staged, not public deployment or proof of broadcast.

## The distinction

- **V20 Radio** is authored by the **original Auto Disco V20** application: the First-Listen Radio source audio, separately isolated Static Sam and Juniper DJ model encounters, sealed first responses, model cross-read, approved voiced segments, deterministic episode assembly, and local MP3 master rendering. HUMKIN does *not* generate replacement DJ banter.
- **The Accident Lab** `/fm/autodisco/` is a discovery/curation experimental console that proposes tracks and gathers feedback. It can feed V20 but does **not** constitute a show, real-first listen or always-on radio transmission.
- **HUMKIN Tower / Cloudflare Worker** owns read-only playout of separately approved V20 broadcast masters from the existing approved R2 catalog.

## The channel

- Public receiver location after deployment: `/fm/v20/`.
- Dedicated Worker stream after Worker deployment: `/stations/autodisco-v20/live.mp3`.
- Dedicated Worker readiness: `/stations/autodisco-v20/health`.
- Existing Season Two `/fmstudio/` dial: two distinct tiles, `Auto Disco V20` and `The Accident Lab`.
- Tower virtual station index and local design desk: one new `autodisco-v20` station with relationship **independent**, zero parent influence, no automatic bumpers, no scheduled generic music.

## Strict programming filter

The dedicated station will select only already-approved, published, enabled R2 **song** recordings whose catalog metadata has `artist = Auto Disco V20` and `album = First-Listen Radio`. In the owner-reviewed intake this requires an explicitly admitted V20 render: the original source must have an authentic V20 episode manifest and finished audio master receipt. The Worker verifies R2 publishability and those exact credits; **it does not cryptographically verify the V20 master receipt at request time**. That last assertion remains a human editorial gate until a separate source-hash/episode-digest admission registry exists.

If there are zero matching approved recordings, `ready=false`, `/health` returns 503, and `/live.mp3` returns `STATION_UNPROGRAMMED`. The dedicated V20 receiver shows a clear not-ready message, not Station One, Eclectic, unrelated songs, synthetic DJ claims, or a pretend live stream.

**No new R2 objects, tracks, or scheduled episodes are created by this branch.** Editing the Tower local draft does not update production until the Worker station source and hosting configuration are deployed.

## How the actual show gets there

1. In the Auto Disco V20 repository, run a genuine bounded audio first-listen under two isolated model calls and seal the dialogue; no key means no episode.
2. Use the original V20 BROADCAST ASSEMBLY and the new `scripts/build-v20-station-episode.mjs` to produce the authoritative episode bundle.
3. Render exact voice segments with owner-recorded/authorized voice model audio, or Windows local OS speech as a **noncanonical test preview**. Run the new V20 `scripts/render-radio-master.mjs` to produce a complete MP3 and SHA-256 receipt.
4. The owner checks recording/music rights, speaker identities and source metadata, marks the master admitted, then uploads it through the established HUMKIN R2 catalog workflow with exact artist/album and published/enabled state.
5. The deployed Worker dynamically picks up the owner-reviewed catalog after its cache expires. The separate V20 receiver exposes the independent audio connection.

Companion V20 source: https://github.com/the-static-collective/The-AutodiscoV.20.-question-marks- . See the `feature/v20-rendered-broadcast-masters-001` branch and `docs/V20-HUMKIN-PRODUCTION-001.md`.

## Remaining future phases

- A scheduled **30–60-minute show compiler** selecting six to twelve genuinely authorized tracks, generating four to eight true first-listen/host transitions, and preserving independent model sessions.
- Performer-originated/consented voice model service with verifiable render inputs; current OS TTS is not canonical voice identity.
- Explicit hash-bound admission registry bridging V20 receipt to HUMKIN stream catalog rather than relying on owner-reviewed catalog credit fields.
- Autonomous or human-supervised production schedule with budget/rate controls, retries, and authenticated publication, plus actual-airplay and synchronized-broadcast evidence as warranted.

## Verification

CI confirms the V20 channel never admits other artists, albums or bumpers, and the dial keeps Accident Lab separate from V20 Radio even when Acer HLS registry is offline. The receiver's client test confirms it will not tune to unrelated streams when V20 has no approved episodes.