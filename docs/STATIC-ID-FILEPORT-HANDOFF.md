# HUMKIN × STATIC ID · OAuth activation handoff (2026-11-23)

The Static Collective's [STATIC ID](https://github.com/the-static-collective/staticID) is an application-layer OIDC client. It **reuses** HUMKIN's existing Proton Authenticator enrollment and Supabase Auth user; it never copies the TOTP seed and never issues privileged database credentials to other apps.

## Verified readiness (read-only checks on Nov 23)

- The Supabase project `pantry-gate` (`kbhqacsdvjsstzyplqij`) was ACTIVE_HEALTHY.
- Deployed Edge function `humkin-proton-login` was ACTIVE; one existing owner record had completed authenticator enrollment; one verified owner user existed.
- Public JWKS `https://kbhqacsdvjsstzyplqij.supabase.co/auth/v1/.well-known/jwks.json` exposed an ES256 public signing key. **Do not rotate it** for STATIC ID.
- The consent page `https://humkin.abundent.org/oauth/consent/` was publicly reachable. Its previously radio-only copy has been made application-neutral, still requiring explicit approve/deny and showing actual requesting client/scopes/return URI.
- OAuth server discovery at `https://kbhqacsdvjsstzyplqij.supabase.co/.well-known/oauth-authorization-server/auth/v1` returned **404** and the production `auth.oauth_clients` table held **zero active clients**. Do not claim shared SSO is currently usable.
- Fileport's `/api/static-id/status` returned **503** (unconfigured) and its legacy encrypted owner-key recovery remains available.

## One-time activation sequence (do not bypass official Auth client registration)

1. At [Supabase pantry-gate](https://supabase.com/dashboard/project/kbhqacsdvjsstzyplqij/auth), open **Authentication → OAuth Server**.
2. Confirm **Authentication → URL Configuration → Site URL**. It must resolve the deployed HUMKIN consent page, e.g., `https://humkin.abundent.org`. Do not casually change existing production Site URL.
3. Enable **OAuth 2.1 server** with authorization path `/oauth/consent/`; leave dynamic client registration **off** for this first owner-only pilot.
4. Register a **confidential** OAuth application named `Static Fileport`, allowed redirect exactly `https://fileport.abundent.org/api/static-id/callback`, authorization-code + PKCE S256. Obtain client ID and server-side client secret.
5. Configure Fileport Cloudflare encrypted production settings: `STATIC_ID_CLIENT_ID`, `STATIC_ID_CLIENT_SECRET`, `STATIC_ID_OWNER_SUB` (the verified existing owner `auth.users.id` UUID), and `STATIC_ID_COOKIE_KEY` (independent 32-byte base64url key). The issuer and Fileport origin are already in Fileport `wrangler.toml`.
6. Redeploy Fileport, confirm `/api/static-id/status` answers 200 and login through the existing HUMKIN owner account. Explicitly approve **Static Fileport** at the consent page. Verify owner read/write and that another account or wrong client is refused.
7. Retain `FILEPORT_ADMIN_TOKEN` for emergency recovery; do not share or re-use it as a STATIC ID cookie key or OAuth secret.

This sequence is not a new Proton Authenticator enrollment. It is an independent OAuth client registration under the existing Supabase identity. Application authorization remains local to each app's own backend (Fileport uses Neon).

References: [Supabase OAuth Server getting started](https://supabase.com/docs/guides/auth/oauth-server/getting-started) and [STATIC ID first Fileport adapter](https://github.com/the-static-collective/staticID/blob/main/docs/FILEPORT-ADAPTER.md).
