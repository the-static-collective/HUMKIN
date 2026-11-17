# HUMKIN ORCHARD NETWORK 004 + LIVE RELAY 005
Source-owned implementation notes · November 16, 2026

## Shipped architecture

The existing pantry-gate Supabase project now has an independent, private HUMKIN Orchard service with P-256 browser identities, server-hosted opt-in public homes, signed presence, server-issued collectible IDs, and atomic two-party artifact transfers.

- Browser identity: a new nonextractable P-256 private key is held in IndexedDB. Every mutation is signed with nonce and timestamp; the backend verifies signatures against the stored public key. Browser identity does not prove that two accounts represent two separate humans.
- HOME: explicit consent publishes a sanitized room name, stage, local object type IDs and minutes summary. Decorations and minutes are self-reported, not certified achievements. Supabase stores and serves the published snapshot when the phone is absent.
- Presence: a signed heartbeat expires after 120 seconds. Presence alone does not mint rewards.
- Live foreground relay: an explicitly opted-in browser can answer a different listener's fresh-home request. The server relays a short-lived task; the first browser signs a current sanitized snapshot; the other listener receives it. This is real service over the network, but not directly served from the phone's public HTTP port, and not background Android uptime.
- Network collectibles: two ordinary starter objects at enrollment; one Relay Leaf for a daily server-checked station catalog audit; a Porch Bell upon first fulfilled live service. Serial numbers identify server-issued historical objects, not economic scarcity or an investment.
- Trading: owner signs a one-day offer for a specific artifact and recipient; recipient signs acceptance. Postgres transactions lock the artifact and offer, verify ownership and transfer once. The immutable issued_to remains tied to the original issuer even when current owner changes.
- GHoT-shaped work: radio.catalog.audit.v1 reads a bounded public radio manifest and computes a digest that the server independently compares. This produces a truthful catalog-agreement receipt; it does not prove unique CPU labor or run the native GHoT daemon.
- Top 42 / Station Guilds: both real features are linked and displayed in the living network. Top 42 chart listens, guild-approved contribution credits and local HUM are deliberately separate ledgers.

## Security and deployment

The network schema has RLS enabled and no anonymous or authenticated table policies; access is through a dedicated Edge Function with a service key never exposed to browsers. Signed requests use short-lived timestamps and replay-denied nonces. No client may mint a canonical artifact or transfer one without the recipient's signed acceptance. Live requests expire after two minutes, require an opted-in public home, and contain only sanitized public room data. Serving requires a visible browser with explicit opt-in, not a hidden background task.

The public test harness runs two independent synthetic P-256 listeners, checks 401 for bad signature, 409 for replay, 404 for private home, real server-owned trade acceptance and nonrepeatability, and a verified catalog check. The extended relay test requests, serves, verifies, and then withdraws its temporary public test room. Live tests are separate from physical Android device validation.

## Important limitations

- Local web HUM, local Android Signal/HUM, chart plays and approved Guild HUM are not fungible or synchronized. They are different measurements, not an exchangeable token.
- A signing key in the current browser has no portability or recovery yet. Clearing browser storage can strand network objects; do not rely on this for valuable ownership.
- Anyone can create more than one identity; registration and task limits reduce casual abuse but do not confer proof of personhood.
- A heartbeat is proof of signed contact, not proof of stake, continuous hosting, or any financial return.
- A served live snapshot is a genuine bounded device-to-relay-to-visitor crossing, but not direct P2P hosting.
- A passing GitHub workflow is not a field-trial report. Real two-phone confirmation remains important.
- No cash value, blockchain, crypto mining, speculative yield or externally redeemed assets.

## Entrances

Radio: /fm/
Top 42: /fm/top42/
Station Guilds: /fm/participate/
Local listening RPG: /fm/orchard/
Opt-in network world: /fm/orchard/network.html

Database schema: supabase/orchard-network-004.sql and supabase/orchard-live-005.sql
Backend: supabase/functions/humkin-orchard-network/index.ts
Live test: tests/orchard-network.smoke.mjs

A future full native GHoT/reLATTE task dispatcher remains distinct from this volunteer browser relay. Preserve OFFER, ASSIGNMENT, EXECUTION and RECEIPT as separate events.
