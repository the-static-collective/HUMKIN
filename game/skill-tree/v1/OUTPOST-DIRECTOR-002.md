# UNIVERSAL JOY 002 — Main game loop as earned changes in experienced reality

**Research → source implementation.** Experimental Android Outpost, stacked on GraftTape and the skill-tree kernel. No redesign of the radio's settled visual skin, no release or server deployment.

## Translating the incremental-game research into rules

| Research pattern | HUMKIN implementation | Evidence / limit |
|---|---|---|
| *Universal Paperclips*: the meaningful action changes its meaning | First, real music. Then charge a capacitor. Then an antenna grants **actual analog-static control**. Later the Orchard grants a **grafting verb** and Level 7 offers a personal frequency. | Existing `SignalRpg`, `OutpostMilestones`, `GraftTape`, native Media3 service. |
| *A Dark Room*: reveal the world only when it exists | First-time radio and Outpost do not display the whole graph; Orchard appears at 4, Bootleg at 7. Deep workshop, map, and missions live behind one voluntary drawer. | No hidden feature is erased; direct-entry activity guards remain in place. |
| *Kittens Game*: related machines actually influence other machines | Existing antenna/crew affect Signal per real playback pulse and capacity; archive affects XP per pulse. UI shows exact BEFORE → AFTER rates on a confirmed upgrade. | Pure `SignalMath` values; no fabricated multiplier. |
| *Melvor Idle*: passive is grounded in an activity | Radio Media3 measures playback; without active audio, there is no XP, capacitor yield or field mission progress. | Unmodified `SignalRpg` and actual Media3 service. |
| *Fallen London*: conditional next-action storylets | Pure `OutpostDirector.choose` considers only factual snapshot, verified local queue changes and current mission, yielding one actionable next verb and a truthfully stated outcome. | Action is independently rechecked at tap time; does not grant backend authority. |
| *Antimatter Dimensions* / cross-chapter revelation | At Level 4, the game opens an entirely different kind of action (hear a new combination). At 7, a listener can operate their own station. | No reset/prestige loss of existing XP or records. |

## Flow

```text
First encounter
    REAL RADIO (one audible record)
       ↓                  ┌───────────────┐
    observations/XP       │ never by timer │
       ↓                  └───────────────┘
    capacitor produces actual Signal
       ↓
    COLLECT when it unlocks next ability
       ↓
    ANTENNA: new physical radio control, visible before/after rate
       ↓
    FIELD MISSION: an observed listening target
       ↓
    CATALOG GRAFT (Level 4): REAL two-song playback changes
       ↓
    PERSONAL STATION (Level 7): REAL owner-programmed queue
       ↓
    held future skills, with independent proof and admission
```

The director is a **guide**, not an autorunner or gatekeeper. It offers one context-aware action at the entrance. The listener can still access all previous departments through **OPEN THE STATION'S OTHER DESKS**. The old screens and stores remain authoritative.

## A consequence contract

Each proposed action must have all of:

1. A real observation from existing state (not an invented counter).
2. An existing, authorized implementation.
3. A measurable pre/post state transition, or actual changed media queue.
4. A truthful outcome text showing what changed.
5. A way for the listener to continue using the change.

The director never writes a balance, advances time, claims a reward, issues an external request, or forges a receipt. It only selects a relevant existing action.

The after-action proof line is based on a new state snapshot, not an expected increment. Graft receipts reflect an accepted queue, **not** audible seconds. A signed reLATTE HOLD does not authorize an external action or gameplay reward. Neither Modal nor R2 is involved.

## Why this is not a conventional "daily reward" system

We are optimizing **first meaningful difference** and **first new affordance**, not compulsive engagement. No streak pressure, watch-time inflation, phantom idle earning, fake scarcity, or notification bait. The simplest player can just listen to the radio.

## Field acceptance

1. First ever Outpost: single **TUNE IN** action, no overwhelming 42-branch map.
2. On actual playback: XP/Signal grows and the first capacitor can fill.
3. Collect and install Antenna I: see real Signal-rate change and confirm the analog-static control appears inside the existing receiver.
4. Start a mission: no progress while paused; progress while real music plays; settle only when complete.
5. Level 4: Graft action replaces a two-song queue through existing Media3; opening the Orchard does not grant HUM.
6. Level 7: earned Bootleg direct door appears and genuinely launches its native frequency.
7. The old workshop, field missions and orders remain reachable behind the optional drawer without requiring a UI rewrite.
8. No save data is reset. Different field-test package names still have separate data until a stable signing/migration path exists.

**Next research frontier:** observe first-action latency, physical-phone before/after change, optional drawer use, and any re-entry confusion. Do not optimize for game-screen minutes or rewards-per-minute in isolation.
