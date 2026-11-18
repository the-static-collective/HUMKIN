# HUMKIN: Direct private R2 bulk crate (desktop)

**Source:** `fm/load/` and `supabase/functions/humkin-r2-direct/index.ts`.
**Status:** Implemented behind a live owner-only readiness check; existing R2 secrets are reused when they have access to both buckets. If any private R2 prerequisite is missing, the existing authenticated Supabase crate loader stays operational. Never assume deploying an Edge Function provisions an R2 bucket or R2 API credentials.

## Buckets and privileges

- `humkin-radio-media` is **public**, and bound to `media.abundent.org`. Keep it and its R2 DNS record intact.
- `humkin-radio-private` is a **separate private R2 bucket**; ensure public `r2.dev` and Custom Domains access are OFF. Do not put unpublished audio in the public bucket, even under a `private/` folder.
- **Simplest path (no Supabase secrets step):** If the already-configured `HUMKIN_R2_ACCESS_KEY_ID` / `HUMKIN_R2_SECRET_ACCESS_KEY` token permits Object Read & Write for **both** R2 buckets, the direct uploader reuses that existing secret pair automatically. Keep the **two buckets separate**; never enable public access on `humkin-radio-private`. Check `DIRECT PRIVATE R2 READY` after choosing the private bucket.
- **If the existing token only grants the public bucket:** it cannot magically write to the private one. You must grant private-bucket access at Cloudflare and ensure the server credentials reflect it, or create a new private-bucket token. For separate credentials, install `HUMKIN_R2_PRIVATE_ACCESS_KEY_ID` and `HUMKIN_R2_PRIVATE_SECRET_ACCESS_KEY` under Supabase `pantry-gate` → Edge Functions → Secrets. The latter is a fallback, not a mandatory setup step.
- `HUMKIN_R2_PRIVATE_BUCKET` is optional; its default is `humkin-radio-private`. A partially supplied private access-key pair is ignored in favor of the complete existing pair.
- Do not disclose S3 credentials, Supabase service-role keys, or presigned URLs in the browser console, GitHub, ChatGPT or documentation.

### CORS for the private bucket

In Cloudflare R2 → `humkin-radio-private` → Settings → CORS Policy, apply:

```json
[
  {
    "AllowedOrigins": ["https://humkin.abundent.org"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

This is the format for Cloudflare's **dashboard JSON tab**, not the Wrangler CLI configuration format. The browser must send **exactly** `Content-Type: audio/mpeg`. Keep the private bucket nonpublic. For testing from the GitHub Pages preview origin, explicitly add `https://the-static-collective.github.io` to `AllowedOrigins` if needed.

## Database and deployed backend

Apply `supabase/migrations/20261118233000_humkin_r2_direct_private_staging.sql` through the existing pantry-gate migration process, then deploy `supabase/functions/humkin-r2-direct/index.ts` as `humkin-r2-direct` with internal owner JWT validation. This adds `storage_provider='r2_private'`, `r2_staging_key` and `r2_upload_verified_at` to the **existing** radio tracks catalog. No second public catalog is created. RLS stays unchanged.

The owner UI calls `status` and checks real access to both buckets before enabling direct R2. It falls back to Supabase staging when the credentials/buckets are unavailable. `prepare` signs only a server-derived `stage/<uuid>/<sha>.mp3` PUT for 300 seconds, after owner authentication and SHA-256/metadata validation; `finalize` checks SHA-256 and object size from the private bucket; `publish` re-verifies source, copies to the public bucket, checks public delivery, commits catalog state, and removes the private staging copy *after* commit.

## Operator flow on Windows

1. In Chrome or Edge open `https://humkin.abundent.org/fm/load/` and sign in with the existing verified HUMKIN owner email.
2. Confirm **DIRECT PRIVATE R2 READY** in Storage Gauge. If unavailable, the old Supabase inbox loader remains operational.
3. Under Desktop folder reader choose a parent music folder. Select an artist/album layout or a custom one and review parsed metadata.
4. Press **STAGE DIRECTLY TO PRIVATE R2**. Up to 3 files upload concurrently. Each MP3 up to 50 MiB. WAV and M4A can be encoded in-browser; for large crates convert them locally using `tools/humkin-radio-batch.py`.
5. Re-select the same folder or press Stage again to retry interruptions. Already published hashes and verified drafts are skipped. **No direct upload automatically publishes anything.**
6. Review verified drafts individually or approve a group of songs/singles. Spoken bumpers remain individual-review only. Published R2 files are then available to existing Station Manager and station programming. Original masters remain untouched.

**Limits:** This is per-file PUT, not multipart-chunk resume. A failed 50 MiB PUT restarts that particular file; successful earlier files in a batch are not reuploaded. The browser must be kept open while files are in flight. Verified SHA-256 is a server-side full-file read of the private object; maximum 50 MiB. R2 PUT and backend publication consume operation/transfer quotas; monitor actual Cloudflare billing limits.

## Verification

CI: `node tests/radio-r2-direct.test.mjs`, existing loader checks and radio storage tests.

Owner field test: use 2 small MP3 files, inspect readiness, staging and post-finalize private catalog rows; confirm public URLs return 404 before approval, then publish just one; verify `media.abundent.org` audio byte ranges, station metadata and no effect on the other unpublished file. Retry the second file by selecting the same folder. A passing code deployment alone is **not** an end-to-end private bucket upload field test.
