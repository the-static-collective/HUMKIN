# LIVING RELAY 001 — One card, several bounded consequences

**Status: executable static-browser fixture on a separate branch. Not deployed, not a real mutual-aid receipt, and not on air.**

The chosen flow is **3 → 1 → 2 → 3**.

- **3 / Living Relic:** A fixed card address identifies one relic. An append-ordered manifest points to a current revision and keeps the earlier sample revisions readable.
- **1 / GIFTWAVE:** A report alone cannot unlock anything. A distinct synthetic confirmation can issue held game-capacity and musical proposals, not a NanaSpork fulfillment or an Outpost state mutation.
- **2 / Haunted Frequency:** An explicitly admitted synthetic confirmation supplies a seed for eight freshly generated Web Audio notes. This is an original algorithmic motif proposal, not a stem remix or Haunted Phonograph render.
- **Return to 3:** The motif proposal appears on the same relic page. The paper address does not change.

## Open and test

From the repository root serve a static site with Python 3's http.server on port 8000, then visit:

http://localhost:8000/living-relic.html?id=field-001

The separate print layout is at:

http://localhost:8000/living-relic-card.html

If the route is deployed and verified, the fixed public URL will be:

https://humkin.abundent.org/living-relic.html?id=field-001

Until deployment, the printed QR may point to a nonexistent public page. **Do not distribute it yet.**

The fixture is at relics/field-001.json. v1 and v2 are explicitly preserved; the browser can view either. The current_revision pointer is separate from the physical URL. There is no deployed dynamic link-bank and no guarantee that an unauthorized future Git edit cannot alter earlier history; preserve revision bodies in Git and add immutable content addressing before real public contributions.

A browser note exports a plain text file. Microphone recording only starts after explicit permission, is stored as a temporary device-local Blob URL, and is downloadable for personal use. A tab close may erase a recording not downloaded. No note, audio, scan, or response uploads. No automatic playback.

## Ownership boundaries

- HUMKIN owns this proposed static presentation, fixed route, public test fixture and original Web Audio preview.
- SIA presently archives local source observations; it is not yet a public mutable redirect or QR link bank. This demo does not claim SIA storage.
- NanaSpork/Jubilee owns authenticated report and confirmation. The fixture confirmation is NOT an actual person's testimony, a Jubilee confirmation or an Outpost unlock.
- WITNESS owns human Scripture readings; the recorder here is NOT a WITNESS upload.
- Haunted Phonograph owns its provenance-aware musical render pipeline. The generated Web Audio tones are NOT outputs of that system.

## Verification

Run:

node --check living-relic.js
node --check living-relic.core.mjs
node --check living-relic.contributions.mjs
node --check living-relic.porch.js
node --test tests/living-relay.test.mjs tests/living-relay-contributions.test.mjs

Tests cover fixed identity across revisions, retained historical source, duplicate/broken revisions, unsafe URLs, deterministic proposals, missing/withdrawn/reported-only confirmation, forged non-synthetic events, and absence of remote recording upload. The workflow living-relay.yml runs those tests on relevant pull requests.

No synthetic test proves production HTTPS, real QR scanning, real device microphone behavior, real recipient authentication, permissions isolation, radio insertion, or any deployment. Those require separate field tests and owner gates.

## Subsequent integration gates

1. Confirm the permanent URL owner and live QR scan in a phone browser. Keep printed links unchanged through content updates.
2. Add consented, authenticated contribution intake and an append-only revision store with deletion/revocation policy. Never publish recipient stories automatically.
3. Bridge only opaque confirmed receipt pointers from NanaSpork/Jubilee; each destination independently decides whether to admit a new event. Do not convert an arbitrary scanner check-in into delivered-help evidence.
4. Feed approved original motifs through Haunted Phonograph's owning contracts. An editor must approve anything actually aired by HUMKIN.
5. Verify the two independent consequences, their refusal paths, replay behavior, and their return to the original relic. Record actual physical results separately from fixture outcomes.

No back-end, station, game, SIA, WITNESS, or Supabase production state is touched by this branch.


## RELAY 002 — Kinship Porch × Living Gifts × sovereign participant channels

**Status: operator-local consent and lineage prototype on the existing HUMKIN draft branch; not deployed or on air.**

Source code reuse here is owner-authorized, not permission to use Kinship Radio's listener material or broadcast identity.

Source ancestry:
- KINSHIP-004 Porch (merged): Receive → welcome/hold/refuse → separately admit. WELCOME has no semantic effect.
- KINSHIP-007 Living Gifts (open PR #33): statement/photo/audio/video, opt-in scoped uses, owner-chosen credit, exact media hashes, scoped release review, withdrawal and import re-review.
- Band Runtime (merged kernel): independent participant channels, append-only receipts, history distinct from the current projection.

The adaptation is in living-relic.contributions.mjs; the UI in living-relic.porch.js; and the new Porch section in living-relic.html. The printed relic QR address is unchanged.

### Try the complete local loop

1. Run the site on localhost or an HTTPS preview. Use living-relic.html?id=field-001. SHA-256 and microphone functionality need a secure browser context.
2. Offer a statement or a local audio/photo/video file. Choose optional attribution and explicitly check any acceptable future uses: relic preview, music influence, radio consideration, archive consideration. Every checkbox starts unchecked. Add a release evidence reference if applicable.
3. The contribution arrives HELD. Choose it in the local operator desk, enter a reviewer label, and click WELCOME. This does not approve any use.
4. Independently choose one proposed use, supply a release check, and click ADMIT THIS USE LOCALLY. Only this use becomes eligible for an explicitly marked local preview.
5. With the existing simulated confirmation enabled, choose PLAY CONSENTED MOTIF VARIATION. The algorithm recomposes eight original note pitches from the admitted gift's opaque identity. It never samples the contributed sound or posts to the radio.
6. An unoffered use, a held/revoked use, an unsupported media file, or a missing release check cannot be admitted.
7. WITHDRAW THIS GIFT blocks every new preview and influence. It cannot recall an already exported copy.
8. Export a private pocket JSON, then import it. The import preserves the review history but resets its authority; new local Porch and use reviews are required. Audio/photo/video must be reattached with exactly the same SHA-256 digest.

To offer a clip captured using the 001 voice recorder, download it first and select that local file in the 002 gift form. No automatic contribution upload is performed.

### Consent and ownership

- Offer is not admission; Porch welcome is not license; human operator declaration is not independently verified authorization.
- The four uses are independent. Approval to preview a story does not allow using it for musical inspiration, broadcasting it, or archiving it.
- A gift has its own channel ID and optional ancestor ID. Ancestry never inherits permission or ownership. A withdrawn ancestor cannot seed a new local descendant.
- Draft and HELD local preview never equal public publication or radio airtime; no authenticated live editor exists in this prototype.
- Import never transfers authorization. Prior use reviews remain evidence only; private original media bytes never enter JSON exports.
- Withdrawal blocks new uses here. Public caches, already shared exports, and future mirrors need a separate cross-system takedown mechanism.
- The Collective owns source code, but not automatically the rights to anyone else's contributed statements, prayers, photographs or recordings.

### Storage and trust

This is an entirely device-memory workspace. Page reload loses unsaved gifts. Explicit pocket JSON exports contain private text, attribution, release references, media SHA-256 digests and historical review statements, but no audio/image/video bytes. Store them accordingly. There is no account, API, database, shared inbox, moderation system, public contributions, or actual producer authorization. The operator label is a demonstration, not proof of station employment or donor consent.

### Test and remaining frontier

Run node --check for living-relic.js, living-relic.core.mjs, living-relic.contributions.mjs and living-relic.porch.js. Run node --test on both tests/living-relay.test.mjs and tests/living-relay-contributions.test.mjs. GitHub Actions runs both on the PR.

Tests exercise no-default permission, independent scoped admission, consent withdrawal, source media hashes, hostile imports, reviewer re-entry, lineage, deterministic held music proposals, and no client upload.

Real sharing still requires a participant-authenticated consent protocol, securely private source file storage, independently authenticated operator reviews, withdrawal propagation, protections against abusive contribution, and separate production/rights/broadcast decisions.

References:
- https://github.com/the-static-collective/static-live/pull/33
- https://github.com/the-static-collective/static-live/blob/main/examples/kinship-fall-share-room/README.md
- https://github.com/the-static-collective/band-runtime
