# TOWER 010 — Living Control (source-controlled, owner-gated)

**Purpose:** Bring the already existing Acer Tower queue/hold/release/weight controls to a phone-usable Crate front door, while retaining the production Cloud HOUSE authority boundary. The desktop tower's original local commands still work on its own local playout; the *new web desk*, accessible on phone or desktop, issues shared cloud scheduling requests.

## Operator workflow

Open `https://humkin.abundent.org/fm/load/#living-control` after GitHub Pages deploys this code. Sign in with the existing HUMKIN owner session. Select an already **published, enabled, verified public R2** recording, then:

- `QUEUE NEXT` — put that recording at the opening of the next cloud revision. No interruption of current audio; GitHub's periodic job, encoder availability and a safe song boundary add latency. The queued track becomes the first recording when the new revision takes effect.
- `QUEUE AT END` — place one explicit occurrence at the end of the next cloud cycle.
- `MORE / LESS` — adjust a song's *additional* live-rotation delta from -2 to +2, with an effective 1–5 occurrences per cycle. The existing 1× ordinary, 2× official single/release and 3× total seasonal source policy is always computed first; the manual delta is then applied.
- `HOLD / RELEASE` — remove or restore a published recording from future incidental rotation. Does not suppress already playing audio.
- `SAVE TRACK INFORMATION` — edit title/artist/album in the source RLS-protected catalog; no audio bytes are changed or re-encoded. A separate `metadata_refresh` intent requests a sooner cloud revision. The existing Station Manager retains advanced notes, tags and artwork controls.

The app shows the last 12 owner-issued requests. **REQUESTED** means the immutable Supabase entry exists; **ACCEPTED** means a Cloud HOUSE program revision carries the cursor; **EFFECTIVE CLOUD SCHEDULE** means the revision is now active with an available HLS media window. Neither accepted nor effective proves a specific device played the entire cue.

## Authentication, persistence and idempotency

- Production Supabase migration `humkin_tower_control_intents_010` adds `humkin_tower_control_intents` with a server-generated, monotonically increasing `id`, foreign-key track ID, action and server timestamp. Follow-up migration `humkin_tower_control_metadata_refresh_010` allows metadata refresh intents. Both migrations were applied without inserting any commands. Migration SQL is preserved under `docs/sql/TOWER-010-*.sql`.
- `INSERT` is *column-scoped*, owner-only via `auth.uid()`, signed Supabase JWT email claim and current approved R2 row. No client `UPDATE` or `DELETE` grants. Public `SELECT` is restricted to **id, track UUID, action, requested_at**—never owner_id or access tokens. No arbitrary media URLs, edited ownership, publisher secrets or privileged receipts may be submitted.
- `tower_living_control.py` reads this strictly bounded public-safe feed. Its cursor/hold/weight checkpoint lives inside the *previous committed R2 Cloud HOUSE revision*, not localStorage. A repeated owner click creates a new explicit request, but a repeated runner cannot apply the same numbered command twice.
- The cloud publisher recalculates **future programming only**. It always validates the canonical approved R2 source list first, checks queued track eligibility, preserves release/single/seasonal tiers and rebuilds incidental bumpers through the existing Bumper Brain. It refuses illegal weight deltas, revoked recordings, malformed/out-of-order commands, more than 50 pending requests per job, fewer than two remaining songs, more than 500 program positions, more than 10,000 HLS segments or more than 32 revisions.
- Existing Cloud HOUSE `cloud_house_sync.py` uses its SHA-addressed AAC segment reuse, FFmpeg only for previously unseen source hashes, and R2 upload-media-first / optimistic schedule-pointer-last publication. If a hold arrives while audio is being prepared, the second ledger read fails closed and the next job can retry.

## Activation (not performed by a merge)

The mobile desk can store **REQUESTED** commands in Supabase after a successful GitHub Pages deploy, but cloud application is separately disabled. This keeps the existing radio stable.

1. Complete a real owner-only test of the published Cloud HOUSE schedule, media R2 bucket credentials and playback on a phone.
2. Deploy the updated `cloud-autopilot.mjs` Worker through the existing Cloudflare release process. The Worker verifies revision `control` metadata and reports the effective and pending cursor from its **public schedule**, never from an owner-supplied browser claim.
3. Set repository Actions variable `HUMKIN_CLOUD_LIVING_CONTROL=ENABLED` only after these tests. The new `tower-living-control.yml` workflow checks for pending requests about every five minutes; this schedule is best-effort and can run late. It uses a lightweight no-credential check before installing FFmpeg/boto3, and shares the publication concurrency lock with the existing incremental and owner-reviewed HOUSE workflows. A manual owner dispatch is available, subject to the same opt-in and guard.
4. If also using regular catalog auto-import, `HUMKIN_CLOUD_AUTOPUBLISH` remains a **separate**, optional setting. Do not enable either to bypass owner approval.

**Costs:** GitHub's five-minute polling still consumes an Actions runner for the lightweight preflight, even if there is no pending request. Monitor quota/cost and lower cadence if necessary. No Vercel dependency.

## Important remaining limitations

1. **Finite cloud revision history.** The current Worker allows 32 schedule revisions and 500 entries/10,000 segments. TOWER 010 explicitly HOLDS at those ceilings. It needs continuity-safe compacting/rolling-planner changes before arbitrary round-the-clock manual editing is reliable.
2. **Not sub-minute control.** Polling and publication boundaries introduce delay. An eventual direct authenticated, audited command-admission path to the Cloudflare scheduler would be lower-latency without a GitHub runner per request.
3. **Native Acer state is not silently merged.** Desktop Tower has its own local queue and richer metadata fields; browser TOWER can be opened on Acer and phone and shares cloud control requests, but legacy local queue state is not mirrored until an authenticated two-way desktop adapter exists.
4. **A scheduled feature is not a queue command.** One-time guest Cloud HOUSE shows still require the separate owner-reviewed TOWER handoff path. A pending guest/return revision makes live control fail closed instead of cutting into it.
5. **Owner-only.** No delegated secretary role or blanket producer permissions. A contribution or proposed program never authorizes on-air publication.
6. **No production activation / receiver proof in CI.** Tests cover pure scheduling logic, the browser request contract and Python R2 revision receipt, but only a real production aircheck can confirm a live broadcast transition.

## Verification

- `python3 tests/tower-living-control.test.py`: source review; exact queue precedence; release tiers plus weight; hold/release; idempotent cursor; malformed/revoked entries; published pointer receipt only.
- `node --test tests/tower-living-control.test.mjs`: trustworthy requested/accepted/effective UI labels, owner login, no browser tokens, Actions opt-in and shared concurrency.
- Existing `tests/cloud-house-delta.test.py`, `tests/cloud-house-rotation.test.py`, Cloud Autopilot Worker tests, Site, TOWER and Station One CI.
- Production Supabase inspect: column privileges (public cannot read `owner_id`), RLS policies and empty intent ledger. No requests were submitted during schema setup.

**Next slice:** continuity-safe revision compaction and control ACK tests on an actual Cloudflare receiver, then the desktop ↔ cloud adapter and delegated producer roles.
