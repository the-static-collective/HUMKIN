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

### Owner controls (mobile friendly)

In Station Manager, follow **OPEN ROBOT DESK · SET THE HUMOR DIAL**. Choose **Run workflow** on the GitHub Actions page. Manual controls: 4 or 8 fresh jokes; mixed or single PLAIN/WRY/STRANGE/COSMIC humor; any one of three synthesis engines or all; WIRE/WARM/CLEAR finish or mixed; optional same-script comparison clips. The weekly schedule retains its automatically balanced 12-line + 9-comparison format. Every batch is a temporary private-review GitHub artifact, not a playlist update or permission to air anything. Use the private Crate Loader only after listening and explicitly approving recordings.


## Script Seed Garden — editable from the phone

At `/fm/studio/robot-seeds.html`, the owner can edit the **actual joke
seed inventory** without touching Python source or GitHub.

- Open the page from the Production Room or Station Manager. Sign in with
  the existing Crate Loader owner session if needed.
- **One line:** compose a short announcement, choose PLAIN / WRY / STRANGE /
  COSMIC, station ID vs character, and a callback family. Save a private
  draft, listen to a deliberately rough *device voice*, or explicitly
  approve the words for future robot auditions.
- **Existing line:** search or filter the canonical 36 built-in jokes, edit
  an original (saving an owner override under the same slug), or REMIX it
  into a separate original draft. Retiring an approved slug excludes it
  from future generation, including any built-in with the same slug.
- **Many at once:** paste up to 20 one-line jokes into the bulk field.
  These are staged as private drafts, not approved or generated.
- **Backups:** export the visible bank and owner data as JSON.
- **Audition:** follow the existing Robot Desk workflow. The weekly
  generator can now fetch owner-reviewed text seed records. New text
  does **not** automatically generate an MP3 at save time; no audio is
  broadcast without separate individual cart review and publication.

### Canon, drafts, reviewed text

The checked-in `fm/studio/robot-seeds.json` is the canonical original
bank, shared by the editor and `tools/generate-robot-drops.py`.

The connected Supabase project adds an RLS-protected
`humkin_radio_script_seeds` table with three statuses:

- **draft:** only the authenticated HUMKIN owner may read or modify it.
- **approved:** publicly readable *script text* by the read-only worker
  (never a public MP3).
- **retired:** publicly readable tombstone used to suppress an original
  or previously approved script in future batches.

Row edits require the original owner UID AND authenticated, verified
account email. The browser uses the ordinary publishable key, never a
service-role credential. Column privileges limit anonymous reads to
reviewed script content and metadata, not owner identities.

The weekly worker makes a read-only GET of approved and retired rows
before sampling. Matching approved slugs override the checked-in
originals; retired slugs are removed. Private drafts never enter the
generator. If the remote catalog cannot load or validates incorrectly,
the workflow fails rather than silently pretending it included the
newly approved seeds.

**Revision note:** Saving an approved owner seed back to draft pauses
that *owner revision* until reapproved. If it replaced a built-in joke,
the original built-in becomes eligible again while the revision is a
draft. Use **RETIRE** to suppress a built-in explicitly.

**Safety:** This page never writes to radio tracks, changes published
bumper eligibility, generates real-time unreviewed speech, or turns
on a transmitter. The rough preview is whichever system voice your
device supplies, not one of the three final synthesis engines.
