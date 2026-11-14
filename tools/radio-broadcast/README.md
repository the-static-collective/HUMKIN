# HUMKIN RADIO — Broadcast source kit (experimental, no server provisioned)

This is the step **beyond browser radio**: an always-on MP3 source that one of the user's own computers can feed into an Icecast server. It uses the *existing* HUMKIN catalog, enabled states, fixed Central-time programs and the new AutoDJ station-ID interval. A single FFmpeg encoder stays connected across song changes; decoded recordings are mixed with a short equal-power crossfade and a light dynamic-leveling filter. The radio website's current `live_stream_url` is deliberately left `null` until a real HTTPS endpoint is confirmed.

**Status:** package in source control and tested offline only. The user's spare computer has **not** been configured or contacted; no online Icecast server, public streaming address, DNS, firewall rules, or 24/7 monitoring exists yet. This is a real executable source program, not a declaration that a stream is live.

## Requirements

- Python 3.9+ with `zoneinfo`; FFmpeg with `libmp3lame`, `dynaudnorm`, and Icecast protocol support; sufficient disk for the local MP3 cache.
- An Icecast 2 server or hosted Icecast-compatible stream service with source credentials, and a **public HTTPS listener endpoint** before the web player can use it. Do not expose an unencrypted management/admin port directly to the internet.
- A reliable always-on computer. The user's older Macs might need a compatible Python/FFmpeg installation rather than current package-manager defaults.
- Onboarding: make sure you own or have streaming rights for every included composition and master. For public/commercial streams, performance and neighboring-rights obligations may apply independently of your Suno subscription; verify with the appropriate service or advisor.

## Safe first check — no broadcasting

From the HUMKIN repository checkout:

```sh
python3 tools/radio-broadcast/engine.py --dry-run
python3 tests/radio-broadcast.test.py
```

The first command reads the *published* station metadata and prints a simulated next-twenty-song order without downloading audio or opening a stream. The second uses fabricated tones and an **offline file**, not user recordings and not a live stream. It checks music rotation, week/daypart selection, bumpers and crossfade continuity.

## First private Icecast test

1. Prepare Icecast separately, locally or at a reputable hosted source; create a unique strong **source** password. The broadcast source URL has the form `icecast://source:YOUR_PRIVATE_PASSWORD@HOST:8000/humkin.mp3`. It is not the public listener URL. Avoid putting credentials into a script, a GitHub issue, a screenshot or a chat.
2. Set an environment variable `HUMKIN_ICECAST_URL` **in your private machine's environment**. Use your OS secret manager or a protected launcher; avoid writing source credentials into shell history.
3. Run:

```sh
python3 tools/radio-broadcast/engine.py --cache "$HOME/humkin-radio-cache"
```

Optional: `--crossfade 0` switches off fades, `--crossfade 1.5` (default) uses short equal-power transitions, `--bitrate 96` saves bandwidth and `--bitrate 128` is default. The source downloads published MP3 listening copies **on demand** into the local cache (without affecting the source WAVs), no more than 65 MiB per file, and uses those same cached copies afterward. Browser listener bandwidth then goes through Icecast rather than repeated Supabase object requests.

**Do not put the Icecast *source* URL (it contains secrets) into the website's `live_stream_url`!** When there is a verified stable **HTTPS public listener URL** (e.g. `https://radio.example.org/humkin.mp3`), test it from a different network/phone. Only then update `fm/rotation.json`'s `live_stream_url` and deploy the player.

## Program behavior

- The actual Icecast stream is one continuous stream: all connected listeners get the same audio.
- Owner-disabled songs are excluded. Existing original 21 website recordings are filtered by static overrides.
- AutoDJ shuffles enabled SONG recordings without repeating within a music cycle. An enabled BUMPER is inserted after every N music songs if configured at Station Manager; if cadence is OFF, no automatic bumpers air.
- An enabled weekly show takes precedence at track boundaries. It loops the recorded running order from the Station Manager; higher-priority overlapping shows win. There is no live microphone/remote DJ handoff yet.
- All schedule decisions use `America/Chicago` (Central Time with DST). The Python engine calculates the active show **at each next-recording selection**, so show starts can be delayed until the current recording finishes.
- The engine fetches public metadata at startup. **Updates after startup require a restart** in this first prototype. Restart under a process supervisor (launchd, systemd) and verify the source reconnects; restart can briefly interrupt listeners.
- FFmpeg's `dynaudnorm` performs mild automatic gain leveling; it does **not** provide two-pass EBU R128 loudness compliance, peak measurements or broadcast-certified metering.
- Crossfades are done in raw stereo PCM at 44.1 kHz, then one MP3 encoder streams the result to Icecast. Very short station IDs use proportionally shorter fades.

## Known limitations before calling it production

The engine is a first working broadcast-source implementation, not resilient production playout. A computer, FFmpeg source process, internet connection and Icecast server must all stay awake and reachable; a crash or connection loss stops streaming until restarted by a supervisor. Corrupt audio can be skipped with a small silence, but failed initial downloads can stop the process. Live metadata/ICY now-playing updates, listener-count analytics, requests/moderation, emergency messages, playback logging, legal compliance, dynamic playlist refresh, 24/7 monitoring, exact show transitions and live studio handoff are still future work. This source has not yet run on the user's devices.

## Resource use and storage

A 128-kbps stream sends roughly 58 MB/hour **per listener** from the Icecast server. Ten listeners listening for ten hours is roughly 5.8 GB delivered (not counting overhead). Home upstream bandwidth, metered data and power outages matter. Keep the Icecast admin password different from the source password. For internet exposure, prefer a host/reverse proxy that handles HTTPS, observability and authentication. No source passwords or tokens are committed to the repository.
