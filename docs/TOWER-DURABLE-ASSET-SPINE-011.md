# TOWER 011 — Durable AAC Asset Spine + Rolling Planner Aperture

## Problem observed

The old incremental Cloud HOUSE sync can spend over half an hour encoding and then HEAD-checking thousands of objects serially. The encoder cache is in `$RUNNER_TEMP`, which is lost if a GitHub runner fails before its full schedule publication. The old reusable AAC index is restricted to assets already mentioned in an R2 program revision; completed but unpublished tracks can be re-encoded.

**TOWER 011 changes what a successful *recording* means.** A track's encoding is now a durable, independently reusable object-storage asset. A cloud station schedule is only a reference to that asset.

## Physical layout

| Role | Store today | Example key |
| --- | --- | --- |
| Original, rights-reviewed MP3 archive | Cloudflare R2, existing media bucket | `tracks/<approved-uuid>/<source-sha>.mp3` |
| Encoded immutable AAC/HLS TS segments | Cloudflare R2, existing `humkin-radio-live` bucket | `autopilot/segments/<source-sha>/segment-000001.ts` |
| **New completion certificate**, written **last** | Same private R2 bucket | `autopilot/assets/<source-sha>/complete.json` |
| Current/future Cloud HOUSE programs | Same private R2 bucket | `autopilot/programs/station-one.json` |
| Published track catalog, ownership, Auth, owner-issued controls | Existing Supabase project | `humkin_radio_tracks`, `humkin_tower_control_intents` |
| Optional per-station operational database and cold mirror | **Not provisioned**, potential Neon project | PostgreSQL rows / Neon S3 objects |

Cloudflare's R2 free 10 GB is **per account (aggregate Standard storage, not per bucket)**. The object-storage and operation allowance is not permission to create unlimited free duplicate audio. Neon's Free 1 GB Postgres database is for metadata, not TS blobs, while its separately allocated Object Storage may be a useful optional station backup/cold tier. The currently connected Neon project belongs to fellowSHIP Commons; TOWER 011 does not modify it.

## Actual implementation

`tools/radio-broadcast/tower_asset_store.py` provides an immutable, source-SHA-addressed encoded asset:

1. Only an already approved/public R2 catalog row can reach the sync's source downloader, and the source bytes are SHA-256 verified.
2. If the private R2 **completion marker** already exists with the exact approved source hash and AAC profile, reuse its durations without downloading MP3 or running FFmpeg. If a prior on-air program advertised the same source with differing durations, abort rather than silently substituting.
3. If the marker does not exist, encode locally *once* with the established FFmpeg AAC profile. Upload and verify the song's TS pieces in a bounded parallel pool (at most 12 workers). If a piece already exists, verify its byte count **and SHA-256** rather than overwrite a possible incompatible encoder output.
4. When all pieces match, store a profile-pinned, checksummed, bounded `complete.json` marker and read it back. **Never** write the on-air program pointer from the asset module. If the 37th source fails, the first 36 completion markers survive on R2 and the next runner skips their encodes.
5. `autopilot_publisher.publish_program` validates the marker and rechecks its first/last segments, then skips the old per-segment HEAD loop for certified assets. For older unmarked on-air material, the full legacy HEAD/existence check remains, but runs in a bounded 12-worker pool instead of serial requests. Any incomplete source still stops publication before the pointer write.
6. On each authorized Cloud HOUSE sync, a **bounded legacy backfill** checks and certifies up to five *currently approved* old-on-air source hashes, reading their existing R2 segments and hashing the bytes **without FFmpeg**. It can make progress even if the station schedule is otherwise unchanged. A disabled/removed catalog source cannot be backfilled automatically. The source catalogue is revalidated again before publishing future audio.
7. The official `--sync` CLI now uses durable media automatically. The public, credential-free `--cache` planning mode remains read-only. Existing station run approval and GitHub workflow settings are unchanged, and no extra credentials are introduced.

### Retention and garbage collection

Revoking a song from the approved catalog prevents **new playlist selection**. It does **not** immediately delete previously certified AAC bytes (an old on-air revision or active HLS listener could still reference them). A future guarded, reference-counted janitor should delete unreferenced orphan assets after grace periods and owner rights review. TOWER 011 intentionally does **not** automatically delete user audio, object-store markers, or any previous valid station media.

### Important limitations and safeguards

- A completed encoded asset is **not** broadcasting permission, a queued command receipt, or verified listener playback.
- TS audio uses the existing content-addressed segment key. Changing FFmpeg encoder parameters requires a separately reviewed codec/profile migration so two different outputs never race for the same key.
- The R2 completion marker is produced by the dedicated credential-holding publisher and must remain immutable. The Worker still checks its live HLS media window for missing objects. Marker first/last checks replace full publication HEAD checks only for marked assets.
- This applies to the **next** workflow run after merge. It does not rescue files from a runner that completed encoding but exited without either uploading pieces or publishing the old schedule.
- The Cloud Autopilot's historic 32-revision, 500-entry, 10,000-segment constraints remain. The station must NOT shift to frequent 3-hour rolling revisions until sequence-safe revision compaction is implemented and tested on real HLS clients.

## Rolling schedule preview (not yet broadcasting)

`tower_rolling_window.py` can derive sequential one- to six-hour **preview-only** windows from a validated canonical FULL source cycle, preserving its Bumper Brain/seasonal ordering and a monotonic source cursor.

The preview is *not* wired to the cloud program pointer because dropping an old Cloud Autopilot revision without a persistent HLS media/discontinuity-sequence anchor would break live client continuity. The next stage is to implement and test:

- segment-sequence and discontinuity-sequence anchors across safely compacted revisions;
- a rolling lookahead that plans the next window before the current one completes, without rescheduling every time the poll runs;
- owner mobile queue/weight/hold commands applied to future windows without cutting a song in progress;
- multi-station scopes and an optional Neon operational index, only after R2 storage is monitored and a second provider genuinely solves a cost or reliability problem.

## Verification

- `python3 tests/tower-durable-asset.test.py`: crash after first track, resume on a fresh runner, manifest-last, bounded immutable checks, corrupt marker fail-closed, marker-aware safe publisher, current-catalog-only historical certification.
- `python3 tests/tower-rolling-window.test.py`: bounded consecutive windows with no repeated or skipped source positions, source policy fingerprint changes require review.
- Existing `tests/cloud-house-delta.test.py`, TOWER cloud/Worker/site/Station One workflows.

**Operational rule:** wait until any currently running long Cloud HOUSE job finishes before dispatching a replacement. If a job fails, retain its logs and review the exact failure before retrying.
