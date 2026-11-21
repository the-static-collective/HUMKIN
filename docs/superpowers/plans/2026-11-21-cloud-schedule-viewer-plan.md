# Cloud HOUSE Schedule Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Cloud HOUSE program easy to read on mobile with accurate planned song order and start times.

**Architecture:** Add a public read-only projection to the existing Cloud Autopilot Worker using the same validated R2 program and UTC playback clock. Render it in the existing GitHub Pages site; keep Worker deployment an explicit separate owner act.

**Tech Stack:** Node/ES modules, Cloudflare Worker/R2, native browser DOM, GitHub Pages, node:test.

**Spec:** `docs/superpowers/specs/2026-11-21-cloud-schedule-viewer-design.md`

## Global Constraints

- No writes, new secrets, external service or schedule-authority duplication.
- Keep `/autopilot/station-one/live.m3u8`, `status` and `now-playing` unchanged.
- Published plan, available HLS segments and audible audio are different facts.
- Cloudflare Worker deployment remains manual and owner-confirmed.

## Review Focus

- Future revision effective during the current song: clip cue and show exact changeover.
- Incomplete program media: show the public plan, but clearly mark `on_air:false`.
- Worker route unavailable or R2 pointer not published: show friendly failure, not fake songs.
- Arbitrary titles and artwork: never interpret track strings as HTML or expose private fields.
- Browser local/UTC display and hidden-tab refresh must not alter audio playback.

### Task 1 — Projection contract and regressions
**Files:** `tools/radio-broadcast/cloudflare/cloud-schedule.test.mjs`, `cloud-autopilot.mjs`

- [x] Write tests first for exact clock order, revision boundary, missing media, no source hashes, unchanged existing routes.
- [x] Verify the new feature tests fail before implementation.
- [x] Implement the projection in the existing read-only Worker handler.
- [x] Verify focused Worker tests pass in PR CI.

### Task 2 — Static viewer and navigation
**Files:** `tests/cloud-schedule-page.test.mjs`, `fm/schedule/{index.html,schedule.css,schedule.js}`, `fm/{index.html,night-shift/index.html}`

- [x] Write tests first for data parsing, timestamps, navigation and text-only DOM.
- [x] Verify feature tests initially fail in PR CI.
- [x] Build mobile-friendly running order with safe metadata, revision warnings, and local/UTC toggle.
- [x] Add entry links without modifying any existing listener engine.
- [x] Verify site CI and route syntax tests pass.

### Task 3 — Operator review and separate deployment
**Files:** `.github/workflows/{validate-site,long-wave-worker,cloud-autopilot-deploy}.yml`, `docs/CLOUD-SCHEDULE-VIEWER-001.md`

- [x] Add focused tests to existing validation and manual-deploy preflights.
- [x] Document the separate manual Worker deployment and real listening acceptance.
- [ ] Review/merge PR, verify deployed static page.
- [ ] **Owner-only** dispatch manual Worker deployment on main and verify projection.
- [ ] Verify actual audio separately with Acer off; no field result is implied by CI.
