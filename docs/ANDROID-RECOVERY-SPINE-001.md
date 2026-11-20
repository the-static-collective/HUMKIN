# HUMKIN Android — recovery spine 001

## Decision

Recover the **complete pre-blue classic native Java/Media3 Android app** as the
comparison baseline, while keeping the HUMKIN web / Tower `main` intact.
Android source was extracted by Git tree reference from
`fix/android-r2-native-playback-035` (commit
`da0d042f51403b059991cf3a7b5495267b9e673a`) and copied under
`apps/android/`; this is NOT a merge of divergent branch histories.

The new Android baseline is built from the same source as the website in CI
without checking out an unrelated old branch. The old Android branch and
all installed APK packages remain untouched.

## This first change

1. Restore all existing Java screens, including the v0.26 cream/plum classic
   radio, album shelf, Outpost, Orchard, collection, Station Guilds, and
   radio source service. Do not replace it with the v0.1/v0.2 Compose demo.
2. Add the isolated `org.abundent.humkinradio.recovery` variant, with the
   classic face. This avoids overwriting any previously installed variant;
   note that each CI build still has its OWN debug-signing certificate.
3. Correct the R2 public recording allowlist used by collection/record
   download. Only exact `media.abundent.org/tracks/{uuid}/{sha256}.mp3`
   paths pass; query strings, non-HTTPS, and unrelated objects fail.
4. Add build, Android 11 emulator-launch, process-alive and screenshot
   checks in GitHub Actions. The screenshot gets uploaded for manual review.
   This addresses the v0.2 prototype's green-CI/white-screen failure.

## Release gates

- Native source builds and existing JUnit tests pass.
- Android 11 emulator installs, starts, survives launch, and returns a
  screen image with more than an essentially blank white surface.
- Real handset: network radio, artwork, pauses, screen-off audio and recovery.
- Feature parity review against the pre-blue classic app.
- Only THEN enable native Tower shared live HLS + truthful now-playing,
  Long Wave → Same-Time fallback, and dynamic station registry.
- Signed identity and explicit preservation/migration plan before any
  in-place upgrade. CI debug APKs are not a production upgrade channel.

## Current omissions / honest boundaries

This first recovery PR does **not** introduce the actual Tower HLS as native
primary playback; Same-Time is still client-side. No new game currencies,
privileged Tower controls, altered server ledger, or production stream
changes are asserted. Emulator screenshots cannot prove acoustic playback
or proper screen-off media operation.

## Source provenance

- Classic UI original: PR #109
- Native R2 repair: PR #120 (do not merge wholesale)
- Original Android source: PR #56
- Failed isolated Compose prototype: PR #178 (not the baseline)
- Broadcast API + fallback docs: docs/R2-LIVE-HLS.md

## Next integration

Introduce a separately reviewable native Tower receiver around the existing
Media3 `RadioPlaybackService`. Use the current public HLS status/cues as
the source of truth; make a plain visible choice between listening to live
Tower and the existing Road Shuffle, while preserving albums, Outpost,
Orchard and local records. Gate every release on emulator screenshot and
physical radio testing.
