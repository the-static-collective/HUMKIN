# HUMKIN INTEGRATION TRAIN 002 — TOWER and Vinyl Council

**Staging only.** Based on `integration/radio-signal-train-20261118` at commit `4d82457256d240e0bacead1f248bc23eb4a9d34e`; overlays the exact changed-file blobs from [HUMKIN #145](https://github.com/the-static-collective/HUMKIN/pull/145), source SHA `e8b6f079b7626f6326a607d78bc941e1437f6221`. This does not merge, close or deploy the source PR.

## Composition

- TOWER virtual stations and source-owned Counterpoint relationships.
- Owner-oriented record constellation/catalog enrichment and candidate metadata.
- Feedback and Vinyl Council proposals with the source PR's separate review/consent gates.
- The source PR's Cloudflare Worker virtual routes, contracts, test files and validation workflow.
- Station Manager integration: **preserve** SIGNAL RELAY's owner-only panel and place a separate TOWER link under the production room. No overwrite of SIGNAL's edited manager page.

## Explicitly held

- [#133](https://github.com/the-static-collective/HUMKIN/pull/133) HLS and R2 live push: separate Worker route compatibility, dedicated R2 bucket, bindings, Acer verification and fallback tests are still unresolved. No live HLS files were grafted into this branch.
- [#95](https://github.com/the-static-collective/HUMKIN/pull/95) Blue Lemon broadcaster: operator-side encoder selection remains an independent test.
- [#135](https://github.com/the-static-collective/HUMKIN/pull/135) Living Relay: human rights/withdrawal and real-world fulfillment require a distinct admission review.
- No vinyl manufacturing, rights transfer, public contact, money handling, token rewards, content licensing or broadcast automation was authorized by compiling this staging tree.

## Acceptance gates

1. This stacked PR must pass the integrated site workflow **and** the source-long-wave-worker workflow on its own head SHA.
2. Manually test signed-out / signed-in Station Manager and verify both Signal Relay and Tower entry points are visible only as their existing permissions allow.
3. Test a 20-track signal path: published recording in Compost → listener feedback → owner HELD suggestion → paused show draft → explicit save/enable decision (no automatic effects).
4. Test Tower virtual station contracts against invalid ancestry, cyclic dependencies, disabled parents, absent catalog and independent session handling.
5. Re-test Station One, fallback receiver chain and current published audio without assuming an Acer stream was present during CI.
6. Recheck consent and credits: chart reactions do not become verified votes, listener responses are not proof of distinct humans, and a vinyl nomination is not a licensing/pressing authorization.
7. Review Cloudflare Worker route compatibility and any planned binding changes before considering the source or integration PR for production.

**Rollback:** leave stacked draft PR unmerged. A field-verified main merge needs a separate human-reviewed promotion decision; no test fixture is a real-world broadcast receipt.
