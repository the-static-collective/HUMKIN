# HUMKIN FIELD WITNESS 001 — the outside listener

## Why this exists

The existing read-only [Night Shift public aircheck](../tools/radio-broadcast/cloudflare/night-shift-aircheck.mjs) verifies HTTP status, manifests, TS segments, and clock advance from a GitHub-hosted runner. **It cannot prove that a human phone heard audio**, or that the Acer was off. Conversely, a human's testimony cannot establish the worker's internal state. Keep both receipts separate and compare them.

## Operator steps

1. Open [Night Shift](https://humkin.abundent.org/fm/night-shift/) after this PR is deployed. On the phone, tap **START FIELD CHECK**, then **TUNE IN**.
2. When sound is genuinely audible, tap **I HEAR AUDIO**. The native browser audio element separately records playing/waiting/stalled/error/pause events.
3. Only when the Acer is physically off, tap **ACER IS OFF**. On hearing a genuine song boundary or interruption, mark the corresponding button. The published title is a label, not proof of what the phone heard.
4. Select **SAVE JSON RECEIPT**. Keep the file private unless you explicitly choose to share it. No network upload, credential, microphone, or audio recording is involved.
5. If available, independently run [public aircheck](https://github.com/the-static-collective/HUMKIN/actions/workflows/night-shift-aircheck.yml) for 300 seconds while the Acer stays off; compare the timestamps and station revision with the field receipt.

A single phone receipt is **unverified human testimony**, not cryptographic proof of power state, decoded audio, or a multi-phone shared clock. Two independently obtained phone receipts plus a separate public aircheck narrow those gaps but do not automatically establish all reliability claims.

## Boundaries

- Existing audio element and core night-shift.js remain unchanged. The optional module listens for media events and records manual field actions **only after opt-in**.
- Receipts live only in browser memory until the owner requests a local download. Reloading loses the unsaved record.
- Local button presses are never broadcast publishing authority, MEMENTO admission, native MOTIF results, or authentication of the witness.
- Repeated media events are bounded to 200 with a dropped count; there is no IP, geolocation, user-agent or personal identifier.
- Preserve the separate status stages: SOURCE, HTTP MEDIA, LISTENER SELF-REPORT, INDEPENDENT FIELD CORROBORATION (not yet implemented), PUBLISH AUTHORITY.

## Next test

Two phones on independent networks, no Acer running, listen across at least one genuine track boundary. Capture each field receipt and one separate GitHub Actions receipt at overlapping times. Use a counterexample (one phone reconnects or stalls) to verify the records preserve disagreement rather than falsely reporting success.

Status: SOURCE PROPOSED IN REVIEW; LOCAL UNIT TESTS PASS; LIVE PHONE TEST NOT RUN.
