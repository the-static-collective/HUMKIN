# HUMKIN ESCALATION 001 — Transmission Ledger

## Witness, November 27, 2026

Operator reported 09:33:00 of audible Night Shift playback before a browser reload, followed by resumed/ongoing listening. At 09:38 UTC a separate public HTTP check returned on_air=true, revision r-20261121220749-528c745856, sequence 68907 and A Few Breaths. That check read status, now-playing and manifest, not segment bytes. Neither observation establishes uninterrupted server uptime since November 21.

## Independent robot listeners

The ledger wraps the existing night-shift-aircheck.mjs probe (status, manifest, now-playing, one real MPEG-TS media object). It appends one JSONL receipt per station even on probe failure. It never writes R2, changes schedules, deploys Workers or touches live listeners.

On Node 22+ from the repository root:

```sh
node tools/radio-broadcast/cloudflare/transmission-ledger.mjs --ledger ./private-data/humkin-airchecks.jsonl
node tools/radio-broadcast/cloudflare/transmission-ledger.mjs --ledger ./private-data/humkin-airchecks.jsonl --summary-only
node --test tools/radio-broadcast/cloudflare/transmission-ledger.test.mjs
```

Run the first command with a single external scheduler every 60 seconds if desired (no scheduler is activated by this PR). Keep the ledger outside the repository or explicitly git-ignore it; use one writer per file. Back up/rotate independently; do not remove historical evidence. A missing observation is unknown, not a successful probe. A stall, regression, failed probe or gap exceeding 180 seconds breaks the sampled span. A stale last sample is never current health. Sampled span is not continuous uptime, receiver audio or Acer-off proof.

## Station registry and activation gates

- station-one / Night Shift: default probe target, production reference unchanged.
- lo-fi / Lo-Fi Study: reserved ID, not enabled or published.
- mutant / Mutant Radio: reserved ID, not enabled or published.

Existing Worker already routes by station ID and uses separate autopilot/programs/<station>.json pointers with immutable media stored at autopilot/segments/<digest>/segment-NNNNNN.ts. Each station's validated program authorizes its own media. Reuse identical encoded assets, never bypass the existing per-program approval check. No new Worker deployment needed merely to add a valid program, subject to deployed route verification.

Publish Lo-Fi only after owner-selected catalog and boundary review, then sample explicitly with --stations station-one,lo-fi. Mutant remains held. Confirm distinct revision and clock, actual segment bytes and an audible transition on two receivers, then expose station navigation in Tower. Tower integration should consume the ledger summary, not reset a clock on browser refresh. Public robot ticker must use sanitized observations and distinguish robots from human listeners.

## Cost and limits

One probe requests four Worker URLs, with internal R2 reads/heads in the Worker. At one probe/minute that is nominally 5,760 Worker requests/day/station, excluding retries and other listeners. This is an estimate, not observed Cloudflare usage. Start with one station and review actual Workers requests/errors, R2 operations and limits in the Cloudflare dashboard before enabling more probes. The current branch does not configure recurring probes, publish Lo-Fi, modify the Tower UI or retrieve private Cloudflare metrics.

Rollback: stop the external probe and retain its JSONL receipts. No live playout rollback is needed for this isolated tool.
