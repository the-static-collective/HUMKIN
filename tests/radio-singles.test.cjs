const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const read=path=>readFileSync(path,"utf8");
const html=read("fm/load/index.html"),loader=read("fm/load/loader.js");
const player=read("fm/radio.js"),manager=read("fm/manage/manager.js");
const managerPage=read("fm/manage/index.html");
assert(loader.includes('["single","OFFICIAL SINGLE ✳"]'),"Uploader must expose singles explicitly");
assert(loader.includes('is_single:item.kind==="single"'),"Uploader must persist single designation");
assert(loader.includes('kind:item.kind==="bumper"?"bumper":"song"'),"Single must stay a playable song, not a new bumper kind");
assert(loader.includes('enabled:item.kind!=="bumper"'),"Single must not be treated as bumper");
assert(loader.includes('row.is_single?"SINGLE ✳'),"Private review list must distinguish singles");
assert(loader.includes('row.kind!=="bumper"'),"Bulk publishing must still exclude bumpers");
assert(html.includes("OFFICIAL SINGLE"),"Uploader copy must explain singles");
assert(player.includes("kind,is_single,enabled"),"Public cloud fetch must retrieve single status");
assert(player.includes('song.source==="cloud"&&song.kind!=="bumper"&&song.is_single===true'),
  "Only owner-designated cloud music, never bumpers, gets extra featured slots");
assert(manager.includes('fields.is_single=fields.kind==="song"&&$("edit-single").checked'),
 "Owner should be able to correct single designation without re-uploading");
assert(managerPage.includes('id="edit-single"'),"Manager must include single toggle");
console.log("Single designation, private stage, release weighting and editing guards OK");
