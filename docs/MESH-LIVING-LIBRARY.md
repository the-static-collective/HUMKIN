# HUMKIN MESH-001 × SIA Linkbank · the living radio library

Status: implementation tracked in HUMKIN + SIA source. This document distinguishes verified code/deployment from the first **physical Windows inventory and public QR field test**.

## Why this exists

The library has grown from 9.04 GB of MP3s to **10.8 GB** after phone recordings, before counting unique WAV masters and stems on another computer. Replicating every file on R2 would waste cloud storage and treat archival production files like approved radio releases.

**MESH identity separates four distinct things:**

1. **Work/reference identity:** the existing \`humkin_radio_tracks.id\` is stable editorial identity; a human-selected \`humkin_mesh_links.slug\` is a permanent SIA-style public doorway.
2. **Physical bytes:** SHA-256 of each *entire* file; identical hashes mean identical bytes, **not automatically the same song or rights**.
3. **Physical locations:** computer node ID, private relative path, last-observed timestamp. Multiple copies can be on one or many computers. A last-seen inventory entry does **not** claim the node is online.
4. **Publication permission:** existing published+enabled R2 catalog, separately and explicitly approved. No local file or private staging bucket is an eligible public destination.

### Architecture

\`\`\`
Windows/other disk --streaming SHA-256--> local JSON inventory (private)
     |                                   |
     | no audio uploaded                  | owner reviews, sends metadata only
     v                                   v
 Originals never moved           Supabase MESH metadata registry (owner-only)
                                         |
                              one object fingerprint, many copy observations
                                         |
Existing approved R2 radio catalog -------+--- explicit owner stable-link decision
                                              |
                                        HUMKIN /m/?id=SLUG
                                              |
                          SIA Linkbank asset ID + Little Packet /p/?id=...
                                              |
                         permanent reference; public listening copy may move
\`\`\`

**No edge daemon, automatic replication, master backups, public peer-to-peer, LAN share, or cross-provider storage transfer is running in MESH-001.** This is the foundational inventory / registry / permanent-link kernel and usable owner interface.

## Operator: first computer

1. Download/extract the latest HUMKIN repository on the computer already equipped with Python 3 (the Acer setup works).
2. Double-click \`tools/mesh/SCAN-MY-MUSIC.cmd\`. Paste the parent music folder path (e.g. an artist-album collection). Choose layout \`artist/album\`, \`album/artist\`, \`none\` or \`genre/artist/album\`. ffprobe tags are optional and may take longer.
3. This reads all recognized MP3, WAV, M4A, FLAC, AIFF, OGG, OPUS, WMA and AAC files, computes SHA-256 in 4 MiB chunks, identifies duplicates without altering them and writes \`%USERPROFILE%\\Downloads\\humkin-mesh-inventory.json\`. Node UUID persists under \`%APPDATA%\\HUMKIN\\mesh-node.json\` so repeat scans represent the same machine. Python standard library is enough unless optional ffprobe is chosen.
4. Open \`https://humkin.abundent.org/fm/mesh/\` and sign in through the existing Crate Loader. Choose inventory JSON, examine preview, then explicitly click **REGISTER INVENTORY (METADATA ONLY)**. Records go in batches of 100; a failure can be retried with the same JSON without duplication. No MP3/WAV content is uploaded through this step.
5. On the second computer, repeat with its own node UUID and export. Same SHA-256 across nodes shows multiple copies. Different WAV/MP3 encodings are distinct files; manually assemble works and derivatives later.
6. Select **INDEX EXISTING PUBLIC R2 CATALOG** to register the already-published Cloudflare files as a separate cloud node; it does not download, upload, or republish them. Files with matching hashes collapse to one content identity and multiple copy locations.
7. If a published radio recording deserves a durable outward-facing QR, choose the track, enter a new \`slug\`, a display title and a reason, then press **CREATE STABLE LINK**. Its URL is \`https://humkin.abundent.org/m/?id=slug\`. The resolver checks current R2 publication and enabled state on each visit. Only a human operator may repoint or hold the link.

### SIA bridge

The SIA repo owns the existing \`sia/linkbank/v0\` public reference + \`LITTLE PACKET\` composition model. HUMKIN exposes an **EXPORT FOR SIA LINKBANK** file with only approved stable references, titles and active/held status; it never contains private paths, local nodes or credentials.

SIA's \`scripts/import-humkin-mesh.mjs\` merges that file into its canonical \`site/registry.json\` after an explicit owner review. Existing packet IDs and asset history survive; a source export does not automatically publish.

The currently mirrored pilot page at \`https://humkin.abundent.org/p/?id=radio-surprise-001\` is sourced from SIA's earlier \`site/registry.json\`. A permanent print run requires actual working HTTPS/playback/retarget testing from separate devices; do not claim SIA root \`abundent.org/p/\` is deployed. **Do not print unverified addresses.**

### Safety invariants

- MESH tables have RLS owner-read only; no anonymous metadata tables; all mutations flow through owner-authenticated Edge Function. Never use user-controlled auth metadata as an owner role.
- Owner email is verified by Supabase \`getUser(token)\`; Supabase service role is never sent to browser.
- The public resolver operates without a login, but can return only a track owned by the link owner with \`published_at\`, \`enabled=true\`, \`storage_provider=r2\`, and strictly checked R2 object key ending in the stored content hash.
- Owner actions \`link_create\`, \`link_repoint\`, \`link_hold\` are independent from radio upload/publication. Link events are appended in the same transaction by a database trigger. A held link never silently substitutes another song.
- Local relative paths can reveal personal information. Inventory JSON is **private**; don't email it casually, publish it in GitHub, or embed it in a QR. The CLI imports no unrecognized files and never follows symlink directories.
- The scanner cannot prove any performance license, consent, work ownership or availability. Its hashes identify physical bytes only.
- No automatic deletion or balancing of audio across clouds. This remains a future, explicit, independently verified operation.

## Evidence and verification

- Unit tests: \`python3 -m unittest discover -s tests -p 'test_mesh_inventory.py' -v\`, \`node tests/mesh.test.mjs\`; SIA \`npm test\`.
- Backend: migration \`supabase/migrations/20261119010000_humkin_mesh_001.sql\`, function \`supabase/functions/humkin-mesh/index.ts\`.
- First field test: index two copies of an MP3 on separate local nodes and verify one unique SHA/2 locations, preserving originals; sync the 152 existing R2 tracks; create one approved reference and verify nonautoplay listening; hold it and confirm unavailable; repoint to a *different* approved track and confirm the original reference URL still works. Check link history. Test the SIA packet on phone as a separate step.
- As inventory expands, review remote-availability checks, copies-count and a backup policy before enabling actual replication or evictions.
