# MESH RADIO 001 · Links are the blocks

**Status:** additive, local-first, static browser experiment on \`/fm/mesh-radio/\`. Does not replace the original HUMKIN Crate Loader, the main radio stream, private catalog, or SIA's published permanent URLs.

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

### Reality check

This first step **does** merge metadata from many device inventories and play files available in the current browser or via linked public HTTPS storage.

It **does not yet** transmit a private Mac file over the Internet, create a network daemon, automatically replicate a file, synchronize listeners' clocks, contact an offline peer, or make an unapproved recording public. A metadata-only route cannot be played remotely. The next meaningful node upgrade is a small opt-in HTTPS peer endpoint or a user-authorized cloud mirror; the station resolver itself need not change.

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
