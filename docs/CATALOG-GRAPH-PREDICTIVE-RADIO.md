# HUMKIN SAFE CATALOG + PREDICTIVE RADIO — staged design

**Status:** experimental, tests only. Neither the shared graph nor offline prediction
is connected to the public receiver or the live Acer control API. This document
must not be read as a deployment notice.

## 1. Protect the master catalog before cross-station editing

The existing Tower editor stores per-frequency metadata in the local
<frequency>-programming.json, and does not rewrite source audio, ID3 tags or
Supabase source rows. Keep using it only for local station experiments until
shared catalog migration is reviewed.

The new catalog_graph.py is an independent transaction and audit foundation:

* Recording identity is the **original source-issued ID**. Never identify a
  recording by mutable title, filename, album spelling or artist text.
* Newly modeled artists, albums, releases and stations get fresh durable IDs;
  matching display names DO NOT silently merge entities.
* Artist credits, album membership and station membership are explicit typed
  links, not a fuzzy lookup or folder-name inference.
* A node's first registered source evidence is immutable. Corrections go into
  a separate metadata overlay.
* Every metadata/relationship change requires the graph revision last reviewed
  by the editor. Stale writes are rejected rather than silently overwriting
  another station operator's work.
* Every committed change is stamped with an actor, revision and before/after
  values. The latest change can be reversed by a compensating audit event.
* SQLite WAL and BEGIN IMMEDIATE coordinate independent local processes.
  The file should live in the Tower's shared local directory and be backed up
  before any deployment. It must not be hosted as a browser-writeable JSON file.

**Not yet wired:** the Tower edit form, archival Supabase tables, remote station
sync, approval preview and browser UI are intentionally not connected to the
graph. There is no global write button. Do not enable global edits, migrate
existing per-frequency overrides, or deploy a live graph endpoint until the
migration can be compared against the existing catalog and rollback tested.
Even after activation, cross-station edits must show the exact affected records,
source revision and scope; a local override must not silently become canonical.

### Proposed cutover gate

1. Snapshot/backup the live Acer programming JSONs, uploaded media hashes,
   source catalog rows and cloud artifact references.
2. Read-only inventory of all recordings; count IDs, duplicate content hashes,
   mismatched artist/album names, absent source references and orphaned links.
3. Import only unambiguous **source-ID-linked records** into the graph; unresolved
   aliases require owner review, never automatic merging.
4. Dry-run shared overrides: calculate every affected station, title, cue,
   schedule and published page. Reject ambiguous or conflicting changes.
5. Expose a two-phase global edit: preview, then confirm with expected revision.
   Preserve the default **Station only** option for independent experiments.
6. Test multi-process refresh, on-air cue updates, edit during crossfades,
   offline recovery, backup restoration and restart reconciliation.
7. Only then promote the graph to a shared authority; remote sync needs its own
   permission and conflict model.

## 2. Predictive synchronized radio: what can and cannot be buffered

**HLS cannot contain audio that has not been encoded yet.** To play scheduled
music through a long network outage, publish a *separate advance playout plan*
and allow an opted-in listener to download copies of eligible future recordings.
The audio planned for broadcast must be retrievable at an immutable, HTTPS,
byte-range-capable media URL. These files are not the mutable live HLS manifest.

The independent **fm/predictive-clock.mjs** prototype checks a future plan:

- a station program epoch and monotonic revision;
- server millisecond timestamps, duration, audio hash and size for each slot;
- status = committed, explicit offline/rebroadcast permission and safe URL;
- at most three tracks and 30 MiB total, only with opt-in downloads;
- a recently sampled server-clock offset and an expiring plan validity window.

It computes a provisional seek offset into a cached track during an outage.
The UI must identify this as **scheduled audio playing offline**, not as a
verified live broadcast. A subsequent network connection should immediately
ask the server for the actual current program epoch, published cues and HLS
playhead, discard outdated predictions and then crossfade back to HLS. Optionally
switch at a track boundary to minimize audible jumps. Never equate a
predicted schedule with the true played stream after manual queue changes.

### Remaining necessary work before listener activation

* The encoder must publish a signed/HTTPS **future rundown** with per-slot media
  hashes, precise start times, committed status, rights and expiring revision.
  Current Tower queue ordering alone is NOT proof a track starts at a given UTC
  time: crossfades, jingles, DJ inserts, skip, preparation failures and source
  restart all affect the real on-air timeline.
* The station must publish a clock sync/status endpoint and source epoch; HLS
  program-date-time and current cue support playhead reconciliation.
* The receiver needs explicit opt-in, network/battery/storage policies and an
  offline media cache that handles HTTP Range/206 responses. Progressive audio
  on mobile Safari is not guaranteed to play offline just because fetch() put
  bytes into Cache Storage. Service workers may be suspended; iOS background
  audio transitions require real-device acceptance testing.
* Never prefetch content without rights covering **download/offline caching**
  (not merely online streaming), and do not leak private library URLs.
* Always fall back safely if the plan expires, a recording is missing, a device
  clock changes, the service worker is evicted, or content hash differs.

### End-user player decision

The future receiver should have an unobtrusive setting:
**Protect listening from signal loss — cache up to 3 upcoming tracks (up to
30 MiB)**. It is opt-in and off by default. When disconnected, the receiver
displays the offline state. On reconnect, it chooses:
1. match current cached track and seek to canonical clock where verified;
2. otherwise crossfade into current live HLS, skipping obsolete cached songs;
3. if HLS is unavailable, preserve existing Long Wave and Same-Time fallbacks.

No actual remote playout, persistent prefetch, service worker or listener UI
changes are included in this initial safety PR.
