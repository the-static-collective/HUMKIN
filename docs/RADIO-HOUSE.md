# RADIO HOUSE 001 — consolidation without cutover

**Status:** additive architecture and evidence framework, not a deployed broadcasting change. **Owner approval:** November 21, 2026, for a protected, reviewable first consolidation slice.

## Purpose

HUMKIN is the first station. Radio House is the proposed framework for multiple stations and interchangeable broadcasters, preserving actual listener behavior, source attribution, editorial rights, and recoverable experiments.

**What this change does:** describe source ownership, introduce provisional versioned contracts, generate bounded GitHub/source-state views, and index experimental branches. It does **not** change any listener route, cloud program pointer, radio rotation, database, R2 object, transmitter, Android APK, live worker, or permissions.

## Source-of-truth hierarchy

| Concern | Current owning surface | Authority and limit |
| --- | --- | --- |
| Web listener and visible choices | `fm/radio.js`, `fm/live-station.js`, `fm/rotation.json` | Code/defaults; the static rotation is *not* evidence of the current cloud program or actual listener audio |
| Owner-edited catalog and eligibility | Supabase HUMKIN radio tables + owner-reviewed Crate Loader | Data authority after authenticated access; do not treat source fixtures as current DB state |
| Approved public audio | R2 `humkin-radio-media`, linked by catalog IDs and verified content hashes | Immutable source identity; an available object is not approved for every use |
| Cloud HOUSE | R2 versioned `autopilot/` media and program pointers in `humkin-radio-live` | Worker interprets published schedule; a merged publisher or successful preview is not proof of on-air audio |
| Acer live transmission | `tools/radio-broadcast/`, Tower and real transmitter metadata | Live cue truth only while that transmitter is actually serving verified audio |
| Personal continuity | Long Wave Worker and Same-Time/Road Shuffle fallback implementations | Long Wave is per-connection, not a shared program clock |
| Android receiver | Open recovery and HLS branches, not canonical main Android release | Independent physical-device acceptance required |
| Editorial station universe | `fm/studio/station-bible.json`, approved audio carts | Scripts and fictional archive are not recorded/aired facts |
| Garden continuity | `garden/intent.json` and generated `CONTINUE.md` | Captures intent and bounded GitHub facts, not live deployment or field truth |

## Boundaries

1. **One recording identity, many memberships.** Stable IDs and source hashes should persist while tracks belong to several programs/frequencies. No automatic binary duplication or metadata aliasing.
2. **One approved publication authority per station revision.** Owner-authenticated review, source/rights checks, exact order, conflict checks, prepared media and explicit release precede the R2 pointer write.
3. **Receiver truth is layered.** Published cloud schedule, transmitter cues, transport selection, buffer offset, and what a phone *actually heard* are separate fields/evidence.
4. **Fallbacks are not program equivalents.** Existing user-facing Live → Long Wave → Same-Time with separate Road Shuffle is preserved. Cloud HOUSE as primary autonomous fallback is a *proposed later cutover*, contingent on real-device proof.
5. **Source is not deployment.** Git commits, merged PRs, CI, public status HTTP, and field recordings form distinct observations.
6. **Experimental branches remain held, not erased.** Unmerged branches are evidence leads. They cannot publish or change current behavior merely by being indexed.
7. **No invented institution-wide authority.** MOTIF can propose tests, MEMENTO can reconstruct history, PHOENIX EGG can preserve working dispositions, and Station Desk can present tools; none bypass owner permissions.

## Provisional contracts

See [station contracts](../core/contracts/README.md). These JSON Schemas define *proposal/interchange documents only*. The running Supabase schema, Cloudflare Worker API, Tower files and web player are **not migrated** to them in 001. A future adapter must be independently tested and owner-reviewed.

## Re-entry and reproducibility

- `docs/CURRENT-SIGNAL.md` is a generated **bounded source-state** report from the existing GitHub repo and a curated manifest. Its deployment and field-check values are explicitly not measured.
- `docs/BRANCH-INVENTORY.md` enumerates the available branch heads and open PR relationships. A name or PR title is not an implementation result.
- `garden/radio-house/evidence.json` is the small source-lead manifest, not an operational database.
- `garden/radio_house_pulse.py` generates both files from GitHub metadata; `--snapshot` supports deterministic offline/fixture tests.
- Existing GHoT-produced `CONTINUE.md` remains independent and is not edited manually.
- Run `python3 -m unittest discover -s tests -p 'test_radio_house_pulse.py' -v` to test report generation. CI refresh adds no broadcast steps.

## Promotion sequence (future, separately reviewed)

1. Prove the 40-song HOUSE revision through cloud HTTP and phone listening with Acer completely off, including several real track boundaries and a tested rollback.
2. Compare source and device receipts, preserving failures.
3. Validate the Android classic recovery + opt-in HLS mode; don't overwrite classic functionality with an unproven prototype.
4. Introduce explicit adapters from the proposed contracts to current APIs, keeping a single station publishing authority.
5. Only then review whether the default listener fallback order should become Acer live → Cloud HOUSE → Long Wave → Same-Time.

## Source doors

- [HUMKIN repo](https://github.com/the-static-collective/HUMKIN)
- [Existing continuity](../CONTINUE.md) and [intent](../garden/intent.json)
- [Cloud HOUSE publisher](NIGHT-SHIFT-CLOUD-PUBLISH-005.md), [receiver](NIGHT-SHIFT-RECEIVER-002.md), [Night Shift acceptance](NIGHT-SHIFT-PROOF-001.md)
- [Radio operations](RADIO-OPERATIONS.md), [Acer catalog](ACER-CLOUD-CATALOG-001.md), [signal lab](STATION-DESK-03.md)
- [Android recovery PR #179](https://github.com/the-static-collective/HUMKIN/pull/179), [Android HLS PR #180](https://github.com/the-static-collective/HUMKIN/pull/180), [Catalog Graph PR #168](https://github.com/the-static-collective/HUMKIN/pull/168), [Outside Witness PR #190](https://github.com/the-static-collective/HUMKIN/pull/190)
