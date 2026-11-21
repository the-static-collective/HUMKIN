# TOWER 007 — Living Crate / ordered Feature Desk (first source slice)

**Scope:** mobile-first operator convenience on existing `/fm/load/` + parity repair in FULL Cloud HOUSE. Protected branch. No new service, no public R2 changes, no currently running program revisions.

## The daily operator path

1. On Android/iPhone/desktop, open `https://humkin.abundent.org/fm/load/`. The top shortcuts jump directly to **Add today's audio**, **Review crate**, and **Build a feature**. File picker already handles MP3/M4A/WAV, with browser codec support, existing private R2 staging and individually approved publication. Existing content identity and server-side SHA validation remain unchanged.
2. Review each song/official single/bumper; approval means the source becomes **published and enabled in the radio catalog**, not immediately included in the separately reviewed Cloud HOUSE HLS program. This separation must be visible, not hidden.
3. In **Feature Desk** choose already enabled and published recordings (including a long interview), add and reorder them, choose repeating Central day/time block, and **SAVE PAUSED FEATURE**. Authenticated owner-only insert into existing `public.humkin_radio_programs` with `is_active=false`. Never invent on-air authorization. `/fm/manage/#programming` remains the single authoritative editor/activation surface for recurring Same-Time/TOWER shows. Never silently enable at save.
4. The Crate page includes a scoped mobile home-screen manifest so a browser may present TOWER as a standalone shortcut. This is **not** a native Android application, and phone installation/codec behavior requires device verification.

The Feature Desk is a mobile-friendly front door, not a parallel station database. It uses the existing Supabase owner RLS. It does **not** offer non-owner church-secretary privileges until a proper scoped delegated-role system is built.

## Release/seasonal weighting across engines

The browser and Tower already have:
- ordinary public radio song: **one total slot**
- curated released-album cut or officially marked single: **two total slots**
- explicitly seasonal song: **three total slots** (not 2+3, even if also an official single)
- spoken bumper: **not** part of song weighting, uses source-owned three-lane bumper scheduler; feature-only interviews remain out of incidental rotation
- manually ordered show: plays its explicit `track_ids` order, separate from shuffled music

Until this change, `house_rotation.make_selection(..., count='FULL')` placed each approved song exactly once and used only the Bumper Brain. Now it reads `fm/rotation.json` release and seasonal policy (single flag from current public catalog), and uses **the existing Tower `featured_extra` and `add_bonus_slots`**, before `with_bumpers`. This preserves the first/final music-slot guard and equal-owner editorial approval. The FULL draft fingerprint includes exact weighted running order, official-single metadata, release policy digest and seasonal hash allowlist. Changed policy/approval must produce a new review. Legacy 12/18/24/40 SONG-ONLY draft semantics remain unchanged.

For the live catalog on November 21, 2026, observed 241 eligible songs, 36 enabled bumpers, 18 song rows marked `is_single=true`, and two seasonal fingerprint matches. The on-main owner-review draft will provide the authoritative exact weighted slot and bumper counts. A source commit is not proof the cloud radio applied the new weighting.

## What remains for real daily low-touch publishing

**Not implemented in this slice:** catalog-event or operator-driven incremental Cloud HOUSE refresh, remote AAC cache reuse between isolated GitHub runners, and automatic owner-approved schedule insertion. The existing manual FULL draft / exact fingerprint / R2 publisher still gates the shared cloud program. Do not embed a GitHub token or R2 credentials in the browser.

The safe next component is an authenticated station publication queue: source ID + immutable SHA + owner approval receipt + desired station + policy revision + idempotency key; a cloud worker reuses previously verified segment hashes, prepares *only new* audio, computes a bounded new schedule, validates rights, policies, segment count and old boundary; only then atomically changes the program pointer. Existing schedule and assets are retained for rollback.

**Not implemented here:** one-time cloud guest scheduling directly from Feature Desk, automatic seasonal tier editing through the loader, role-scoped church-secretary logins, native Android share-sheet/background uploads, automatic cloud-cycle reshuffling, or changing default listener routes.

These features need separate authorization and tests before the word “live” applies.

## Acceptance tests
- `node --test tests/living-crate-feature.test.mjs`: arbitrary upload cannot be included, ordered feature supports repeats, paused-only contract and Central time validation, invalid identities/days and overnight blocks rejected.
- `python3 tests/cloud-house-rotation.test.py`: 1/2/3 weighting parity, recurring seasonal+single receives exactly 3, policy drift and source metadata invalidation, earlier full catalog/Bumper Brain and hosted segment limits.
- `node --test tests/night-shift-cloud-publish.test.mjs`: owner fingerprint review, no unapproved job dispatch.
- `node --check fm/load/feature-core.mjs` and `fm/load/feature-desk.mjs`.
- PR Actions for read-only live FULL selection; **no** cloud publication during CI.

## Operator acceptance (later)
A new song and a feature assembled on an actual phone should be uploaded, privately staged, independently approved and saved as a **paused** draft; after explicit separate activation of the applicable station, actual audio and published cue evidence should be verified. A one-time guest Cloud HOUSE feature still requires separate reviewed cloud programming.
