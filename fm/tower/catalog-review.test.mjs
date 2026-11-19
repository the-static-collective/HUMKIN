import assert from "node:assert/strict";
import test from "node:test";
import {candidateTags,validatePack,reviewRecord,unreviewRecord,
 publicEnrichment,shortlist,normalizeTagText} from "./catalog-review.mjs";

const H="b".repeat(64);
function pack(){return {schema:"humkin.catalog.candidates/v1",tracks:[{
 mp3_sha256:H,title:"Private Story",artist:"Original",album:"Unshackled Dreams",
 source_path:"private/music/Private Story.mp3",
 suno_style:"dreamy indie folk",
 human_description:"This was written for someone I know",
 suggestions:[{tag:"genre:folk",score:3,evidence:[{source:"suno_style",term:"folk"}]},
  {tag:"mood:dreamlike",score:2,evidence:[{source:"human_description",term:"dreamy"}]}],
 approved_for_tag_publication:false,possible_family_hashes:[]}]};}
test("private descriptions and Suno prompts are absent from public export",()=>{
 const p=validatePack(pack());
 reviewRecord(p.tracks[0],"genre:folk, mood:dreamlike, genre:folk");
 const out=publicEnrichment(p);
 assert.deepEqual(out.tracks,[{mp3_sha256:H,reviewed:true,tags:["genre:folk","mood:dreamlike"]}]);
 const text=JSON.stringify(out);
 assert(!text.includes("private/music"));
 assert(!text.includes("This was written"));
 assert(!text.includes("dreamy indie folk"));
 assert(!text.includes("Private Story"));
});
test("review is opt-in; invalid tag syntax and duplicate hashes fail closed",()=>{
 const p=pack();
 assert.equal(publicEnrichment(p).tracks.length,0);
 assert.throws(()=>normalizeTagText("genre:jazz,https://evil.site/track"),/Use up to 32 tags/);
 assert.throws(()=>normalizeTagText("genre:folk;genre:funk;unknown:fake"),/Use up to 32 tags/);
 assert.deepEqual(candidateTags(p.tracks[0]),["genre:folk","mood:dreamlike"]);
 reviewRecord(p.tracks[0],"genre:folk");
 unreviewRecord(p.tracks[0]);
 assert.equal(publicEnrichment(p).tracks.length,0);
 p.tracks.push({...p.tracks[0]});
 assert.throws(()=>validatePack(p),/duplicate MP3 hash/);
});
test("search can browse thousands without changing approvals",()=>{
 const p=pack();
 p.tracks[0].suggestions.push({tag:"genre:metal",score:3});
 assert.equal(shortlist(p,"folk","all").length,1);
 assert.equal(shortlist(p,"","unreviewed").length,1);
 assert.equal(shortlist(p,"","ambiguous").length,1);
 assert.equal(shortlist(p,"","reviewed").length,0);
});
