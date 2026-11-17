# Universal Joy: Fractal Skill Kernel 001

**Status:** experimental, UI-neutral kernel and native Android read-only projection. No APK release or backend deployment.

The radio is **the first door**, not the total world. New capabilities may grow outward through HOMKIN/HUMKIN, WebZ, Static Workbench, reLATTE, GHoT, MOTIF and Jubilee without combining their repositories or permissions into one administrator.

## First construction: small, composable, already playable

A source-controlled `catalog.json` mounts independent `slices/*.json`. Each slice has a bounded set of nodes, a parent mount, stable capability identifiers, explicit prerequisites, a release status and a reveal rule.

```text
Receiver (always live)
  ├─ Outpost (live)
  │   ├─ Antenna → Chart Radar → Request Beacon → [future frequencies]
  │   ├─ Archive → Little Press → [future trading]
  │   ├─ Night Crew → Night Editor → [future relay]
  │   └─ Listening Orchard [Level 4]
  │       ├─ Garden
  │       ├─ Public Catalog Workbench
  │       ├─ [pilot: Orchard Network]
  │       └─ Bootleg Frequency [Level 7]
  │           ├─ Personal Frequency (live)
  │           ├─ [pilot: another tower]
  │           └─ [pilot: Junction to wider world]
  │               ├─ WebZ [planned]
  │               ├─ Workbench [planned]
  │               └─ Jubilee [planned]
  └─ [held: Listener Weather until Android crash QA]
```

The two core milestone levels are **not changed**: level 4 Orchard, level 7 Bootleg. The three existing upgrade tiers are not renumbered. All XP / Signal / HUM calculation continues to belong to existing native implementations. No wall-clock catch-up, extra worker, new wallet, points minting, remote task, or public action is introduced.

## Kernel grammar

A node expresses:
- `id`: stable id in the graph, not a user identity.
- `parent`: previous meaningful ability (can come from another slice).
- `release`: `live`, `pilot` or `planned`.
- `reveal`: `always` (only root), `tease` (may be seen while parent locked), `on-parent` (visible only when parent available).
- `requires`: AND of existing local integer facts, or explicitly owner-admitted capability markers.
- `capability`: identifier that another **owner-owned** adapter might elect to make actionable. The kernel has no dispatcher.

The pure evaluators return **AVAILABLE**, **LOCKED**, **HIDDEN**, **HELD** or **PLANNED**. Only `AVAILABLE` nodes expose capability identifiers. Pilot and planned nodes never become actionable merely because a player reaches level 100 or passes arbitrary strings as admissions. Hidden nodes are omitted from the public projection rather than just drawn dim.

A receipt from reLATTE in HOLD is *not* an owner admission. A GHoT execution receipt is *not* a HUMKIN player reward. Future real-world actions require a separate authorized receiver adapter, evidence verification, consent and distinct gameplay admission. There is no such automatic bridge in kernel 001.

## Single source, two implementations

- `game/skill-tree/v1/catalog.json`: version and mount points.
- `game/skill-tree/v1/slices/*.json`: five independent declarative pieces.
- `game/skill-tree/v1/kernel.mjs`: read-only JavaScript kernel for a future website, WebZ or tooling.
- `apps/android/app/src/main/java/org/abundent/humkinradio/SkillTreeKernel.java`: equivalent pure Java kernel.
- `SkillTreeBridge.java`: loads the exact same JSON as packaged Android assets and projects *existing* `SignalRpg.Snapshot` facts (no new save file).
- `game/skill-tree/v1/demo.mjs`: inspection without UI.
- Node and Android JVM tests protect gating, unknown references, withheld pilots, and mount extension.

Both interpreters consume the same skill definition files. Actual app screens are unchanged while the radio's visual design is being settled.

## How to extend

1. Add a named `slices/new-world.json` owned by the relevant application integration.
2. Add its path to the catalog, and mount its first node under a currently established parent capability.
3. Leave unimplemented actions as `pilot` or `planned`; do not call them live just because the repo exists.
4. Introduce externally admitted fact sources only with their own independent verification and authorization.
5. Run JS / JVM tests and preview first-run, level 4, level 7 and high-level profiles.
6. Add actual UI presentation *after* the art direction is chosen, by consuming only the projection.

No Modal or R2 dependency is involved at this stage.

## Developer quick look

```sh
node --test tests/skill-tree-kernel.test.mjs
node game/skill-tree/v1/demo.mjs
node game/skill-tree/v1/demo.mjs 4 2 1 0
node game/skill-tree/v1/demo.mjs 7 2 2 2
gradle -p apps/android --no-daemon :app:testDebugUnitTest
```

**Next frontier:** connect a stable UI consumer to this projection. Keep the early receiver and Outpost minimal, then let the familiar controls acquire abilities as the project evolves. Later, an approved reLATTE receiver can supply a *verified admitted fact* to a matching live node. Do not infer the ability to operate external repositories from their mere discovery.
