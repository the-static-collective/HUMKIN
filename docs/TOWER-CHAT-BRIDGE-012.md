# TOWER 012a-b — Chat bridge ingress (reviewable source, no broadcast activation)

## Scope and state

This is an **authenticated HTTP bridge candidate**, not a plugged-in ChatGPT MCP server and not a live program publisher. Deployment and an OAuth/ChatGPT tool connection are additional steps. Creating, testing, or merging this source does not change an R2 program pointer, turn on GitHub Actions autoplays, or broadcast any audio.

Source:
- \`supabase/functions/humkin-tower-chat/contracts.mjs\` — bounded command grammar, public-safe catalog and Worker projection, status classification.
- \`supabase/functions/humkin-tower-chat/index.ts\` — read-only source-grounded status/catalog/intent operations, authenticated owner command request; no R2 keys or media uploads.
- \`supabase/migrations/20261123194600_humkin_tower_chat_idempotency.sql\` — optional UUID column and unique per-owner key. Existing Crate inserts without a key remain accepted.
- \`tests/tower-chat-bridge.test.mjs\` — pure offline acceptance tests.

## API (POST JSON)

\`{ "action": "status", "station_id": "station-one" }\` reads the **deployed Worker** public schedule, not a static JSON fixture. Worker not available => fail closed.

\`{ "action": "catalog", "station_id": "station-one", "query": "blue" }\` reads only eligible published/enabled R2 rows via the Supabase **anon/RLS** role; returns stable IDs and metadata, no private keys or hash URLs.

\`{ "action": "intents", "station_id": "station-one" }\` reads the public-safe last 12 intents; joins Cloud Worker cursors only for REQUESTED/ACCEPTED/EFFECTIVE schedule labels. No HEARD assertion.

\`{ "action": "control_request", "station_id": "station-one", "track_id": "<UUID>", "command": "queue_next", "request_id": "<new UUID>" }\`
requires an actual **Supabase owner JWT** in the Authorization Bearer header. The Edge function verifies that account against Auth (email-confirmed owner), rechecks the exact approved track via that JWT and submits with the exact same owner-scoped JWT to PostgREST/RLS, not with service-role. The server-held service key is used only for owner-checked idempotency lookups / rate limiting. Duplicate UUID replays return the original ID, or 409 if the key is reused for a different command. Only existing queue-next/end, hold/release, more/less are supported. No arbitrary URLs or on-air pointer operations.

Each successful new intent returns **REQUESTED** and a sequence number; a protected Cloud HOUSE publisher must independently accept and make it effective at a future safe boundary. Retrying a previously accepted \`request_id\` does not repeat the command. Metadata edits, exact-order feature publication, private R2 audio uploads and direct stream control remain **unimplemented** in this slice.

## Deployment gates (still HOLD)

1. Run \`node --test tests/tower-chat-bridge.test.mjs\` plus existing TOWER 010, cloud-revision and R2 validation tests. Review CI and auth/RLS boundaries. Check Supabase changelog and current deployment docs before executing migration.
2. Apply the idempotency migration to the **existing** \`pantry-gate\` Supabase project, not another project's database; inspect grants/index and verify old Crate owner writes still work. No intent rows should be inserted by migration.
3. Deploy \`humkin-tower-chat\` to this existing project. Ensure standard Supabase env vars \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\` are server-held. This should be \`verify_jwt=false\` at the edge gateway **only because the handler explicitly validates the owner JWT** for every write; do not allow public write actions on other paths.
4. Test public status and catalog reads; an unavailable Cloudflare schedule must return UNVERIFIED, not a fabricated on-air title.
5. Test a fake/bad JWT, another account, a revoked track, an ineligible bumper/weight, duplicate UUID and an invalid station; assert all fail without creating an intent. Use a single approved owner test intent only with explicit on-air-scheduling authorization.
6. To operate from inside ChatGPT, build/configure a **separate OAuth-protected remote MCP connector** that passes the authenticated principal's Supabase access token to this endpoint. The existing skill-only Station Desk plugin does not automatically call new HTTP endpoints. Never paste access/refresh tokens into chat or plugin descriptions. Registration/authorization will require the owner to approve the connector.
7. **Do not enable** \`HUMKIN_CLOUD_LIVING_CONTROL=ENABLED\`, publish media or change \`/fm/\` until updated Worker deployment, HLS revision compaction and Acer-off phone aircheck validate the full chain. Existing current HLS limits are 32 revisions, 500 items and 10k segments.

## Rollback

No listener route or cloud R2 pointer changes in this PR. Un-deploy the Edge function to remove the HTTP surface. The optional \`client_request_id\` column can remain unused (safer than dropping it on a live service); Crate's preexisting requests continue without a key. Never delete recorded command rows or treat a 503 as confirmation that no write occurred; retry by original \`request_id\`.

## Source of truth

Repo \`docs/TOWER-LIVING-CONTROL-010.md\`, \`docs/TOWER-DURABLE-ASSET-SPINE-011.md\`, \`fm/load/living-control.mjs\`, \`tools/radio-broadcast/cloudflare/cloud-autopilot.mjs\`. Station Desk v0.4.0 is an orchestration plugin, not yet a remote MCP connection.
