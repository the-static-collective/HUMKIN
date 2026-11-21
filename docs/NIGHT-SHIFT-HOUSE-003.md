# NIGHT SHIFT 003 — expand a two-song cloud proof into an approved HOUSE program

## Capability

Cloud Autopilot's shared HLS program is **not** the personal Long Wave MP3 stream. The current two-song cloud clock has passed its first user-reported Acer-off listening test; a larger shared house requires encoding more approved MP3s as durable AAC/TS segments and atomically scheduling a new R2 revision.

This change adds a **source-verified draft builder** using the same enabled, published R2 song catalog already used by Long Wave. An on-demand GitHub Action builds an 18-song, roughly hour-long draft as an artifact without privileged credentials, transcoding, modifying radio programming, or accessing private user uploads. The length estimate comes from the live published metadata and is not a guarantee of an exact 60-minute show.

### Cloud-only draft: no computer required

Open GitHub Actions → **HUMKIN Night Shift — draft a larger cloud HOUSE**, choose **Run workflow**, select 12 / 18 / 24 already published songs. Download the resulting \`night-shift-house-selection-draft\` artifact. It is a JSON document containing public, content-addressed R2 object identifiers, titles, artists, durations and SHA256 hashes. It contains **no media bytes and no credentials**.

The Action also runs on a pull request to demonstrate its ability to consult the *actual* public catalog. This is a read-only test, not publication.

Selection is deterministic for a given public catalog and count. It interleaves artists where possible without inventing audience play counts or artistic endorsements. Each source must be: an enabled, already published song; storage provider R2; a canonical \`tracks/<uuid>/<sha256>.mp3\` object path; valid nonempty title; credible duration; and a 64-character SHA256 digest. Changed/held/disabled/unpublished media fails closed on rechecking.

### Acer publication: explicit owner confirmation

Once the owner has reviewed every track and its permission for internet radio, use the **updated HUMKIN checkout** on the Acer and put the downloaded JSON in a known path:

\`\`\`powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\cloud-autopilot.ps1 -HouseSelection "$env:USERPROFILE\Downloads\night-shift-house-selection.json"
\`\`\`

That command is preview only. It re-fetches the **live public catalog** (to catch eligibility changes), downloads each permitted public MP3 into a disposable temporary file, confirms its full SHA256 digest, encodes/validates its AAC/TS segments, and retains only the privately cached transcoded output and pinned review receipt. A failed download, source mutation or missing source fails without changing R2.

Only after reviewing duration/order, explicit internet-radio rights and the R2 storage/operation cost, the owner may run the same command with \`-Publish\`. Type \`PUBLISH AUTOPILOT\` when prompted. It uses the **existing Windows DPAPI R2 credential vault**, not GitHub Action secrets. The publisher checks the public catalog **again**, compares the current remote MP3 bytes to the preview receipt, uploads immutable segments, compares the old R2 schedule, and changes the program pointer last.

The existing cloud program remains active until the next safe track boundary (minimum lead time 120s). If publication aborts before that pointer, the existing house keeps playing. No public \`/fm/\` cutover is implied.

### Verify the bigger house

- Confirm \`/autopilot/station-one/status\` reports a new revision.
- Play \`/autopilot/station-one/live.m3u8\` or the standalone \`/fm/night-shift/\` receiver.
- Confirm several **different** tracks with correct server-side titles, transitions, and audio while the Acer is powered off.
- Run the credential-free Night Shift 300-second GitHub aircheck while the Acer remains off.
- Test a separately reviewed exact-order Tower guest show and automatic HOUSE return. The currently merged Tower → Cloud Autopilot handoff can now fetch published remote sources; don't pretend a new house selection is itself a guest-show approval.

### Scope and rollback

- Never overwrite, garbage-collect or alter original public MP3 source objects.
- No new R2 write interface, public self-publishing endpoint, scheduled uncontrolled task, permanent source MP3 cache, or extra Cloudflare secret.
- No listener rewiring, no current program change from building a draft, previewing or merging this source branch.
- A replacement HOUSE revision supersedes the two-song loop at a track boundary. To revert, publish a new reviewed HOUSE program through the existing publisher or restore a known-good pointer using the owner's private operational recovery process, maintaining segment assets for buffered receivers.
- Public publication and owner audio listening are **not proven** merely by passing Python tests.

**Provenance:** installed Cloud Autopilot Worker; the merged secure remote-media Tower bridge formerly PR #177; public \`humkin_radio_tracks\` source eligibility and SHA256; existing publisher's revision-boundary and remote-byte pin checks.
