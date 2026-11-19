# MESH RADIO 001 · Links are the blocks

**Status:** additive, local-first, static browser experiment on \`/fm/mesh-radio/\`. A new optional R2 upload section reuses the *existing* Supabase owner session, private R2 staging service and public R2 publication machinery. Does not replace the original HUMKIN Crate Loader, the main radio stream, or SIA's published permanent URLs.

## The idea

A station need not own the files it plays. Its recipe points to **recording identities** and a routing layer chooses an available approved copy. Everything that supplies the music can be a node: a Mac, a pair of Windows desktops, R2, Supabase public Storage, another accessible HTTPS host, or future peer relays. A node may participate only as an index; it need not stay online or upload any bytes.

The key distinctions are:

- **Work**: a human concept or song that might have several masters, mixes, and encodings. This experiment does *not* decide work equivalence.
- **Recording block**: SHA-256 of one exact audio file plus editable metadata. Different encodings have different fingerprints.
- **Node block**: a device or hosting provider. A node can report a copy without offering network access.
- **Location link block**: recording → node with \`device\` (known copy, not necessarily accessible) or \`https\` (a potential playable audio route).
- **Station recipe block**: references the shared recording pool and selection rule. The first recipe is \`compost-heap\`, prioritizing the least-played *locally playable* recordings.
- **Stable outward link**: the existing HUMKIN \`/m/?id=...\` and SIA \`sia/linkbank/v0\` remain the reviewed *public* doorway for published music. Linkblocks experiments do not automatically claim or repoint those addresses.

This is an exchangeable graph of links, **not a blockchain**, a token, or a consensus ledger. Content hashes guard byte identity. Signed availability announcements and station synchronization can be added later.

## First playable experiment

1. Open \`/fm/mesh-radio/\` when published to GitHub Pages. It is a static site and requires no Tower or Vercel login.
2. On your Mac or desktops, optionally use the existing read-only \`tools/mesh/scan.py\` to produce \`humkin.mesh/inventory/v1\` JSON. The Windows one-click wrapper is \`tools/mesh/SCAN-MY-MUSIC.cmd\`. Import two or more inventories through the **MESH inventories** picker. Shared SHA-256 values collapse to one recording, while both physical source nodes remain represented. Inventory alone never transfers audio.
3. Press **ADD PUBLISHED HUMKIN R2 SONGS** to add eligible public R2 recording routes using the existing public Supabase Postgres catalog read. Neither the browser nor the database gets new private storage credentials.
4. Select individual audio files, or an entire folder, on the computer currently running the browser. Those file bytes are fingerprinted sequentially and get temporary browser-local playback URLs. No upload. The list remembers recording metadata and node reports in local browser storage; reselect files after browser restart to play locally again.
5. Play The Compost Heap. It selects the least-played currently playable recording. On audio failure it tries another linked public host route for the same SHA before skipping that recording. Completed plays are tracked only in that browser.
6. For an existing fingerprint, use **LINK ANOTHER SOURCE** to register a permanent public HTTPS audio file address from another host. The exact content must match the fingerprint; **the lab does not currently download/re-hash a third-party public URL**.
7. Use **EXPORT PORTABLE GRAPH** to move this graph between browsers. Import the exported JSON on another computer. This file contains only allowlisted node labels, recording hashes and metadata, public route URLs, and the station recipe. No private paths, raw audio, cloud credentials, browser blob URLs, or play-history are exported. Review title metadata before sharing it with others.

## Actual Cloudflare R2 intake from Mac / any computer

This is the missing piece after the first local-only Linkblocks experiment. It uses the **existing** server-authorized \`humkin-r2-direct\` Edge Function (no Vercel and no browser-visible R2 API keys). MP3 uploads are catalog entries, not merely links.

1. On \`https://humkin.abundent.org/fm/mesh-radio/\`, select a music folder with MP3s in the local folder picker. The files are hashed and playable in that browser before upload.
2. Scroll to **04 · Put these songs on R2**. Click **CHECK MY HUMKIN R2 CONNECTION**. The browser reuses the same Supabase owner session as \`/fm/load/\`. There is no new HUMKIN login system.
3. If the Mac has no owner session, use **EMAIL MY SIGN-IN LINK**. If Supabase's unresolved redirect configuration sends a fresh email link to \`localhost:3000\`, copy the *unopened* link and paste it into the masked **UNLOCK THIS BROWSER FROM EMAIL LINK** field. The token is exchanged directly against the same Supabase Auth API; it is not put in this document, GitHub, or the browser index.
4. **UPLOAD SELECTED MP3s TO PRIVATE R2** calls \`status\`, then for up to three recordings concurrently runs: \`prepare\` → single presigned R2 PUT of one MP3 → \`finalize\` SHA-256 verification. The private staging bucket remains private. Song metadata comes from existing Linkblocks inventory data or title inferred from file name with HUMKIN / HUMKIN RADIO · INBOX fallbacks. 50 MiB per MP3 max.
5. The service records verified, unpublished drafts in existing \`humkin_radio_tracks\`. The page can refresh and rediscover those drafts after reopening it. **PUBLISH ALL VERIFIED R2 DRAFTS TO RADIO** requires a second deliberate click and confirmation; after each successful \`publish\`, the verified source is copied to public \`humkin-radio-media\`, registered as a published Supabase radio track, and the Linkblocks catalog refreshes. This bulk action encompasses *all* verified unpublished drafts belonging to the owner, not just currently selected Mac files.
6. If a recording is already cataloged by exact MP3 SHA-256, the upload skips it. A selected WAV/M4A does **not** upload via the new direct panel; use the existing Crate Loader's local conversion or an offline converter and reselect MP3. If **PRIVATE R2 NOT READY**, check private bucket and permissions, or stage through the old loader's Supabase route.

This feature is still browser-field-test pending. CI checks the code and backend contracts, but does not claim an actual owner session, real Cloudflare write, Mac Safari codec behavior, or CORS success. Files and private keys never travel through Vercel.

### Reality check

This first step **does** merge metadata from many device inventories and play files available in the current browser or via linked public HTTPS storage.

It **does** upload MP3s selected on a Mac or other computer to owner-authorized private R2 and, after explicit approval, publish them into the existing radio catalog. It **does not yet** transmit arbitrary offline-node files peer-to-peer, create a network daemon, automatically replicate between peers, synchronize listener clocks, or contact an offline machine. A metadata-only route cannot be played remotely. The next meaningful node upgrade is a small opt-in HTTPS peer endpoint or a second host adapter; the station resolver itself need not change.

## One-person, many free resources

Nothing here requires buying a dedicated radio server. Provider-specific storage is separated from the stable identity and station logic.

| Resource | Linkblock role | Required? |
| --- | --- | --- |
| GitHub Pages or other static hosting | Serves the player and portable manifests | One static host for a shared page; offline copies also work |
| Cloudflare R2 | Optional always-available audio route for published copies | No |
| Supabase Postgres / Storage | Optional catalog metadata and public audio hosting | No |
| A personal computer | Offline index, optional currently selected browser playback | No permanent uptime required |
| Another HTTPS host / relay | Additional address for the same recording | No |
| SIA Linkbank | Stable outward references that can change their destinations after review | Only for published durable links |

Free tiers change, so no unverified promise of unlimited bandwidth, storage, or uptime is built into this design. Public direct URLs are appropriate only for recordings intended to be available to the audience; source devices and private directories stay invisible.

## Engineering proof

\`node --test tests/mesh-radio-linkblocks.test.mjs\`

The tests exercise two inventories sharing a recording fingerprint, offline-only indexes, browser-local playback, HTTPS fallback, deterministic least-played selection, rejection of credential-bearing URLs, reviewed R2 catalog filtering, idempotent manifest merge, and privacy of exported fields.

### Next steps

1. Test on **two actual computers** using separate inventory files and locally selected audio.
2. Add a **temporary node availability lease**, not an assertion that every indexed copy is streaming.
3. Add a small, explicit peer/host connector: HTTP range support, user-chosen shared folders, HTTPS transport and no leaked private path. Cloudflare and personal-host adapters can implement the same route shape.
4. Promote station recipes from this local experiment to a shared clock/program ledger, then test real dual-device tune-in against a common program.
5. Reuse SIA's public, reviewable stable-link export for published assets; never confuse portable private catalogs with public broadcast authorization.

**Operating rule:** a recording keeps its identity when hosts come and go; a station keeps its recipe when recordings move. No single provider becomes the whole radio.
