# Auto Disco V20 × HUMKIN — Accident Frequency 001

**Status:** playable proposed browser station and editorial handoff. Not an always-on server stream, automatic AI-DJ, model-generated listening receipt, or published deployment.

Entry after merge/deploy: `/fm/autodisco/`. It is also surfaced as a distinct choice on the `/fmstudio/` dial.

## Architecture

1. Request the published, enabled catalog and existing approximate play counts from the HUMKIN Compost Heap public Edge Function. This reuses its rights/approval gating; it never lists R2 buckets.
2. Assemble six playable non-bumper recordings using fewest reported plays first. Artist/album diversity breaks ties, without claiming to infer audio style or musical genre. Missing score row is displayed as missing, not verified zero.
3. Listener clicks **Tune to Auto Disco**. Browser begins an on-demand program with actual recorded sound, artwork, accurate known catalog metadata, skip and optional feedback. Qualified listens and 1–5-star/reaction ratings return to the current Compost API and existing safeguards.
4. Export the currently selected program as a local, unsigned `humkin.accident.autodisco-handoff/v1` JSON manifest. This is an **editorial proposal**, not an audio digest, model prompt or signed receipt.
5. A V20 operator independently retrieves each authorized audio source, verifies exact bytes, creates a 45-second-or-shorter canonical AUDIO WINDOW, and invokes the two isolated first-listen calls. **Neither DJ sees the editorial manifest, catalog history, play count or the other DJ's interpretation before their first response is sealed.**
6. V20's existing sealed-response, cross-read and broadcast-assembly verifier can then create an episode. A human/editorial gate admits approved episodes as future station carts, with separate provenance and on-air receipts. No sealed episode is fabricated by this PR.

## Local boundaries

- HUMKIN owns publishability, listener responses, radio playback and musical catalog.
- Auto Disco V20 owns first-listen evidence, voice identity, dialogue and assembled episode artifacts: https://github.com/the-static-collective/The-AutodiscoV.20.-question-marks-
- Selection in this first slice is a **deterministic heuristic**; there is not yet a live MOTIF or CHARTSWAN agent execution.
- A V20 episode artifact is not evidence that it aired. Publishing a proposed program does not create a broadcast receipt, Top 42 chart point, vinyl permission or confirmed human audience size.
- This is a browser-local station, not a synchronized shared-clock frequency. Browser lock/background behavior remains subject to the device.

## Test

Run `node --test tests/autodisco-accident.test.mjs`, then open `/fm/autodisco/` over HTTPS or local HTTP, listen, skip, submit one response, download the curator packet, and verify it does not claim any first-listen result.

## Next crossing

Add an owner-authorized local V20 ingest runner to consume the editorial packet while quarantining it from DJ inputs, download each admitted track, verify hashes, run real sealed encounters and assemble reviewable episodes. Then return approved divergent DJ interpretations and listener feedback to the Accident Engine as proposals, not as automatic canon or uncontrolled broadcast.