# RADIO HOUSE 002 — public Cloud HOUSE running order

**Status:** source implementation in a protected review PR; merge and manual Worker deployment are separate from running audio verification.

## Public interface

- Proposed URL after GitHub Pages deploy: `https://humkin.abundent.org/fm/schedule/`
- Entry links: `/fm/night-shift/` and the existing `/fm/` footer
- Displays published `station-one` program revision, current clock cue, next planned track appearances, local/UTC times, rotation count/length, planned revision changeovers, and media availability warnings
- Does not provide a program editor, account access, permission grant, public writing endpoint, recording ingest or replacement stream
- User-visible timing is the Cloud Autopilot clock, not proof a particular device has played a recording; live Acer, Long Wave, Same-Time and Road Shuffle have different schedules

## Public projection

Read-only Worker endpoint (requires **separate manual Worker deployment**):

```
GET https://humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/schedule
```

The Worker derives its answer from the existing validated `autopilot/programs/station-one.json` object in R2 `humkin-radio-live`. The schedule uses published source order and exact AAC segment durations from the current program, with the same 15-second clock lag used by HLS. It accounts for published future revision boundaries, including a revision switching partway through a track, and reports only the current upcoming finite window (one rotation, or the remainder and one cycle of an already published next revision). It exposes bounded track names, artists, album, public artwork links and planned UTC start/end times. It does **not** expose source SHA-256, R2 object keys, segment URLs, creator-submitted private carts, hidden drafts, or credentials.

The `on_air` property is true only if the currently required HLS window's segment objects are present. If a program pointer exists but current media are missing or it has not started, the schedule remains readable with `on_air:false` and `reason`, rather than pretending audio exists. `/status` and `/now-playing` keep their prior contracts; no production listening route switches.

## Deploy and accept (two distinct steps)

1. Merge the reviewed PR. The existing Pages workflow publishes the static schedule viewer automatically; until the Worker route is deployed, the page shows an honest unavailable-state notice.
2. When the owner is ready to change Worker source, open [HUMKIN Cloud Autopilot — manual Long Wave Worker deploy](https://github.com/the-static-collective/HUMKIN/actions/workflows/cloud-autopilot-deploy.yml) on **main**, choose `Run workflow`, and explicitly select `DEPLOY_LONG_WAVE`. This deploys the *existing* Worker with the additive read-only schedule route. **The assistant did not dispatch or perform this deployment.**

Checks to complete separately: Worker JSON responds with correct public revision and track count; page shows the same rotation in correct chronological order and times; missing-media/offline warnings are honest; Night Shift audio works independently; actual Android/phone listening across boundaries is tested with Acer off. A green source test or page render is not a listening receipt.

## Rollback

Revert the static viewer link/page or the Worker source deploy in a separate approved change; the existing Cloud HOUSE pointer, media, published revision, and Android player remain untouched by this feature. No station scheduling data needs migration.
