# HUMKIN — CONTINUE (Continuity Pilot 001)

**Last source check:** 2026-11-19 (UTC; PR state last looked up around 19:02Z)  
**Status:** DRAFT PROPOSAL FOR OWNER REVIEW; not yet merged, deployed, or field-tested  
**Owning source:** [HUMKIN repository](https://github.com/the-static-collective/HUMKIN)  
**Purpose:** Re-enter the present HUMKIN radio/studio work without relying on an outdated album-era README, assumed chat memory, or unmerged PRs.

> **Before acting:** Re-check the linked PRs and current `main`. This dated note is a locator and a set of owner-reported design constraints, not proof of live software behavior.

## What this project has grown into

HUMKIN now has overlapping but distinct workstreams: public music site and listening players; live radio receiver with invisible fallbacks; computer/Acer transmitter and Tower station desk; a multi-frequency music catalog with R2 uploads, user feedback and metadata; Auto Disco v20 and other generative stations; and later distribution/vinyl programming. The [Nov 12 README](README.md) still describes an earlier 12-track release as its starting point. Do not mistake its opening summary for today's entire system.

## Owner-reported foundational decisions (intent; not implementation proof)

1. **Listener front end:** The primary button should be live listening. Longwave and Same-Time Radio are **invisible** fallback layers; Road Shuffle is separately visible. Preserve titles, track artwork, and existing player design. A “Hear the New One” feature should return the listener to live radio afterward.
2. **Broadcast truth:** Accurate live titles/artwork should come from the Acer's actual now-playing feed. Never manufacture “live” status from a local playlist, website fallback, or a PR title.
3. **Compost Heap:** Ingest the whole expanding MP3/WAV/stem library, not just the 12-song launch set; catalog metadata should be editable, source-linked, and capable of selecting the least-played material. Tracks can also enter multiple station lineups without duplicating media blobs.
4. **Tower controls:** Reorder tracks reliably; enable/disable **any** track; edit titles and metadata on the fly; coordinate multiple station frequencies. Drag/drop and up/down movement must preserve stable item identity, not just visual position.
5. **Background playback:** Minimized/closed browser behavior must not silently switch from the authentic live stream to precanned playlists or stop at segment transitions.
6. **Creative operation:** Invent, consolidate, replace, and prove. The Android app is eligible for wholesale rebuilding rather than compatibility preservation if that improves the system.

These are **USER-REPORTED** operating requirements from the Nov 18–19 conversation context. Their presence in this draft does not assert that code implements them. If they conflict with later explicit owner corrections, preserve the correction and supersede this dated note.

## Recent GitHub observations (verify live again)

| Change | Observed state | Provenance |
| --- | --- | --- |
| Background-safe radio and full Tower track-row editing | **Open PR** at cut; NOT merged by this observation | [#166](https://github.com/the-static-collective/HUMKIN/pull/166) |
| Mac Proton login denied-session recovery | **Merged PR** at cut; field behavior not established by merge alone | [#165](https://github.com/the-static-collective/HUMKIN/pull/165) |
| Proton codes unlock existing Supabase Crate Loader | **Merged PR** at cut | [#164](https://github.com/the-static-collective/HUMKIN/pull/164) |
| MESH RADIO Mac songs → R2 upload | **Merged PR** at cut | [#163](https://github.com/the-static-collective/HUMKIN/pull/163) |
| Mesh linkblocks across music sources | **Merged PR** at cut | [#162](https://github.com/the-static-collective/HUMKIN/pull/162) |
| Integration Train 003 / Living Relay / HLS lab / real v20 dial | **Open PR** at cut | [#161](https://github.com/the-static-collective/HUMKIN/pull/161) |
| Auto Disco v20 independently produced station | **Open PR** at cut | [#160](https://github.com/the-static-collective/HUMKIN/pull/160) |
| Tower stations + Vinyl Council over SIGNAL | **Open PR** at cut | [#159](https://github.com/the-static-collective/HUMKIN/pull/159) |
| SIGNAL + Auto Disco + Season Two + Tracer | **Open PR** at cut | [#158](https://github.com/the-static-collective/HUMKIN/pull/158) |

**Open does not mean merged. Merged does not mean deployed. Deployed does not mean independently field-tested.** Never collapse these states. Other newer commits/PRs may have appeared since this cut.

## What still needs actual field verification

- Live station continuity across mobile background/minimize/lock and track transitions, with no unexpected switch to precanned content.
- Correct artwork/title/metadata directly reflecting transmitter's now-playing event.
- All-row enable/disable, edit, reliable drag/drop and up/down moves after repeated reorder.
- New radio frequencies produced by their intended machinery, not merely named UI placeholders.
- Browser differences (including Mac and Android), connectivity fallback, and return-to-live after one-off playback.

No checked result from these tests is asserted here. Distinguish user reports, simulated tests, backend processes, and real receiver behavior.

## How to resume from a new chat

1. Read **this file and its timestamp** as a proposed intent handoff, then inspect [HUMKIN current main](https://github.com/the-static-collective/HUMKIN) and active PRs, especially [#166](https://github.com/the-static-collective/HUMKIN/pull/166) and the integration stack.
2. Separate **desired UX** above from what exists on `main`, what is held in PRs, what's deployed, and what the owner actually field-tested.
3. Ask only for essential missing physical observations, not for a repeat of foundational requirements already listed here.
4. Start with the most consequential next test: **authentic live playback through consecutive track transitions while minimized**, with timestamped actual now-playing and fallbacks traced.
5. When a result changes the project, update this carrier (or its owner-approved successor) and cite actual commit, PR, test or user correction. Do not rewrite a past cut as if the future were known.

## Boundary and supersession

This is a **draft continuity pilot**, not a replacement for the canonical product specification and not an authoritative assertion of deployment. It belongs on an owner-reviewed branch until adopted. Keep credentials, private media, user contact information, and unpublished collaboration records out of public documentation.

Cross-project method proposal: [CONTINUITY RETURN 001](https://github.com/the-static-collective/What-is-the-static-collective-/pull/102). Historical receipt: MEMENTO (private draft PR #59). Reasoning receipt: [MOTIF draft PR #331](https://github.com/the-static-collective/MOTIF/pull/331).
