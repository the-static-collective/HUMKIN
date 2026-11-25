# QUIET FREQUENCY 001 — held cloud lane
Owner-approved station: quiet-frequency. Replaces Workshop placeholder in FM Studio, dedicated /fm/quiet/ room, no Station One change.
Reuse: shared Cloud Autopilot /autopilot/quiet-frequency/{status,live.m3u8}; existing native HLS receiver and cue parser; Haunted Toaster atmosphere.cjs (3652c2a96b6b287cda316d1c92daadf7c7417eaf), xorshift field and rain/steam ideas adapted for browser, not full ASS compiler.
Artwork: install owner-approved widescreen image at fm/quiet/study-room.jpg. A local-only file chooser permits audition until asset is installed. No private Suno IDs or links in public source.
Publication: owner auditions existing private 89-track candidate pool, reconciles approved R2 media identities, excludes abrasive versions and duplicate recordings, builds a unique >=4-hour cycle (including revision boundary review), uses existing cloud-autopilot publisher with station_id quiet-frequency. No publication performed. Don't substitute a personal shuffle. No new database or provider. Level-match audio on the production side, review repeat policy at revision cutovers. Verify status, actual manifest/segments, two listeners, phone background, Acer-off continuity, rollback. Motion is optional, reduced-motion respected and hidden tabs stop rendering.
Return receipt: source base 2afc79b7c58f7fc9e3b0405773810c35b8a5ca63; disposition adapted; MEMENTO snapshot deep-root-20261124-v3 had no HUMKIN refs in previous recovery; direct owning source used. Actual cloud media and physical tests remain HELD. admission:none.
Test: node --test tests/quiet-frequency.test.mjs.

## Owner handoff — catalog deliberately empty
No selected IDs are committed. When ready, save an ordered JSON array of approved R2 catalog IDs as a private local file (e.g. quiet-ids.json). From repository root:

    python tools/radio-broadcast/quiet_selection.py --ids quiet-ids.json --output quiet-selection.json
    python tools/radio-broadcast/autopilot_publisher.py --house-selection quiet-selection.json

Review the exact running order and actual encoded duration. Only when explicitly authorized, rerun the publisher with --publish and existing protected R2 credentials. The quiet lane rejects short cycles, duplicate IDs or audio hashes, stale approvals, mismatched fingerprints and repeat violations across revision boundaries. No unrelated catalog tracks or bumpers enter automatically. The existing preview/source-pin gate is retained. This is not permission to publish.

Artwork upload remains an explicit binary asset installation (fm/quiet/study-room.jpg); source connector accepts text and base64 strings but does not ingest local file references. Do not publish a private file URI or fake public art URL. The receiver can preview the local image without uploading it. Tests are added to existing validation workflow.
