# ESCALATION 002 — THE DIAL

Operator preview: `fm/network/dial.html`. This is an additive page, not a replacement for Radio House, main FM, Night Shift, or the Android app.

## Operator flow

1. Check signals. The browser queries fixed public Worker endpoints for three registered stations. A Worker status is not a media-byte or listening receipt.
2. Select an on-air frequency and explicitly tune. Switching disconnects only this page's receiver. No autoplay, automatic fallback, or mutation of a station.
3. Import a local JSON summary from the transmission-ledger CLI. Stale observations are marked stale even if the original export said healthy; the historical sampled span is not continuous verified uptime.
4. Import one to three local Cloud Autopilot program exports to count unique encoded assets and cross-station references across their revisions. This is not a live R2 census or a storage invoice.
5. Import a local source crate and export a retargeted draft for lo-fi or mutant. The draft preserves the exact source records and order; it does not validate media rights, authorize publication, or modify station-one. Review it with the existing credential-holding publisher. Do not import credentials or secrets into the browser.

The page uses the same external hls.js CDN dependency pattern as the existing receiver. Browser file imports are not sent by the dial code, but this is not an isolated security boundary against third-party scripts. Use only non-secret program exports.

## Activation gates

- Public checks on November 27: station-one on_air=true, r-20261121220749-528c745856, reported age 12 seconds; lo-fi and mutant returned HTTP 503. Their exact 503 reason was not retrieved.
- Choose a real Lo-Fi crate, independently review source eligibility and order, preview with existing Autopilot publisher, explicitly publish only the lo-fi pointer with existing credentials, then verify real media bytes and two receivers through a transition. No automatic publication.
- Measure Worker/R2 usage before increasing monitoring cadence. Enable recurring monitoring only after selecting an appropriate host and durable ledger storage.
- The existing read-only CI workflow includes both the ledger and dial unit tests. No live deploy or publication is triggered by this change. Manual browser playback and successful CI are still required.

Rollback: leave this additive page unused; stop monitoring if activated. No playout changes have been made.
