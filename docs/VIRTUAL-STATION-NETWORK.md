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
| seasonal | Yes | Approved seasonal recordings |
| talk | No | Placeholder until talk material is tagged and approved |
| top-40 | No | Placeholder until chart IDs and editorial rules are selected |

A station with no approved matching content fails closed; it does not
secretly revert to the full music library. User-defined artists, albums
and tags are not inferred by AI or automatically assigned. Manifest tags
are supported; Supabase's current public catalog includes artist and
album, but not genre tags.

## New Worker routes

- GET /stations — read-only station listing with program, count, ready state.
- GET /stations/{id}/health — one enabled station's status.
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
- The local station designer edits modes, names, filters and weekly schedules.
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
