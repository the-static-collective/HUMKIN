import assert from "node:assert/strict";
import {test} from "node:test";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {humkinAuthLock,humkinAuthStorage,humkinAuthOptions,sessionStorageMode}
  from "../fm/browser-safe-auth.mjs";

test("uses an auth lock that never depends on denied browser Web Locks",async()=>{
  const order=[];
  const a=humkinAuthLock("owner",0,async()=>{
    order.push("a-start");await new Promise(resolve=>setTimeout(resolve,15));order.push("a-end");
  });
  const b=humkinAuthLock("owner",0,async()=>{
    order.push("b-start");await new Promise(resolve=>setTimeout(resolve,3));order.push("b-end");
  });
  await Promise.all([a,b]);
  assert.deepEqual(order,["a-start","a-end","b-start","b-end"]);
  await assert.rejects(humkinAuthLock("owner",0,async()=>{throw Error("test");}),/test/);
  await humkinAuthLock("owner",0,async()=>order.push("after-rejected"));
  assert.equal(order[4],"after-rejected");
});
test("browser storage fallback retains session for the tab if local storage is unavailable",()=>{
  const value=JSON.stringify({access_token:"example-token-not-real"});
  humkinAuthStorage.setItem("session-test",value);
  assert.equal(humkinAuthStorage.getItem("session-test"),value);
  humkinAuthStorage.removeItem("session-test");
  assert.equal(humkinAuthStorage.getItem("session-test"),null);
  assert.equal(sessionStorageMode(),"memory");
});
test("Supabase client receives the same safe lock + storage for both upload desks",()=>{
  const opts=humkinAuthOptions();
  assert.equal(opts.persistSession,true);
  assert.equal(opts.autoRefreshToken,true);
  assert.equal(opts.detectSessionInUrl,true);
  assert.equal(opts.lock,humkinAuthLock);
  assert.equal(opts.storage,humkinAuthStorage);
  const loader=readFileSync("fm/load/loader.js","utf8");
  const mesh=readFileSync("fm/mesh-radio/r2-intake.mjs","utf8");
  for(const code of [loader,mesh]){
    assert(code.includes('import {humkinAuthOptions} from "../browser-safe-auth.mjs";'));
    assert(code.includes("auth:humkinAuthOptions()")||code.includes("auth: humkinAuthOptions()"));
    assert(!code.includes("navigator.locks.request("));
  }
});
test("UI only displays active enrollment actions and diagnoses browser rejection",()=>{
  const code=readFileSync("fm/proton-auth.mjs","utf8");
  assert(code.includes(".hk-proton [hidden]{display:none!important}"));
  assert(code.includes("Proton code accepted. Opening the HUMKIN session"));
  assert(code.includes("The Mac browser denied access to its session storage."));
  assert(code.includes('db.auth.setSession({'));
  for(const path of ["fm/browser-safe-auth.mjs","fm/proton-auth.mjs",
    "fm/load/loader.js","fm/mesh-radio/r2-intake.mjs"]){
    execFileSync(process.execPath,["--check",path]);
  }
});
