# HUMKIN TOWER — Virtual Station Network

**Status: experimental draft PR.** No production switch, R2 migration,
Supabase migration, or live-HLS deployment is made by this PR.

## Goal

Program many stations against **one** reviewed R2 media library without a
continuous encoder for each station.

- **Vault:** Only already approved, enabled, published R2 recordings.
- **Clock:** Independent station definitions, optional weekly Central-time
  dayparts, priority, artist/album/tag/track-ID selection.
- **Transmission:** Long Wave produces one continuous MP3 connection per
  *active listener*. Idle virtual stations do not originate audio.

No public R2 bucket listing authorizes airtime. Approvals remain attached
to the source catalog. Existing recordings are not copied or transcoded.

## Preset stations

| Slug | Enabled | Content |
| --- | --- | --- |
| eclectic | Yes | Approved songs and approved station carts |
| spotlight | Yes | Music; featured singles 17:00–22:00 Central |
| seasonal | Yes | Approved seasonal recordings, counterpoint Mainline |
| deep-wave | Yes | Counterprogramming against Spotlight's inherited Mainline preferences |
| talk | No | Placeholder until talk material is tagged and approved |
| top-40 | No | Placeholder until chart IDs and editorial rules are selected |

A station with no approved matching content fails closed; it does not
secretly revert to the full music library. User-defined artists, albums
and tags are not inferred by AI or automatically assigned. Manifest tags
are supported; Supabase's current public catalog includes artist and
album, but not genre tags.

## COUNTERPOINT — versioned station contracts (second slice)

The station definitions now have `contract_version: 1`, a monotonically
incremented **draft** `revision`, a `parent_id` and a bounded relationship
`{kind, influence}`. Supported kinds are `echo`, `counterpoint`,
`inverse` and `independent` (influence 0–100%). Mainline is a
read-only conceptual root, not another transmitter.

**Response rule:** Each enabled station selects its own records only from
the approved R2 catalog, then computes bounded relative rotation weights
from its parent's current selected records and weights. It inherits
*preference signals*, never permission or exclusive membership.

Example dependency graph:

    MAINLINE (approved catalog + published Supabase weekly show)
      ├── Eclectic (weak echo)
      ├── Spotlight (strong echo)
      │      └── Deep Wave (strong counterpoint)
      └── Seasonals (counterpoint, seasonal-only eligible content)

The shipped contracts use the published, active
`humkin_radio_programs` schedule if readable under the existing public
Supabase RLS policy. This is **planned Mainline programming**, not actual
play history or the Acer's live playout log. When schedule metadata is
unavailable, the resolver uses only the approved music baseline and
explicitly labels that fallback. We do not invent what actually aired.

**Safety:** The dependency graph is validated before resolving.
Duplicate IDs, missing parents, cycles, unsupported versions and
disabled parents fail closed. Each child has its own approved filter.
The parent cannot authorize a recording or override a withdrawn item.
No AI model or opaque audio-genre inference is used to determine weights.

**Automatic updates:** The Worker reevaluates the station's lineage at
each recording boundary and refreshes public Mainline programming/catalog
metadata after its five-minute cache lifetime. Program selections and
recording approvals propagate without manually editing each child station.
There is a bounded **five-minute cache delay, plus the currently playing
recording**; this is not instantaneous removal or an emergency-broadcast
interrupt. Source outages stop new derived playback after cache expiry
rather than silently serving an indefinitely stale selection.
Derived MP3 listener connections currently end cleanly after at most
300 recordings or eight hours (whichever comes first) to reserve Worker
subrequests for metadata checks. Listeners must retune after the stream
ends; automatic background reconnection is not yet implemented.

**Auditability, not blockchain:** The resolver emits a deterministic
noncryptographic selection fingerprint and a read-only contract receipt.
It does not constitute a cryptographic signature, immutable history,
independently verified play log or on-chain consensus. The TOWER editor
records draft edits in a browser-local event journal, included with
`humkin-network-draft.json`; browser data can be changed or deleted.
A persistent append-only ledger would require a separately authorized
server-side schema, identity policy, and retention rules.

A read-only GET at `/stations/{id}/contract` explains the resolved
lineage, parent, relationship, source and selection fingerprint.
Contract metadata is public programming information, never a credential.

## New Worker routes

- GET /stations — read-only station listing with program, count, ready state.
- GET /stations/{id}/health — one enabled station's status and contract receipt.
- GET /stations/{id}/contract — deterministic read-only explanation of the selection.
- GET /stations/{id}/live.mp3 — continuous R2-based personal MP3 stream.
- HEAD /stations/{id}/live.mp3 — stream metadata.
- GET /live.mp3 and GET /health — original Long Wave unchanged.

The Worker evaluates timed program selection at **each recording boundary**,
not in the middle of audio. America/Chicago time accounts for daylight
saving. If shows overlap, higher priority wins, then later start. A show
that spans midnight requires two entries.

**Virtual schedule does NOT mean synchronized playback.** Two people tuning
in can hear different recording positions, because each has an independent
MP3 stream. Actual shared-clock stations without continuous encoders require
pre-encoded, immutable HLS segments in R2 plus a deterministic sliding
playlist built from a shared program clock. That separate project still
needs implementation, rights and device verification.

## TOWER desktop workbench

The draft control page is under fm/tower/ on GitHub Pages when this branch
is deployed.

- The receiver wall reads the deployed Worker; tuning requires a user click,
  and playback never auto-starts.
- The local station designer edits modes, names, inherited parent,
  relationship, influence strength, filters and weekly schedules.
- An explicit parent/dependency check rejects cycles before saving.
  Local contract revisions and the browser-only change journal are
  included in the exported draft.
- Drafts save only to this browser and can be downloaded as
  humkin-network-draft.json for review. **Export does not publish.**
- A reviewed draft must be integrated into
  tools/radio-broadcast/cloudflare/stations.mjs, tested, and deliberately
  deployed. No unauthorized public write API was added.
- The design editor is public, not owner-authenticated, precisely because
  it cannot change live programming. Do not place credentials in drafts.

The receiver points to the existing HUMKIN Long Wave workers.dev base.
Until its routes are deployed, the TOWER receiver wall correctly reports
that virtual frequencies are not yet available.

## Tests and staging

From the repository root:

    node --test tools/radio-broadcast/cloudflare/worker.test.mjs tools/radio-broadcast/cloudflare/stations.test.mjs tools/radio-broadcast/cloudflare/receiver.test.mjs
    node --check fm/tower/tower.js

To stage safely:

1. Review the PR and edit station presets as required.
2. Stage a **module Worker** (worker.mjs imports stations.mjs), using Wrangler
   with an intentionally selected staging name and the existing RADIO_MEDIA
   R2 binding. The included wrangler.toml currently names the production
   Long Wave Worker; do not deploy it over the public Worker accidentally.
   Pasting worker.mjs alone in the dashboard will not bundle its import.
3. Verify /stations and each /stations/{id}/health endpoint with real R2
   data, including empty/disabled responses.
4. Tune two independent stations in separate browser sessions; confirm
   distinct music and carts, no cross-station contamination, and natural
   playback across several recording boundaries.
5. Confirm a Chicago daypart transition, screen-off behavior, error handling,
   original /live.mp3, and Station One. A scheduled program may begin at the
   next recording boundary rather than its exact wall-clock minute.
6. Release to production only after explicit verification and approval.
   No existing listener is automatically switched.

## Bulk catalog style enrichment

The offline converter and TOWER catalogue desk can now propose and review
optional Suno style, embedded genre and human-description metadata. Only
reviewed genre/mood/texture tags are joined by exact MP3 SHA-256 in the
Long Wave Worker. An enrichment tag cannot publish or enable media.

The approved Supabase radio catalog is retrieved in 1,000-record pages
up to 20,000 tracks. Long Wave uses a separately reviewed public
fm/catalog-enrichment.json for tags. Details and operator steps:
docs/CATALOG-CONSTELLATION.md.

MOTIF-inspired reason cases are proposals only (NOT_RUN); no native solver
execution or audio genre recognition is claimed.

## Audience feedback as temporary station metadata

The optional Listener Weather overlay now joins weekly, provisionally
aggregated anonymous song feelings to separately approved R2 tracks.
This is a distinct time-bounded signal, not a permanent genre label
and not a qualified Top 42 chart play. A reviewed Dance New Contenders
station contract selects currently approved songs with at least three
current-week 'move' responses. The public Top 42 page previews that
new-contender list; incomplete/truncated boards fail closed.

TOWER's feedback council also projects daily EP and weekly album
creations onto a monthly LP/EP nomination slate. The proposed
owner-only monthly source is read-only and still deliberately marked
incomplete until archived month-end evidence and event attribution
are independently reconciled. See docs/FEEDBACK-VINYL-COUNCIL.md.

## Boundaries

- No always-on encoder per **virtual** station, but active listening still
  incurs R2 reads, Worker work and bandwidth. Check current plan limits.
- Long Wave's initial ID3 stripping does not normalize mismatched MP3
  encoding formats; decoder tests on actual recordings remain necessary.
- Live mode is reserved and deliberately not connected to PR #133's
  experimental Station One HLS transmitter. It does not automatically
  take over a virtual station or perform a synchronized fallback.
- A third-party catalog still needs broadcast authorization and provenance.
- True synchronized virtual HLS, server-authorized publishing, analytics
  and a one-click TOWER production deploy are **not** in this milestone.

## Follow-up: shared-clock segment transport

Build an offline conversion/indexer that prepares each approved recording
once into stable short HLS segments, storing segment durations, keys and
rights provenance. A Worker can then calculate a channel's current schedule
from time, generate a sliding playlist for listeners, and serve segments
from R2 as requested. Test boundary discontinuities, track-seek accuracy,
clock drift, mobile decoding and deliberate live fallback. This is the
next transport layer, not a claim about this PR's implementation.
