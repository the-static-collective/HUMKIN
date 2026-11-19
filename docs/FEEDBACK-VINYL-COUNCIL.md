# HUMKIN FEEDBACK ENGINE · Dance New Contenders + Monthly Vinyl Council

Status: experimental and unmerged inside HUMKIN PR #145. No Supabase Edge Function, Cloudflare Worker, public site or physical release was deployed by this change.

## User intent

Treat feedback as relationship metadata, never as a rewritten recording fact. A song receiving sufficient distinct anonymous 'It made me move' responses becomes an eligible *Dance New Contenders* recording. Monthly chart activity and future verified participation events help select eligible listener-made EP and LP records as physical candidates.

## Sources already available (not newly invented)

- Listener Weather: existing public HUMKIN resonance Edge Function. Codes: hope, tears, seen, laugh, move, stayed. One current feeling per song, provisional anonymous device-key and station week. Corrections replace, not accumulate. Server-side owner-keyed HMAC actor/network caps exist; no guarantee one browser key equals one real person.
- Top 42: existing humkin-league Edge Function. Qualified RADIO and PLAYLIST listens remain separate. The chart currently reserves roughly 7% of station music airtime; feedback does not create chart points.
- Record League: daily six-track EP (four radio-only + two released) and weekly twelve-track album (eight radio-only + four released). The monthly slate nominates these existing user-made digital records; it does not invent a new game or change the existing rules.
- Guilds/Orchard: verified contribution credits are distinct from chart listens. They cannot be purchased or self-asserted as music votes. Future verified, proof-linked event participation may contribute a bounded nomination component only after the event controller and rules are approved.

## On-air weekly contender seam

- New fm/top42/feedback-signals.mjs joins publicly aggregated Listener Weather to existing approved track IDs. Dynamic feedback belongs in listener_weather, NOT permanent track tags or embedded audio metadata.
- Dance contender rule: min_count 3 for feeling code move, current Chicago station week, complete (nontruncated) board and approved song in the existing R2 catalog.
- The added enabled Dance New Contenders station contract filters by feedback. If no approved recording qualifies, its stream readiness is unavailable rather than silently playing unrelated audio. It responds to new weekly feedback at the Worker's five-minute metadata refresh and track boundaries.
- The Top 42 webpage now shows the provisional dance contenders using its existing Listener Weather fetch. No reaction is counted as a qualified listen, paid engagement, genre certification or guarantee of airtime.
- Public feedback boards currently truncate after 5,000 private rows and 500 summary tracks. When the source flags truncation, the station's feedback-dependent selection fails closed. A future scalable database aggregate is needed before heavy participation volumes.

## Vinyl council: the monthly decision contract

Module: fm/top42/vinyl-council.mjs; preview: fm/tower/feedback.html.

Input snapshot schema: humkin.monthly-feedback-snapshot/v1 with month, approved catalog, monthly track-level chart plays, aggregated weekly Listener Weather counts, eligible record-league entries and optional reviewed event receipts.

Separate scoring channels, relative to the strongest candidate *in the same format*:

- Up to 70 points: actual qualified chart listens, tracking radio and playlist totals separately.
- Up to 20 points: capped provisional feeling responses across a record's tracks; each feeling's contribution is limited to five per track to prevent one song dominating the entire compilation.
- Up to 10 points: future independently reviewed participation events with one unique event ID and proof reference per event; disabled unless an owner-verified event feed is actually available. A raw HUM balance is not a score source.

An EP and LP can have different winning records. A candidate needs at least one chart listen. Duplicate IDs, invalid record shape, withdrawn/unapproved songs, bad counters, and incomplete monthly snapshots are guarded. Even a completely reconciled closed month only generates a NOMINATION SLATE awaiting an explicit human editorial decision.

Current live daily/weekly views do not establish final MONTHLY winners. The proposed owner-only read endpoint source at supabase/functions/humkin-monthly-council/index.ts combines existing private chart/reaction/record tables without exposing actor hashes, IPs or raw reaction rows. It is NOT deployed. It deliberately sets complete:false because Listener Weather is mutable week-level state, not a frozen historic month ledger; the public League catalog also has its own 1,000-track read limit. For credible official winners we must archive each month, reconcile coverage, verify eligibility and authorize the closing receipt.

## Physical press boundary and Other People's Fire

vinylNominationPacket produces humkin.vinyl-nomination/v1, an expressly NOT MANUFACTURABLE held packet with prospective A/B tracks, current titles/credits and available durations. It is **not** compatible with, or a substitute for, the separately unmerged lemonPRESS PR #58 lemonpress/vinyl-preflight/v1 proof.

Other People's Fire PRESS 000/001 has its own source admission and experimental physical preflight. No public URL, chart winner, broadcast permission or Suno download by itself grants vinyl reproduction rights. Every master owner and artist must authorize physical manufacture and any distribution, artist copies and accounting. A manufacturer, test pressing, side-timing/mastering, artwork proof, price and human lemonPRESS admission remain required. No vinyl was ordered.

## Practical operation

1. Continue to use existing Listener Weather 'It made me move' responses at /fm/top42/. The Worker can place reviewed/approved matching music into Dance New Contenders automatically *after* PR code is staged and deployed.
2. Use fm/tower/feedback.html after a deliberate site deployment. Its weekly board reads existing public anonymous aggregate APIs. The threshold preview is local; it does not change the on-air contract.
3. For monthly previews, open a local monthly-snapshot JSON or sign into the existing owner crate loader on the same origin and attempt the separate owner-only monthly endpoint once deliberately deployed. If it is not installed, the site reports the missing endpoint instead of fabricating winners.
4. Export a held LP and/or EP packet, review rights, masters, side timing and artist accounting, then deliberately submit it to lemonPRESS production for its own independent preflight. Nothing is copied, pressed, paid or ordered by the HUMKIN export.

## Deferred until separately designed, authorized and tested

- Immutable monthly aggregate and closing/freeze receipts; historical week-level Weather cannot be retroactively reconstructed perfectly from upserted weekly rows.
- Public publishing of winners and physical release selection after owner/artist rights review.
- Authenticated event-specific participation credits (not converting HUM or donations into listener votes); event anti-gaming eligibility and caps.
- Higher-scale aggregated reaction counters without public 5,000-row truncation and explicit suspected-manipulation holds.
- Real vinyl pressing vendor, quotes, financing, shipping, artist-copy allotments and manufacturing orders.

## Test commands

node --test fm/top42/feedback-signals.test.mjs fm/top42/vinyl-council.test.mjs tests/vinyl-council-edge.test.mjs
node --test tools/radio-broadcast/cloudflare/worker.test.mjs tools/radio-broadcast/cloudflare/stations.test.mjs tools/radio-broadcast/cloudflare/contracts.test.mjs

All implementation is in a reviewable draft PR. CI validates synthetic cases and current source regressions; field playback and full-month production reporting remain unverified.
