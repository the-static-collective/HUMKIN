# TOWER 003 — Common Console

Extends the integration PR #213. Canonical entry /tower/ now opens the same-origin operating desk rather than sending the operator to Vercel. Legacy hosted Compost Tower and predecessor recovery/export remain linked under a disclosure. Do not retire those storage origins until actual backups are verified.

## Three adapters, distinct authority
- Acer local: tools/radio-broadcast/on_air.{html,js,py}, tower_library.py, existing loopback server and per-frequency programming JSON. Queue, immediate skip when ready, local metadata overlay, batch changes, curated lineup, saved programs. No remote loopback access. No credential or local path transfer.
- Web/mobile: /fm/manage/ and /fm/load/ share HUMKIN Auth and the approved catalog. Global approval/metadata differs from frequency-specific policy. Night Shift cloud request ledger only; Switchyard drafts for three registered targets. No secondary live commands without scoped server enforcement.
- Conversation: existing TOWER 012 OAuth MCP and control intent contract; same cloud request semantics, not local skip or direct publish. Deployment/owner connection must be verified independently.

Authority and source references: docs/ACER-TOWER.md, docs/TOWER-LIVING-CONTROL-010.md, docs/TOWER-DURABLE-ASSET-SPINE-011.md, docs/TOWER-MCP-OAUTH-012.md. Local weight deltas and cloud weight deltas do not share a scale; no automatic conversion. A held local track is not globally revoked.

## First implemented bridge
Desktop export private inventory from an existing connected local frequency. Snapshot contains stable IDs, display titles and local held/disabled/rotation/lineup/weight flags. No raw audio, filesystem paths, notes, queue slots, auth token or credentials. In web Manager > Infrastructure > Desktop reconciliation, import the JSON. Compare exact stable ID first, then exact source SHA for upload-<hash>. Distinguish ambiguous and not-in-loaded-catalog; never infer by title. Loaded web catalog is capped, so absence is not proof of absence globally. Results remain in page memory. No upload or mutation. Snapshot is not a live command, membership assignment or broadcast proof.

## Recovered research instruments
Selective PR #145 recovery: fm/tower/catalog.html and catalog-review modules (local metadata evidence/explicit tag review), fm/tower/feedback.html and pure Top 42 signal and vinyl council modules (public aggregates / optional private nomination snapshot). Preserve experimental review-only boundaries. Monthly-council endpoint not provisioned here; import a valid local snapshot instead. No old Worker replacement, virtual station enablement, or automated public tags. Counterpoint station contracts remain in PR #145 until their distinct virtual per-listener transmission model is reconciled with shared-clock cloud stations. See original PR for full evidence.

## Next
Run all recovered pure module tests and Common Console tests. Browser acceptance with real owner session, including local export/import from updated checkout. Back up Acer programming.json and never update running source files in place. Then add station membership and scoped command/receipt schemas, with explicit target/revision/idempotency and no automatic queue synchronization. No DNS, Auth, database, R2, Worker, or transmitter deployment performed. No claim of live desktop update.
