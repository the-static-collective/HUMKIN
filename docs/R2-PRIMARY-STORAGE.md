# HUMKIN RADIO — Cloudflare R2 primary storage (November 17, 2026)

## Architecture

- **Cloudflare R2 `humkin-radio-media`**: primary home for approved, public songs and station bumpers. Public audio origin: `https://media.abundent.org`. No subscription upgrade needed for ~484 MiB in the existing Supabase crate (R2's 10 GB-month free allowance).
- **Supabase Postgres**: authoritative owner-reviewed catalog, record metadata, track IDs, hashes, play classifications, enabled state, schedules and provenance. Each `humkin_radio_tracks` row now has `storage_provider`, `r2_object_key`, `r2_synced_at`, and `supabase_source_removed_at`.
- **Supabase private inbox**: temporary draft staging via the existing authenticated Crate Loader. **Drafts are never stored in publicly readable R2.**
- **Supabase Edge Function `humkin-r2-bridge`**: private owner-only bridge. Verifies Supabase Auth token, verified owner email and matching `uploaded_by` before any action. Only derives object keys from an existing database ID and SHA-256. Contains the R2 S3 signing credentials via secret environment variables. It never exposes them to the browser.
- **GitHub Pages**: radio, Station Manager, Crate Loader and Production Room UI. The original static files can remain while the cloud crate migrates without an outage.

## One-time R2 authorization (required before migration)

**Do not put secret access keys in ChatGPT, GitHub, a URL, screenshots or website JavaScript.**

1. Cloudflare → **R2 Object Storage → Overview → Account Details → API Tokens → Manage**. Create a token with **Object Read & Write** permissions, restricted to **only `humkin-radio-media`**. Save its **Access Key ID** and **Secret Access Key** privately: Cloudflare will show the latter only once.
2. In Supabase project `kbhqacsdvjsstzyplqij`, open **Edge Functions → Secrets**. Save:
   - `HUMKIN_R2_ACCOUNT_ID`: `9edad7a17d56c1f1c368a724a9a4e4cb`
   - `HUMKIN_R2_ACCESS_KEY_ID`: the **Access Key ID** from Cloudflare
   - `HUMKIN_R2_SECRET_ACCESS_KEY`: the **Secret Access Key** from Cloudflare
3. Open the authenticated [HUMKIN Station Manager](https://humkin.abundent.org/fm/manage/), refresh, and look for **R2 ACCESS READY**. A configured flag proves secrets exist; the first *actual* successful migration is the end-to-end R2 write test.
4. Press **MIGRATE NEXT 20 TO R2**. The owner can rerun to resume the next batch, without duplicate writes for already-migrated rows. For each published file, the bridge reads its known Supabase original, recomputes SHA-256, uploads to R2, validates the signed HEAD's byte count and publicly accessible GET, and **then** switches the DB row to `storage_provider='r2'`. A failed item stays pointed at Supabase.
5. Press **RECLAIM 20 VERIFIED COPIES** *only when ready to remove the redundant Supabase originals*. This is an irreversible deletion of the Supabase backup, not the R2 object, with a confirmation prompt and fresh remote verification. Repeat for remaining batches. Before that, both copies exist and Supabase usage has **not** decreased.
6. From the [Crate Loader](https://humkin.abundent.org/fm/load/), upload a new track, review it and publish. The uploader uses R2 automatically once credentials are configured. With R2 credentials absent, it preserves the old Supabase publication route and clearly says why.

**Do not delete the Cloudflare DNS record named `media.abundent.org`.** The owner's screenshot confirms **Type R2**, correctly pointing at the bucket.

## How files are tracked

DB fields for an individual `humkin_radio_tracks` recording:

| Field | Meaning |
| --- | --- |
| `id` | Stable Supabase UUID, unchanged by migration |
| `sha256` | Original content digest, verified before transfer |
| `storage_provider` | `supabase` (legacy) or `r2` |
| `storage_path` | Legacy Supabase source key for provenance |
| `r2_object_key` | Cloudflare object key, `tracks/<UUID>/<SHA256>.mp3` |
| `published_at` / `enabled` | Editorial decision, never inferred from upload |
| `supabase_source_removed_at` | True accounting of when the duplicate Supabase object was deleted |

The radio and Production Room both read the same storage backend fields and generate the proper public URL. A separate reviewed static R2 manifest still includes `Blue At The Tip` (193.96 seconds, seasonal 3×). It is visible in Station Manager and Production Room as a **read-only manifest source** until explicitly imported into the editable database catalog; don't auto-duplicate it.

## Limits and recovery

- Current crate at inspection: **152 published recordings**, ~**507 MB** total. Largest ~6 MB; well below the 64 MiB per-operation bridge guard.
- Moving a track does **not** modify the row's ID, release/single status, or scheduling membership.
- An older browser holding a pre-migration cached URL may request the retained Supabase source; keep originals during an initial listener field test. After cleanup, refreshing the browser selects the R2 source. The web app's service-worker cache version is bumped.
- R2 is **public read-only**. Do **not** put unreleased songs, confidential recordings or submitted private material into `humkin-radio-media` before review.
- The bridge is intentionally owner-only and does not offer a general-purpose cloud file browser or arbitrary object-key upload.
- If migration fails: leave the old Supabase file intact, check Supabase function logs, credentials, bucket permission, and R2 object delivery. An unsuccessful PUT or HEAD never changes the authoritative location.
- Song media objects remain available after a **database record** is hidden, but the Station Manager deliberately blocks destructive R2 deletion: accidental deletion of the authoritative audio would produce dead radio links. Manage explicit deletion separately when needed.
- Browser CORS for optional audio prefetch may need the bucket CORS policy with `AllowedOrigins: ["https://humkin.abundent.org"]` and methods `GET`, `HEAD`. The normal audio element can request directly without JavaScript prefetch.

Official references: Cloudflare R2 Authentication, R2 CORS, and Supabase Edge Function Secrets. R2 overage charges are possible if its free usage allowances are exceeded. The first end-to-end write cannot be verified until the user installs restricted R2 keys.
