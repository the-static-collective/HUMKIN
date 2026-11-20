# ANDROID-032 · Native Fit Radio (good-enough responsive compromise)

## Why the previous screen did not expand

On the user's 691×1536 Android 11 screenshot, the radio stopped around the natural image height and the remainder of the app displayed blank navy. Our `LivingReceiverFace` calculated its 864×1536 aspect ratio but attempted to learn the actual window size by walking up its own parent chain after attachment. That listener did not reliably apply the available ScrollView viewport. The three enamel insertion zones therefore received zero extra height in practice.

## Repair

- `MainActivity` now hands the radio the actual measured `ScrollView` viewport height via a direct native `OnLayoutChangeListener`, plus a post-layout initial measurement.
- The receiver uses screen metrics as an early-first-frame fallback, then replaces them with the real viewport height.
- In portrait, the fixed hardware bands preserve their geometry. Three navy enamel gaskets get the remaining height, rather than a giant empty rectangle underneath the footer.
- In short/landscape windows, the art remains proportional and scrolls; no squeezing of controls or text.
- The track, dial, and button hitboxes remain native Views mapped with the exact same piecewise geometry as the art.
- The blurry, corrupted frequency numbers from the earlier upscaled Canva thumbnail are covered by a **native Canvas-rendered dial** with real FM/AM marks and a moving virtual station needle. Other original artwork stays intact.
- No change to HUMKIN web radio or the real Media3 player and rotation engine.

## Install identity and verification

Github Actions currently signs debug APKs with changing keys, so Fit Radio uses a new independent package `org.abundent.humkinradio.fit`, labeled **HUMKIN · FIT RADIO**; it does not overwrite `.flex`, `.pocket` or older progress. Version code 33 / version name 0.33.0.

Checks include all Android build variants and tests. The parent-to-child direct binding is native Android layout behavior and still needs a real-device visual verification before calling the viewport issue resolved. If the radio still shows a giant navy rectangle, inspect the app name, package, whether full-screen space is available, and compare another screenshot; do not claim a successful result from Gradle alone.

**Architecture choice:** this is deliberately the simplest acceptable native compromise. Do not migrate playback to a WebView or Compose just for static artwork. Keep real native controls and the existing Media3 service. The artwork can be replaced by more refined section assets later without disturbing playback.
