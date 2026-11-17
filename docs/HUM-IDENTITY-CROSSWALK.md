# HUMKIN · HUM earning, portable identity and the WebZ Link Wallet

Status: **design crosswalk, not a deployed HUM purchasing wallet**.
Source inspection: 2026-11-17. This note intentionally separates mechanisms
already in code from proposed shared-account capabilities.

## What exists

1. **Android local Outpost (`SignalRpg.java`, `SignalMath.java`)**:
   Media3 counted audible time accumulates XP and capacitor Signal. Collecting
   moves Signal into a local upgrade wallet. Rewards never make public chart
   plays. Antenna tier 1 now unlocks radio static controls. These local values
   are *not* spendable, server-backed HUM and not transferable.
2. **HUMKIN Station Guilds (`fm/participate/`)**:
   A private station contribution queue, owner-reviewed rewards, and a
   server-backed **nontransferable verified-HUM ledger** keyed to a pseudonymous
   participation pass (random UUID in localStorage, recoverable via explicit
   pass export). It is not yet an authentication system for native app earning
   or an all-purpose HUM wallet. Possession of a copied pass can impersonate
   its bearer; this proves neither authorship nor singular human personhood.
3. **WebZ Link Wallet 001/002 (webZ merged PRs #171/#172)**:
   encrypted local IndexedDB *bookmark/keyring* for permission/invitation URLs,
   with opt-in one-tap same-origin handoff. Not a coin balance, identity
   verifier, ledger, or cross-domain session. Useful for keeping project invites,
   contribution receipts and station doors accessible.
4. **WebZ Link Wallet 003 (webZ PR #233, draft, not deployed)**:
   a proposal-only owner desk validates public WF008 P-256 signed delegations,
   local HOLD/REFUSE and revocation; does not identify a physical person, admit
   remote permissions, move money, or authenticate HUMKIN spending.
5. **Human Witness and reLATTE DID binding (Human-Witness PR #1 merged;
   reLATTE PR #31 draft)**:
   human-encounter evidence and portable signed-key relationships, not
   independently verified human identity or a live audience login.
   A signature proves key control over signed bytes, not music rights, honest
   listening, unique human existence, or a legal identity.

## Recommended clean joining points

### A. Every listener (no login required)

- Keep listening, XP, basic offline library and DRM-free downloads usable
  without identity proof. Initial proposed earn schedule: 3 HUM after
  10 qualified minutes, +1 at 30, +1 at 50, +1 at 80 minutes daily.
  These numbers are **design targets, not production credits**.
- Separate **Capacitor charge / Signal**, **XP**, and a **HUM spending balance**;
  do not accidentally relabel old local upgrade Signal as server-issued HUM.
- Offer 1 HUM per managed song, 2 HUM for a new single as a convenience
  mechanism, not for rights to free files already distributed elsewhere.
  Never DRM-lock the MP3 or make redemption necessary to obtain an existing
  free download elsewhere.

### B. Portable collecting and controlled spending (optional account)

- A lightweight, opt-in pseudonymous identity can bind a device signer and an
  explicit recovery method to a server-side account. Sign a server nonce,
  *then* issue a short-lived session. Android Keystore non-exportable private
  keys improve local handling but do not establish personhood.
- Server records capped daily rewards and debits using atomic, idempotent
  transactions and unique (account, grant day, threshold) keys. Service-side
  accounting is necessary before transfer, redemption across devices or
  externally consequential uses. Untrusted local counters cannot manufacture
  shared balances.
- Maintain a persistent library entitlement/collection separate from the
  local MP3 bytes. Same song is not charged again after deleting a local file.
  DRM-free local media is never expired or secretly removed when a wallet
  session changes. Account deletion and export must be understandable.
- Multi-device synchronization and account recovery remain optional. A local
  account can continue enjoying unlocked media without a server response;
  recognize that server-side anti-abuse cannot prove acoustic listening with
  cryptographic signatures alone.

### C. Artist submissions (additional evidence, not mandatory listeners' KYC)

- Accept a signed **submission receipt** binding author-controlled key,
  canonical content hash, declared title, creator/rights-holder claims,
  permission scope, and submission timestamp. Original uploaded media remains
  private until reviewed. Consent and revocation are separately recorded.
- Owner review evaluates evidence, rights/credits, duplicate material and
  acceptance. **KEY != HUMAN**, **SIGNATURE != AUTHORSHIP**, **SUBMISSION !=
  AIRPLAY**, **WALLET LINK != PERMISSION**, **REVIEW != PAYMENT**.
- Keep an audit trail between accepted contribution receipt and server-side
  verified HUM grant. Migrating the existing participation pass to a new
  identity must require control of that pass and explicit user action;
  never silently replace or expose it.

## Safe build order

1. **Now**: enforce Antenna-first static control; retain all existing earned
   local progress and no extra menu clutter.
2. **Next**: implement native `My Records` and offline MediaStore MP3 handling,
   then simple local gameplay HUM display with clear *local* scope, if desired.
3. **Before cross-device spending**: add anonymous/pseudonymous account binding,
   an idempotent server HUM ledger and opt-in encrypted/recoverable keys.
4. **For submissions**: reuse signed witness/receipt concepts with rights
   review, not draft owner-delegation authority or forced government ID.
5. **Later**: wallet link handoff for station rooms and shareable collection
   invitations. Reuse the existing Link Wallet as a keyring **not** as a bank.

No actual user grant, secret, private signing key or bearer pass is stored in
this document. Nothing here authorizes ledger minting, spending, artist
licensing, asset transfer or automatic on-air release.
