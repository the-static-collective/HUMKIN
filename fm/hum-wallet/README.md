# HUMKIN HUM-WALLET 001 · live signed server, narrow boundaries

Source and deployment: November 17, 2026.

**Working server wiring:** Supabase project `pantry-gate`
(`kbhqacsdvjsstzyplqij`), Edge function `humkin-hum-wallet` deployed
as v1 with `verify_jwt=false` **intentionally** because every operation
(including registration) requires an ECDSA P-256 device-held signature.
The SQL is deployed via the migration
`humkin_hum_wallet_001_signed_actor_nontransferable`. Exact source
snapshots are in `edge-function.ts` and `schema-001.sql`.

**The server has real receipts, not merely UI animation.** From Android
v0.29, the OS-managed AndroidKeyStore key signs a fresh nonce, short
timestamp, action and bounded payload. Server verifies the public
fingerprint and ECDSA raw-P1363 signature, and only then invokes an
atomic, service-role-only PostgreSQL function. No password or private
key travels to the server.

Signed wire message, UTF-8:
`HUMKIN-HUM/v1\nACTOR\nNONCE\nUNIX_MS\nACTION\nPLAYED_MS_OR_0\nSONG_ID_OR_EMPTY`.
JSON envelope:
`{packet:{actor,nonce,ts,action,played_ms,song_id,jwk?},signature}`.
`jwk` is sent only during registration. Device actor is SHA256 of
canonical `{"kty":"EC","crv":"P-256","x":"...","y":"..."}`.
ECDSA P-256 SHA-256 signature is 64 raw bytes (r||s), base64url-no-padding.

### API

`POST /functions/v1/humkin-hum-wallet`, JSON body, signed action:

- `register` — create a pseudonymous key account with zero initial balance
  and no personal information.
- `state` — return server-owned wallet state for this signing key.
- `listen` — report cumulative eligible Media3 playback milliseconds for
  the station day. Reports are bounded by actual elapsed server time
  since last report, limited to 120 seconds per batch; client cannot
  instantly claim 80 minutes by posting an enormous counter. Audio
  authenticity itself is NOT cryptographically proven.
- `collect` — debit exactly once for an owner-published song. Source
  lookup is authoritative: enabled+published `humkin_radio_tracks` for
  cloud `crate-UUID`, or exact approved IDs from
  `https://humkin.abundent.org/fm/rotation.json` for static audio.
  The server—not the client—determines ordinary 1 HUM or designated
  current single 2 HUM. Repeating a previously collected song is
  free, and the entitlement survives deleting its local MP3.

Each state-changing request uses an independently unique nonce. The
nonce is inserted in the **same database transaction** as the debit,
award, and receipt, with a primary-key uniqueness constraint. Wallet
updates are row-locked `FOR UPDATE` to reject concurrent double spending.
There is no direct public REST access to the wallet rows; all four tables
have RLS enabled, no permissive public policies, and explicit revocation
for `anon`, `authenticated` and `PUBLIC` roles. The only function
executor is `service_role` via the signed Edge handler.

### Exact earned HUM schedule

America/Chicago date; ten minutes +3, 30m +1, 50m +1, 80m +1,
maximum **6 listening HUM/day per signing key**. The little coin UI is
triggered from a **confirmed server award receipt** rather than a
client-side timer. Shared HUM is never automatically minted from the
old local-capacitor Signal or `HumWallet` editable local credits.

### Native record contract

Android 10+: `Music/HUMKIN` files are ordinary, unencrypted MediaStore
MP3s. They play in other music players and survive uninstall. Their
collection entitlements live in the signing key's server account;
this remains **account-local to a device until recovery/key linking**.
AndroidKeyStore private keys are not exportable; deleting/reinstalling
the test app currently loses access to the old server account even
though the MP3 bytes remain available. The next keyring step must
solve opt-in account recovery before promising lifelong cross-device
access. The old v0.28 local wallet is not silently merged or traded.

### Deliberate limits

This is in-game, nontransferable, nonfinancial HUM. It cannot be traded,
converted to cash, and does not own or create rights in any recording.
Station Guilds' reviewed contribution HUM exists **in another ledger**
and must not be silently added or exchanged without authenticated,
owner-approved migration. There are no artist permissions inferred from
client signatures. CANNON selection can pin this experimental source
and independently verify behavior without requiring branch merge.

A signed phone report is **not independently verified listening**.
A user can create more than one pseudonymous device key; server
elapsed-time limits only mitigate instant minting. More comprehensive
anti-Sybil controls, privacy limits, session recovery, key rotation,
event cleanup, observability and abuse review are required before
giving HUM externally consequential value or transfers. Existing
website MP3 downloads remain free.

### Verification

- The existing live schema passed a synthetic SQL test: accumulate
  five bounded report batches to reach the 10m +3 award, spend 1 HUM
  once, repeat a song for 0 additional HUM, reject duplicate nonce,
  and check precisely two signed-ledger events.
- The synthetic test wallet was **deleted**; queried remaining test
  wallets: **0**.
- An explicit one-shot live endpoint smoke test uses an ephemeral
  WebCrypto P-256 key and **must** succeed before claiming Android
  and deployed function agree on signed request serialization.
- Source, app and tests live on HUMKIN's experimental Android PR #56;
  Android builds are not a substitute for on-phone lifecycle tests.
- First-use song-feeling crash remained after the old nested-dialog
  timing fix. v0.29 removes the extra dialog entirely, saves locally
  before any opt-in network work, and includes a private crash-note
  copier in Radio `⋯` if a device crash recurs.

No service-role secret, private device key, or real listener identity
belongs in this repository.
