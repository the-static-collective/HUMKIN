# Radio House 003 · Station Seed rehearsal

## Start here

Run from the repository root with Python 3, Node 22 or later, and FFmpeg on PATH. The output parent must already exist. Choose an unused directory and a UTC start time.

```sh
python tools/radio-broadcast/station_seed.py garden/radio-house/seeds/fellowship.json --effective-at 2026-11-21T12:00:00Z --output ./fellowship-rehearsal
node --test tools/radio-broadcast/cloudflare/station-seed.test.mjs
```

The versioned seed declares the station identity, synthetic sources, program library, UTC loop, editorial roles, automation policy, receiver engine, health policy, and provenance. The clock selects the initial program from the library. A new station in this rehearsal uses another valid station ID, source list and program order. Station One is reserved. The seed loader accepts generated tones and rejects local paths and remote media URLs. The seed's editorial fields describe required roles. Access grants belong in the owner-authorized publishing system.

The output contains a standard Autopilot crate, generated WAV files, encoded HLS segments, a single-revision program, and a preparation receipt. That receipt ties the exact seed bytes and source SHA-256 hashes to the revision and effective UTC time. Encode with the same FFmpeg version for byte-for-byte comparisons. Keep the output together so the relative crate paths resolve. Review `receipt.json` and `program.json` before staging.

## Stage using the existing Worker

The integration test runs the real Autopilot handler with generated AAC/MPEG-TS in a disposable bucket fixture. For a local HTTP rehearsal, choose a start near the current UTC time and use Wrangler's local R2 store. Run these commands in PowerShell from the repository root. Set the output path to your generated folder and use a fresh state directory for each rehearsal.

```powershell
$demo = (Resolve-Path ./fellowship-rehearsal).Path
$state = Join-Path $demo 'wrangler-state'
$config = 'tools/radio-broadcast/cloudflare/wrangler.toml'
$bucket = 'humkin-radio-live'
Get-ChildItem -LiteralPath "$demo/cache" -Recurse -File -Filter 'segment-*.ts' | ForEach-Object {
    $key = "autopilot/segments/$($_.Directory.Name)/$($_.Name)"
    npx --yes wrangler@4.136.3 r2 object put "$bucket/$key" --file $_.FullName --content-type video/mp2t --local --persist-to $state --config $config
    if ($LASTEXITCODE) { throw "Failed to stage $key" }
}
npx --yes wrangler@4.136.3 r2 object put "$bucket/autopilot/programs/fellowship.json" --file "$demo/program.json" --content-type application/json --local --persist-to $state --config $config
if ($LASTEXITCODE) { throw 'Failed to stage the FELLOWSHIP pointer' }
npx --yes wrangler@4.136.3 dev --local --persist-to $state --config $config
```

After the configured start and the Worker's 15-second playout offset, check `http://localhost:8787/autopilot/fellowship/status`, `now-playing`, `schedule`, and `live.m3u8`. Fetch a segment named by the playlist and decode it in an HLS-capable receiver. For an isolation drill the automated test installs both station pointers, removes FELLOWSHIP media, and restores a FELLOWSHIP snapshot after a failed candidate. [Cloudflare local R2 instructions](https://developers.cloudflare.com/r2/local-development/)

The local Wrangler staging attempt on Windows stopped when workerd raised an access violation on the first R2 upload. The disposable bucket integration test passed, including the failed-candidate restore.

## Public deployment gates

The deployed Worker already recognizes the FELLOWSHIP frequency. Public availability requires the existing Cloud Autopilot publisher and its server-side R2 authorization. The GitHub HOUSE workflow is configured for Station One. A FELLOWSHIP publishing workflow needs an owner-approved station scope, with production HOUSE excluded from that workflow's writes. Verify the resulting scope against the deployed control plane before granting access.

1. In an isolated staging target, exercise the existing media-first publisher against the generated crate. Verify private source handling, prepare a known-good prior program, and exercise a failed candidate and a forward return to the prior order. Save the affected station ID, previous and candidate revision, actual effective time, and the before/after airchecks for both stations.
2. After owner approval and a verified staging return, use the authorized publisher to schedule the reviewed rehearsal crate. The existing publisher assigns the deployed revision and effective time. Save those alongside the preparation receipt. Run `node tools/radio-broadcast/cloudflare/night-shift-aircheck.mjs --station fellowship --watch-seconds 60` and the same check for `station-one`. Compare each station's schedule, now-playing, HLS transport, and direct listener playback through a track boundary.
3. Keep immutable segments during recovery. A live return must preserve HLS timeline continuity. Verify the expected candidate is still current before changing the station pointer, and use the approved return schedule at a clean boundary. The in-memory snapshot restore in the integration test does not certify live R2 replacement or concurrency behavior.

## Inventory and field acceptance · November 21, 2026

- **Cloud HOUSE and R2** · Station One revision `r-20261121152734-6c358c2df0` reported 40 tracks. Public schedule and now-playing agreed on “Godfather Got My Back” during the first sample. A later sample reported the scheduled successor “Washed Dirt Version (1).” FFprobe identified stereo AAC at 44.1 kHz in a fetched MPEG-TS segment. Raw legacy Tower HLS status returned HTTP 503. That observation establishes cloud delivery during the sample. A human witness still needs to record the Acer's physical power state. [Public schedule](https://humkin.abundent.org/fm/schedule/) · [Successful GitHub publication](https://github.com/the-static-collective/HUMKIN/actions/runs/44918778844)
- **Receivers** · Night Shift is the opt-in cloud web receiver. On the Dell desktop its media element was unpaused, ready, and advanced from 2.48 to 6.17 seconds with no media error. The deployed main FM entry still uses its legacy live path and fallbacks. Android classic recovery, native Tower HLS, and the isolated Living Receiver remain in open PRs. No Android device was attached to ADB during this check. Long Wave independently reported healthy through its personal-stream health endpoint. [FM](https://humkin.abundent.org/fm/) · [Night Shift](https://humkin.abundent.org/fm/night-shift/) · [Android recovery](https://github.com/the-static-collective/HUMKIN/pull/179) · [Native HLS](https://github.com/the-static-collective/HUMKIN/pull/180) · [Living Receiver](https://github.com/the-static-collective/HUMKIN/pull/178) · [Long Wave health](https://humkin-long-wave.joyvolcanomusic.workers.dev/health)
- **Editorial system** · The connected Supabase project contains the catalog, programs, contribution intake, and program proposals with RLS enabled. The R2 direct, R2 bridge, Tower Gate and program-proposals Edge Functions are active. Main already carries Tower's exact-order cloud handoff, Gambit review and guest/return scheduling. Those are the integration points for actual contributions. The open FELLOWSHIP possibility experiment was identified as prior work. Its source and permissions are distinct from the generated tones. [Tower handoff](https://github.com/the-static-collective/HUMKIN/pull/175) · [Gambits](https://github.com/the-static-collective/HUMKIN/pull/173) · [FELLOWSHIP experiment](https://github.com/the-static-collective/HUMKIN/pull/13)

## Execution order

1. Rehearse the seed and fault isolation, then prove a guarded publication and return in a staging target. Collect the full 40-track HOUSE's field evidence with the Acer physically off. Compare a real web session and Android session through several boundaries, recording revision, track, UTC time, device, and heard result.
2. Wire the authoritative cloud routes into the supported main receivers through separately reversible changes. Publish FELLOWSHIP's synthetic rehearsal after publisher scope and rollback acceptance. Verify simultaneous independent field playback.
3. Reuse contribution intake, proposal review, and guest/return scheduling for the first real program. Pin contributor consent, license, stations, approved media IDs and hashes, revision, exact window, and operator approval. Archive the publication, transport and device receipts with the review. A receiving station needs its own approval over the shared recording IDs before scheduling them.
4. Add optional bounded editorial proposals once the review path is verified. MOTIF can propose a decision, MEMENTO can retain source-linked history, CHARTSWAN can frame measurable alternatives, and LOADOUT can capture repeatable operator steps. Keep broadcasting and publication independent of those services. Human authorization controls editorial and publishing grants.

Status at this source cut: live HTTP and media verified for HUMKIN, FELLOWSHIP generated and exercised in a disposable fixture, public FELLOWSHIP unseeded. Physical Acer-off audio for the current HOUSE, main web/native Android convergence, public station isolation, an aired consented contribution, an attributable on-air contribution receipt, and a deployed rollback remain open.
