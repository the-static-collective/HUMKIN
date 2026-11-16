# HUMKIN ORCHARD 001 — playable room, collection, and local workbench

**Status:** implemented on the branch for review; online trading, independent computer jobs and a shared orchard are **NOT LIVE**. Nothing is represented as a commercial or transferable crypto token.

## What works in this slice

- Independent installable browser listening-world at /fm/orchard/. Existing /fm/ Same-Time Radio and Road Shuffle remain independent and unchanged.
- Orchard player plays real HUMKIN tracks from the current /fm/rotation.json (no invented files). No autoplay; tracks run in a repeat-free weighted deck with release/song spotlight eligibility. Orchard uses a local shuffle; the actual same-time schedule and prerecorded bumpers are on /fm/.
- Real audio timeline advancement earns device-local HUM and XP on either the orchard player or the existing /fm/ player (via an optional bridge). A timer on a blank page earns nothing; jumps greater than five seconds or seeking do not count.
- Starting balance 42 HUM; 1 HUM per 18 seconds of qualified playback; 1 XP per 4 seconds. No money is accepted; no server scoreboard points are minted from this.
- A 30-object shop; eight collectible discoveries (after 4 minutes, then approximately every 12 minutes); one local workbench reward. Collections and scene placements persist in browser localStorage.
- Level and elapsed-time-based orchard art changes. Quiet/offline growth changes scenery but does **not** award currency.
- Four room slots and four garden slots. Placing or stowing never deletes a collectible.
- Level 4 unlocks a tiny **voluntary local catalog-check**: fetch the published radio metadata (not the MP3s), validate IDs and same-origin paths, and compute a SHA-256 fingerprint. No arbitrary tasks or background mining. The current code respects Data Saver and battery <25% if a Battery API is available, and requires an explicit click.
- Local work receipt includes a task identifier, day, track count and SHA-256 value. Max one *local* reward per UTC day, +28 HUM/+72 XP and a local-only spool. It **does not** certify network verification, external authenticity, or global ownership.
- Read-only shareable orchard URL, plus local JSON backup and explicit restore. A snapshot is not proof of possession, an account, or a trade.
- Responsive mobile interface, reduced-motion support, navigation from /fm/ and /fm/top42/, offline shell entries.

## Engineering boundaries / threats

1. **LOCAL ≠ TRUSTED.** LocalStorage is editable. User-visible points and serials must never be imported as canonical server balances. The game makes no cash-value or global scarcity claim.
2. **LISTENING ≠ STREAM FARMING.** Only actual local media timeline advancement yields local game rewards. The existing Top 42 scoring and its duplicate limits are independent. No orchard events are submitted to the Top 42 API.
3. **HASH ≠ ATTESTATION.** Hashing the catalog on the client proves that code ran locally only to that client. A future task issuer must sign an immutable expected work manifest, verify bounded outputs on the server and issue its own receipt. Client screenshots / locally editable JSON cannot earn shared items.
4. **PROCESSOR ≠ AUTHORITY.** A volunteer device is only a bounded executor, not a station administrator. GHoT's offer/assignment/execution/receipt distinctions survive this integration.
5. **POWER STATE ≠ PERMISSION.** Each voluntary task requires explicit consent even if the device is charging; power-saving or low battery may HOLD work. Never assume the Battery API exists on mobile.
6. **COLLECTION ≠ MARKET.** No crypto, fiat redemption, speculative sale, guaranteed scarcity or trustless trading is introduced.

## Peer/GHoT work plan — follow-on, not implemented

### Work offer

A willing listener may offer *specific allowlisted* capabilities, limited by time, bytes, energy, network and per-device daily quotas. No remote arbitrary shell, unrestricted code execution, listener tracking or private files.

Example future offer contract:

    {
      "schema": "humkin.orchard.work-offer/v1",
      "capability": "radio.catalog.audit.v1",
      "max_input_bytes": 100000,
      "max_runtime_ms": 10000,
      "needs_network": true,
      "battery_floor": 0.25,
      "allowed_source": "https://humkin.abundent.org/fm/rotation.json"
    }

This is a design example; a browser cannot run a native GHoT Python worker or guarantee background service. Android WorkManager/foreground-service limitations and user opt-in must be handled in the actual Android client. A plugged-in desktop GHoT node is the preferred early peer.

### Work lifecycle

    VOLUNTEER EXPLICITLY OPTS IN
      -> POWER / DATA / USER PREFERENCE CHECK
      -> VALIDATED ALLOWLISTED OFFER
      -> TRUSTED TASK AUTHORITY SIGNS IMMUTABLE INPUT + NONCE + EXPIRY
      -> DEVICE ACCEPTS LEASE, BOUNDED EXECUTION
      -> DEVICE RETURNS RESULT + CONTENT HASH
      -> SERVER INDEPENDENTLY VALIDATES
      -> REPLAY-SAFE RECEIPT + REWARD
      -> CANONICAL COLLECTIBLE EVENT

Use signed GHoT/reLATTE crossing and execution receipts where compatible with the current implementation. Never claim completion when a task was merely offered or leased. No cross-site secret keys in client JavaScript. Publish node identity only with informed permission.

### Real account-backed trading

Before allowing any user-to-user transfers, implement:
- anonymous or full Supabase Auth identity and a separate optional public display name; portable recovery and deletion rights;
- server-created IDs and immutable issuance history for artifacts, with clear scarcity policy and conflict-safe mint operations;
- trade proposals with sender, recipient, specific artifact IDs, expiry and consent from both sides;
- one atomic database transaction to ensure owner-at-commit is sender, no outstanding locks, and transfer is exactly once;
- trade cancellation/expiry, no buyer payments, auditable lineage, anti-spam and block options;
- server-signed reward receipts for *verified work* only, not imported local progress;
- migration preview where users may choose to start a new canonical inventory rather than quietly elevate self-reported local contents.

Suggested schema (not deployed): listeners(id, created_at), artifacts(id, kind, origin_receipt_id, issued_at), artifact_ownership(artifact_id PK, owner_id, version), trades(id, proposer_id, recipient_id, status, expires_at), trade_items(trade_id, artifact_id), work_offers(id, capability, limits), work_assignments(id, nonce, owner, status), work_receipts(id, assignment_id UNIQUE, output_digest, verification_status).

**Do not directly use the existing publicly callable Top 42 edge function as an authority for HUM, work rewards, or ownership.** It was designed for provisional listen scoring, not fungible currency issuance or trades.

## Native app path

The orchard is inside the existing /fm/ PWA scope and has its own installable manifest. On Android browsers that support PWA installation, it can be added to the home screen as an app-like view. It does **not** modify or repackage previously generated native APKs, and is not yet a Play Store binary. Add the /fm/orchard/ route as a feature tab in the native app when that app's source project is available. Avoid loading two separate players simultaneously in native WebViews.

## Tests and go-live

Run:

    node --test tests/orchard.test.cjs
    node --test tests/top42.test.cjs
    node --test tests/radio.test.mjs

Then verify in a real Android browser:
1. Open Orchard, buy a lamp (42 -> 24), place and stow it, refresh; confirm persistence.
2. Play real audio for 18 seconds and see HUM increase. Seek ahead: no reward for the jump. Pause: no rewards. Refresh and check totals.
3. Return to /fm/ and play a track; confirm Orchard stats reflect progress without changing the Top 42 rules.
4. Reach level 4; run manual catalog audit, inspect hash receipt and spool. Try again the same UTC day: no new reward.
5. Verify /fm/ Same-Time mode, shuffle, art, bumpers and Top 42 unaffected.
6. Test compact Android viewport, PWA installation, reduced-motion, backup restore, visit sharing, and offline site shell.

No production/Android device verification is claimed until those steps are actually performed.
