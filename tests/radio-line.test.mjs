import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
import {createHmac,webcrypto} from "node:crypto";
const read=p=>readFileSync(p,"utf8");
const source=read("tools/humkin-line/index.ts");
new Script(source);
let route;
const env={};
const endpoint="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-radio-line";
const sid=x=>x+x[0]+ "0".repeat(32); // overridden below with real Twilio SID lengths
const acct="AC"+"a".repeat(32);
const call="CA"+"b".repeat(32);
const message="SM"+"c".repeat(32);
const recording="RE"+"d".repeat(32);
const owner="eeeeeeee-0000-4000-8000-eeeeeeeeeeee";
const consentRows=[];
const saved=[];
const fakeFetch=async (resource,opts={})=>{
 const url=String(resource);
 if(!url.includes("/rest/v1/"))throw Error("No external upstream expected: "+url);
 if(url.includes("humkin_radio_settings"))return Response.json([{owner_id:owner}]);
 if(url.includes("humkin_radio_line_call_consents")){
  if(opts.method==="GET")return Response.json([{owner_id:owner,caller_tag:"a".repeat(16),topic:"song"}]);
  if(opts.method==="POST")consentRows.push(JSON.parse(opts.body));
  return Response.json([]);
 }
 if(url.includes("humkin_radio_line_inbox")){
  if(opts.method==="GET")return Response.json([]);
  saved.push(JSON.parse(opts.body));
  return Response.json([]);
 }
 throw Error("Unexpected REST endpoint "+url);
};
const ctx={Deno:{env:{get:k=>env[k]||""},serve:fn=>route=fn},
 TextEncoder,crypto:webcrypto,Response,Request,URL,URLSearchParams,Uint8Array,
 atob,fetch:fakeFetch,AbortSignal,Date,console,setTimeout,clearTimeout};
runInNewContext(source,ctx);
assert.equal(typeof route,"function");
async function request(path,fields={},signed=false){
 const content=new URLSearchParams(fields).toString();
 const url=endpoint+path;
 const headers={"content-type":"application/x-www-form-urlencoded"};
 if(signed){
  const sorted=new URLSearchParams(content);
  const canonical=[...new Set(sorted.keys())].sort().reduce((str,key)=>{
   for(const value of sorted.getAll(key))str+=key+value;return str;
  },url);
  headers["X-Twilio-Signature"]=createHmac("sha1",env.TWILIO_AUTH_TOKEN).update(canonical).digest("base64");
 }
 return route(new Request(url,{method:"POST",headers,body:content}));
}
let resp=await route(new Request(endpoint+"/health"));
let health=await resp.json();
assert.equal(health.ready,false,"Line must be disabled with no number or secrets");
assert.equal(health.ai_host_connected,false,"Not the existing private Lumi AI line");
resp=await request("/voice",{});
assert.equal(resp.status,503,"Disabled line rejects call even if unsigned");
Object.assign(env,{
 HUMKIN_LINE_ENABLE:"true",TWILIO_AUTH_TOKEN:"private-test-token",
 TWILIO_ACCOUNT_SID:acct,HUMKIN_LINE_NUMBER:"+15075550123",
 HUMKIN_LINE_CALLER_PEPPER:"private-radio-caller-pepper-12345",
 SUPABASE_URL:"https://kbhqacsdvjsstzyplqij.supabase.co",
 SUPABASE_SERVICE_ROLE_KEY:"test-only"
});
health=await (await route(new Request(endpoint+"/health"))).json();
assert.equal(health.ready,true,"All keys and explicit switch should make test instance ready");
const standard={AccountSid:acct,CallSid:call,From:"+15075550987",To:env.HUMKIN_LINE_NUMBER};
resp=await request("/voice",standard,false);
assert.equal(resp.status,401,"Unsigned Twilio call must be rejected");
resp=await request("/voice",standard,true);
let xml=await resp.text();
assert(xml.includes("not a live broadcast")||xml.includes("not a live broadcast".replace(/ /g,"")));
assert(xml.includes("Press one")&&xml.includes("Press two"));
assert(!xml.includes("<Record"),"No recording before explicit consent");
resp=await request("/choose",{...standard,Digits:"1"},true);
xml=await resp.text();
assert(xml.includes("consent?topic=song"));
assert(!xml.includes("<Record"),"Choosing song doesn't grant recording consent");
resp=await request("/consent?topic=song",{...standard,Digits:"2"},true);
assert(!(await resp.text()).includes("<Record"),"Declining consent must never record");
resp=await request("/consent?topic=song",{...standard,Digits:"1"},true);
xml=await resp.text();
assert(xml.includes("<Record")&&xml.includes('maxLength="90"'));
assert.equal(consentRows.length,1);
assert.equal(consentRows[0].call_sid,call);
assert.equal(consentRows[0].topic,"song");
assert.equal(consentRows[0].caller_tag.length,16);
assert(!JSON.stringify(consentRows[0]).includes(standard.From),"No raw caller number in consent DB");
resp=await request("/recording",{
 AccountSid:acct,CallSid:call,RecordingSid:recording,
 RecordingStatus:"completed",RecordingDuration:"18"
},true);
assert.equal(resp.status,200);
assert.equal(saved.length,1);
assert.equal(saved[0].transport,"voicemail");
assert.equal(saved[0].recording_sid,recording);
assert.equal(saved[0].permission_to_broadcast,false);
resp=await request("/sms",{
 AccountSid:acct,MessageSid:message,From:standard.From,To:standard.To,
 Body:"SONG: Please play HaileyLu Bloom"
},true);
assert.equal(resp.status,200);
assert(!(await resp.text()).includes("<Message"),"No outbound SMS or paid AI response");
assert.equal(saved.length,2);
assert.equal(saved[1].topic,"song");
assert.equal(saved[1].body,"SONG: Please play HaileyLu Bloom");
assert.equal(saved[1].permission_to_broadcast,false);
assert.equal(saved[1].caller_tag.length,16);
assert(!JSON.stringify(saved[1]).includes(standard.From),"No raw caller number stored");
resp=await request("/sms",{
 AccountSid:acct,MessageSid:"SM"+"e".repeat(32),
 From:standard.From,To:standard.To,Body:"STOP"
},true);
assert.equal(saved.length,2,"STOP must not become a radio request");
assert.equal(resp.status,200);
const config=JSON.parse(read("fm/line/config.json"));
assert.equal(config.number,null,"No pretend line number published");
assert.equal(config.state,"not_provisioned");
const ui=read("fm/line/index.html"),client=read("fm/line/line.js"),
 admin=read("fm/line/manage/inbox.js"),adminPage=read("fm/line/manage/index.html");
assert(ui.includes('id="state"')&&ui.includes('id="phone"'));
assert(client.includes("health?.ready===true"),"Public dial button requires actual live gateway");
assert(admin.includes("account?.email?.toLowerCase()!==OWNER"));
assert(admin.includes('db.from("humkin_radio_line_inbox")'));
assert(admin.includes("confirm this message ACTUALLY AIRED".toUpperCase())||admin.includes("ACTUALLY AIRED"),
 "Producer must confirm a true broadcast");
assert(adminPage.includes('id="inbox"'));
assert(read("fm/index.html").includes('href="./line/"'));
assert(read("fm/studio/index.html").includes('href="../line/manage/"'));
assert(read("sw.js").includes('"./fm/line/manage/inbox.js"'));
console.log("HUMKIN telephone gateway tests passed: signed calls/SMS, explicit consent, hash-only caller, disabled defaults, owner moderation and no AI/outbound broadcast.");
