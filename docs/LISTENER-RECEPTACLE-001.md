# HUMKIN Listener Receptacle 001 — Jubilee economic-layer field test

**Status: PREVIEW ONLY. No payment destinations configured and no real transaction is possible from this version.**

This is a separately addressable page at `/support.html`. It does not replace, redirect, or change the album homepage, FM station, Android app, donation accounts, or publication workflow.

## Flow and distinct states

1. A listener chooses **1¢ / 5¢ / 25¢ / $1 / $5**. This is an intention, *not an authorization*; provider minimums and fees may prevent very small payments.
2. **Make-believe coin** makes only a volatile client-side simulation. There is no local storage, analytics, database, submission, receipt, API, transaction or counter.
3. Default `support-doors.json` has `mode: "preview"`, `ownerApproved: false`, and no provider URLs. No live payment button renders.
4. A separately verified, operator-approved live manifest would open a preexisting Cash App, Venmo, or PayPal.Me profile in its own app/site. **The visitor must verify the actual recipient and enter the amount externally.** No prefilled amounts or transfer promises.
5. HUMKIN cannot infer that a click paid anything. `OPEN != DONATE`, `LINK != SETTLEMENT`, `PLEDGE != RECEIPT`.

Listening remains free; contributions are not purchases, memberships, or charitable tax receipts.

## Jubilee Treasury's existing Door Registry 012

This is deliberately a read-only adapter for the experimental source at
`the-static-collective/Jubilee-treasury`, draft PR #12 (`experiment/universal-door-registry-012`).
It verifies its existing Ed25519 signature domain, canonical JSON, event sequence, digest chain, steward key and WITHDRAW history. A source key must be **pinned independently**, never trusted because it arrived inside the registry file.

`tools/receptacle/export-jubilee.mjs` requires all of:
- A separate trusted steward public-key PEM;
- An existing valid Jubilee signed registry;
- Explicitly allowlisted, still-open door IDs whose `purposeId` is `purpose-humkin-listener-support-001`;
- Each selected door's signed `publicationRef` matching the operator's approval reference;
- Explicit `--confirm-recipient HUMKIN` after out-of-band verification of the exact Cash App/Venmo/PayPal recipient and any applicable account permissions;
- Provider URLs restricted to exact HTTPS `cash.app/$Cashtag`, `venmo.com/u/Name`, or `paypal.me/Name`. No parameters, fragments, redirects, lookalikes, embedded credentials or payment-amount tricks.

The command only exports a static manifest. It does not connect to providers or validate provider identities, taxes, recipient authority, settlement, balances or fees. Confirm the selected account's permission to accept this type of creator contribution. In particular, personal Venmo payments are not interchangeable with permitted business/charity payments.

Example (private local working directory, **not** this repository):

```sh
node tools/receptacle/export-jubilee.mjs \
  --registry /private/jubilee/registry.json \
  --pin /private/jubilee/steward-public.pem \
  --approval approval-humkin-001 \
  --door humkin-owner-approved-cashapp-001 \
  --confirm-recipient HUMKIN \
  --out /private/jubilee/humkin-support-doors.json
```

Do **not** commit private registry signing keys, provider access tokens, bank information, or actual participant records. Review and explicitly approve the manifest's *public* URLs before replacing `support-doors.json` for a future merge. A proper public release should check provider terms, fee/minimum behavior, and identities manually.

## Testing

```sh
node --test tests/receptacle.test.mjs
node --check support.js
node --check support-logic.mjs
node --check tools/receptacle/export-jubilee.mjs
```

Tests exercise intentional preview, amount selection contract, official provider URL allowlists, synthetic valid Ed25519 registry events, the pinned-key boundary, signed payload tampering, wrong approval, duplicate door, malicious signed link and withdrawal.

Field-test the static page under GitHub Pages on mobile after a successful preview deployment. This experiment must not cause a real payment without the user's independent consent inside an actual provider. Do not claim money received until independently verified with the payment processor. No ledger based on clicks.

## Next gate

After a known HUMKIN-owned or authorized provider destination has been independently confirmed and account status verified, publish only approved doors in a separate deliberate deployment. Reconcile any future *real* small payment with a provider transaction record and preserve fee/net amount, currency, reversal and source provenance. Cross-provider netting, pooling, routing, advances and automatic payouts remain **out of scope** until authorized rails and compliance obligations exist.
