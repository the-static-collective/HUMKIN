# HUMKIN × Haunted Phonograph — Stem Orchard receiving desk 001

**Status:** staged browser review adapter. Not an active remix broadcast. No creator stems or live Modal/R2 account have been connected by this repository change.

## What is now connected

- Source/creation lives in [The Haunted Phonograph](https://github.com/the-static-collective/the-haunted-phonography): seedable owner-declared cross-song candidate selection and actual deterministic FFmpeg rendering from byte-verified stems.
- Transport is **private** Modal (operator-triggered CPU job) + **private** Cloudflare R2 bucket. Original stems and generated held WAV stay out of public GitHub Pages and public custom domains.
- A new local receiving desk at \`/fm/living/phonograph.html\` accepts \`humkin.phonograph-candidate/v1\` JSON. It checks the record's schema, plan/candidate identity, source ID references against the actual published \`fm/rotation.json\`, owner references and absolute HOLD state.
- It never requests private WAVs, writes Supabase data, changes the Station Manager, copies to public R2, edits \`fm/rotation.json\`, or claims a broadcast occurred. Local browser notes are removable and exportable.
- The older Living Discography desk remains fully functional, and links to the new receiving desk. Existing live \`/fm/\`, Android/older iOS radio, and the album homepage are untouched.

## Human release procedure

1. Start with personally supplied stems for two or more already cataloged HUMKIN songs, plus owner-declared BPM/key and SHA-256 hashes. Rights control is the owner's assertion, not inferred from a public MP3.
2. Render a private WAV locally or through the Phonograph Modal + R2 tool. This creates a private \`candidate.wav\`, \`candidate.receipt.json\` and \`candidate.humkin.json\` — or their private R2 equivalents.
3. Retrieve \`humkin.json\` securely and import it into the HUMKIN receiving desk. The page verifies structural identity, **not** the actual bytes in private R2. It does not autoplay.
4. Listen to the generated WAV, compare the sources and receipt, record KEEP/WEIRD/COMPOST via existing producer conventions. An owner must separately approve a final encoding and publication rights.
5. Move **only the approved listening copy** into the public media bucket/Station Manager through the existing explicit owner workflow. Nothing here promotes a HOLD to broadcast, and the public media bucket should never contain \`stems/\` or \`candidates/\`.
6. If aired in a real broadcast, confirm that occurrence separately through the Living Discography. A completed compute render is **not** an airing.

## Where to set up cloud services

Cloudflare has no verified direct account connection here. The R2 and Modal work is staged in Phonograph, not deployed: [Source-owned setup guide](https://github.com/the-static-collective/the-haunted-phonography/blob/feat/phonograph-humkin-stem-orchard-001/docs/STEM-ORCHARD-001.md).

Create two distinct zones:
- \`humkin-radio-private\` — R2 **private** stems, requests and candidates; no public access/domain.
- \`humkin-radio-media\` — proposed **public** listening-only vault, optionally served from \`media.abundent.org\`, after explicitly approved release. This is not a completed DNS setup.

For mobile-only operation, the Phonograph repository has a manual workflow that reads a private R2 \`requests/*.json\` manifest through the Modal Secret \`humkin-r2-private\`. The GitHub workflow needs only Modal execution tokens; it never logs the R2 secret. The underlying engine needs no GPU for the initial deterministic mixing.

## Test

\`node tests/phonograph-bridge.test.mjs\`

Expected: source ID validation, HOLD-only gate, private key format enforcement, refusal of public URLs, refusing forged plan identities and unchanged \`/fm/\` behavior.
