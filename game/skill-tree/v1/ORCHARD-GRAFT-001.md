# ORCHARD-GRAFT-001 — Actual sound changes, not another decorative counter

**Experiment, not a production release.** Stacked on the skill-tree kernel PR, itself stacked on the existing native Android PR. The design/skin of HUMKIN is unchanged; this tests an *affordance*.

## The challenge

The Listening Orchard is rich in objects, but buying and placing them changes very little about the experience of listening. The next room must create a noticeable difference in reality, not a fabricated badge.

**First new verb:** GRAFT. A level-four listener chooses two genuinely owner-published recordings, presses a short two-record tape, and hears those recordings in a new A→B order through HUMKIN's *existing native Media3 service*. A local receipt is only written after the controller confirms a queue containing those exact two song IDs with playback requested.

```text
CURRENT RADIO -> ENTER ORCHARD (level 4)
                   ↓
         GRAFT TWO PUBLISHED SONGS
                   ↓
         SWAP / SURPRISE / CHOOSE A and B
                   ↓
          PRESS TAPE [explicit]
                   ↓
           native Media3 queue changes
                   ↓
       A → B → A → B ... locally on this phone
                   ↓
    controller confirms both queue IDs and play intent
                   ↓
         LOCAL QUEUE-CHANGE RECEIPT
                   ↓
       resume ordinary radio any time
```

**Measured difference:** exact new queue length 2, precise approved IDs in order, currently requested play state, durable local number of confirmed changes, deterministic A/B fingerprint (which changes if the order changes). If actual Media3 playback becomes ready, the UI can truthfully report that playing is active, but the receipt does **not** claim audible seconds. Only pre-existing Media3 playback metering may credit genuine audible listening.

**No fake value:** no new HUM, XP, rarity, votes, chart spins, radio broadcasts, cloud uploads, public redistribution rights, R2 storage, Modal, signed cross-world task or hardware discovery. A two-track tape is not the level-seven personalized Bootleg Frequency; it is one bounded finite-choice garden action, with no access to the private station selector before level seven.

## Software

- `GraftTape.java`: pure order-sensitive A/B composer from the current approved-song list; chooses a cross-album/era second record when practical. Never accepts a guessed or unpublished ID.
- `GraftTapeStore.java`: separate local receipt ledger; records only queue changes that were verified in the UI after issuing playback commands.
- `GraftTapeActivity.java`: native mini greenhouse; short side-A/side-B picker, cross-pollinate, press-tape, replay the most recent verified composition, observe the before/after result. Reuses native `RadioCatalog.Station` and `RadioPlaybackService`, not a WebView or a parallel player.
- `OrchardActivity.java`: the new meaningful activity is placed **above** shop/inventory, without removing existing collections.
- Skill-tree slice `orchard.graft` is `AVAILABLE` only at level >=4. The new screen independently enforces both the original level gate and the read-only shared kernel gate; its Android activity is `exported=false`.
- Unit tests exercise distinct published tracks, invalid IDs, deterministic ordered identities, cross-era surprise, original level-four gate and no unlock before level four.

## Phone acceptance

On a real Android 11 receiver, listen to the current HUMKIN radio, enter the level-four Orchard, open the Grafting Bench and choose two different currently approved songs. Press the tape. Observe that the player now plays the selected two-song loop and that the lock-screen/Media3 controls remain functional; pressing the normal radio Tune In should retune the station. Re-enter the bench and replay the last recorded tape; confirm the number of confirmed queue changes increases only after a successfully changed queue. Check airplane mode/unavailable catalog shows a truthful refusal, and verify that the Orchard/Bootleg level gates remain intact.

A real phone listening test is required before claiming the user heard the new program, or before merging to the main Android branch.

## Next musical frontiers

If a small A→B tape is delightful in field use, the same `orchard.graft` capability can produce future seeds for more meaningful sound transformations: voice/bumper grafts with permission, a locally exported station card, or a provenance-backed generated motif. Those require separate bounded integrations and are **not** implied by this pilot.

**Principle:** a skill node earns its place when it opens a real new possibility, not because it changes a number.
