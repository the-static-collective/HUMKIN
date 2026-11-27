# TOWER — Unified Operating Desk 002

Integration branch based on #210 (Transmission Ledger / Dial / Switchyard), carrying the UI changes from #212 (Operating Desk). The canonical existing entry remains /fm/manage/ on humkin.abundent.org. No new hosting or auth origin required. A separate tower.abundent.org vanity address can be considered after same-origin acceptance; the observed DNS zone has no explicit tower record (wildcard exists). Do not move the Supabase auth origin or create a second catalog.

## Operator route map
| Department | Existing route / work area | Authority |
|---|---|---|
| Overview | /fm/manage/#desk-overview | Read-only catalog and schedule overview, links to frequency drafts and signals |
| Library / art | /fm/manage/#desk-library | Shared recording identity, metadata, global enabled state |
| Intake | /fm/load/#desk-intake | Local file/whole-folder selection and private staging |
| Approval | /fm/load/#desk-review | Explicit owner approval to global catalog, not cloud scheduling |
| Frequency builder | /fm/load/#feature-desk | Separate tab-local drafts for station-one, lo-fi, mutant; no publication |
| Legacy shows | /fm/manage/#programming | Existing Same-Time recurring schedule only |
| Live control | /fm/load/#living-control | Night Shift only; durable requests, not immediate skip |
| Automation | /fm/manage/#desk-automation | Existing legacy rotation/global editorial scope |
| Network signals | /fm/network/dial.html | Read-only Worker reports and local ledger summaries (#210) |
| Production | /fm/manage/#desk-production, /fm/studio/, /fm/living/ | Cart machine, private producer work, human review |
| Infrastructure | /fm/manage/#desk-infrastructure, /fm/load/#desk-storage, /fm/mesh/ | Media vault, transfer logs and distributed copies |
| Review | /fm/participate/review.html, /fm/line/manage/ | Existing contribution and line inboxes, separate approval |
| Listener surfaces | /fm/, /fm/network/, /fm/archive/, /fm/top42/, /fm/signal/, /fm/orchard/, /fm/line/, /fm/participate/, /fm/schedule/ | Listener experiences, not separate privileged managers |

This is a source-derived map, not an exhaustive crawl or a claim of live availability for every route. The current switchyard/dial is still on a review branch. Keep public listening URLs and old operator deep links intact.

## Operating contract
- Same-origin, two workspaces, shared navigation. Do not iframe privileged editors or duplicate their authentication. Switching within a workspace preserves existing DOM, file selection, and unsaved station draft state. Leaving Loader triggers a browser beforeunload guard when a selection, transfer, or nonempty feature draft exists; browsers may suppress prompts. Local drafts still do not survive a full reload. Export before departure.
- Frequency cards choose a validated station in Feature Desk via URL query; a query is never authority to issue commands. Night Shift live-control calls are unmodified; secondary controls remain unavailable. Global catalog visibility is explicitly labeled.
- One source identity, many frequency memberships. Next implement a station-membership overlay and scoped command/receipt bus; no additional station-wide mutation endpoint until isolation is enforced server-side and tested. No automatic publication from this change.
- Keep #211 Archive Janitor independent; maintenance runs separately, never changes editorial scope. No DNS, R2, Worker, database, or live program mutation during this integration.
- This branch includes #210's experimental publisher changes. Do not merge or deploy until its tests, browser/phone acceptance and operator review pass. The merge would include both predecessor branches' content; avoid merging overlapping manager/loader versions separately.

Verification: direct control-ID inventory and simulated workspace routing passed, including legacy art and feature anchors. Browser QA, CI and actual station-specific publication tests remain pending.
