import test from "node:test";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {AMOUNTS,safeLink,amountText,parseReceptacle,previewObservation,providerAmountStatus} from "../support-logic.mjs";
import {canonical,inspectSignedRegistry,prepareManifest} from "../tools/receptacle/export-jubilee.mjs";
import {readFileSync} from "node:fs";
const sample=JSON.parse(readFileSync(new URL("../support-doors.json",import.meta.url),"utf8"));
const candidates=JSON.parse(readFileSync(new URL("../tools/receptacle/owner-supplied-candidates.json",import.meta.url),"utf8"));
test("default production asset is strictly disabled preview",()=>{
  assert.equal(parseReceptacle(sample).mode,"preview");
  assert.equal(parseReceptacle(sample).doors.length,0);
  assert.equal(previewObservation(1).settled,false);
  assert.deepEqual(AMOUNTS,[1,5,25,100,500]);
  assert.equal(amountText(1),"1¢");
  assert.equal(amountText(500),"$5.00");
});
test("provider exact-host/path allowlist rejects lookalikes and injections",()=>{
  for(const [p,u] of [
    ["cash_app","https://cash.app/$HUMKIN"],
    ["venmo","https://venmo.com/u/humkin_test"],
    ["paypal","https://paypal.me/HumkinTest"]
  ])assert.equal(safeLink(p,u),u);
  for(const u of ["http://cash.app/$Foo","https://cash.app.evil.test/$Foo",
    "https://cash.app/$Foo?amount=100","https://cash.app/$Foo#hello",
    "https://user@cash.app/$Foo","https://cash.app/%24Foo","https://cash.app:444/$Foo"])
    assert.throws(()=>safeLink("cash_app",u));
  assert.throws(()=>safeLink("bank","https://cash.app/$Foo"));
  assert.throws(()=>safeLink("venmo","https://paypal.me/Foo"));
});
const keys=generateKeyPairSync("ed25519");
const pem=keys.publicKey.export({type:"spki",format:"pem"});
const alt=generateKeyPairSync("ed25519").publicKey.export({type:"spki",format:"pem"});
const mk=()=>({schema:"jubilee.door-registry/v0.1",stewardPublicKey:pem,events:[]});
const hash=v=>createHash("sha256").update(canonical(v)).digest("hex");
function add(reg,type,payload){
  const unsigned={seq:reg.events.length+1,type,payload,
    previous:reg.events.length?hash(reg.events.at(-1)):null,
    createdAt:"2026-11-18T00:00:00.000Z"};
  const signature=sign(null,Buffer.from("JUBILEE-DOOR-REGISTRY-012\n"+canonical(unsigned)),
    keys.privateKey).toString("base64");
  return {...reg,events:[...reg.events,{...unsigned,signature}]};
}
const target={id:"humkin-test-door-001",kind:"payment_link",
  purposeId:"purpose-humkin-listener-support-001",termsRef:"terms-test-001",
  publicationRef:"approval-humkin-001",
  target:{provider:"cash_app",url:"https://cash.app/$HUMKIN"}};
const opts={approvedDoorIds:[target.id],ownerApprovalRef:"approval-humkin-001",confirmedRecipient:"HUMKIN"};
test("signed Jubilee door becomes read-only HUMKIN link after explicit approval",()=>{
  const reg=add(mk(),"OPEN",target);
  const output=prepareManifest(reg,pem,opts);
  assert.equal(output.mode,"live");
  assert.equal(output.doors.length,1);
  assert.equal(parseReceptacle(output).doors[0].provider,"cash_app");
  assert.equal(output.sourceHead,hash(reg.events[0]));
  assert.equal(output.ownerApproved,true);
});
test("tampering, wrong key, wrong approval and withdrawn doors fail closed",()=>{
  const reg=add(mk(),"OPEN",target);
  assert.throws(()=>inspectSignedRegistry(reg,alt));
  const tampered=structuredClone(reg);
  tampered.events[0].payload.target.url="https://cash.app/$Attacker";
  assert.throws(()=>prepareManifest(tampered,pem,opts),/signature/);
  assert.throws(()=>prepareManifest(reg,pem,{...opts,confirmedRecipient:"Unknown"}),/recipient/);
  assert.throws(()=>prepareManifest(reg,pem,{...opts,ownerApprovalRef:"other-ref-001"}));
  const withdrawn=add(reg,"WITHDRAW",{doorId:target.id,evidenceRef:"owner-revoked-001"});
  assert.throws(()=>prepareManifest(withdrawn,pem,opts),/not currently open/);
  assert.throws(()=>prepareManifest(reg,pem,{...opts,approvedDoorIds:[target.id,target.id]}));
});
test("a deliberately malicious, but steward-signed, provider URL fails anyway",()=>{
  const reg=add(mk(),"OPEN",{...target,target:{...target.target,url:"https://cash.app.bad.test/$HUMKIN"}});
  assert.throws(()=>prepareManifest(reg,pem,opts),/provider/);
});
test("manifest does not mistake a public link for payment evidence",()=>{
  const reg=add(mk(),"OPEN",target),m=prepareManifest(reg,pem,opts);
  assert.equal(m.paymentReceived,undefined);
  assert.equal(m.amountReceived,undefined);
  assert.throws(()=>parseReceptacle({...m,mode:"preview"}),/Preview/);
  assert.throws(()=>parseReceptacle({...m,sourceHead:null}),/source/);
});

test("user-supplied candidate rails stay behind HOLD, with exact supported link patterns",()=>{
  assert.equal(candidates.publicationStatus,"HOLD_NOT_PUBLISHED");
  assert.equal(candidates.doors.length,3);
  assert.deepEqual(candidates.doors.map(x=>x.suppliedIdentifier),[
    "$LuVstudio","@The_Real_Lucas_V","@thestaticcollective"]);
  assert.equal(candidates.doors.every(x=>x.identityVerified===false&&
    x.ownerPublicationApproved===false),true);
  const [cash,venmo,paypal]=candidates.doors;
  assert.equal(safeLink("cash_app",cash.candidateUrl),"https://cash.app/$LuVstudio");
  assert.equal(safeLink("venmo",venmo.candidateUrl),"https://venmo.com/u/The_Real_Lucas_V");
  assert.equal(paypal.candidateUrl,null,"Never invent a PayPal.Me URL from an @username");
  assert.equal(sample.doors.length,0,"Public manifest must not inherit candidates");
});
test("one-cent experiments cannot advertise an ordinary Cash App payment",()=>{
  for(const amount of [1,5,25]){
    assert.equal(providerAmountStatus("cash_app",amount).available,false);
  }
  assert.equal(providerAmountStatus("cash_app",100).available,true);
  assert.equal(providerAmountStatus("cash_app",500).available,true);
  assert.equal(providerAmountStatus("venmo",1).available,true);
  assert.match(providerAmountStatus("venmo",1).reason,/not been verified/);
  assert.equal(providerAmountStatus("paypal",1).available,true);
  assert.throws(()=>providerAmountStatus("bad",1));
});
test("synthetic Jubilee-signing fixture accepts exact proposed Cash App and Venmo URLs, but not payment evidence",()=>{
  const [cash,venmo]=candidates.doors;
  let registry=mk();
  for(const door of [cash,venmo]){
    registry=add(registry,"OPEN",{
      id:door.id,kind:"payment_link",
      purposeId:"purpose-humkin-listener-support-001",
      termsRef:"synthetic-test-only-001",
      publicationRef:"synthetic-approval-test-001",
      target:{provider:door.provider,url:door.candidateUrl}
    });
  }
  const manifest=prepareManifest(registry,pem,{
    approvedDoorIds:[cash.id,venmo.id],
    ownerApprovalRef:"synthetic-approval-test-001",
    confirmedRecipient:"HUMKIN"
  });
  assert.equal(manifest.doors.length,2);
  assert.equal(manifest.paymentReceived,undefined);
  assert.equal(manifest.amountReceived,undefined);
  // Synthetic test keys and synthetic authorization cannot certify account ownership.
  const withdrawn=add(registry,"WITHDRAW",{doorId:venmo.id,evidenceRef:"synthetic-revocation-001"});
  assert.throws(()=>prepareManifest(withdrawn,pem,{
    approvedDoorIds:[cash.id,venmo.id],
    ownerApprovalRef:"synthetic-approval-test-001",
    confirmedRecipient:"HUMKIN"
  }),/not currently open/);
});
