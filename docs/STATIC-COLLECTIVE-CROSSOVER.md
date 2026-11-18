# HUMKIN × Static Collective

## Daily Slice pilot

The Daily Slice selects a committed atomic Markdown slice and supplies original host copy for private editorial review. Its exporter keeps the slice's declared posture, hashes the Git blob bytes, and supplies a commit-pinned source. HUMKIN accepts the exact export only with a current separate operator review for private text. It generates a HOLD rundown and a return receipt. The Daily Slice verifies the receipt against those candidate bytes and rundown, and can keep the metadata locally as a new HUMKIN-origin input.

Run the exporter documented in The Daily Slice. Transfer the candidate unchanged and verify the source pointer, source digest, attribution, posture and copy during review. Take the SHA-256 of the candidate file itself and use it in the local review below. Store the review outside both repositories and outside any web root.

```json
{
  "schema": "humkin.editorial-review/v1",
  "candidateSha256": "<64 lowercase hex characters>",
  "decision": "APPROVED",
  "scope": "PRIVATE_TEXT_PREVIEW",
  "reviewerRef": "private-editor-ref",
  "optInRef": "private-opt-in-ref",
  "rightsRef": "private-rights-ref",
  "reviewedAt": "2026-11-18T10:00:00.000Z",
  "expiresAt": "2026-11-18T12:00:00.000Z"
}
```

Use actual current timestamps and references to evidence in operator custody. A reviewer verifies the contributor's explicit opt-in, permission for the exact text and destination, and suitability for this private purpose. The operator provides only the current decision through an access-controlled local directory. Candidate submitters must have no write access to that directory or the review file. On withdrawal replace or remove the current review, remove old copies from operator access, and quarantine existing rundown copies. The CLI checks the supplied current review and expiration. Revocation storage, operator authentication and signed review transport would be required before accepting remote reviews.

```sh
HUMKIN_DAILY_SLICE_PREVIEW=1 node tools/crossover/daily-slice.mjs /private/candidate.json /private/review.json > /private/result.json
node --test tests/daily-slice-crossover.test.mjs
```

PowerShell users set `$env:HUMKIN_DAILY_SLICE_PREVIEW = '1'` in the operator session. Preserve the files as UTF-8. Candidate hashes cover exact serialized bytes, including final newline. The flag is off unless set to `1`. Send the result over the private handoff for return verification, then retain only the metadata receipt as needed. The result contains no reviewer or rights references. Receipts are deterministic content checks and require a trusted local handoff for attribution. The pilot has no audio renderer, network callback, player hook, scheduler hook, cart promotion or payment operation. Existing editorial and on-air mechanisms retain their own approvals.

## Adapter boundary and rollout

The only implemented `static-collective.crossover-record/v1` kind is `story`. The envelope carries schema, kind, source, posture, credit, title and script. Source carries repository, revision, path and SHA-256. Keep source owner decisions outside the envelope. A consumer validates the version and kind, applies its own current review for a particular projection, and returns a receipt with source, input and output digests and disposition. A receipt can enter a source project's review process as a new observation. The source artifact and local authority retain their own history.

Future adapters stay disabled until tested against their owners' current protocols:

| Project | Bounded next crossing |
| --- | --- |
| MEMENTO | Offer a HUMKIN session or recording reference as an attributable encounter. MEMENTO owns admission, refusal and fog. |
| mundaneWORMHOLE | Propose a listening seam linking two immutable, independently cleared audio archive sources. Keep both parents identifiable and handle refusals locally. |
| Human Witness | Link sealed encounter evidence to a separately opted-in recording. Keep raw capture private and require separate permission for each destination. |
| national-treasure | Propose host copy from a pinned case or clue. Carry the evidence posture and explicitly speak speculation. |
| Jubilee Treasury | Allow an optional, owner-approved public-safe opportunity pointer with current status and withdrawal checks. Exclude personal details and payment, fulfillment and donation claims. |
| Static Live | Use its existing performance packets and Phonograph intake where applicable. Add separate live, podcast, archive and radio projections with per-destination review and provenance. |
| SIA, TranchNode, Autodisco and reLATTE | Reuse observation, lineage or crossing receipts when integration needs them. Keep discovery, attribution and admission separate. |
| Band Runtime, Groove Rooms, Idea Grove, Full Measure and GHoT | Use owner-approved session or participation evidence and bounded execution surfaces when needed. Room events and processor execution confer no publication rights. |

For audio, bind moderation to the exact media digest and separately authorize each recording, underlying work, participant and use before release. Record consent scope, expiration and withdrawals in an authenticated owner-controlled system. Carry only redacted locators in projections. Require independent source-owner and destination approvals for public use and stop future projections on withdrawal. The current HUMKIN on-air workflow stays independent of this pilot.
