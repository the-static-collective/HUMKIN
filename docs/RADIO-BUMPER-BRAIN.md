# HUMKIN RADIO — Bumper Brain v1 + Robot Desk

## What changed (2026-11-16)

Bumper Brain is **editorial selection logic**, not a replacement transmitter. It builds a stable, shareable sequence of real published/approved MP3 carts after song boundaries.

- Owner cadence remains the reference (currently four songs). At values of four or more, a cycle uses predictable, slight variation (4 / 5 / 3 / 4 / 6 / 3...) instead of mechanically interrupting each fourth song.
- Cards are classified as **station ID, musical, character, comedy, show opener or feature**, using the explicit `fm/rotation.json` `bumper_brain.profiles` plus conservative duration/title fallbacks.
- Separate edits in one **family** cannot cluster within the preceding four break positions if enough alternatives exist. Short recordings dominate; cuts over 28 seconds are only considered routinely at roughly every fifth break; recordings over 49 seconds are reserved for a specific program.
- Explicit show openers, long performances, fictional clock readings, and request-service claims are **held out of ordinary bumper rotation**. They are not deleted, unpublished, or marked disabled in storage. A scheduled show can deliberately use them.
- The first ten proposed breaks and held list are inspectable by the owner at `/fm/manage/`. Existing manager EDIT/PREVIEW/HIDE and schedule tools still control real recordings.
- The same `plan(songs,bumpers,cadence,tracks,policy)` is applied to every Same-Time clock cycle. Break length, break positions and selected cart IDs depend on the public eligible inventory, cadence and versioned policy, not local RNG, listener behavior or the shuffled order of songs; consequently the calculated cycle duration remains the same for different receivers with the same catalog snapshot.
- Road Shuffle uses the same editorial break plan. Shared clocks and Road Shuffle retain their existing differing static/memory rules. Site fallback still uses legacy AutoDJ if the new helper cannot load.

## Robot Desk

`tools/generate-robot-drops.py` produces **original eSpeak retro-computer** performances, not the proprietary Microsoft SAM voice and not a clone. Content is scripted from the fictional Station Bible and optionally reacts to published site source-inventory counts; never reads private callers, unverified claims, weather or location.

Run locally: `python3 tools/generate-robot-drops.py --seed TEST --count 8 --out /tmp/robot-auditions`

The `robot-desk-auditions.yml` workflow also runs once a week (Monday 13:00 UTC) and by manual GitHub Actions dispatch. It installs eSpeak + FFmpeg, writes human-review-only MP3s and a manifest with source text, family, duration and SHA-256, and uploads **GitHub Actions artifacts with 30-day retention**. The workflow has read-only GitHub permissions, no deploy keys and no broadcast API writes. Its output does not automatically air, create a live cloud record or change the station allowlist. Review the batch manually, then stage selected MP3s in the HUMKIN Crate Loader as STATION BUMPER, and individually approve them.

**Live service caution:** Same-Time Radio remains a browser-based synchronized simulation; it is not a continuous hosted transmitter. A browser not fetching the cloud catalog will have a smaller inventory, and schedule may differ from a listener who loaded the complete catalog. Confirm receiver audio on Android before claiming a recorded cart was actually heard.

## Verification

- `node tests/bumper-brain.test.cjs` verifies determinism, hold rules, family spacing, non-repetition across break slots, variable cadence, and source integration.
- `node tests/radio.test.mjs` preserves the legacy clock, scheduler, and existing AutoDJ fallback.
- `python3 -m py_compile tools/generate-robot-drops.py` verifies render-script syntax.
- Every proposed change is reversible by reverting PR source; no cloud records are modified by this upgrade.
