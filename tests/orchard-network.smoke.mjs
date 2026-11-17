import {webcrypto} from "node:crypto";
import assert from "node:assert/strict";
const subtle=webcrypto.subtle,enc=new TextEncoder();
const endpoint="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-orchard-network";
const hex=a=>Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,"0")).join("");
const hash=async s=>hex(await subtle.digest("SHA-256",enc.encode(s)));
const nonce=()=>hex(webcrypto.getRandomValues(new Uint8Array(16)));
async function identity(){
 const pair=await subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},false,["sign","verify"]);
 const j=await subtle.exportKey("jwk",pair.publicKey);
 const jwk={kty:"EC",crv:"P-256",x:j.x,y:j.y};
 return {id:await hash(JSON.stringify(jwk)),key:pair.privateKey,jwk};
}
async function send(user,action,payload={},packet=null,wrong=false){
 const p=packet||{actor:user.id,nonce:nonce(),action,ts:Date.now(),payload};
 let signature=Buffer.from(await subtle.sign({name:"ECDSA",hash:"SHA-256"},user.key,enc.encode(JSON.stringify(p)))).toString("base64url");
 if(wrong)signature="A".repeat(signature.length);
 const resp=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Origin":"https://humkin.abundent.org"},body:JSON.stringify({packet:p,signature})});
 return {status:resp.status,data:await resp.json(),packet:p};
}
const [a,b]=await Promise.all([identity(),identity()]);
const listing=await fetch(endpoint+"?mode=world");
assert.equal(listing.status,200);
for(const [user,name] of [[a,"CI Private A"],[b,"CI Private B"]]){
 const r=await send(user,"register",{jwk:user.jwk,name});
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.data.artifacts.length,2);
}
const bad=await send(a,"state",{},null,true);assert.equal(bad.status,401);
const original=await send(a,"state");assert.equal(original.status,200);
const replay=await send(a,"state",{},original.packet);assert.equal(replay.status,409);
let r=await send(a,"publish",{public:false,name:"CI Private A",home:{room:"private pilot",stage:1,things:["blue-cup"],minutes:42}});
assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal((await fetch(endpoint+"?mode=home&id="+a.id)).status,404);
r=await send(a,"heartbeat");assert.equal(r.status,200);
const cup=original.data.artifacts.find(x=>x.kind==="chipped-blue-cup");
r=await send(a,"offer",{artifact_id:cup.id,to:b.id});assert.equal(r.status,200,JSON.stringify(r.data));
const id=r.data.offer_id;
r=await send(a,"accept",{offer_id:id});assert.equal(r.status,409);
r=await send(b,"accept",{offer_id:id});assert.equal(r.status,200,JSON.stringify(r.data));
r=await send(b,"accept",{offer_id:id});assert.equal(r.status,409);
r=await send(b,"state");assert.ok(r.data.artifacts.some(x=>x.id===cup.id));
r=await send(a,"challenge",{consent:true,capability:"radio.catalog.audit.v1"});
assert.equal(r.status,200,JSON.stringify(r.data));
const challenge=r.data.offer.id;
const catalog=await fetch("https://humkin.abundent.org/fm/rotation.json",{cache:"no-store"});
assert.equal(catalog.status,200);
const digest=await hash(await catalog.text());
r=await send(a,"complete",{challenge_id:challenge,digest});
assert.equal(r.status,200,JSON.stringify(r.data));
assert.ok(r.data.receipt.artifact_id);
r=await send(a,"complete",{challenge_id:challenge,digest});assert.equal(r.status,409);
// A real relay-assisted peer serve: B asks, foreground A offers a fresh room,
// the station relays it, and only a valid signed serve earns one Porch Bell.
await new Promise(resolve=>setTimeout(resolve,20200)); // prior private publication has a 20s write cooldown.
r=await send(a,"publish",{public:true,name:"CI FIELD TEST (TEMPORARY)",home:{room:"CI TEMP LIVE ROOM",stage:1,things:["blue-cup"],minutes:0}});
assert.equal(r.status,200,JSON.stringify(r.data));
r=await send(a,"heartbeat",{serve:true});assert.equal(r.status,200,JSON.stringify(r.data));
r=await send(b,"request_live",{to:a.id});assert.equal(r.status,200,JSON.stringify(r.data));
const liveId=r.data.request.id;
r=await send(a,"poll_live");assert.equal(r.status,200,JSON.stringify(r.data));
assert.ok(r.data.requests.some(x=>x.id===liveId));
r=await send(a,"serve_live",{request_id:liveId,home:{room:"CI FRESH ROOM",stage:2,things:["first-seed"],minutes:0}});
assert.equal(r.status,200,JSON.stringify(r.data));
assert.ok(r.data.served.served);
let result=await fetch(endpoint+"?mode=live-result&id="+liveId);
assert.equal(result.status,200);const live=await result.json();
assert.equal(live.state,"served");assert.equal(live.home.room,"CI FRESH ROOM");
r=await send(a,"serve_live",{request_id:liveId,home:{room:"REPLAY"}});
assert.equal(r.status,409,"live serve must be exactly once");
r=await send(a,"state");assert.ok(r.data.artifacts.some(x=>x.kind==="porch-bell"));
await new Promise(resolve=>setTimeout(resolve,20200)); // return the synthetic test porch to PRIVATE.
r=await send(a,"publish",{public:false,name:"CI PRIVATE A",home:{room:"CI PRIVATE ROOM",stage:0,things:[],minutes:0}});
assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal((await fetch(endpoint+"?mode=home&id="+a.id)).status,404);
console.log("PASS: live owner-consented peer snapshot request/serve/result, Porch Bell, replay refusal and privacy withdrawal");

console.log("PASS orchard network: signed identities, replay refusal, opt-out, presence, atomic transfer, verified catalog work");
