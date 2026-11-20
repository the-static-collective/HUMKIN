# HUMKIN RADIO v0.28 — HUM & the actual pocket record shop

## Scope shipped on the Android experimental branch

The goal is **listen → small automatic HUM reward → choose a published song
→ save a real DRM-free MP3** without an account dialog, claim button,
browser, private media format, pop-up checkout or imaginary mission.

### On-device HUM economy (working, limited)

- Same recorded, bounded Media3 audible playback as the Outpost; an extra
  `hum_today_ms` counter excludes replaying local `library:` files.
- Per **America/Chicago** day: reaching 10 eligible cumulative minutes gives
  +3 HUM, 30m +1, 50m +1, 80m +1. At most **6 local HUM/day** from these
  milestones. This is based on actual app playback events, not wall clock.
- `HumEconomy` contains deterministic pure rules and approved public MP3 URL
  checks. `HumWallet` atomically stores a milestone bitset, local HUM balance,
  total earn/spend and acquired music entitlement in one private app preference.
  Restart, pause/resume, and repeated callbacks cannot grant a daily threshold
  twice *within that local state*.
- No HUM claim button. The radio dial has one discreet `ⓗ balance` control;
  a new award produces only a **760 ms silent +HUM floating flourish**, with an
  accessibility announcement and disabled-motion fallback.
- Published ordinary songs: 1 HUM. Tracks explicitly flagged by the station
  as **current singles**: 2 HUM. No fee to re-download previously collected
  recordings.
- Music may still be downloaded for free through HUMKIN's public website.
  This is a tiny earned convenience, not purchased music rights.

**Trust boundary**: this is an *on-device, nontransferable field-test game
wallet*, not a production, synchronized or tamper-proof HUM issuance system.
It must NEVER be mislabeled as server-backed `verified_hum`, deposited
into the Guilds contribution ledger, exposed as transferable value, or
silently promoted to a remote spendable balance. Android SharedPreferences
can be edited/reset; a device UUID is not unique personhood. Before live
cross-device HUB spending, deploy CANNON-selected, independently verified
source-backed server grant+debit transactions with proper authenticated
account ownership, anti-replay and revocation; migrate local assets only
by explicit owner-reviewed policy.

### Actual DRM-free music, not simulated purchases

- Tapping **KEEP THIS RECORD** on the playing station or album song calls
  an atomic debit/entitlement operation (no double-spend on fast repeat taps).
- The same action starts a bounded HTTPS MP3 transfer from allowlisted
  published HUMKIN website audio or public station Supabase live audio.
  Cross-site redirects, private paths and arbitrary audio URLs are refused.
- On Android 10+ the MP3 is inserted in **shared MediaStore Music/HUMKIN**:
  freely playable by another player or transferrable with a file manager.
  There is **no DRM, custom encryption, login condition or expiry**.
- A failed transfer leaves the song collected and the HUM debit intact.
  `My Records` exposes **DOWNLOAD** at no additional HUM charge;
  users can always retry or delete the local file without deleting the
  collection entitlement.
- The native **My Records** screen includes a real offline Media3 PLAY,
  re-download and REMOVE FILE button. Albums and radio audio retain
  separate playlists and the actual Media3 background service.
- Older Android (<10) saves ordinary MP3s in app-specific Music storage
  instead; those legacy files do not persist when the app is uninstalled.
- This is currently device-local. An app uninstall loses the local ledger
  and collection entitlements, although shared Music/HUMKIN MP3s remain
  ordinary files. Field-test package isolation also means progress does not
  automatically copy from prior Radio Rebel/Outpost versions.

### First song-feeling crash investigation

- Report: first selection of "THIS ONE DID SOMETHING" causes an Android
  crash. Exact device logcat stack trace was not available.
- Likely risky code path: the very first selection synchronously opened a
  second `AlertDialog` to ask about optional sharing while the selection
  dialog was still closing. Code now explicitly dismisses first, defers
  the sharing dialog by 120ms on the same UI view, and declines if the
  Activity is no longer live.
- The saved song feeling remains local regardless of network/share choice;
  asynchronous upload remains opt-in and isolated from Top 42 chart plays.
- This is a **plausible lifecycle fix, not a verified root cause** until an
  actual first-time selection passes on an Android device.

## Field-test checklist

1. New package `org.abundent.humkinradio.hum`, app label `HUMKIN · HUM 028`.
   Keep earlier app installations if their saved Outpost progress matters.
2. Listen 9 minutes (0 HUM), then cross 10 minutes (+3 HUM once). Pause/play,
   close/relaunch, and check no repeated credit; 30/50/80m each +1.
3. After earning 3, keep a normal published station song. Confirm balance
   goes to 2 and its actual file appears in Music/HUMKIN. Repeat KEEP:
   no second debit.
4. Turn off internet and PLAY from My Records. Delete its MP3; verify its
   collection entry remains; reconnect and download again for 0 HUM.
5. Try a current single tagged by station: exactly 2 HUM. Confirm bumpers,
   private paths and non-MP3 recordings have no KEEP button.
6. Start a downloaded track: no further passive HUM from that offline file.
   Streaming live radio again resumes normal earnings.
7. Fresh install: press song-feeling button, select a feeling, choose
   keep-private or share; verify no crash and prompt appears once.
8. Previous Antenna gate remains: static default ON until upgraded, then
   radio `⋯` exposes user toggle. Test both Same-Time Radio and shuffle.
9. Radio must continue playing across calls, screen navigation and
   backgrounding as it did before. Check no excess animation for people
   with animations disabled or app in background.

## Future source integration

- CANNON exact-commit scope selection is valid even for unmerged
  experimental branches; see CANNON CANON FIELD 001 and SOURCE REVIEW.
  `TESTED != SELECTED`; `SELECTION != EXECUTION`.
- Jubilee Treasury's signed hash-chained receipts, reserve/commit/refuse
  patterns can underpin idempotent **server** HUM, but in-game HUM is not
  physical PENNY, cash, property or a community payment rail.
- WebZ Link Wallet is a keyring for optional access and recovery; it is
  not an existing server login or spend authorization.
- Human Witness can bind declared rights/capacity to reviewed artist
  contribution records, not magically validate authorship.
- Keep ordinary listeners account-free until actual portable wallet
  redemption requires opt-in identity handling.

No production backend, wallet account, secret, cross-device redemption,
third-party media license, production signing key or migration to Guilds
verified HUM is installed by v0.28.
