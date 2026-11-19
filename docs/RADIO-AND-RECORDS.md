# HUMKIN Radio & Records — season two preview

Open `/season/` from a local HTTP server rooted at this checkout. The album homepage and the classic radio dial are still the public entry points. The current homepage is an artist landing page covered by the Walmart submission decision recorded in the README. A future homepage cutover needs its own decision.

## The dial

The page displays ten proposed formats. Station One is the only receiver offered in this preview. The label “Receiver available” means the existing receiver can be opened. Any current audio status comes from that receiver. Selecting a prospective format shows its description and leaves an already-open receiver alone.

The embedded view uses `/fm/#receiver`. It shares the classic player, including audio-timed Acer cues, cover artwork, Listen Live, the invisible Long Wave and Same-Time fallbacks, Road Shuffle, and the featured-single handoff. The iframe loads on request. The listener starts audio inside it. Browsing the dial, records, and late screen keeps the receiver mounted. Closing it stops playback. The full receiver is also available on its own page.

For a second frequency, first give the Tower an eligible program and verify its intended public playback. Tower already names per-frequency HLS routes. The current receiver's continuity fallbacks are shared, so enabling more dial entries with the same fallback would make different stations collapse to the same program during outages. Before adding a station, decide and verify its frequency-specific fallback or its honest off-air behavior. For a derived program, share the catalog and the flagship's revision, then apply that station's own selection and spacing rules. Publish new program snapshots at track boundaries. Require an independent sound and artwork check from a second device before advertising a frequency.

## Other People’s Fire

The October planning thread describes a 12-song, 11-artist compilation with artist rights retained, accurate credits, artist copies and transparent costs. It proposed Other People’s Fire as a lemonPRESS imprint. [PRESS 000](https://github.com/the-static-collective/lemonPRESS/pull/55) is a one-song digital sleeve experiment covering “Rosemary Bloom.” It is an open experiment in lemonPRESS and supplies neither a manufacturing approval nor a release grant.

A physical PRESS 001 would progress through artist and recording permissions, approved masters, exact side timings, vinyl mastering, sleeve and label proofs, a manufacturing quote and test copy, and explicit approval of the run and accounting. Keep airplay, visual publication, downloads and physical compilation permissions independently accountable. lemonPRESS owns edition admission and physical production. The HUMKIN shelf points listeners to the published edition when it exists. A QR inside the sleeve can return listeners to the record page and its associated radio program.

## The late screen

The small visual loop begins only when requested and respects reduced-motion settings. It uses CSS and carries no soundtrack. Haunted Toaster can supply approved per-release MP4s and captions, with render lineage kept with the source release. HyperFrames can supply authored station IDs, interstitials or silent loops. Keep those pre-rendered and load footage only when the listener asks to watch. Treat original playback and separately soundtracked videos as different listening actions to avoid two soundtracks.

## Classic radio template

The [classic-radio-template branch](https://github.com/the-static-collective/HUMKIN/tree/archive/classic-radio-template) pins the full working tree at `34bb5aa32cd810a794d9da08db459d2742675fad`, including the receiver, scheduling, Tower, broadcast tooling and static site. It is a frozen reference for the future starter.

To make a neutral installation, extract the player, configuration and deployment instructions. Parameterize branding, covers, station IDs, catalog, relay origins and hosting. Use an explicitly redistributable sample catalog and test a clean install against its own endpoints. Select and apply a software license with the owner and inventory the separate rights on recordings, artwork and names before offering a template release.

## Preview checks

From the checkout, run `node --test tests/season-network.test.mjs`. Then open the preview locally, open the receiver, press Listen Live, browse the record shelf and return to the dial. Check an Acer track change on a second device once the public relay and cue feed are available. Test Narrow View, Road Shuffle, the new-single handoff, and reduced motion in the same pass.
