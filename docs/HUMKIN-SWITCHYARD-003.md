# ESCALATION 003 — THE SWITCHYARD (Dr.MADDcl0wn mutation)

Hypothesis: shared media with isolated editorial lineups is a better operator model than separate crates or a global station queue.

Parents: the local Acer Tower already has per-frequency queues and overlays (docs/ACER-TOWER.md); the browser Feature Desk already builds ordered source-verified cloud handoffs; Cloud Autopilot already isolates program pointers by station and shares content-addressed media; Dial/Transmission Ledger provide separate observation.

Implemented on review branch:
- Existing Crate Loader Feature Desk selects Night Shift, Lo-Fi Study or Mutant Radio. Switching retains independent unsaved drafts during this tab, including time and order. Explicit copy clones a draft, never an active queue; replacing a populated draft asks first.
- Cloud feature exports include target station in both the packet and protected fingerprint. Legacy paused Same-Time save is disabled for secondary stations. Existing live-control request feed remains Night Shift-only; global archive controls are not station eligibility controls.
- Station Manager links to the multistation editor and labels legacy/global scope.
- Secondary HOUSE seed export rechecks owner-visible eligible R2 rows using existing auth. It produces a fingerprinted draft; the CLI --seed-house path rechecks current public catalog and pins actual source bytes during preview, refuses a preexisting program, and uses existing immutable media publisher. No browser credentials or R2 writes. A single credential-holding operator must serialize seed publication; the current R2 publisher is not a distributed CAS lock.

Preview from repo root: python tools/radio-broadcast/autopilot_publisher.py --seed-house HUMKIN-lo-fi-house-crate.json
After reviewing exact lineup and preview, the existing owner can explicitly add --publish with their established R2 credentials; this is not activated by this PR. Same local AAC cache required between steps. The public catalog lookup is capped at 500 rows; a missing row blocks publication rather than inferring eligibility. No automatic genre classification. No publication attempted.

Control: ordinary separate station editors. Compare time and mistakes assembling one 12-track lineup then adapting it to another frequency. Success: preserve original order, copied order independently editable, shared IDs not duplicated in storage, wrong-station export rejected; measure operator time against separate editor baseline. Failure: any cross-station command or overwrite, stale source acceptance, or missing draft due to switch. Drafts are tab-local and are lost on reload; export reviewed packets before closing.

Next mutation candidates (unimplemented): track-by-frequency membership matrix with inherit/allow/hold, station-scoped command bus with idempotency and per-station receipts, shadow programming simulator with diversity and collision checks, syndication of reviewed shows as independent copies, automatic least-heard recommendations separated from global archive holds. Existing TOWER MCP and durable asset spine are the natural seams. Do not add station parameters to the existing unscoped command write endpoint until its database, consumer and receipt schema all enforce isolation.

Tests: added station fingerprint/seed validation and UI-scope tests to existing tower-cloud-feature-handoff.test.mjs. Execution and mobile browser smoke test pending. No schema migration, production deployment or live program change.
