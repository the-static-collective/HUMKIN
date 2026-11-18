# HUMKIN STATION ONE — Windows 10 Acer launch desk

**For the public radio relay:** see [GO-ON-AIR.md](GO-ON-AIR.md). It covers the distinction between encrypted Icecast source ingest and the separate HTTPS listener, host signup, bitrates, and verification.

**Status:** a Windows launcher for the existing, offline-tested `tools/radio-broadcast/engine.py`. It is **not** a new radio engine, does not deploy an Icecast host and does not enable the public site by itself. Designed for the Acer i5-4590 / 8 GB RAM / Windows 10 Pro 22H2. The local sample is deliberately the first milestone.

## Get the PC making radio sound

1. Get the *complete repository* from GitHub (Code → Download ZIP) and extract it, or clone it. Do not run scripts directly inside the ZIP. You don't need Git installed if you use the ZIP.
2. Double-click `tools/radio-broadcast/windows/STATION-ONE.cmd`. Choose **1 — Check**. This only checks installed software and reads the public HUMKIN catalog; it does not transmit.
3. If it reports missing software, install it in PowerShell (or manually from the publishers) and reopen the launcher:

   ```powershell
   winget install --id Python.Python.3.14 -e
   winget install --id Gyan.FFmpeg -e
   py -3 -m pip install --user tzdata
   ```

   **Windows 10 timezone launcher correction:** Earlier versions used Python `-c` through Windows PowerShell 5.1. PowerShell could remove the quotes around `America/Chicago`, producing `NameError: name 'America' is not defined`, even when Python and `tzdata` were correctly installed. The fixed launcher invokes `check_timezone.py` directly and avoids native argument quoting. If you saw that exact NameError, **do not reinstall Python**. Download and extract a fresh full HUMKIN ZIP, then run the corrected `STATION-ONE.cmd` from the new folder.

   The `tzdata` package is needed because Windows may not ship the IANA `America/Chicago` database used by Python's `zoneinfo`. The launcher recognizes either `py -3` or `python`, and checks FFmpeg **and** ffprobe on PATH. Installation is **not automatic**; review the terminal messages and accept package prompts yourself. If `winget` isn't available, install Python from python.org and FFmpeg from its official download page, then open a new terminal.
4. Choose **2 — Local preview**. The engine caches public listening MP3s under `%LOCALAPPDATA%\HUMKIN\StationOne\cache`, writes a 45-second local MP3 at `%LOCALAPPDATA%\HUMKIN\StationOne\station-one-preview.mp3`, and opens your music player. No stream server or paid account is needed. If the preview fails, choose **3** to check the offline FFmpeg path.
5. Only **after** you have an authorized external TLS-capable Icecast source endpoint should you choose **4 — Broadcast**. You must explicitly type `ON AIR` and enter the hostname, source port, source username, mount path and bitrate. The launcher **verifies source TLS before asking for the private source password**. An encrypted public listening URL alone does not establish encrypted source ingest. The source credentials stay in the PowerShell/child-process memory for that session; **they are never saved** in repo files, argument lists or the generated MP3. Stop with Ctrl+C. Do not share unredacted FFmpeg errors if the server includes the private URL.

For a live hosted source, **option 5** can verify a public HTTPS MP3 listener independently of AzuraCast's optional now-playing API. It checks real audio bytes but does not claim ownership of the stream without separately listening from another network. The site/app do not switch automatically.

## What the current engine actually does

- Loads the public HUMKIN catalog and approved cloud media, plus recurring Supabase program windows. **Station One 003 now reads `storage_provider` and `r2_object_key` from the Supabase catalog.** The 152 migrated recording rows keep metadata/identity in Supabase while approved listening files are fetched from Cloudflare R2. Its source URL is rebuilt from the public media domain with strict path validation; it will not silently fall back to the deleted Supabase audio copy for migrated rows. Disabled/unpublished recordings remain excluded.
- Uses one FFmpeg encoder for continuous output, softly crossfades and lightly normalizes audio.
- **V2 program selection** reads explicit release 2× and approved seasonal 3× total rules from the published station policy, mixes catalog-arrival eras, schedules φ-shaped short IDs and approximately 11/22-minute medium/long breaks, and optionally includes the Top 42's small bonus share. Publicly published field carts and approved public R2 manifests are eligible; unpublished/private recordings are never ingested.
- Recurring Central-time programs still take priority at track boundaries.
- These are **server-side policy equivalents**, not byte-for-byte identical shuffles or phase-matched sequences to the browser. The live source has **not** been connected to Blue Lemon queue consumption, Top 42 listener feedback, receiver synchrony or private listener submissions. Do not advertise those features as working through Icecast.
- Live configuration is read at startup and on bounded reconnects, not continuously. Changes made in Station Manager need a restart to be reflected immediately.
- A failed Icecast encoder connection retries at increasing intervals (up to five times). The operator still needs a Windows service/task supervisor, sleep management and monitoring for 24/7 uptime.
- An external Icecast server remains necessary for public HTTPS listening. The website's `fm/rotation.json` has `live_stream_url: null`; leave it unchanged until a real independent endpoint has been checked and heard from a phone on another network.
- A continuously running station also needs automatic startup/restart, sleep and Windows Update coordination, monitoring, an outage plan, and sufficient transmission/public-performance rights. Those are next-stage operational work, **not** claims of this launcher.

## Safety/operations

- The launcher only prompts for source credentials in Broadcast mode. Never commit passwords, service-role keys or private local cache files to GitHub. **Important:** the current FFmpeg Icecast protocol uses a credential-bearing destination URL in the encoder process command line. That URL is not written by the launcher to disk or exposed in its menu, but it can be seen by processes/users with permission to inspect local command lines. Restrict local logins and process-inspection access; a future source transport could eliminate this exposure.
- Keep a separate account password for Icecast administration and source transmission. The updated encoder forces **FFmpeg `-tls 1` for Icecast destinations**: use a host and ingest port with real TLS, or the connection must fail. HTTPS for *listeners* is a separate requirement. Never fall back to cleartext remote ingest.
- Windows 10 reached general end of support in October 2025. Do not expose this PC's RDP, source/admin ports, SMB or direct Icecast server publicly. Prefer an outbound-only source connection to a managed TLS endpoint or isolate this PC from untrusted traffic.
- The machine has a 500 GB mechanical HDD. Maintain free space, prevent sleep while testing, and keep the audio cache away from backed-up private works until you intentionally opt in.

## Handy console commands

Run from the HUMKIN repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\radio-broadcast\windows\station-one.ps1 -Action Check
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\radio-broadcast\windows\station-one.ps1 -Action Preview
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\radio-broadcast\windows\station-one.ps1 -Action Test
```

**After the November 17 R2 storage migration:** if you downloaded a HUMKIN ZIP before **Station One 003**, extract a **fresh ZIP from main** over a new folder (do not overlay scripts inside the old extracted copy). The previous Python version still pointed migrated records to a now-empty Supabase audio bucket. The Windows launcher name and menu are unchanged.

**Current storage proof (read-only):** On November 17, pantry-gate reported 152 rows with `storage_provider=r2`, 142 published/enabled and 31 of those labeled bumpers. No R2 key was missing. This is a snapshot, not a claim that a physical Acer has played them.

**Acceptance:** One local preview MP3 actually plays on the Acer, and the offline test script passes. A live broadcast remains unverified until the output stream URL has been proven on a second device/network.


## Icecast connection plan (no hosting assumption)

**Acer:** outbound source -> **TLS-capable Icecast-compatible relay** -> public HTTPS listener mount -> verified HUMKIN receiver.

1. Choose or provision a relay that exposes **an encrypted source ingest endpoint** and a separate public HTTPS listener endpoint. AzuraCast/Icecast hosting plans differ: confirm that a plan allows external source/DJ connections and provides an ingest hostname, port, source/mount password and path.
2. On the Acer, choose **4** only when you have those values. It prompts for the password without echo and keeps credentials out of the repository. The encoder uses FFmpeg's official Icecast protocol with `-tls 1` for the upstream connection. Some hosted services' port 8000 does **not** support TLS: obtain their encrypted ingest port instead.
3. Prove the real broadcast from a second device on cellular/mobile data. Independently test the provider's HTTPS listener URL and now-playing API using `tools/radio-broadcast/host_preflight.py`; its AzuraCast now-playing requirement applies to **AzuraCast-compatible services**, not bare Icecast installations.
4. **Only after proof**: consider setting public `fm/rotation.json` `live_stream_url` and `live_nowplaying_url` for the browser receiver. The site remains browser-based until that separate intentional cutover.

**No provider account, subscription, port forwarding, Windows firewall opening, DNS change or public station is created by these scripts.** Windows 10 has passed general support, so do not expose this machine's administrative services or local HTTP ports to the Internet.
