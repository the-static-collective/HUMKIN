import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isHarborRelease,canRemix} from "../commons.mjs";
const src="https://media.example.org/v1/catalog.json";
const hash="a".repeat(64);
const valid={id:"sha256:"+hash,sha256:hash,title:"Synthetic video",kind:"video",
  availability:"published-cleared",asset_url:"https://media.example.org/media/"+hash+".mp4",
  rights:{status:"cleared",allow_remix:true,license_id:"CC-BY-4.0",
  license_url:"https://creativecommons.org/licenses/by/4.0/"}};
assert(isHarborRelease(valid,src),"expected valid explicit release");
assert(canRemix(valid),"expected original gate");
assert(!isHarborRelease({...valid,id:"sha256:"+"b".repeat(64)},src),"wrong digest");
assert(!isHarborRelease({...valid,sha256:hash.slice(1)},src),"short digest");
assert(!isHarborRelease({...valid,asset_url:"http://media.example.org/media/"+hash+".mp4"},src),"insecure media URL");
assert(!isHarborRelease({...valid,asset_url:"https://foreign.example/media/"+hash+".mp4"},src),"cross-site media URL");
assert(!isHarborRelease({...valid,asset_url:"https://media.example.org/media/"+hash+".html"},src),"unsafe media type");
assert(!isHarborRelease({...valid,rights:{...valid.rights,status:"review_required"}},src),"unreviewed rights");
assert(!isHarborRelease({...valid,rights:{...valid.rights,license_url:"https://example.org/license"}},src),"wrong license URL");
assert(!isHarborRelease({...valid,availability:"public-preview"},src),"mere public preview");
assert(!isHarborRelease(valid,"http://media.example.org/v1/catalog.json"),"HTTP source");
const settings=JSON.parse(readFileSync("commons/sources.json","utf8"));
assert.deepEqual(settings.remote_catalogs,[],"the owner must explicitly configure a real server URL");
assert(readFileSync("commons.html","utf8").includes('id="harbor-state"'));
console.log("HUMKIN external harbor source checks passed (zero home-server endpoints exposed).");
