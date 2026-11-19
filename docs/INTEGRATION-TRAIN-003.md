# INTEGRATION TRAIN 003 — Living Relay × HLS Lab × V20 Carrier

**Status:** staged, draft, source-pinned integration for human bug testing; NOT merged/deployed to HUMKIN public production.

**Base:** V20 radio carrier [#160](https://github.com/the-static-collective/HUMKIN/pull/160), at `c443310884fe3ff20eb0e09da8d5161f81af389c`. That branch is already stacked on [Train 002 #159](https://github.com/the-static-collective/HUMKIN/pull/159), which is stacked on [Train 001 #158](https://github.com/the-static-collective/HUMKIN/pull/158). Train 001 includes source PRs #151, #154, #155, #156 and #138; Train 002 overlays #145.

## Integrated source contributions

| Original PR | Admitted into bug-test branch | What remains outside |
| --- | --- | --- |
| [#160](https://github.com/the-static-collective/HUMKIN/pull/160) | V20's owner-approved independent frequency, separate Accident Lab tile, receiver and tests | No real V20 master automatically published |
| [#135](https://github.com/the-static-collective/HUMKIN/pull/135) | Entire local Living Relay 001+002 prototype and source CI workflow | No participant identity service, public contribution upload, automatic use permission or third-party recording rights |
| [#133](https://github.com/the-static-collective/HUMKIN/pull/133) | Its isolated HLS test receiver page at `/fm/long-wave/hls.html`, and dedicated receiver fallback tests | **Do not rewind the current HLS engine/Worker/Acer scripts.** Most underlying HLS code was already incorporated or superseded in main and Train 002. The old #133 worker and encoder are not blindly remerged |
| [#154](https://github.com/the-static-collective/HUMKIN/pull/154) | Updated late commits to Auto Disco on-demand experiment page and documentation | No blind V20 first listen occurred automatically |

### HLS compatibility rationale

The current `main` already has active `tools/radio-broadcast/cloudflare/hls-routes.mjs`, a multi-frequency station registry, server routing, HLS push/encoder/launcher code and offline tests. The original [#133](https://github.com/the-static-collective/HUMKIN/pull/133) is based on older versions of almost all those paths. Source-copying them would overwrite recent bug fixes and station-registry / TOWER integration. In the previous stacked train, such a Worker overwrite caused an actual 503-versus-404 routing regression and missing module; the resolved routes now pass the integrated suite.

The unique test receiver and corresponding tests are now *additive*. For local use, `/fm/long-wave/hls.html` provides a separate manual HLS endpoint field, no autoplay, optional failover to Long Wave, source freshness checks and recovery controls. It is **not** a new live public station or a verified Acer connection.

### Permission and effect boundaries

- Living Relay holds each offered human gift by default; receive, welcome, review and approve a specific use are separate decisions. Import/review history never makes media automatically reusable.
- A voluntary musical influence, a radio consideration and a physical-world gift confirmation require their own independent evidence. A synthetic field fixture is not real charity or proof of delivery.
- V20 broadcaster reads only owner-approved published R2 songs with exact source credits and album matching. No secretly emitted AI DJ material.
- SIGNAL proposals never activate programming; Vinyl Council is a selection proposal, not pressing permission.
- No new provider credentials, Cloudflare bindings, R2 bucket, server migration, public DNS, donation transaction, video rendering or external message is produced by these code commits.

## Bug test order after staging CI

1. **Basic listening regression:** Original HUMKIN Station One live button, correct titles/artwork, Long Wave then Same-Time fallback, Road Shuffle and Compost. Test desktop and phone. Verify no autoplay.
2. **The dial:** The FM Studio page should separate Auto Disco V20 (real station, only if approved program exists), Accident Lab (on-demand experimental listening) and other frequencies. Offline and unprogrammed channels must not be labeled on air.
3. **SIGNAL to Tower:** From a published Compost recording, open the exact-track link. Check the play/rating form; in signed-in Station Manager load the song into a **paused** show draft. Verify nothing enters rotation before deliberate SAVE/ENABLE.
4. **HLS lab:** Open local/preview `/fm/long-wave/hls.html`, provide a *controlled, actual* deployed HLS Worker URL, deliberately start a test stream, hear at least three segment transitions, stop Acer and check optional Long Wave rescue. Source freshness must report offline if publishing stops. Field confirmation requires Acer, provider permissions and a real second device; fixtures aren't substitutes.
5. **Living Relay:** Open `/living-relic.html?id=field-001` on desktop and phone. Test receive → held → specific scoped opt-in → withdrawal → export → import, and check import **resets all permissions**. Attempt unauthorized media and mismatched hashes. Voice notes should remain on-device unless explicitly exported.
6. **V20 source clearance:** Confirm the carrier cannot start without the approved V20 artist+album catalog; owner review of an actual master and rights occurs before any public release.
7. **Receipts:** Separate code/test results from real-world human confirmations. Report errors by exact path, track ID (public only), reproduction steps, device/browser, and expected/actual behavior. Do not upload private participant files or credentials.

## Automated acceptance

- Existing Train 001/002 suites and V20-specific source CI.
- `node --test tests/living-relay.test.mjs tests/living-relay-contributions.test.mjs`.
- `node --test tests/hls-receiver.test.mjs`.
- Living Relay module syntax checks plus existing site, station registry, worker, R2, HLS and radio tests.
- Source `.github/workflows/living-relay.yml` is included as an independent permission-gate regression job.

This staging tree is the **bug-test candidate**, not a promise that every original unmerged experiment is production-ready. The Android/Orchard stack, Blue Lemon playout, cross-repo MOTIF experiments, producer live uploads, and unreviewed service hooks remain separate until the field-tested radio train is accepted.

**Release discipline:** Preserve all source PRs and this stacked PR as drafts. Do not merge to `main`, deploy, or enable new listeners' production features solely because CI passes. A separate real-user acceptance/merge decision follows the user's bug test.
