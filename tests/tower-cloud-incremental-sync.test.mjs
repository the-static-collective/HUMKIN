import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const workflow=readFileSync(".github/workflows/tower-cloud-incremental-sync.yml","utf8");
const source=readFileSync("tools/radio-broadcast/cloud_house_sync.py","utf8");

test("automatic Cloud HOUSE refresh is disabled unless explicitly opted in",()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/  schedule:/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/vars\.HUMKIN_CLOUD_AUTOPUBLISH == 'ENABLED'/);
 assert.match(workflow,/inputs\.confirmation == 'SYNC_APPROVED_CATALOG'/);
 assert.match(workflow,/default: HOLD/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/group: humkin-reviewed-cloud-house-station-one/);
 assert.doesNotMatch(workflow,/\n  (?:push|pull_request):/);
});
test("dedicated live-bucket credentials only; no tokens in public UI",()=>{
 assert.match(workflow,/HUMKIN_R2_LIVE_ACCESS_KEY_ID/);
 assert.match(workflow,/HUMKIN_R2_LIVE_SECRET_ACCESS_KEY/);
 assert.match(workflow,/CLOUDFLARE_ACCOUNT_ID/);
 assert.match(workflow,/permissions:\n  contents: read/);
 assert.doesNotMatch(workflow,/CLOUDFLARE_API_TOKEN|service_role|sb_secret_|contents: write/);
 assert.match(source,/validate_selection\(chosen, latest\)/);
 assert.match(source,/publish_program\(program, Path\(cache\), client/);
 assert.match(source,/prepare_delta/);
 assert.match(source,/needs_refresh/);
 assert.match(source,/if old and len\(old\["revisions"\]\) >= 32/);
});
test("auto-sync never modifies the protected owner-fingerprint workflow",()=>{
 const old=readFileSync(".github/workflows/night-shift-house-publish.yml","utf8");
 assert.match(old,/reviewed_fingerprint:/);
 assert.match(old,/inputs\.confirmation == 'PUBLISH_AUTOPILOT'/);
 assert.doesNotMatch(old,/\n  schedule:/);
});
