# NIGHT SHIFT 002 — one-tap cloud receiver

**Scope:** an opt-in, standalone listening page; no change to the existing /fm/ default stream, browser-clock radio, Android APK, R2 bucket, Worker or published program. The existing two-song proof continues until the owner separately publishes a larger program.

## The new door

- Open `https://humkin.abundent.org/fm/night-shift/` after this source change has passed CI and deployed through the ordinary GitHub Pages workflow.
- Press **TUNE IN**. Native Safari uses built-in HLS; browsers supporting Media Source Extensions use the same hls.js major version already loaded by /fm/.
- **REJOIN LIVE** deliberately rejoins the current cloud clock; **PAUSE** leaves playback paused. Autoplay requires a user gesture; fallback is the visible native audio controls.
- Song/title/artist information comes only from the real Cloud Autopilot now-playing JSON. It is explicitly labeled *published cloud schedule*: the displayed title may run ahead of a buffered phone. No fictitious listening receipt or invented air time.
- The page does not store credentials or configure a Worker and does not auto-publish tracks. The separately linked Long Wave stream is a listener-driven alternative, not falsely claimed as the same synced program.
- Background restrictions vary by browser/Android. An HLS media error while a tab is hidden is deferred for on-screen recovery rather than silently changing programs or forcing a browser autoplay; native Android playback remains independent.

## Independent cloud state (owner-reported field evidence)

On 20 November 2026, the user heard the published cloud HLS radio continue with the Acer physically off. The current proof sample is a two-track house program; the user had not confirmed a transition while the Acer remained off at the time of the initial test. Read-only cloud API checks confirmed the published revision and advancing segment numbers. These observations are not a claim of a 24-hour uptime test.

## Next: expand the house recording set

Cloud Autopilot is a shared *transcoded HLS* program. The 188 approved R2 catalog entries served by personal Long Wave are **not automatically 188 HLS house entries**. For a longer shared program, select 12–24 reviewed recordings, use the existing owner's Tower/Autopilot AAC preparation and publication authority, and verify the next effective track boundary. The remote-only audio path from PR #177 is still a separate draft, not merged here. No new public recording may be invented or auto-approved.

Acceptance tests for house expansion: new revision visible in `/autopilot/station-one/status`, real `.ts` media for the new program, monotonically advancing playlist sequence, selected titles in `now-playing`, audible transitions with the Acer off, and a safe return to the previous house rotation after a guest show.

## Tests

`node --test tests/night-shift-receiver.test.mjs`

Run this with the ordinary site validation on a pull request. Browser/phone field verification is still a separate gate.
