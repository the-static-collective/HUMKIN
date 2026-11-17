# HUMKIN RADIO / BLUE LEMON 001 — home-computer broadcaster handoff
**Status (2026-11-16 Central):** isolated Supabase queue deployed, 131 eligible station songs synchronized from current public manifests and enabled cloud releases; one private worker credential provisioned but not yet seen; ZERO physical Blue Lemon serials issued and ZERO broadcast requests. A source computer, Icecast listening host and verified public HTTPS stream are NOT connected.

## Exact boundaries
- One first-edition Blue Lemon may be numbered 001–042. The isolated SQL schema permits only those serials; NO print/redeem tokens were minted.
- An eventual enabled serial plus its private bearer code may request one enabled song per America/Chicago station day. UNIQUE(serial, station_day) enforces the daily limit. It queues a request; it does not preempt the song currently airing.
- A registered server-side broadcaster alone may sync the currently published eligible songs, heartbeat, lease the oldest pending request and mark it AIRED after its audio has passed the actual source encoder. Normal queue entries remain private; no Top 42 plays, Guild HUM, Orchard XP, or digital ownership is inferred.
- The original radio scheduler and source catalog remain authoritative for protected programs, bumpers, disallowed songs and normal shuffled rotation.
- The broadcaster reads the priority request **at a song boundary**; it postpones the ordinary song for after the request and never interrupts the one on air. Timing depends on the actual broadcaster's encoder and music caching.
- If the queue API fails, ordinary music continues. A lease expires after 30 minutes if the source dies. Requests older than 24 hours are not claimed automatically; cleanup/return policy needs review before actual issuance.
- One public source worker credential is NEVER in repository, web JS or logs. The private onboarding file is delivered separately to the owner. Rotate it if lost or exposed.

## Deployed service
- Project: existing **pantry-gate**, no new Supabase project.
- Edge Function: `humkin-blue-lemon`, `verify_jwt=false` because handlers perform **independent high-entropy scoped worker/card authorization** and use only the private service-role client internally.
- Public read-only: `/functions/v1/humkin-blue-lemon?action=health` and `?action=catalog`.
- Worker actions (private header `x-humkin-worker-key`): `worker_probe` (no presence claim), `worker_catalog`, `worker_heartbeat`, `worker_next`, `worker_finish`, `worker_offline`.
- Future card action (private card bearer in JSON): `squeeze`. Every missing or disabled claim code fails closed. No code has been issued, so **no one currently has a usable Lemon**.
- Database: `supabase/blue-lemon-001.sql`; no API privileges for `anon` or `authenticated`; four isolated tables, all RLS-on and default-denied.

## Computer setup
Existing Python/FFmpeg source: `tools/radio-broadcast/engine.py`, now supporting `--blue-lemon` and `tools/radio-broadcast/blue_lemon.py`. It needs Python >=3.9, FFmpeg with libmp3lame, Icecast output, and dynaudnorm.
Use the owner-only Mac connection package containing the private worker environment file. NEVER commit the environment file.

From the repository checkout on the computer:
```bash
# Safe simulation: public metadata only, no stream and no Blue Lemon claim
python3 tools/radio-broadcast/engine.py --dry-run

# An offline-to-public-station local recording preview, but not a live transmission
python3 tools/radio-broadcast/engine.py --file-output ./test-output.mp3 --seconds 45

# AFTER source URL exists, rights are checked and you explicitly choose to go live:
export HUMKIN_BLUE_LEMON_WORKER_KEY=...      # private
export HUMKIN_ICECAST_URL=icecast://source:...@HOST:8000/humkin.mp3
python3 tools/radio-broadcast/engine.py --blue-lemon --cache "$HOME/HUMKIN-RADIO-CACHE"
```

**The source URL contains private broadcaster credentials and is NOT a listener URL.**
The existing public `fm/rotation.json` has NOT been populated with a fake `live_stream_url`; listeners keep the existing browser-based station until a real always-on Icecast/AzuraCast endpoint is independently checked from another device. A computer on a private LAN is not a public HTTPS transmitter by itself.

## Actual verification
- SQL migration applied on pantry-gate and private worker hash provisioned; server reports one provisioned worker, **uncontacted**.
- Public Edge health GET through an independently executed HTTPS round trip returned 200 and `{"connected":false,"catalog_count":131,...}`. This is expected until the Mac connects.
- Unauthenticated worker claim POST returned **401 WORKER_UNAUTHORIZED**.
- Existing audio encoder offline tests and new Blue Lemon unit tests are included in GitHub's validate workflow; GitHub CI should be checked at the exact PR head. A real Mac/Icecast stream test has NOT happened.
- No physical edition, card claims, program overrides, public stream deployment, source recording upload or accidental on-air promotion.

## Before first printed Lemon
1. Verify a real shared HTTPS listening stream and two-device source continuity.
2. Prove worker-connected queue delivery with a reversible synthetic test, then an approved real request, actual decoded audio, and `aired` acknowledgment.
3. Add supervised source operation, recovery/offline logging and music-failure handling.
4. Add **owner-approved one-time redemption** bound to Orchard's verified P-256 owner identity and device recovery; don't mistake copied card codes for physical custody or silently equate paper transfer with digital transfer.
5. Test 42-card serial issuance, print layout and unrevealed activation codes before handing out physical cards.
6. Add bounded backlog policy and show/bumper protection, and confirm musical/recording broadcast rights.

## Recovery and cancellation
Set `enabled=false` for `home-mac-001` in `humkin_lemon_workers` to revoke access; delete the local private credential. Change the GitHub branch freely; the production Edge and database are separate until reviewed. Keep the private worker file off public links and source control.
