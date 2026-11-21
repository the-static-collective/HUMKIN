# NIGHT SHIFT 006 — reviewed FULL Cloud HOUSE (all songs + Bumper Brain)

**Status:** protected source proposal; not a public program publication. No automatic R2 writes, Worker deployment or listener cutover.

## The inventory boundary

The live catalog query of 2026-11-21 observed 241 published/enabled R2 songs and 36 published/enabled R2 bumper recordings (277 total). One song is 22.85 seconds: the previous 30-second **song** lower bound wrongly excluded it. In FULL mode the narrow lower bound is 15 seconds, while 12/18/24/40-song selections preserve their older validation.

Of the 36 bumpers, 35 are within the current <=180-second incidental-cart limit; the remaining 262.5-second recording is **not** inserted at random breaks. It remains eligible for deliberate feature scheduling when separately reviewed. Disabled/unpublished, malformed source IDs/keys, manual profile holds, and feature-only voice files are not auto-aired.

The database's `r2_upload_verified_at` field is not populated, so catalog metadata is **not** evidence every source object is fetchable or playable. The publisher must download and SHA-256 verify each source before publishing, then validate the manifest and real AAC segments.

## Algorithm

`tools/radio-broadcast/house_rotation.py --count FULL` uses the existing public R2 catalog, the currently configured owner `bumper_every`, `bumper_groups`, `bumper_rules`, the repository-owned `fm/rotation.json` Bumper Brain policy and the native Tower `scheduler_v2.with_bumpers` planner. It emits one reviewed, deterministic, content-addressed Cloud HOUSE program.

- Every valid enabled/published **song** appears once in the core artist-spaced music order.
- Short (<=19 sec) carts use phi irregular opportunities, with no drops after consecutive songs or at the first song in the cycle.
- Medium (20-59.999 sec) and long (60-180 sec) carts follow the established ~11/22-minute anchors, with no cart stacks.
- Every duration lane uses an equal-weight shuffled bag; enabled owner ATTRACT/REPEL and manual HOLD remain source-owned.
- A currently enabled time-window rule that cannot be respected by a fixed cloud cycle **holds** publication rather than falsely promising daypart enforcement.
- When a cart is reused in the cycle, the publisher reuses its immutable source hash and encoded segments; this does not create a second original recording.
- The FULL fingerprint includes exact source order, all recurring cart occurrences, owner settings/policy digest and count/hold receipts. A changed catalog, source metadata, enabled state, settings or policy invalidates approval.

The program must fit Cloud Autopilot's existing hard limits of 500 entries and 10,000 segments. If it doesn't, **HOLD**; do not silently trim, lower media safeguards or mutate the live pointer. The prepared full 13+ hour program may take longer than the former 90-minute Actions limit, so the strictly manual publisher has a 240-minute job timeout.

## Release steps

1. Merge only after the tests and workflow-source review pass. No R2 or radio mutation happens on merge.
2. On `main`, go to **Actions → HUMKIN Night Shift — draft a larger cloud HOUSE → Run workflow**, choose `FULL`. Review the entire Summary: song count, bumper-break count, held carts, exact sequence and **REVIEW FINGERPRINT**. Keep the draft JSON artifact.
3. On `main`, go to **Actions → HUMKIN Night Shift — publish reviewed HOUSE in cloud → Run workflow**, choose `FULL`, paste the same fingerprint, deliberately choose `PUBLISH_AUTOPILOT`. This owner-only job requires the existing narrowly scoped live-R2 secrets; no chat-supplied credentials.
4. The ephemeral GitHub runner independently refreshes the approved catalog and policy, verifies the fingerprint, downloads/pins source MP3s, encodes all AAC/TS segments and uploads content-addressed media **before** comparing/writing the R2 schedule pointer. Check job output for verified program revision, UTC effective time, entry count and any failure.
5. Verify independently via published public /autopilot/station-one/status, /schedule and actual `/live.m3u8` media responses, then use `/fm/night-shift/` on two phones/browsers with Acer off through several real boundaries including bumper/song transitions. A status response or code merge is not acoustic proof.
6. **Do not** repoint the default `/fm/` receiver or ship the experimental native Android Cloud HOUSE APK until those respective acceptance checks pass. Existing Acer/Long Wave/Same-Time fallbacks stay in place.

## Failure handling

A missing object/hash, altered catalog, invalid editorial rule, unsupported item count, short malformed segment or missing R2 secret **fails closed** before any R2 pointer write. A failed upload may leave unreferenced immutable segments; do not delete prior referenced media. If publication succeeds but audio fails, restore an owner-reviewed previous R2 program revision after preserving current buffer media. Do not erase the existing revision history.

One full cycle is **not** proof of a continuously running service. Verify real devices, background locks, long-term cloud cadence and rollback independently. Publishing the expanded Station One does not deploy the separate FELLOWSHIP station or approve its audio.
