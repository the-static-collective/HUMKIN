/* HUMKIN Radio original station bible - non-executable source for the studio.
 * Every line is a proposed script until recorded, approved, and actually aired.
 */
(function(root){"use strict";
const SCHEMA="humkin.radio.station-bible/v1";
const ALLOWED=new Set(["station_id","news","comedy","sponsor","community","promo","field_report","weather","other"]);
function validate(input){
 if(!input||input.schema_version!==SCHEMA||!Array.isArray(input.roles)||
    !Array.isArray(input.dayparts)||!Array.isArray(input.scenes)||
    input.roles.length>30||input.dayparts.length>24||input.scenes.length>100)
   throw Error("Unsupported station bible.");
 const ids=new Set();
 for(const scene of input.scenes){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scene?.id||"")||ids.has(scene.id)||
     !ALLOWED.has(scene.department)||
     !["fiction","real_template"].includes(scene.kind)||
     typeof scene.script!=="string"||!scene.script.trim()||
     scene.script.length>2400||typeof scene.label!=="string"||
     !Number.isInteger(scene.expected_seconds)||
     scene.expected_seconds<5||scene.expected_seconds>600)
    throw Error("Invalid production script in station bible.");
  ids.add(scene.id);
 }
 return input;
}
function scriptNote(scene){
 const notice=scene.kind==="real_template"?
  "[REAL WORLD TEMPLATE — DO NOT AIR UNVERIFIED]":
  "[SCRIPTED FICTION — NOT FACTUAL NEWS]";
 return [notice,scene.role,"DIRECTION: "+scene.direction,scene.script].join("\n").slice(0,1200);
}
function asRundown(scene){
 if(!scene||!ALLOWED.has(scene.department))throw Error("Unknown script department.");
 return {type:"script",label:scene.label,
  department:scene.department,expectedSeconds:scene.expected_seconds,
  notes:scriptNote(scene)};
}
function pilotBeats(input){
 const bible=validate(input);
 const beats=bible.scenes.filter(s=>s.in_pilot);
 if(beats.length!==7||beats.some(s=>s.kind==="real_template"&&!s.script.includes("VERIFIED")))
  throw Error("Pilot must contain seven original beats, including an unverified bulletin placeholder.");
 return beats.map(s=>[s.department,s.label,scriptNote(s),s.expected_seconds]);
}
function copyText(scene){
 return ["HUMKIN RADIO — PRODUCTION SCRIPT",scene.label,
   "VOICE: "+scene.role,"CATEGORY: "+(scene.kind==="fiction"?"FICTION":"HOLD FOR REAL HUMAN VERIFICATION"),
   "EXPECTED: "+scene.expected_seconds+" seconds",
   "DIRECTION: "+scene.direction,"",scene.script,"",
   "NOT AN AIRED RECORDING. PRODUCER REVIEW REQUIRED."].join("\n");
}
const api=Object.freeze({SCHEMA,validate,scriptNote,asRundown,pilotBeats,copyText});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_STATION_BIBLE=api;
})(typeof window!=="undefined"?window:globalThis);
