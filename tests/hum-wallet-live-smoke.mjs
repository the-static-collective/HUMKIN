// One-time public endpoint test. Ephemeral test key, no secrets; creates a
// disposable nonfinancial wallet with zero starting credits. Remove synthetic
// actor after reading the CI log. Never run on every push by default.
import { webcrypto, randomBytes, createHash } from "node:crypto";
import assert from "node:assert/strict";

const endpoint="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-hum-wallet";
const subtle=webcrypto.subtle;
const pair=await subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
const publicJwk=await subtle.exportKey("jwk",pair.publicKey);
const key={kty:"EC",crv:"P-256",x:publicJwk.x,y:publicJwk.y};
const actor=createHash("sha256").update(JSON.stringify(key)).digest("hex");
const hex=()=>randomBytes(16).toString("hex");
function b64url(data){return Buffer.from(data).toString("base64url")}
async function packet(action,{played_ms=0,song_id="",nonce=hex()}={}){
  const ts=Date.now();
  const signed=["HUMKIN-HUM/v1",actor,nonce,ts,action,played_ms,song_id].join("\n");
  const signature=await subtle.sign({name:"ECDSA",hash:"SHA-256"},
                                    pair.privateKey,Buffer.from(signed));
  const p={actor,nonce,ts,action,played_ms,song_id};
  if(action==="register")p.jwk=key;
  return {packet:p,signature:b64url(signature)};
}
async function call(body){
  const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(body),signal:AbortSignal.timeout(13000)});
  return {status:res.status,body:await res.json()};
}
const reg=await call(await packet("register"));
assert.equal(reg.status,200,JSON.stringify(reg));
assert.equal(reg.body.schema,"humkin.hum-wallet/v1");
assert.equal(reg.body.balance,0);
const state=await call(await packet("state"));
assert.equal(state.status,200,JSON.stringify(state));
assert.deepEqual(state.body.records,[]);
const earn=await call(await packet("listen",{played_ms:600000}));
assert.equal(earn.status,200,JSON.stringify(earn));
assert.equal(earn.body.balance,0,"cannot claim 10 minutes instantly");
assert.equal(earn.body.awarded,0);
const unknown=await call(await packet("collect",{song_id:"not-a-real-humkin-song"}));
assert.equal(unknown.status,400,JSON.stringify(unknown));
const attempt=await packet("collect",{song_id:"mutant-pop-01"});
const blocked=await call(attempt);
assert.equal(blocked.status,402,JSON.stringify(blocked));
const replay=await call(attempt);
assert.equal(replay.status,402,JSON.stringify(replay)); // failed debit rolled back; no charge
console.log("HUM_SERVER_LIVE_PASS actor="+actor+" (synthetic; delete this test wallet)");
