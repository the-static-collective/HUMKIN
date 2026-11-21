# NIGHT SHIFT 005 — publish the reviewed HOUSE from GitHub Actions

Status: the workflow is **manual, owner-authorized**. The publisher must never run on push, pull request, or cron. Installing this workflow does **not** publish a program or repoint a web/Android receiver.

## Why

The original NIGHT SHIFT 003/004 owner workflow required downloading an approved JSON artifact onto the Acer, running the local Python/FFmpeg preview, and repeating publication using an R2 credential protected in that PC's Windows DPAPI vault. The live station can play without the Acer; publication should not depend on its availability either.

This change moves the **same existing pinned-source broadcaster** into an ephemeral GitHub Actions runner. The runner pulls only published, enabled R2 MP3s, verifies their identities, transcodes their AAC HLS segments and publishes the program pointer after all media is uploaded. Source MP3s in the public archive are never rewritten, and credentials do not go into the repository, browser or workflow artifacts.

## One-time cloud setup — by the repo owner, not through chat

In the existing Cloudflare account, create an **R2 S3-compatible API key pair** restricted to Object Read & Write for **only** the existing humkin-radio-live bucket. Do NOT grant access to humkin-radio-media or all R2 buckets. This credential is separate from the Worker-deployment Cloudflare API token; a deployment token cannot automatically act as an S3 access key.

Save the values under GitHub repo Settings → Secrets and variables → Actions → Repository secrets:

- CLOUDFLARE_ACCOUNT_ID — Cloudflare account ID (already used by the existing Worker deployment workflow, but verify that the secret actually exists).
- HUMKIN_R2_LIVE_ACCESS_KEY_ID — dedicated scoped R2 access key ID.
- HUMKIN_R2_LIVE_SECRET_ACCESS_KEY — corresponding secret access key.

Never put these values in the chat, a GitHub issue, an Actions workflow input, the catalog JSON or browser JavaScript.

The two R2 key secrets are required. If absent or invalid, the publish workflow **fails without announcing a new program**. Cloudflare R2 transfer/storage charges may apply; the 40-song selection is around 2.1 hours of music, and the action prepares ~128-kbps AAC segments, rather than storing the source MP3s a second time in another bucket.

## Normal phone-friendly publication process

1. In the HUMKIN repo, open **Actions → HUMKIN Night Shift — draft a larger cloud HOUSE → Run workflow**. Choose 40 (or 12/18/24). This is read-only. When it finishes, open its **Summary**, review the complete running order and copy the 64-character **REVIEW FINGERPRINT**. The JSON artifact remains available if you want to archive or inspect it.
2. Open **Actions → HUMKIN Night Shift — publish reviewed HOUSE in cloud → Run workflow**. Select the **same count**, paste that exact fingerprint, and select **PUBLISH_AUTOPILOT**. Keep it on the default/main branch.
3. GitHub rebuilds the selection from the *current* public catalog. If any source eligibility or selection changed, the fingerprint won't match and publication stops before downloading/encoding.
4. On its ephemeral runner, FFmpeg transcodes the verified public MP3s and saves private source-checksum receipts. The publisher rechecks eligible records and **source bytes** before publishing. It uploads immutable AAC/TS assets first, rechecks the old R2 program, then writes the revised cloud schedule pointer last. Nothing is publicly changed by the dry-run stage.
5. Read the workflow Summary for the **published revision ID, effective UTC time and exact track count**. Open https://humkin.abundent.org/fm/night-shift/ and independently verify the new revision, multiple song boundaries, and actual audio. The older revision may continue until a safe track boundary at least 120 seconds after publication.
6. The Acer may stay shut down throughout.

The preview/publish pin and source approval rules are still owned by tools/radio-broadcast/autopilot_publisher.py and house_rotation.py, not reimplemented in GitHub shell code. The Action never uploads an arbitrary user-provided remote URL; the fingerprint is checked against the approved live R2 catalog.

## Boundaries, limitations and rollback

- No hands-free auto-publication. The owner must approve each HOUSE change through GitHub. The Actions workflow is read-only for repository contents and only uses R2 secrets during actual publication.
- No direct website button yet; the streamlined control is GitHub Actions. A future owner-only Station Desk can front this approval flow once its GitHub dispatch authorization and publishing accountability are designed properly.
- Only repository users with sufficient GitHub permissions can trigger the workflow. Additional GitHub environment approvals can be considered if the team grows.
- GitHub cannot read or automatically import the Acer's Windows-encrypted DPAPI R2 vault. The owner must configure the dedicated R2 GitHub secrets once.
- This new cloud publisher changes only Cloud Autopilot station-one schedule objects under the existing humkin-radio-live R2 bucket. It does **not** switch the main /fm/ web listener or the native Android app to the Cloud Autopilot HLS stream.
- Concurrent GitHub publishing runs are serialized. The existing publisher also reloads the latest R2 schedule before its write, but an independent Acer publication at precisely the same time can still race; coordinate owner changes.
- If the job fails before its final schedule pointer write, the previous HOUSE should remain in service. Some new immutable segments may remain and should not be immediately deleted because they may later be referenced.
- Rollback: publish another explicitly reviewed HOUSE revision or restore an authorized previous program pointer while preserving still-buffered segments; do not delete current revisions or source objects.
- No field claim: Green GitHub test status does not prove playback on the physical phone. Confirm at the Night Shift listener and Cloudflare status endpoints.

## Acceptance criteria

Source-only milestone: workflow is defined on main; PR checks cover authorization gating, Python syntax, preflight and upload-order use; existing publisher tests remain green.

Live milestone: owner has installed R2 Actions secrets; workflow completes a reviewed publication; R2 pointer shows the requested 40 song IDs in exactly the approved order; cloud status changes at the revision boundary; listening across multiple different songs with Acer off is confirmed. These are distinct milestones.
