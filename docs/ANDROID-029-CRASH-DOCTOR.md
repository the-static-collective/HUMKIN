# HUMKIN Android — Startup Crash Doctor 029

The `.living` APK opens briefly and reportedly exits immediately on a Motorola Android 11 handset. The previous claim that successful Gradle builds prove the app launches was incorrect. No device stack trace was accessible from CI.

## Diagnostic design

- Publish a **separate** `org.abundent.humkinradio.doctor` build; never overwrite/delete `.living` or any older HUMKIN app and local data.
- Use the existing `HumCrashNote` uncaught-exception handler. On launch **following a crash**, before `buildScreen`, `HumServerBridge`, `SessionToken` or any network startup, open a simple crash desk with a copy-to-clipboard button.
- Nothing is uploaded automatically. The listener decides whether to share the trace.
- The desk also offers **safe radio start**, which bypasses nonessential `HumServerBridge.refresh`, `refreshAlbumIndex` and periodic HUM UI refresh while retaining the native playback stack. If safe starts but normal crashes, that narrows the culprit.
- Avoid conflating the web receiver with the native APK. This diagnostic build retains the native Java UI; it is not a pixel-accurate implementation of the supplied radio mockup.

## Practical verification

1. Install `humkin-radio-android-crash-doctor-029` from the successful Android Actions run without uninstalling other HUMKIN apps.
2. Open the Doctor app. If it crashes, open it a second time. The *Recovery Desk* should show the saved trace.
3. Tap **COPY CRASH REPORT** and paste it in the conversation. Don't include unrelated sensitive info from any log.
4. Optionally test **TRY SAFE RADIO START**. Report whether it opens, plays, or still crashes.
5. Diagnose from the actual stack and fix the root cause in the native source. Do not merge a guessed crash fix into a stable app.

The Doctor package uses different private storage: it cannot read crash notes or wallets from an existing `.living` install. Do not delete the original app while diagnosing.
