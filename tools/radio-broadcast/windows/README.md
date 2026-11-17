# HUMKIN STATION ONE — Windows 10 Acer launch desk

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

   The `tzdata` package is needed because Windows may not ship the IANA `America/Chicago` database used by Python's `zoneinfo`. The launcher recognizes either `py -3` or `python`, and checks FFmpeg **and** ffprobe on PATH. Installation is **not automatic**; review the terminal messages and accept package prompts yourself. If `winget` isn't available, install Python from python.org and FFmpeg from its official download page, then open a new terminal.
4. Choose **2 — Local preview**. The engine caches public listening MP3s under `%LOCALAPPDATA%\HUMKIN\StationOne\cache`, writes a 45-second local MP3 at `%LOCALAPPDATA%\HUMKIN\StationOne\station-one-preview.mp3`, and opens your music player. No stream server or paid account is needed. If the preview fails, choose **3** to check the offline FFmpeg path.
5. Only **after** you have an authorized external Icecast source endpoint should you choose **4 — Broadcast**. You must explicitly type `ON AIR` and enter the hostname, port, mount path and a masked source password. The source credentials stay in the PowerShell/child-process memory for that session; **they are never saved** in repo files, argument lists or the generated MP3. Stop with Ctrl+C. Do not share unredacted FFmpeg errors if the server includes the private URL.

## What the current engine actually does

- Loads the public HUMKIN catalog and approved cloud media, plus recurring Supabase program windows.
- Uses one FFmpeg encoder for continuous output; inserts simple song-count bumpers, softly crossfades and lightly normalizes audio.
- Reads live configuration **once at startup**. Its older `Station` selector does **not** yet have the latest browser `featured_rotation` 2× policy, φ-pattern short IDs, 11/22-minute feature lanes, Top 42 share, Blue Lemon queue or live submission handling. **Do not imply this Windows stream exactly mirrors the current browser station.** Converge and test scheduling separately before public cutover.
- An external Icecast server remains necessary for public HTTPS listening. The website's `fm/rotation.json` has `live_stream_url: null`; leave it unchanged until a real independent endpoint has been checked and heard from a phone on another network.
- A continuously running station also needs automatic startup/restart, sleep and Windows Update coordination, monitoring, an outage plan, and sufficient transmission/public-performance rights. Those are next-stage operational work, **not** claims of this launcher.

## Safety/operations

- The launcher only prompts for source credentials in Broadcast mode. Never commit passwords, service-role keys or private local cache files to GitHub.
- Keep a separate account password for Icecast administration and source transmission. An Icecast `icecast://` source connection is not automatically encrypted; use a host that supports protected source ingest (or a trusted tunnel) before sending passwords over the public internet.
- Windows 10 reached general end of support in October 2025. Do not expose this PC's RDP, source/admin ports, SMB or direct Icecast server publicly. Prefer an outbound-only source connection to a managed TLS endpoint or isolate this PC from untrusted traffic.
- The machine has a 500 GB mechanical HDD. Maintain free space, prevent sleep while testing, and keep the audio cache away from backed-up private works until you intentionally opt in.

## Handy console commands

Run from the HUMKIN repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\radio-broadcast\windows\station-one.ps1 -Action Check
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\radio-broadcast\windows\station-one.ps1 -Action Preview
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\radio-broadcast\windows\station-one.ps1 -Action Test
```

**Acceptance:** One local preview MP3 actually plays on the Acer, and the offline test script passes. A live broadcast remains unverified until the output stream URL has been proven on a second device/network.
