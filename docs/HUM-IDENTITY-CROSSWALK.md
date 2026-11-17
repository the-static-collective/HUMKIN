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
6. **CANNON CANON FIELD (CANNON PR #2 experimental branch, #4 crossing,
   #5 present-use and #92 independent MOTIF branch-native selection)**:
   `MAIN != CANON`; exact source Git commits on **unmerged experimental
   branches are eligible for scoped owner selection, verification, reuse
   and adapter testing**. Git branch status is not a capability score or a
   default rejection. Pin repository, full commit SHA, original source bytes,
   allowed scope, and evidence of passing tests. Selection can be promoted
   or superseded without merging the source repository's main branch.
   However `TESTED != SELECTED` and `SELECTION != EXECUTION`: publishing
   signed selection does not install a backend, connect accounts or confer
   spend authority. Receiver ownership and production deployment remain
   explicit gates.
7. **Jubilee Treasury experimental accounting (007 signed asset ledger,
   PENNY-014 conserved work/physical custody model)**:
   exact signed, hash-linked, replayable events; quantities and reservations;
   refusal of duplicate claims and impossible double allocation. These
   **working experimental branches** supply eligible original-source modules
   for a CANNON-scoped HUMKIN adapter. The HUM wallet should borrow only
   bounded event-accounting and conservation, not imply that in-game HUM is
   physical PENNY, cash, external legal ownership or a real financial token.

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

## Automatic earn and invisible keyring (accepted UX target)

**No buttons to claim listening HUM.** Listeners participate by listening,
not by operating a wallet. The goal is Ethereum-like *deterministic triggers*
without requiring a blockchain, gas fees, transaction prompts or a crypto
account. A single small, short-lived on-screen flourish says `+3 HUM`
when the authoritative award is first confirmed; `+1 HUM` on later
milestones. The icon moves up/fades out near the radio dial in ~0.7s,
with accessibility announcement and reduced-motion fallback. Never interrupt
audio or show a modal. An off-screen award simply updates the balance; don't
stack celebratory banners or repeatedly replay old awards on reopening.

**Initial schedule (per America/Chicago broadcast day):** 10 distinct minutes
of qualified audible playback -> +3, 30 -> +1, 50 -> +1, 80 -> +1;
maximum **6 HUM/day** from these ordinary listening thresholds. Track
cumulative qualified playback, not the number of times a song is started.
The listener's station and library remain usable without opening a wallet.
Do not silently award HUM for elapsed clock time or off-air/background
silence. These are proposed grant rates until the actual server ledger
is connected and tested.

**The automatic transaction** should be one idempotent backend action,
keyed by `(listener-account, broadcast-day, milestone)`, validating
eligibility and atomically incrementing the HUM balance exactly once.
Never create spendable server-backed HUM from client-edited counters.
A client can show pending offline progress but must not flash a *confirmed*
coin or inflate the authoritative balance until the grant is accepted.
If a reward arrives late, show at most one unobtrusive receipt, not a backlog
of animations. Abuse controls must not involve invasive human surveillance
or claims that device signatures alone prove a distinct human/listen event.

**Keyring wraps the wallet, without UI ceremony.** An optional device-bound
key in Android Keystore establishes session continuity after a one-time
enrollment. Keyring stores/accesses that capability; the HUM balance and
issuance history are server-owned. In everyday use no passphrase, browser
keyring or signature prompt appears. Offer an explicit recovery/second-device
path before relying on a nonexportable device key alone. Reuse WebZ's
encrypted-link transport concepts later for invitations and artist doors;
do **not** import its browser IndexedDB blob and call it a native signed
login. Artist contributions can add bounded signed declarations and human
review when materially necessary.

**What makes a coin legitimate:** the wallet must be able to immediately
redeem it for an actual, DRM-free `My Records` collection action (normally
1 HUM/song, 2/current single), and the user must be able to redownload
previously collected music without spending again. No pretend spending
currency may replace the real feature. Until redemption and authoritative
earning exist, prototype the animation only as a *nonspendable preview*
in developer field tests, never imply public HUM has been issued.

**CANNON flip boundary:** select and verify a pinned source commit and its
adapter; conduct reproducible source-owner tests, adapter tests, exact
receiver permissions and real build QA; finally enable the *feature flag*.
Do not make `feature_enabled=true` a bypass for missing wallet authority,
anti-replay, collection entitlements or artist rights. Production activation
can be quick once these conditions are satisfied, regardless of whether
the selected source originally lived on an experimental branch.

## Safe build order

1. **Now**: enforce Antenna-first static control; retain all existing earned
   local progress and no extra menu clutter.
2. **Next**: build native `My Records`, its DRM-free MediaStore MP3 lifecycle
   and ordinary song entitlement rules; integrate with verified-HUM rewards
   rather than offering cosmetic coins that cannot purchase anything.
3. **Before live HUM credit or debit**: build optional device/key enrollment,
   an idempotent server-side HUM grant-and-spend ledger and independently
   replayable, source-pinned Jubilee/CANNON accounting tests. Add the
   half-second UI coin flourish only after an actual award succeeds.
4. **For submissions**: reuse signed witness/receipt concepts with rights
   review, not draft owner-delegation authority or forced government ID.
5. **Later**: wallet link handoff for station rooms and shareable collection
   invitations. Reuse the existing Link Wallet as a keyring **not** as a bank.

No actual user grant, secret, private signing key or bearer pass is stored in
this document. Nothing here authorizes ledger minting, spending, artist
licensing, asset transfer or automatic on-air release.
