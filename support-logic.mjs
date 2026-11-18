// HUMKIN Listener Receptacle — a read-only doorway adapter, not a payment processor.
export const AMOUNTS=Object.freeze([1,5,25,100,500]);
export const RAILS=Object.freeze({
  cash_app:{label:"Cash App",knownMinimumCents:100,host:"cash.app",path:/^\/\$[A-Za-z0-9_]{1,35}$/},
  venmo:{label:"Venmo",knownMinimumCents:null,host:"venmo.com",path:/^\/u\/[A-Za-z0-9_-]{2,40}$/},
  paypal:{label:"PayPal.Me",knownMinimumCents:null,host:"paypal.me",path:/^\/[A-Za-z0-9]{1,20}$/}
});
// null means the minimum is not verified, not that pennies are accepted.\nexport function providerAmountStatus(provider,cents){\n  const rail=Object.hasOwn(RAILS,provider)?RAILS[provider]:null;\n  if(!rail||!Number.isSafeInteger(cents)||cents<1)throw Error("Invalid provider or amount");\n  if(rail.knownMinimumCents!==null&&cents<rail.knownMinimumCents)\n    return {available:false,reason:rail.label+" currently requires at least $1 for ordinary payments."};\n  return {available:true,reason:rail.knownMinimumCents===null?\n    "Provider minimum and fees have not been verified; the provider may reject this amount.":\n    "Amount meets the publicly documented ordinary-payment minimum; provider may impose other restrictions."};\n}\nexport function amountText(cents){
  if(!AMOUNTS.includes(cents))throw Error("Unknown suggested amount");
  return cents<100?cents+"¢":"$"+(cents/100).toFixed(2);
}
export function safeLink(provider,url){
  const rail=Object.hasOwn(RAILS,provider)?RAILS[provider]:null;
  if(!rail||typeof url!=="string"||url.length>200)throw Error("Unsupported payment door");
  let u;try{u=new URL(url);}catch{throw Error("Invalid provider URL");}
  if(u.protocol!=="https:"||u.hostname!==rail.host||u.port||u.username||u.password||
    u.search||u.hash||!rail.path.test(u.pathname)||u.href!==url)
    throw Error("Payment door is not an exact official provider profile URL");
  return url;
}
export function parseReceptacle(value){
  if(!value||typeof value!=="object"||Array.isArray(value)||
     value.schema!=="humkin.receptacle/v0.1"||
     value.recipient!=="HUMKIN"||
     value.purposeId!=="purpose-humkin-listener-support-001"||
     !["preview","live"].includes(value.mode)||
     !Array.isArray(value.doors)||value.doors.length>12)throw Error("Invalid receptacle manifest");
  if(value.mode==="preview"){
    if(value.doors.length||value.ownerApproved!==false)throw Error("Preview must not expose payment doors");
    return {mode:"preview",doors:[],sourceHead:null};
  }
  if(value.ownerApproved!==true||typeof value.ownerApprovalRef!=="string"||
     !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/.test(value.ownerApprovalRef)||
     !/^[a-f0-9]{64}$/.test(value.sourceHead))throw Error("Live publication has no signed-source evidence and owner approval");
  const seen=new Set(),doors=[];
  for(const door of value.doors){
    if(!door||typeof door!=="object"||Array.isArray(door)||
       !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/.test(door.id)||
       seen.has(door.id))throw Error("Duplicate or invalid door identity");
    seen.add(door.id);
    safeLink(door.provider,door.url);
    doors.push({id:door.id,provider:door.provider,url:door.url});
  }
  if(!doors.length)throw Error("No approved payment doors");
  return {mode:"live",doors,sourceHead:value.sourceHead};
}
export function previewObservation(cents){
  return Object.freeze({type:"SIMULATED_INTENT",cents,settled:false,verified:false,
    message:"Practice only. No payment requested, sent, received, or recorded."});
}
