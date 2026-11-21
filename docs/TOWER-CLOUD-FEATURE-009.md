# TOWER 009 — one-time feature from the phone's Crate

**Status:** source-ready after tests and merge, not a change to live Cloud HOUSE.

The owner can use the existing Crate Loader at `https://humkin.abundent.org/fm/load/` to stage, approve and order recordings. The **Feature Desk** already saves PAUSED recurring shows to the existing Station Manager. It now offers a **separate one-time Cloud HOUSE export**:

1. Sign in as HUMKIN owner. Upload songs, interviews and bumpers normally, and **approve exact recordings** first. A long interview may be explicitly included in a show even though it must not enter the incidental bumper lottery.
2. Under **Feature Desk**, add already approved recordings and arrange their exact order. Repeat a recording by adding it twice if that is the intended programming.
3. Provide a name and a one-time **date plus quarter-hour Central time**. Select **EXPORT ONE-TIME CLOUD FEATURE**.
4. A JSON packet downloads containing only published R2 media identities and metadata, the exact ordered positions, Central slot and SHA-256 owner-review fingerprint. This matches the previously implemented `humkin.tower.cloud-handoff/v1` schema. It is a **proposal**, not a broadcast instruction; the on-air Cloud HOUSE pointer remains unchanged.
5. The existing credential-held `tools/radio-broadcast/autopilot_publisher.py --tower-program <reviewed-packet.json>` can preview and source-pin the handoff using the Tower schedule bridge. A later explicit `--publish` with authorized R2 access schedules the show at the next safe previous-program boundary after its requested slot, then returns to the original HOUSE program. **Do not skip independent approval, source and rights verification.**

## Authority and future service design

There are two completely separate release controls:
- Crate catalog publication (a verified `humkin_radio_tracks` item becomes eligible for program selection).
- Owner-reviewed Cloud Autopilot publication (a specific program revision and actual R2 TS segments are committed). Exporting a JSON handoff crosses neither boundary on its own.

Only canonical enabled/published **public** R2 rows may appear in the exported file. The feature is capped at eight hours by source metadata, uses only ID/expected source hash/allowed URL for audio, and never includes private R2 staging objects, Supabase access tokens, service-role credentials, or local phone paths.

A packet can become stale when an asset or its permissions change. **The final publisher must recheck current approval and source bytes before publication**; the existing Tower generic handoff code validates the allowlisted URL/expected source SHA and requires an owner-controlled publish action, while the current FULL HOUSE draft has stronger catalog-based eligibility rechecks. Until equivalent live-catalog revocation rechecks are established for ordered Cloud handoffs, do not enable automatic publication of these exported packets.

## Still to build

The **one-button Cloud Feature booking** directly from the phone requires an authenticated owner-only proposal queue and a server-held publisher that verifies its live permissions and records independent approval. Secretary accounts must be station-scoped contributors, without access to owner tokens or Cloud HOUSE publication. This work must precede actual delegated scheduling.

## Tests

`node --test tests/tower-cloud-feature-handoff.test.mjs` builds a feature containing a long interview and an intentional repeat and invokes the existing Python Tower validator to check exact fingerprint and schema compatibility. It also rejects private/unpublished assets, forged R2 keys, bad hashes, malformed dates/times, and overlong shows. The standard Crate/site/Proton/R2 CI remains in place.
