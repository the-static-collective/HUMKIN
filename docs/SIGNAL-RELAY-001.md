# SIGNAL RELAY 001 — Compost listener signal → owner-held programming draft

**Source:** existing public Compost Heap catalog, /fmstudio/compost.js and the existing humkin-compost Edge Function.
**Editor:** existing authenticated Station Manager at /fm/manage/.
**Status:** proposed code and CI fixture tests. Not an automatic broadcast rule, a MOTIF native execution, or a verified field outcome.

## The first real crossing

1. A listener deliberately plays an approved recording in Compost and can provide the existing voluntary rating/reaction.
2. After the existing Station Manager owner login, the Signal Relay section reads the public Compost endpoint. No additional Supabase schema, service keys, or private audio indexing.
3. Candidate selection intersects public Compost items with the owner's current library; only enabled, published songs with valid track IDs qualify. About 70% of the 20 displayed seats favor least-recorded plays; up to 30% are reserved for stronger listener signals.
4. DANCE CONTENDER requires two saved dance reactions and two ratings; RETURN LISTEN requires three ratings averaging at least four stars; other choices are UNDERHEARD. These are simple heuristics, not verified popularity.
5. LOAD PAUSED SHOW DRAFT passes a catalog ID to the existing show editor and forces the active checkbox off. The owner must inspect the show, rights and schedule and separately press SAVE. No server show is created by merely loading a draft.
6. LISTEN / SHARE EXACT RECORDING creates a no-autoplay link in the form /fmstudio/?compost=PUBLIC_ID. Compost validates against the currently published catalog each visit. Removed IDs are not replaced with a different work.
7. Optional local proposal receipts can be saved/exported as JSON. They explicitly say not_published_by_relay and are NOT proof of actual broadcast or human fulfillment.

## Boundaries

- The earlier /fm/signal/ three-song station seeds remain untouched.
- No Top 42 votes, guild awards, Orchard XP, personal profiles, automatic station activation, style inference, or automatic outreach.
- No native MOTIF service, GHoT compute, SIA link repoint, payment, printing or social connection is implied.
- Exact-track links are QR-ready while an approved catalog record exists; truly permanent print destinations still require approved MESH/SIA linkbank mapping.
- Proposals are browser-local under the key humkin.signal-relay.proposals/v1. Export is required for backup. These local observations are not a signed/server-authenticated audit trail.

## Verification

Automated: node --test tests/signal-relay.test.mjs, and Node syntax checks for the modified manager, UI, model and Compost scripts. These run in the site pull-request workflow.

Manual tests after review/deployment:
1. Open Station Manager while signed out: Signal Relay must be hidden.
2. Sign in as owner: candidates must match approved, enabled songs; no show is created by reading them.
3. Open an exact-track share URL on a second device: no autoplay, exact approved audio and existing feedback form after user action.
4. Load a candidate into a paused show draft, then abandon it: the live station schedule must remain unchanged.
5. Optionally save one paused temporary show after deliberate review, verify its inactive state, then remove the temporary show.
6. Export a proposal note; verify no private paths, listener identifiers, unpublished rights data or false broadcast claim.
7. Test an unavailable track ID: it must not silently change identity.

**Baseline:** a least-played list plus ordinary manual show selection. Measure false positives, editor minutes, and observable real results rather than inferred audience size.
