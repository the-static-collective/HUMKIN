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


## Robot Desk v2 — voice engines × audio finishes × timeless humor

Three independent offline synthesis engines (eSpeak, Flite, Festival) are
crossed with three dry audio finishes: WIRE (narrowband), WARM (mellow old radio),
CLEAR (higher-fidelity compressed speech). These change sound rather than jokes.
No simulated radio static is baked into recordings; Same-Time RADIO owns that layer.

A separate four-step humor ladder sets the editorial premise:
PLAIN = a neighbor, a meal, a small helpful gesture, a practical human failing.
WRY = an absurd committee, a human contradiction, a chore that outwits us.
STRANGE = an ordinary object making a small unreasonable demand.
COSMIC = an impossible situation with a human, unhurried landing.

Timelessness criterion: the punchline should make sense without computers,
fashion, pop culture or the day's news. Comedy can be shared across generations
and rural/urban communities, including Amish listeners, without stereotyping
or mocking a belief system or tradition. The listener is never the punchline.

The weekly generator now selects 12 original curated lines with roughly equal
coverage across the four levels and rotates the three voice engines and three
finishes. An optional 3×3 A/B matrix renders the same welcoming line through all
three engines and finishes. The output includes LISTEN-HERE.html, a mobile-friendly
offline audition sheet, and audition-manifest.json containing precise scripts,
generator and finish choices, absurdity levels, durations and SHA-256 checksums.

A reproducible ISO-week seed keeps outputs auditable. Two optional funny lines
react only to public source repository inventory counts; no private messages,
caller audio, internet data or invented real-world facts are inserted.
This is a curated comedy engine, NOT autonomous unsupervised improvisation.

The workflow produces private human-review artifacts only, weekly Monday
13:00 UTC and after its initial main-branch update. Nothing is automatically
uploaded to public storage, approved, transmitted or inserted in live radio.

To generate a full comparison locally (requires all three synthesizers):
    python3 tools/generate-robot-drops.py --seed 2026-W47 --count 12 --engines espeak,flite,festival --compare --out robot-auditions

To generate a universally readable wholesome pack with locally available voices:
    python3 tools/generate-robot-drops.py --seed PORCH --count 5 --engines auto --absurdity plain --finish clear --out wholesome-auditions

Quality names describe sonic processing, not the claim of a human-like
synthesis or a licensed/proprietary computer voice. A future neural voice lane
needs its own rights/cost review. All proposed carts remain unpublished drafts.
