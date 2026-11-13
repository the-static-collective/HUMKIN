# HUMKIN RADIO — Lickety-Split Crate Loader (v1)
**Implementation:** GitHub Pages `/fm/load/`, browser WAV conversion + authenticated Supabase Storage, dynamic live rotation.
**Status:** backend schema deployed; website branch awaiting CI/merge; physical Android field test and email redirect must still be verified.

## Two-click path
1. Open `https://humkin.abundent.org/fm/load/` in Chrome on your phone or computer.
2. Enter `us@abundent.org`, request the sign-in link, and open it on the same device. Supabase Auth must allow `https://humkin.abundent.org/fm/load/` as an additional redirect URL. If the link lands elsewhere, add it under Authentication → URL Configuration in the pantry-gate project; no public password is stored.
3. Select many MP3 and WAV files or drag a folder's audio files onto the drop zone (desktop). MP3s are copied intact. WAVs are encoded **locally in the browser** to 128-kbps MP3, stereo where available, with the original WAV never leaving the device.
4. Press **STAGE THIS CRATE**. Each file is SHA-256 hashed, checked against existing entries, and sent one at a time to a **private** storage bucket. Files above 6 MiB use resumable TUS uploads. Retry by selecting the same files; exact duplicates are skipped. Do not lock your screen during upload.
5. Inspect the private list and press **PUT THE CRATE ON AIR** to authorize publication. Files are moved into the public playback bucket and metadata set live. Reload `/fm/` to see the expanded station rotation. No repo commits are needed per song.

## Architecture and boundaries

- Supabase project: existing active pantry-gate (no new project created), separate `humkin_radio_tracks` table and `humkin-radio-inbox` (private) / `humkin-radio-live` (public) storage buckets.
- Table and bucket writes require Supabase-authenticated token with signed JWT email `us@abundent.org`; arbitrary visitors have no upload or publish permissions. Front-end uses a publishable key only, never the Supabase service-role or secret key.
- Anonymous table reads show only rows with `published_at IS NOT NULL`. Drafts are not present in the public playlist.
- Radio player appends approved cloud MP3s to the **existing 21 songs**. If network or Supabase is unavailable, the original 21 still play.
- Storage keys are owner UID + content SHA-256, not untrusted filenames. Duplicate file hashes are rejected. Uploaded originals are preserved locally; the cloud files are listening copies only.
- Explicit human publication is required for every crate. No upload automatically triggers public visibility.

## Free-plan scale caution

The Supabase organization uses a **free** plan with **1 GB of file storage total across the organization** and limited monthly bandwidth. 10 hours of music at 128 kbps is roughly 550 MiB (plus headers/metadata), 20 hours roughly 1.1 GiB. The UI conservatively stops radio uploads at 700 MiB of registered cloud objects to reduce likelihood of quota exhaustion. **This is not a global quota guard**; other project storage or orphaned uploads also count. Do not blindly fill the organization. A self-hosted audio origin or larger object store should replace this v1 backend for 20+ hours and sustained public listening.

WAVs should NOT be uploaded to the server as WAV: their original size can be 10–20 times greater. The browser decoder is memory-intensive for long WAVs, so for mass ingest on your computer use:

```bash
python3 tools/humkin-radio-batch.py "/path/to/Suno Downloads" --out "./humkin-ready"
```

This requires FFmpeg + ffprobe, scans supported audio recursively, skips identical source hashes, transcodes to 128-kbps stereo MP3, and writes `humkin-crate-manifest.json` with hashes and durations. Your source WAVs remain untouched. After conversion, choose all the resulting MP3s on the website. For phone use, select smaller WAV batches to prevent browser memory pressure.

## Limits and truthfulness

- No login has yet been performed with the actual owner email in a real browser. Authentication redirect allowlisting may need a manual change in the Supabase dashboard.
- No real user audio has been uploaded to these buckets yet; tests verify code, schema and RLS shape, not that every codec/browser/device succeeds.
- Media Session lock-screen playback and continuous 24/7 broadcast are **separate** problems from this importer. Switching MP3s still depends on the phone keeping browser JS active. A continuous Icecast/AzuraCast stream remains the reliable upgrade path.
- 1 GB free storage is a **quota**, not an assurance that large uploads will not hit limits or be interrupted. The 700 MiB app check is a safety aid; monitor Supabase organization usage.
- Tracks appear when the station reloads. Existing listeners keep the rotation they loaded until the next refresh.
- Cloud-uploaded titles come from local filenames; album/artist use HUMKIN radio defaults. Curated tags/artwork/review can be enhanced later.

## November 13: owner email link sent to localhost:3000 (confirmed)

The owner attempted to sign in from Android. Supabase Auth logs show the app correctly requested a redirect to `https://humkin.abundent.org/fm/load/`, but the generated verification email link used `redirect_to=http://localhost:3000`; the phone then displayed `ERR_CONNECTION_REFUSED` and `access_denied`. The owner email account exists and has already been confirmed. This establishes a **hosted Auth redirect allowlist/default Site URL issue**, not a missing GitHub Pages route. Clicking the same one-time link again can result in an expired-link error.

**Permanent configuration change (not available via the connected Supabase tools):** In the **pantry-gate** project, open **Authentication → URL Configuration → Redirect URLs**, add this exact allowed URL:

```
https://humkin.abundent.org/fm/load/
```

Save it. This is sufficient for the `emailRedirectTo` already sent by the loader. Changing the **Site URL** from `http://localhost:3000` would change the default for *all* applications sharing pantry-gate, so do not change it blindly without auditing other applications.

**Interim workaround now included in the owner-only loader:** Request a NEW email link. On the phone, long-press its link and choose **Copy link address** **without visiting it**. Return to `/fm/load/`, paste it in the masked **Paste your new, unopened email link** field, and press **UNLOCK FROM EMAIL LINK**. The app accepts only exact `https://kbhqacsdvjsstzyplqij.supabase.co/auth/v1/verify` URLs with a valid-looking token hash and an appropriate email verification type. It uses `supabase.auth.verifyOtp({token_hash,type})` to exchange the token for a session locally and immediately clears the paste field. Never paste auth links into chats, logs, external websites or issue trackers.

**Proof boundary:** Automated checks cover the presence of this recovery path, not a real email client login. A newly requested link and a live phone test are still needed to confirm that both direct verification and the normal redirect work.
