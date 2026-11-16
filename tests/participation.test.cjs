const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
test("Participation Engine has a usable phone-first submission and private receipt surface",()=>{
 const page=read("fm/participate/index.html"),script=read("fm/participate/desk.js");
 for(const id of ["mission-grid","submission-form","social-platform","social-handle",
  "work-file","work-disclosure","work-rights","work-link","earned-hum","pending-hum",
  "backup-pass","restore-pass","my-work"])
   assert.ok(page.includes('id="'+id+'"'),"Missing interactive field "+id);
 for(const action of ['action:"submit"','action:"finalize"','action:"withdraw"'])
   assert.ok(script.includes(action),"Missing workflow "+action);
 assert.ok(script.includes("uploadToSignedUrl"),"Original video/audio must upload directly to private Storage");
 assert.ok(script.includes("PARTICIPATION")||script.includes("participation"),"Shareable pass and state must be explicit");
});
test("Server keeps reviewed HUM separate from local Orchard HUM and cannot self-mint",()=>{
 const edge=read("fm/participate/edge-function.ts");
 assert.match(edge,/humkin_contrib_review/);
 assert.match(edge,/await authOwner\(req\)/);
 assert.match(edge,/createSignedUploadUrl/);
 assert.match(edge,/awaiting_upload/);
 assert.match(edge,/state:"pending_review"/);
 assert.match(edge,/rights_checked/);
 assert.ok(!edge.includes('db.from("humkin_contribution_rewards").insert('),
   "No direct reward inserts on anonymous path");
 const orchard=read("fm/orchard/model.js");
 assert.match(orchard,/A room of your own/);
 assert.match(orchard,/The Street Team/);
 assert.match(orchard,/The Picture Department/);
});
test("Review is private and site navigation points to real workbench",()=>{
 const html=read("fm/participate/review.html"),review=read("fm/participate/review.js");
 assert.ok(html.includes('noindex,nofollow'));
 assert.ok(review.includes("getSession"));
 assert.ok(review.includes('action:"review"'));
 assert.ok(read("fm/manage/index.html").includes("participate/review.html"));
 assert.ok(read("fm/index.html").includes('href="./participate/"'));
 assert.ok(read("fm/orchard/index.html").includes('href="../participate/"'));
 assert.ok(read("sw.js").includes("./fm/participate/desk.js"));
});
