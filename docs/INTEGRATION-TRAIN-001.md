# HUMKIN INTEGRATION TRAIN 001 — 2026-11-18
Status: **staging-only, draft PR; not production**. Constructed as a single content-composition commit on observed main `8cf3f343f40c273d73fbe59e81f78968d7f62854`. All source PRs remain distinct review sources, not silently merged or closed. No media bucket, billing, DNS, credentials, external messages or live radio configuration was changed.

## Track A — composed and under test

| Source PR | Included in this staging tree | Operational boundary |
| --- | --- | --- |
| [#151](https://github.com/the-static-collective/HUMKIN/pull/151) | /season/ preview; curated network receiver, docs | Does not retune public default player |
| [#154](https://github.com/the-static-collective/HUMKIN/pull/154) | /fm/autodisco/ on-demand experiment, /fmstudio/ discovery and synthetic V20 export | No live AI listening or auto publishing |
| [#155](https://github.com/the-static-collective/HUMKIN/pull/155) | Compost-to-owner Station Manager proposal, paused show draft and exact-track links | No programming changes on suggestions alone |
| [#156](https://github.com/the-static-collective/HUMKIN/pull/156) | Read-only exact-ID tracer CLI and evidence receipt | HLS proof remains conditional on actual live cue |
| [#138](https://github.com/the-static-collective/HUMKIN/pull/138) | Optional HOLD-only Daily Slice adapter CLI | Requires separate source rights/operator decision |

### Integration resolution

- The overlapping `.github/workflows/validate-site.yml` files were **combined**, rather than choosing one branch's version: Auto Disco core and snapshot tests, Season Two page tests, SIGNAL Relay tests and Tracer tests all run in one workflow, alongside the existing baseline tests and Daily Slice tests.
- **Current main reconciliation (2026-11-19):** preserve the newer FM Studio live frequency dial and station-registry routes from main `9cca272c83ad4c4c7a2d128ce18a2481b2711542`. Instead of restoring #154's older FM Studio page, add a clearly labeled on-demand Auto Disco link to the newer dial; its actual experiment code is unchanged. Retain #155's `fmstudio/compost.js` exact-track deep link.
- `fm/index.html` and network receiver styles come from #151, preserving the existing primary website and receiver route.
- All code and static files in the table were copied from their specified **source head trees**, rather than cherry-picking unrelated commits from entire historical branches. Their independent PR review history remains available.
- This staging commit has one parent (main) and does **not** claim that these source PR heads have been merged into production.

## Track B — held for a dedicated conflict-resolution wave

- [#145](https://github.com/the-static-collective/HUMKIN/pull/145): TOWER virtual-station network, feedback/vinyl council and Cloudflare Worker. Its station-manager HTML overlaps SIGNAL #155 and its Worker with HLS #133. Integration should resolve the owner-desk interface and worker routes together with targeted tests; do not overwrite either version wholesale.
- [#133](https://github.com/the-static-collective/HUMKIN/pull/133): R2 live HLS and Acer bridge. PR currently non-mergeable; dedicated bucket/credentials/Worker binding and physical field tests are outstanding. No deployment of streaming infrastructure via this train.
- [#95](https://github.com/the-static-collective/HUMKIN/pull/95): Blue Lemon broadcaster; shares playout/engine surfaces with #133. Choose the reliable live path based on field evidence first.

## Track C — independent experiment families

- [#135](https://github.com/the-static-collective/HUMKIN/pull/135): LIVING RELAY and real-world gift/consent surfaces; intentionally not co-deployed with the radio train before provenance and withdrawal review.
- [#56](https://github.com/the-static-collective/HUMKIN/pull/56) and [#120](https://github.com/the-static-collective/HUMKIN/pull/120): overlapping native Android code, with dependent branches #103, #108, #110 and #112. Preserve the stack, choose a single canonical Android baseline, and test on-device before unstacking.
- [#13](https://github.com/the-static-collective/HUMKIN/pull/13): Fellowship possibility experiment. Separate human/date validation.
- MOTIF, LOADOUT and SIA have many independent open proposals; this HUMKIN staging tree does not import unrelated source or alter their ownership contracts.

## Release gate — do not treat a draft PR as deployment

1. Require the combined GitHub Actions Validate HUMKIN site workflow to pass on **this integration SHA**, not just source PR heads.
2. Manually confirm Station One still plays with the intended live/Long Wave/Same-Time/Road Shuffle fallback behaviors on phone and desktop; source tests cannot verify remote Acer live service.
3. In owner Station Manager, verify Signal Relay remains hidden signed out, opens a **paused** draft after authenticated editorial choice, and never writes or activates a show without a deliberate save/enable.
4. Share an exact Compost track URL from a different device: human click should select that recording, never autoplay, never silently substitute unavailable media.
5. Exercise Auto Disco locally, validate aggregate feedback and the proposed V20 handoff on a synthetic example without claiming live model listening.
6. Verify Season Two is a preview link, not an unexpected switch of the public homepage/default station.
7. Before promotion, inspect codeowners, credentials, publication consent, migration/state compatibility and CI status again. Only merge a separately scoped PR when these gates are satisfied.

**Rollback:** With no default route changed and no automatic write endpoints added, rollback is to close the integration PR or revert its eventual merge. Production program decisions remain owner-controlled.

This document is a composition receipt, not a claim of physical broadcast or community benefit.

## Concurrent-main compatibility

The source PRs originally based on earlier main. The integration branch now carries a two-parent reconciliation commit with current main, including new FM Studio frequency discovery, station-registry implementation and tests, plus main's Worker HLS/registry dispatch. This is a code composition, not evidence that a secondary Acer frequency was heard live.
