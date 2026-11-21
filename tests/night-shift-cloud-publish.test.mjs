import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const publish = readFileSync(".github/workflows/night-shift-house-publish.yml","utf8");
const draft = readFileSync(".github/workflows/night-shift-house-draft.yml","utf8");

test("public cloud publication requires explicit owner dispatch and matching reviewed fingerprint",()=>{
  assert.match(publish,/on:\n  workflow_dispatch:/);
  assert.doesNotMatch(publish,/\n  (?:push|pull_request|schedule):/);
  assert.match(publish,/github\.ref == 'refs\/heads\/main'/);
  assert.match(publish,/inputs\.confirmation == 'PUBLISH_AUTOPILOT'/);
  assert.match(publish,/cancel-in-progress: false/);
  assert.match(publish,/^\s+contents: read$/m);
  assert.match(publish,/reviewed_fingerprint:\n[\s\S]*?required: true/);
  assert.match(publish,/selection\['fingerprint'\] != expected/);
  assert.match(publish,/HOLD: published catalog or selection differs from the reviewed draft/);
  assert.match(draft,/REVIEW FINGERPRINT/);
});
test("uses only dedicated secret-scoped R2 publishing credentials, never the Worker deployment token",()=>{
  assert.match(publish,/secrets\.HUMKIN_R2_LIVE_ACCESS_KEY_ID/);
  assert.match(publish,/secrets\.HUMKIN_R2_LIVE_SECRET_ACCESS_KEY/);
  assert.match(publish,/secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(publish,/secrets\.CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(publish,/service_role|sb_secret_|permissions:\n\s+contents: write/);
  assert.match(publish,/cloud program does not match reviewed song order/i);
});
test("previews before publishing, retaining existing private source pin / revalidation",()=>{
  const preview = publish.indexOf("--cache \"$RUNNER_TEMP/humkin-house-cache\"");
  const release = publish.indexOf("--cache \"$RUNNER_TEMP/humkin-house-cache\" --publish");
  assert(preview>0 && release>preview);
  assert.match(publish,/python tools\/radio-broadcast\/autopilot_publisher\.py/g);
  assert.match(publish,/rechecks current R2 program revision/);
  assert.match(publish,/Get|put_object|R2 program pointer VERIFIED/i);
  assert.match(publish,/timeout-minutes: 90/);
});
test("embedded Python snippets are valid Python without requiring live cloud credentials",()=>{
  const snippets=[...publish.matchAll(/          python - <<'PY'\n([\s\S]*?)          PY/g)];
  const all=[...snippets,...draft.matchAll(/          python - <<'PY'\n([\s\S]*?)          PY/g)];
  assert(snippets.length>=3,"Expected fingerprint gate, credentials gate, and post-publish verification");
  assert(all.length>=4);
  for(const [,body] of all){
    const src=body.split("\n").map(l=>l.startsWith("          ")?l.slice(10):l).join("\n");
    const checked=spawnSync("python3",["-c","import ast,sys;ast.parse(sys.stdin.read())"],
      {input:src,encoding:"utf8"});
    assert.equal(checked.status,0,checked.stderr);
  }
});
