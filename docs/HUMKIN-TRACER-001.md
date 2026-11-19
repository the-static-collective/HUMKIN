# HUMKIN TRACER 001 — one recording, inspectable crossings

**Status:** code in a draft PR. The operator runs it deliberately. No deployment,
permissions changes, playlist writes, automatic programming, SIA mutation, votes,
vinyl orders or audio rebroadcast occur.

## Why

Tower already writes the HLS `#EXT-X-DATERANGE` track cues on sample-relative
boundaries, while the public Compost endpoint lists enabled published recordings
and pseudonymous aggregate listening responses. SIGNAL RELAY 001 (separate
draft PR #155) exports local, **not-published** editorial proposals. Previously,
there was no single read-only way to inspect whether these artifacts referred
to the very same approved catalog ID.

TRACER 001 creates a bounded evidence receipt by intersecting those artifacts
by **exact recording ID**. It does not attempt to invent a blockchain or a
general-purpose event bus.

## Live operator check (Acer or any desktop with Node 22)

Choose the **public catalog ID** visible in Compost or Station Manager, such as
`crate-<uuid>`, `r2-<slug>` or a verified built-in radio ID. Do not pass an
S3 object path, private filename, media URL or artist name.

```bash
node scripts/humkin-tracer.mjs --track crate-REPLACE-WITH-APPROVED-ID --live --out humkin-trace-001.json
```

The command fetches the public Compost catalog and Station One's published
HLS manifest over HTTPS. If the stream is offline, it still produces a
partial receipt and explicitly marks the cue as absent. It does not try to
start or change the transmitter. Run it again when the named track is inside
the short HLS playlist window.

For a secondary frequency, add `--frequency talk` after first verifying that
the frequency is deployed and appropriate.

## Offline/portable audit using captured inputs

```bash
node scripts/humkin-tracer.mjs --track crate-REPLACE-WITH-APPROVED-ID \
  --catalog compost-snapshot.json \
  --hls live-snapshot.m3u8 \
  --proposal humkin-signal-relay-proposals.json \
  --out trace-with-proposal.json
```

The `--catalog` input is the **whole public GET result** from
`https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-compost`,
including both `tracks` and `scores`. The optional HLS input is the
public `/hls/live.m3u8` response from
`https://humkin-long-wave.joyvolcanomusic.workers.dev`.
The optional editorial input is the JSON exported by the owner-only
Station Manager in SIGNAL RELAY 001; it cannot be construed as owner
approval or as a persisted server-side station schedule.

The CLI will not overwrite an existing receipt. Its output contains SHA-256
digests of supplied snapshots, one catalog identity, bounded public credits,
the matching cue timestamp if present, aggregate play/response counts and
the local proposal's decision status. It deliberately does **not** copy media
URLs, listeners, source paths, credentials, network addresses or private audio
into the receipt. A SHA-256 digest identifies the bytes used for review; it
does not prove the snapshot was authentic or that anything happened in the
world.

## Exact authority/verification boundaries

| Crossing | What is established | What is not established |
|---|---|---|
| Public catalog | This ID appeared in the supplied published catalog snapshot | Rights, private originals, source approval beyond the snapshot |
| HLS cue | A matching cue appeared in the supplied public playlist window | A receiver played the audio, a listener heard it, a complete song aired |
| Compost score | Aggregate response counters were reported | Unique human listeners, manipulation resistance, actual DJ plays |
| SIGNAL proposal | A local paused/editorial action was recorded | Owner authentication, an enabled show, an accepted live queue |
| Record/QR handoff | **Not run** | Manufacturing, payment, print, SIA permalink or broadcast |

**Second-device field gate:** on the Acer, start the intended stream using the
existing broadcaster controls. On another device, intentionally tune to Live,
listen through a real transition, confirm the title/art match the audible
recording, and capture the public HLS manifest around the same cue. The
tracer alone does not satisfy this gate. Preserve Live → invisible Long Wave
→ invisible Same-Time and independent Road Shuffle. Never interrupt current
broadcasting to make a tracer pass.

**Editorial gate:** while authenticated as the owner, inspect one SIGNAL
candidate and load a paused show draft; abandon it, then verify the public
station hasn't changed. The local receipt may be exported and passed to
TRACER, but that still does not authorize a public broadcast.

**Known limitation:** HLS is a sliding window, and its DATERANGE can include a
previous cue carried into the window. A matching cue is therefore only an
observation of published metadata, not a claim of current audible playout.
Time, sequence and actual media play-through must be separately checked.
A failed live fetch is an unobserved cue, not a fabricated zero audience.

## Automated verification

```bash
node --test tests/humkin-tracer.test.mjs
node --check scripts/humkin-tracer-core.mjs
node --check scripts/humkin-tracer.mjs
```

## Integration path after the first field receipt

1. Validate the receiver and live metadata, preserving the original player.
2. Admit real MESH catalog IDs with provenance into the one published catalog.
3. Merge/review SIGNAL RELAY #155 and Auto Disco #154 independently.
4. In TOWER, use owner-reviewed drafts and actual transmitter receipts as
   separate sources, never conflating planned show schedules with aired plays.
5. Only after authorization, send a release nomination to lemonPRESS or an
   approved stable recording link to SIA. Neither occurs here.

**Rollback:** this addition is only a new CLI, core helper, test and
documentation plus CI validation. Removing them does not affect the live
receiver, catalog, R2 data, Supabase schema or Acer process.
