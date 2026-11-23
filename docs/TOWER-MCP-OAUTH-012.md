# TOWER 012c · Native OAuth MCP for HUMKIN RADIO (held deployment)

## Why this path

As of 2026-11-23, Supabase's supported \`@supabase/server\` middleware and Streamable HTTP MCP Edge function let the *existing pantry-gate Supabase Auth* be the OAuth 2.1 authorization server. No separate identity system, database, or Vercel deployment is needed. It is distinct from Supabase's general project-admin MCP connector.

**Source-only PR status:** implementation is reviewable; no migration, Edge function, OAuth Auth setting, live Cloud HOUSE pointer, catalog, or recording is changed by a GitHub source commit. Only a verified endpoint + OAuth handshake can prove deployment.

## Files / contracts

- \`supabase/functions/humkin-tower-mcp/index.ts\` — owner-only **native MCP** over HTTPS, with protected-resource discovery + JWT verification via \`withOAuthProtectedResource()\` / \`withSupabase({auth:'user'})\`. Even read-only operations require verified owner, not just any signed-in pantry-gate user.
- \`supabase/functions/humkin-tower-chat/index.ts\` — reviewed smaller HTTP command gate from TOWER 012a-b. The MCP forwards the already-validated OAuth Bearer token server-to-server to the **existing JWT + Supabase RLS** command endpoint; writes run as the owner, never as service role. UUID replay/duplicate protection in same central ledger.
- \`oauth/consent/index.html\`, \`oauth/consent/consent.mjs\` — lightweight user-facing OAuth approval on the **existing GitHub Pages site**; uses current shared HUMKIN browser session storage, existing Proton Authenticator sign-in, or explicit email link. The page asks Approve/Deny, shows actual client/scope/redirect, and only redirects to the Auth-provided destination. Nothing auto-grants a connection.
- \`tests/tower-mcp-oauth.test.mjs\` and \`tests/tower-chat-bridge.test.mjs\` — regression coverage; GitHub CI invokes Node tests, Deno typecheck and existing radio suite.

Tools exposed from MCP:
\`tower_live_schedule\` (read), \`tower_search_catalog\` (read), \`tower_recent_requests\` (read), \`tower_request_control\` (one approved future request). No \`publish_now\`, no arbitrary SQL/R2 media write, no general-purpose command execution. Retain existing Crate for metadata editing and R2 ingestion.

## Exact HTTP MCP endpoint (after deployment)

\`https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-tower-mcp\`

The endpoint is NOT known to be deployed until the Supabase function list and live HTTP verify it. It cannot be connected successfully until Auth OAuth prerequisites below are complete. Do not add a pretend-live MCP URL to the current Station Desk release.

## Owner / admin setup once, **not executed by source build**

1. **Inspect the JWT signing key** on \`pantry-gate\`: Supabase Auth \`withSupabase({auth:'user'})\` requires ES256 or RS256 JWTs; if old HS256, plan a careful rotation with working site/login checks (never rotate impulsively). Current public API key type alone does not prove active user-JWT algorithm.
2. At Supabase **Authentication > URL Configuration**, verify the Auth Site URL is the deployed \`https://humkin.abundent.org\` domain. Don't casually change an existing different production Site URL: other applications in this shared project may depend on it. Alternative: host consent on that actual current Site URL if it differs.
3. At **Authentication > OAuth Server**, enable OAuth 2.1 server; authorization UI path \`/oauth/consent/\` when the Site URL is the HUMKIN origin. Enable dynamic client registration for compatible ChatGPT MCP clients only if acceptable; alternatively manually register an approved client and verify support for the chosen client flow. OAuth scopes/grants and consent remain human approved.
4. Deploy static GitHub Pages \`/oauth/consent/\` by the ordinary site pipeline, verify JavaScript loads and owner sign-in works on desktop/mobile before trying a ChatGPT OAuth redirect.
5. Review and apply only \`supabase/migrations/20261123194600_humkin_tower_chat_idempotency.sql\` on existing \`pantry-gate\`, and verify \`client_request_id\` column grants are INSERT-only and unique per owner. Old Crate still works without the column.
6. Deploy the two Edge functions \`humkin-tower-chat\` and \`humkin-tower-mcp\`. **Both** must be deployed with gateway \`verify_jwt=false\`: HTTP gate verifies the Bearer JWT for **all writes**; MCP discovery must be available without a bearer challenge intercepted by the gateway and its middleware verifies JWT for every actual tool request. Never remove the owner/auth checks. Supabase's server environment holds secrets; do not add R2/Supabase service role secrets to the plugin.
7. Verify an **unauthenticated** MCP initialize returns 401 and \`WWW-Authenticate\` metadata pointing to the project's correct \`/auth/v1\` issuer. Verify OAuth metadata and DCR/consent. As an approved owner login, confirm tools list/reads. Invalid token/another user, ineligible UUID, invalid station and malformed idempotency UUID must not record commands.
8. In ChatGPT, add the new public HTTPS URL as a connected **custom MCP app** (or update Station Desk's \`.mcp.json\` and \`mcp.json\` in a **new** release). Authorize via HUMAN owner sign-in and consent; do not paste bearer tokens into the conversation.
9. Run an approved single owner control request only once the cloud schedule and receiver state are ready. It must return \`REQUESTED\`, not \`ON AIR\`. Cloud auto-consumption and safe publishing require their OWN separate approval/aircheck.

## No-airing, no-secret boundaries

- Never use a Supabase admin SQL connector to \`INSERT\` owner requests: it could bypass RLS. This MCP delegates writes to actual signed-in owner JWT on the HTTP gate and RLS.
- No \`HUMKIN_CLOUD_LIVING_CONTROL=ENABLED\` toggling, scheduled runner dispatch, user recording publish or R2 pointer mutation without separately authorized, safe-boundary field test. Existing 32 revision / 500 positions / 10k segments block uncontrolled editing until compaction is proven.
- A successful \`REQUESTED\` row is not \`ACCEPTED\`, an \`EFFECTIVE\` schedule is not \`HEARD\`.
- The Auth Site URL is shared across the pantry-gate project; verify dependent sites before changing. DCR lets outside clients register but does not let them act as owner without owner authentication and approval. Keep consent explicit and review grants.

## Tests

\`node --test tests/tower-chat-bridge.test.mjs tests/tower-mcp-oauth.test.mjs\`

\`deno check supabase/functions/humkin-tower-chat/index.ts supabase/functions/humkin-tower-mcp/index.ts\`

Run both in CI, then verify *live* unauthorized and authorized behavior after separately approved deployment. Static source checks cannot prove that current Supabase Auth settings or Cloudflare Worker endpoints are ready.

## References (up-to-date November 2026)

- Supabase Deploy MCP servers: https://supabase.com/docs/guides/ai-tools/byo-mcp
- Supabase OAuth 2.1 server: https://supabase.com/docs/guides/auth/oauth-server/getting-started
- HUMKIN Tower 010: \`docs/TOWER-LIVING-CONTROL-010.md\`
- HUMKIN Tower 011: \`docs/TOWER-DURABLE-ASSET-SPINE-011.md\`
- Chat bridge: \`docs/TOWER-CHAT-BRIDGE-012.md\`
