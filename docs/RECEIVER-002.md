# HUMKIN RECEIVER 002 — The Living Pocket Radio

**Status:** implementation branch / candidate for testing, November 17, 2026.
**Visual target:** user-supplied blue enamel / brass / orange paisley radio mockup (the newer illuminated snapshot).
**Destination:** \`/fm/\`, retaining the existing browser radio playback engine and catalog, not a separate toy player.

## Decision

The earlier desktop-oriented page is a design rocket stage, not the product's visual identity. Receiver 002 replaces its user-visible surface with a tactile, vertically responsive illustrated radio. We keep the old DOM hidden *only as an integration compatibility bridge* so that the existing scheduler, album art, Radio Clock / Road Shuffle, bumpers, media session, Orchard and station callbacks continue to work without rewriting or accidentally duplicating the audio engine. Once the new UI and integration have proven themselves, the bridge can be replaced with explicit radio-engine events.

## Live / not live

- **Live now:** Tune In delegates to the real \`#listen\` transport. Song title, artist, artwork and playback indicator mirror existing engine DOM and audio events. Same-Time Radio and Road Shuffle delegate to the already-working engine, rather than simulating radio. Volume controls the **same** \`#air\` HTML audio element and persists locally. Navigation opens actual record shelf, Orchard network / Outpost and Top 42 / Signal.
- **Interactive but limited:** Tuning knob accepts touch/pointer drag, keyboard arrows, Home/End and mouse wheel; needle and brass knob respond. The only playable frequency in this phase is **98.2 virtual FM = HUMKIN** (a metaphorical channel inside the app, not an over-the-air frequency). Tuning away pauses the current station and opens a readable, closable construction message.
- **Intentionally unfinished:** AM archives, stereo-to-mono DSP, signal boost, user-run frequencies, real hosting, and station-manager permissions are shown as under-construction circuits. They make a small electronic fizzle if activated, never falsely claim to change audio or connect to broadcasters.
- **Not implemented:** No new backend, station directory, identity, HUM funding economy, cash token, terrestrial frequency allocation, licensing, 24/7 stream, native APK, or verified background-service semantics.

## Later evolution

Define \`StationChannel\` separately from the UI:

\`\`\`
channelId, band, virtualFrequency, ownerId, callsign,
status = UNBUILT | UNDER_CONSTRUCTION | TEST_SIGNAL | ON_AIR | OFF_AIR,
playbackSource, rightsState, moderationState, lastVerifiedAt
\`\`\`

The dial should be populated by a real station registry only after server-owned rights/permission and capability checks. New stations may require HUM earned from genuine contributions, but spending HUM never bypasses rights, consent, moderation or limits on live services. Unbuilt stations retain their slot and become interactive only when the network actually builds them.

A later AM band can represent independently cleared historic music and recorded human archival material; classification as historical does not grant rebroadcast rights.

## Accessibility and QA

- Touch targets, keyboard operability, focus indication, readable under-construction sheet with Esc/close, descriptive slider semantics, reduced-motion CSS.
- Test against the actual user screenshot in Chrome/Android WebView at 320, 360, 393, 432, 540 and 640 CSS pixels. Check tall phones, scroll, landscape and text-overflow.
- Verify real playback, pause, next auto-advance, changing station clock vs shuffle, album art, background media transport, artwork errors and signal interruption. Browser/Android hands-on checks remain outstanding on this branch.
- Run \`node tests/receiver.test.mjs\` and the pre-existing \`node tests/radio.test.mjs\`, plus the full \`Validate HUMKIN site\` workflow.
- Do not merge over production solely because the rendered screen resembles the illustration. Browser and device playback must pass.

## Visual construction note

The original mockup is a **reference**, not an app asset. This build uses individually interactive HTML components, real data labels and CSS-painted enamel/brass/radial metal surfaces, with ornaments built from SVG. It deliberately avoids a giant screenshot with dead hitboxes. Some print-like scratches, precise illustration details and original lettering are not yet pixel-exact; fidelity can be improved with dedicated source-separated foreground textures and checked against the reference.
