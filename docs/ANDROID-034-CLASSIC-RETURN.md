# HUMKIN Android 034 — CLASSIC RADIO (Pre-Blue Visual Return)

User request, 2026-11-17: "it was more alive before we messed with it … go back to the design from right before we turned it blue."

## Exact visual baseline

Restored **native Android v0.26.0**, immediately preceding PR #100 ("Contraband Transmitter / Radio Rebel"), parent commit `420e4e222325fceeced0f6ef086cc032cc5a31de`. The pre-blue appearance uses:

- **Warm cream app background**, light Android navigation/status bars.
- **Deep plum illustrated header**, enormous white HUMKIN lettering and bright yellow RADIO accent.
- Striped yellow “SONGS • STORIES • A LITTLE STATIC” banner.
- **THE HUMKIN DIAL** heading and a tidy overflow button.
- Large same-time and road-shuffle buttons in **yellow and mint**.
- Real album artwork, actual now-playing info and animated waveform in a simple console.
- Big yellow **TUNE IN / PAUSE**.
- Real **COMING UP / JUST PLAYED** station log, Outpost entry, Albums, Share The Dial, Request Line.

The visual code for the classic screen, masthead and radio controls was sourced **directly** from the pre-blue MainActivity in the repository and added as `buildClassicScreen`, `addClassicHero`, and `buildClassicRadio`. It is not a reimagined blue/silver/plastic facsimile.

## New capabilities kept

Rather than restoring old v0.26 binaries wholesale (and losing days of music/system fixes), classic presentation is a skin on the current single **Media3** service, current album catalogue, current song-reaction behavior, last-player continuity and the server-based HUM ledger. The HUM balance and Keep This Record controls are integrated below the historic dial heading without replacing the original cream/plum/yellow/pink design. The small coin acknowledgement remains.

Classic mode bypasses all `RebelReceiverSkin` visual styling for primary modes; it keeps the original `HumkinVisuals.setPillFill()` yellow/mint active state. It does not render the blue tuning image or overlay a radio poster. All controls are native Android buttons.

The `org.abundent.humkinradio.classic` package is a separate app, shown as **HUMKIN · CLASSIC RADIO**, version 0.34.0. Because the CI debug signing key can change between builds, don't promise in-place upgrades over a different APK signature. Installing Classic leaves all Pocket/Flex/Fit/Rebel installations and their private data intact; it does **not** automatically migrate their HUM wallet data.

## Verification

- CI builds and unit-tests this `radioClassic` variant together with the existing Android variants.
- Manual Android 11 smoke: app opens without crash; play/pause; mode change; real cover art; coming-up/just-played; open Albums and return; press ⋯; keep record; background playback; rotate and font-size test.
- The shared Android 11 `readNBytes()` crash fix from Android 030 remains in the current native code.
- This is a return to the original interface, not another responsive illustrated blue mockup experiment. The web radio is unchanged.
