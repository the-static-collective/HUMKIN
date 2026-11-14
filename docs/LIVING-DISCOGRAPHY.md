# HUMKIN Radio — Living Discography / Kinship-inspired producer desk 001

**State: standalone, local-first producer prototype. Not a broadcasting server or an actual Kinship integration.**

## First executable crossing

`/fm/living/` reads the **published static** `/fm/rotation.json` and lets a human link two actual recordings with an interpretation, evidence-qualified observation, or creative proposal. It stores source IDs, human notes and status locally; never uploads them. This is not automated music analysis, generated sound, Suno extraction, a published show or broadcast.

The desk deliberately borrows the tested shape from `the-static-collective/static-live` KINSHIP-001 through KINSHIP-005 (producer packets, human-reviewed `ready`, explicit confirmation of `aired`, station memory, shift handoff, and return verdicts). It does **not** borrow Kinship Radio's name, credentials, private data, listeners, mission or permission to air anything.

The workflow is:

```text
real catalog recording A + recording B
          ↓
human observation | interpretation | proposal
          ↓
DRAFT → READY (named human) → AIRED (actual human-confirmed occurrence) → RETURNED (KEEP / WEIRD / COMPOST)
          ↘ HOLD
          ↓
re-open from witnessed air = NEW DRAFT with ancestor ID; prior evidence remains unchanged
```

- **Station Memory:** only human-confirmed aired/returned cards count, with transparent relationship and verdict counts. Prepared cards never become broadcasts by being placed in a rundown.
- **Rundown:** exports *only READY* reviewed cards as `humkin.producer-rundown/v0.1`, with `status: proposal_not_broadcast` and `broadcastingAuthorized: false`. It does **not** write to Supabase, schedule a program or generate sound.
- **Backup and return:** JSON save/restore, import validation, localStorage only. The existing live radio and original Walmart-facing album site are untouched.
- **Manual inclusion:** the live site will have a link from the Station Manager after merge. The desk itself is static/no login; its data is local to each browser. Do not put personal, prayer, donor, or volunteer information in it.

## Truth and permission boundaries

- Observation is a producer assertion, not independently verified listening analysis. Contradictory interpretations can coexist.
- Metadata (`title`, `album`, ID) identifies a catalog entry, not rights clearance or proof of authorship.
- Nothing here demonstrates a synchronized 24/7 broadcast; the current radio uses browser playback.
- *No actual broadcast event exists until human-confirmed.* Never reconstruct events from planned programming or media files.
- Kinship's specific prayer requests, volunteer vetting, donation records and station editorial authority remain Kinship-owned and are never imported.
- The radio remains functional if this desk or every AI component is unavailable.

## Source ancestry / further adapters (not yet wired)

- **Autodiscography Vault:** use verified hashes and manifests to distinguish alternate recordings and keep source material outside public Git.
- **Autodisco V20:** carry independent first-listen interpretations as named, provenance-preserving *proposals*. A model cannot mark a card `ready` or `aired`.
- **Haunted Phonography:** link new `ResolvedPerformance`/receipt outputs to their source recordings only after a verified, authorized public audio asset exists. A mutation proposal is not itself a published recording.
- **Static Live KINSHIP-003/004:** consider a deliberate producer handoff and wider source cards later. This prototype uses the core memory boundary, not signed cross-system messages.
- **HUMKIN Station Manager:** later read-only import of publicly enabled cloud tracks, real schedule preview and operator-controlled, reviewed `ready` → program-draft crossing. Never auto-publish a human interpretation.
- **Broadcast server:** independent work to provision real stream source, AutoDJ, metadata, uptime and licenses. Never fill `live_stream_url` before a working stream is verified.

## Run tests

From HUMKIN root:

```sh
node tests/living-discography.test.mjs
```

Requires no token or connected account; the desk itself runs on a static host with browser localStorage. This first specimen has no private or station-owned data access.
