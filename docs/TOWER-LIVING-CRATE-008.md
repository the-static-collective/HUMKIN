# TOWER 008 — Daily Approved Crate → Cloud HOUSE

**Status:** protected implementation. No cloud schedule, secret, catalog row or listener cutover is modified merely by merging this code. The unattended schedule stays **HOLD** until the owner explicitly sets the opt-in repository variable.

## What the operator does

On a phone or Acer, use the existing `https://humkin.abundent.org/fm/load/` workflow:

1. Upload or share individual MP3/M4A/WAV recordings; crate's existing private staging, content SHA-256 duplicate detection, metadata and server verification remain untouched.
2. Review and explicitly approve each song, single, or individual bumper. The item must become `enabled=true`, `published_at` set, `storage_provider='r2'`, and have strict content-addressed object key before Cloud HOUSE considers it. Staged/private-only and disabled recordings never enter.
3. From the same page, **TOWER · Cloud HOUSE receipt** reads the public schedule revision and current program size. This is not proof a specific phone heard the track.
4. When auto-sync is enabled, the cloud runner periodically compares the reviewed FULL selection against the actual R2 program. If anything changed, it prepares only unseen source hashes; reuses existing R2 AAC segments; rechecks all published eligibility; then publishes a new revision at the next clean song boundary. No Acer required at runtime.

The owner can use the new single-confirmation [Cloud Sync workflow](https://github.com/the-static-collective/HUMKIN/actions/workflows/tower-cloud-incremental-sync.yml) from GitHub, select `main` → `SYNC_APPROVED_CATALOG` and inspect its receipt. This does **not** require the 64-character running-order fingerprint from NIGHT SHIFT's separate emergency/manual publisher.

**One-time unattended setup:** after this manual path successfully verifies real cloud media and a real mobile listener, set the GitHub repository Actions variable `HUMKIN_CLOUD_AUTOPUBLISH` to exactly `ENABLED`. Scheduled work polls the approved catalog around minutes 17 and 47 of each hour. GitHub schedules may run late and are not a real-time guarantee. Removing or changing that variable disables unattended publishing without changing the live audio. The original manual owner-reviewed fingerprint gate is untouched.

## The authority boundary

- Owner approval is the *existing* authenticated Crate publish path with Supabase RLS. Audio staging, a phone upload, private field-cart editing, or a mere program suggestion do **not** authorize Cloud HOUSE.
- The scheduled job runs on the repository's protected `main` branch; it requires explicit `HUMKIN_CLOUD_AUTOPUBLISH=ENABLED` and existing dedicated `HUMKIN_R2_LIVE_*` Actions secrets, plus `CLOUDFLARE_ACCOUNT_ID`. Secrets never reach public Pages, a browser, a guest or a secretary.
- `house_rotation.make_selection(..., count='FULL')` determines ALL music weights (1× ordinary / 2× release/single / 3× total seasonal), and the short/medium/long Bumper Brain, including non-consecutive shorties and explicit feature-only holds. This selection is regenerated and checked immediately before publishing.
- Cloud manifests previously *published* by the protected R2 publisher contain source-checked SHA-256 identities and approved AAC segment duration maps. A matching hash reuses those durations; an unseen hash is fetched from the canonical media.abundent.org R2 object, checked byte-for-byte, and encoded. The existing R2 publisher then HEAD-checks every referenced segment and uploads missing immutable TS media **before** the program pointer.
- If no requested content/order/credits differ, the job returns `unchanged` without altering the pointer.
- Automatic refreshing does not interrupt a published *future* guest/feature or modify the previous show's restoration window. The existing program pointer is unchanged on any validation/encoding failure. The manual and automatic Actions share the same concurrency group.

## Safe holds and real limitations

- Cloud Worker currently caps each cycle at **500 program entries** and **10,000 TS segments**, with **32 revisions** in one active program. FULL had 406 entries in the 2026-11-21 rehearsal (241 unique songs, 262 weighted song slots and 144 bumper appearances).
- With frequent daily additions, the hard 500/10k/32 limits will become real. TOWER 008 **does not** silently exclude the newest or oldest recordings, reset historical media sequence numbers, or compress revisions without a continuity test. It fails closed before changing the public pointer. Continuity-safe rolling-window programming and revision compaction must be built and deployed before treating this as indefinite autonomous growth.
- If a published R2 source has changed without its hash or prior audio segments are missing, verification/publishing aborts rather than trusting a URL or overwriting a live program.
- Operator approval and Cloud HOUSE scheduling do not prove a listener heard an entire song; verify with `/fm/night-shift/`, public schedule and actual Android/background-playback tests, Acer offline. Crate and the separate Same-Time/TOWER transmitter still work when Cloud HOUSE fails.
- New secretary delegation requires station-scoped contributor/editor RLS and review receipts. Owner-only rights are **not** given to third parties by this feature.
- Ordered one-time Cloud HOUSE guest shows are still separately reviewed via existing Tower handoff and `program_deck`. Scheduled refresh HOLDS any future program revision and does not convert a paused Same-Time feature into cloud programming.

## Verification

- `python tests/cloud-house-delta.test.py`: reuse existing asset hashes, encode only unseen, hold on revocation, no-op on unchanged running order, hold before a future show, recheck approval before commit.
- `node --test tests/tower-cloud-incremental-sync.test.mjs`: scheduled mode opt-in and manual confirmation, shared publication lock, protected main, no web/client secrets, original owner-fingerprint workflow unchanged.
- `node --test tests/tower-cloud-receipt.test.mjs`: public schedule receipt does not claim listener evidence.
- Existing Tower/Station One/Full HOUSE/seasonal/bumper/site CI must pass.
- Real R2 publication and the planned automatic cron require the owner-only GitHub Actions execution and a production device aircheck; code merge is not that proof.

## Next engineering slice

Bring **owner-reviewable one-time ordered feature booking** to the Feature Desk, then implement versioned rolling Cloud HOUSE windows and continuity-preserving revision compaction. Only after these controls are proven should a scoped church-secretary account stage recordings and propose features without full station rights.
