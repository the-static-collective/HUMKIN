# ORCHARD GAMBIT 001 — listener rules become programming skills

**Status**: real local workbench and source-verified Signal proposal, not a
server-owned station operator. Only public, already approved recordings from
`/fm/rotation.json` enter the personal setlist. No autoplay.

## Core decision
HUMKIN's progression is not an ornament around the radio. Every advancement
should expand the real tools a listener can use, eventually allowing
authorized people to operate or cofound independently running cloud stations.
The home Acer remains a producer/controller; the cloud is the durable
station clock and media store. The radio must keep playing while the owner
computer is off.

## Priority-based radio Gambits

The player builds ordered `WHEN (condition) → THEN (selection action)` rules.
The first enabled rule with eligible songs wins. Next song selections are
bounded by a published catalog, avoid repeats in each three-song preview, and
carry a human-readable decision receipt. The rule engine is deliberately
deterministic and has no access to public scheduling, upload or ownership APIs.

Starter conditions:
- Unheard recording available
- Different album available
- Evening/night
- Short recording available
- Fallback

Actions:
- Least heard (local estimate, not global audited play count)
- Different album
- Shortest / longest
- Surprise

The dedicated mobile workbench lives at `/fm/orchard/gambits.html`, with
progressive entry from Orchard. It produces a shareable **real** three-track
My Little Signal URL using the existing Signal contract, not a fake station
or speculative server authority.

## Progression that can actually grow

| Stage | Local game content | Real-world privilege |
| --- | --- | --- |
| Receiver, level 1 | Listen, explore, read sample Gambits | No remote write power |
| Tuner, level 3 | Edit 3 Gambit slots; personal Signal | Personal only |
| Archivist/contributor, level 4 | 4 slots; Guild workbench | Guild contributions still require review |
| Bootleg Frequency, level 7 | 6-slot personal experimental deck | Personal only, no frequency reservation |
| Collector+, level 9 | 8-slot personal deck | Personal only |
| Producer, future | Author station policy proposals | Server review required |
| Operator, future | Manage one station's queue/rules | Authenticated server-issued scoped grant |
| Founder, future | Manage stations and teams | Separate verified grants per station |
| Network Builder, expandable | Federated policy packs, shared network | Explicit opt-in and roles per operator |

The level requirements above align with the current local Orchard
implementation where applicable. Android and network progression systems may
have their own distinct milestone receipts. Local/browser XP, local HUM,
Top 42 participation, network artifacts and Guild credit must remain separate,
and none of them confer unaudited publishing authority.

## The next architecture seam

Eventually move from personal Gambit drafts to *reviewed station policies*:

```
personal priority deck
   → proposed radio program + explainable simulation
   → scoped station/role authorization
   → review of track eligibility, rights, timing, cooldown and station capacity
   → signed versioned policy
   → Cloud Autopilot schedules it at a safe boundary
   → listener receives one continuous common program
```

The eventual operator's rules should compile to a bounded declarative AST
(**never arbitrary JavaScript**) with allowed actions, budgets, cool-downs,
rights constraints, versioning and rollback. A rule may propose a queue or
rotation change, but nothing bypasses station owner approvals or transmitter
truth. Rule evaluation receipts should attribute each selection to the
ruleset revision and the approved catalog versions.

FFXII-inspired rule *ordering* is the gameplay reference; the final system
should have a HUMKIN-native visual identity and names.

## Device validation
- Level 1 displays presets without editing or publication.
- Level 3 editable reordering works on Android, saved across reloads.
- Suggested song IDs are present in the published rotation and never duplicate.
- 'Open My Three-Song Signal' links to an actually playable personal Signal.
- Nothing changes Station One, Cloud Autopilot, Top 42 or Studio Tower when
  the workbench runs.
- Local Orchard HUM, XP and local artifacts are unchanged by simulation.
