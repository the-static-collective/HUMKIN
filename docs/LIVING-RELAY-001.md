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
node --test tests/living-relay.test.mjs

Tests cover fixed identity across revisions, retained historical source, duplicate/broken revisions, unsafe URLs, deterministic proposals, missing/withdrawn/reported-only confirmation, forged non-synthetic events, and absence of remote recording upload. The workflow living-relay.yml runs those tests on relevant pull requests.

No synthetic test proves production HTTPS, real QR scanning, real device microphone behavior, real recipient authentication, permissions isolation, radio insertion, or any deployment. Those require separate field tests and owner gates.

## Subsequent integration gates

1. Confirm the permanent URL owner and live QR scan in a phone browser. Keep printed links unchanged through content updates.
2. Add consented, authenticated contribution intake and an append-only revision store with deletion/revocation policy. Never publish recipient stories automatically.
3. Bridge only opaque confirmed receipt pointers from NanaSpork/Jubilee; each destination independently decides whether to admit a new event. Do not convert an arbitrary scanner check-in into delivered-help evidence.
4. Feed approved original motifs through Haunted Phonograph's owning contracts. An editor must approve anything actually aired by HUMKIN.
5. Verify the two independent consequences, their refusal paths, replay behavior, and their return to the original relic. Record actual physical results separately from fixture outcomes.

No back-end, station, game, SIA, WITNESS, or Supabase production state is touched by this branch.
