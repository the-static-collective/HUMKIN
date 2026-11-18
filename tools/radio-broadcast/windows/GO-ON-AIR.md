# HUMKIN STATION ONE — connect a real internet transmitter

**Status:** the Acer has passed the local 45-second MP3 broadcast preview. The
public relay is **not** provisioned or verified yet. Do not change the public
HUMKIN website to a supposed live URL until a stream is audibly checked from
another network.

## Our architecture

Acer (Python 3.14 + FFmpeg, no inbound ports)
→ encrypted Icecast **SOURCE** connection (password; only goes to host)
→ provider radio relay
→ public HTTPS listener URL → verified listening clients.

The Acer is our only source programmer. The provider distributes its compressed
MP3 signal to listeners; users do not make inbound connections to Windows.

## Pick an external host: no charges without the owner's action

- **Zeno.fm** (https://on.zeno.fm/register) supports Icecast encoder input
  according to https://help.zeno.fm/en/article/how-can-i-sign-up-my-station-on-the-zeno-media-platform-r23r5/
  . Its Broadcast Settings provide the actual host, port, mount, password and
  stream. Some plans/features can carry charges; inspect the selected plan.
  Zeno's documentation advertises HTTPS *listening*, but this does **not**
  establish TLS on the **source ingest port**. Ask for a confirmed encrypted
  source connection and port before transmitting a password.
- **Caster.fm Free Cloud** (https://www.caster.fm/) advertises a permanent
  free Icecast listener server capped at **96 kbps** and a 400-listener ceiling;
  no card required. See https://www.caster.fm/compare/ .
  The provider's public HTTPS listener is separate from SOURCE TLS. Verify
  SOURCE TLS is supported, and verify the plan lets HUMKIN use the direct
  listener MP3 URL from its own website and Android app. Avoid assuming the
  provider permits external embedding/direct URLs on Free.
- An existing, explicitly configured TLS-capable Icecast/AzuraCast host is
  equally acceptable. **No provider is auto-selected, purchased, subscribed
  to, or provisioned by these repository scripts.**

## Operator setup

1. Create a station called **HUMKIN RADIO** in your chosen host's dashboard.
   Select a plan deliberately and review source/royalty rights and provider
   terms. This is internet radio, not a licensed over-the-air transmitter.
2. Find **Broadcast Settings / Encoder Settings** and note these separately:
   source hostname, encrypted SOURCE port, mount path, SOURCE username,
   SOURCE password. Obtain the separate **public HTTPS direct MP3 listener
   URL**. If the host only provides a station webpage or HLS playlist,
   the current simple MP3 preflight is not sufficient.
3. Replace `station-one.ps1` and `host_preflight.py` with versions from the
   latest HUMKIN repository, or extract a fresh main ZIP into a new folder.
4. Run `windows/STATION-ONE.cmd`, choose **4**, type **ON AIR**, and enter
   the **provider-assigned** SOURCE host, port, username, mount and bitrate.
   `96` is the default for free limited-bit-rate plans; `128`, `160`
   and `192` are available only when your plan permits those bitrates.
   The launcher establishes a TLS connection and validates its certificate
   **before** asking you for the private SOURCE password. If the check fails,
   **stop** and request an encrypted source ingest port from the host. Never
   type the password into a website form here, GitHub issue, screenshot or chat.
5. If the TLS check passes, the source password is typed only locally on your
   Acer in a masked prompt. FFmpeg transmits the HUMKIN station MP3 to that
   host. Keep the Acer awake, network attached and program window open for
   this first supervised test. Exit with Ctrl+C.
6. On another device using mobile/cellular data, visit the provider's public
   HTTPS listener URL. You should hear the same Station One broadcast.
   Then use **5** on the Acer and enter that public MP3 URL to verify HTTP
   audio bytes. If the host actually runs an AzuraCast-compatible now-playing
   API, optionally provide its HTTPS now-playing URL; otherwise press Enter.
   The check distinguishes **audio bytes only** from verified online state.
7. **Only after real listener verification and an explicit decision to switch
   users** should anyone update `fm/rotation.json` `live_stream_url`, test
   web playback/background behavior, and stage an Android build. The browser
   and native app retain their existing playback path until then.

## Practical operations

- Source TLS and listener HTTPS are separate. A host saying that its listener
  URL starts with `https://` is not proof that the encoder credentials are
  encrypted on the SOURCE port. FFmpeg uses `-tls 1` for an Icecast source,
  and the launcher refuses source settings without a valid TLS handshake.
- The Python process and FFmpeg process temporarily contain the source
  password (FFmpeg's command line may be visible to local administrators).
  Keep this Windows 10 device private and do not expose RDP or source ports.
- The Acer needs an active power source, prevented sleep, internet connection,
  supervision and restart/recovery checks before calling it *24/7*. Windows 10
  has passed general support; avoid direct internet-facing Windows services.
- Do not change the public website to an unverified URL, and do not advertise
  the Blue Lemon queue as supported by this continuous Icecast playout yet.
- Provider music/performance licensing terms and full broadcast rights still
  require review even where the artist owns the recording.

## Acceptance gates

- **Local:** passed — Acer 45-second preview played.
- **Source:** pending — external host assigned; protected source login made.
- **Network:** pending — second device successfully listened via HTTPS.
- **App cutover:** pending — deliberate receiver integration after proof.
