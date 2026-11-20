# HUMKIN SAVE THE HOUR 001 — Living Deck pilot

**Status:** SOURCE PROTOTYPE / field behavior unverified (November 20, 2026). The actual radio source, main player and cloud permissions are unchanged.

## Player's contract
- New independent Orchard route: `/fm/orchard/save-the-hour.html`. Public catalog is read from the existing `/fm/rotation.json`, filtered to valid same-origin MP3 paths.
- 24 fixed game cards in six families; five drawn per round, three played; predictable daily Central-time starter hand and optional practice rounds.
- Each play chooses one distinct **real published** recording using the shared `HumkinGambits.propose` selector; equipment → record, crew → gambit, and weather → relic pairs create explainable selection constraints.
- Challenge is a Boredom: three albums, two songs unused in previous **local practice rounds**, 75 seconds of duration contrast, or three card families. Score is practice-only.
- Completed hands can open a real independent `HumkinSignal.toUrl` three-song personal player. The optional copied JSON receipt explicitly says `authority:local-only`, `verifiedBroadcast:false`, `rewardsIssued:false`.

## Explicit boundaries
- The player neither owns nor controls songs, a broadcast station, Top 42 chart plays, Orchard's verified network collectibles, Blue Lemon physical cards, nor Guild permissions.
- No XP/HUM mint, Supabase writes, transmitter commands, remote requests, paid loot boxes or purchases. The new route needs no login.
- Play counts are **this device's practice choices**, not authoritative stream plays or actual station rankings. Local browser state is editable, not a durable signed record.
- Cards have no secondary market claim; none are server-issued or printed. The historical Blue Lemon card remains its own held source branch (#95).
- A future listener programming proposal must go through existing private editorial review (#173) and explicit publishing authority. Cloud Autopilot (#175) remains independent and needs field testing before real airing.
- Do not silently add this game to the station homepage or replace actual live-listening routes.

## Source ancestry
- Orchard game and personal Gambit rules: https://github.com/the-static-collective/HUMKIN/pull/172
- Private daily Gambit review: https://github.com/the-static-collective/HUMKIN/pull/173
- Cloud Autopilot programming: https://github.com/the-static-collective/HUMKIN/pull/175
- Held physical request-card integration: https://github.com/the-static-collective/HUMKIN/pull/95
- Current owner invariants: `AGENTS.md`, `garden/intent.json`, `CONTINUE.md`.

## Verification and next gate
1. CI: `node tests/save-the-hour.test.cjs`, syntactic checks and existing whole-site regression.
2. Browser: open new route on Android and Mac; verify five visible cards, three unique actual songs, condition feedback, no autoplay, working Signal link.
3. Continuity: refreshing preserves the local hand; new practice changes it; clearing local storage resets it.
4. Failure: offline catalog is explicitly unavailable; there is no fake success or fallback to made-up songs.
5. Broadcast: neither playing cards nor sharing a Signal should change any actual `/fm/` live program, receiver, artist/title, or schedule.

## Later, separate authorizations
Connect real collectible identity through existing verified Orchard network, possibly grant a card for a witnessed programming contribution, and translate certain game decks into **review proposals only**. Add actual radio transmission only after editorial review, rights clearance and owner-confirmed Cloud Autopilot publishing. Never infer broadcast or server authority from local card-game progression.
