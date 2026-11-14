/* HUMKIN RADIO — phone request/voicemail receiver v1.
 * A *separate* public listener doorway from owner-only LUMI LINE 001.
 * No live AI, no project/memory access, no public recordings, no outbound SMS.
 * Twilio webhooks use the exact signed URL and post parameters. Fails closed.
 */
const BASE="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-radio-line";
const te=new TextEncoder();
const env=(key)=>(Deno.env.get(key)??"").trim();
const enabled=()=>env("HUMKIN_LINE_ENABLE")==="true";
const E164=/^\+[1-9][0-9]{7,14}$/;
const SID={call:/^CA[0-9a-fA-F]{32}$/,message:/^(SM|MM)[0-9a-fA-F]{32}$/,record:/^RE[0-9a-fA-F]{32}$/};
const XML_HEADERS={"content-type":"text/xml; charset=utf-8","cache-control":"no-store"};
const JSON_HEADERS={"cache-control":"no-store"};
const xml=(body)=>new Response('<?xml version="1.0" encoding="UTF-8"?><Response>'+body+"</Response>",{headers:XML_HEADERS});
const json=(object,status=200)=>Response.json(object,{status,headers:JSON_HEADERS});
const escape=(str)=>String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const say=(text)=>"<Say>"+escape(text)+"</Say>";
const noMessage=()=>xml("");
const ready=()=>enabled()&&!!env("TWILIO_AUTH_TOKEN")&&
 /^AC[0-9a-fA-F]{32}$/.test(env("TWILIO_ACCOUNT_SID"))&&
 E164.test(env("HUMKIN_LINE_NUMBER"))&&
 env("HUMKIN_LINE_CALLER_PEPPER").length>=20&&
 !!env("SUPABASE_URL")&&!!env("SUPABASE_SERVICE_ROLE_KEY");
function constantTimeEqual(a,b){
 if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
async function hmac(secret,message,hash="SHA-1"){
 const key=await crypto.subtle.importKey("raw",te.encode(secret),{name:"HMAC",hash},false,["sign"]);
 return new Uint8Array(await crypto.subtle.sign("HMAC",key,te.encode(message)));
}
async function validTwilio(req,raw){
 const signature=req.headers.get("X-Twilio-Signature");
 if(!signature||!env("TWILIO_AUTH_TOKEN")||!req.url.startsWith(BASE+"/"))return false;
 const q=new URL(req.url);
 if(q.origin!==new URL(BASE).origin||!q.pathname.startsWith(new URL(BASE).pathname+"/"))return false;
 const params=new URLSearchParams(raw);
 const keys=[...new Set(params.keys())].sort();
 let payload=req.url;
 for(const key of keys)for(const value of params.getAll(key))payload+=key+value;
 const hash=await hmac(env("TWILIO_AUTH_TOKEN"),payload);
 let received;
 try{received=Uint8Array.from(atob(signature),c=>c.charCodeAt(0))}
 catch{return false}
 return constantTimeEqual(received,hash);
}
async function callerTag(number){
 if(!E164.test(number))return null;
 const buf=await hmac(env("HUMKIN_LINE_CALLER_PEPPER"),number,"SHA-256");
 return [...buf.slice(0,8)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
async function db(method,table,query="",payload=null,extraHeaders={}){
 const url=env("SUPABASE_URL")+"/rest/v1/"+table+(query?"?"+query:"");
 const key=env("SUPABASE_SERVICE_ROLE_KEY");
 const r=await fetch(url,{method,headers:{
  apikey:key,Authorization:"Bearer "+key,
  ...(payload===null?{}:{"content-type":"application/json"}),
  ...extraHeaders
 },body:payload===null?undefined:JSON.stringify(payload),
 signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error("private_store_failed_"+r.status);
 if(r.status===204)return [];
 const body=await r.text();
 return body?JSON.parse(body):[];
}
async function owner(){
 const rows=await db("GET","humkin_radio_settings","select=owner_id&id=eq.main&limit=1");
 if(!rows?.[0]?.owner_id)throw Error("station_owner_missing");
 return rows[0].owner_id;
}
function matchingAccount(params){
 return params.get("AccountSid")===env("TWILIO_ACCOUNT_SID");
}
function matchingNumber(params){
 return params.get("To")===env("HUMKIN_LINE_NUMBER");
}
function greeting(){
 const g='<Gather input="dtmf" numDigits="1" timeout="7" action="'+BASE+'/choose" method="POST">'+
  say("Welcome to HUMKIN RADIO. The music is free, the road is long, and this is our listener line. This is not a live broadcast. Press one to request a song. Press two to leave a story or community idea. No recording starts until you consent.")+'</Gather>';
 return xml(g+say("We did not hear a choice. You can call again.")+"<Hangup/>");
}
function chosen(params){
 const digit=params.get("Digits");
 if(digit!=="1"&&digit!=="2")return xml(say("No message was recorded. Thank you for calling.")+"<Hangup/>");
 const topic=digit==="1"?"song":"story";
 const part='<Gather input="dtmf" numDigits="1" timeout="9" action="'+BASE+'/consent?topic='+topic+'" method="POST">'+
  say("Before we continue: we can record your next message for private station staff review. It is not played on air automatically. Please do not share sensitive information. To consent to being recorded, press one. To decline, press two or hang up.")+
  '</Gather>';
 return xml(part+say("No recording has started. Goodbye.")+"<Hangup/>");
}
async function consent(params,url){
 if(params.get("Digits")!=="1")return xml(say("No recording was made. Thank you.")+"<Hangup/>");
 if(!matchingNumber(params)||!SID.call.test(params.get("CallSid")||""))
  return xml(say("We could not start the recording.")+"<Hangup/>");
 const tag=await callerTag(params.get("From"));
 if(!tag)return xml(say("Sorry, our message box is unavailable for this call.")+"<Hangup/>");
 const topic=url.searchParams.get("topic")==="song"?"song":"story";
 const owner_id=await owner();
 await db("POST","humkin_radio_line_call_consents","on_conflict=call_sid",
 {call_sid:params.get("CallSid"),owner_id,caller_tag:tag,topic,
  expires_at:new Date(Date.now()+2*3600*1000).toISOString()},
 {"Prefer":"resolution=merge-duplicates,return=minimal"});
 const text=say("After the beep, leave a message under ninety seconds. Press pound to finish. If you'd like your voice considered for broadcast, you can mention that; staff will still review permission before any use.");
 const record='<Record maxLength="90" timeout="6" finishOnKey="#" playBeep="true" transcribe="false" '+
  'recordingStatusCallback="'+BASE+'/recording" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed" '+
  'action="'+BASE+'/done" method="POST"/>';
 return xml(text+record);
}
async function ingestRecording(params){
 const call=params.get("CallSid")||"",rec=params.get("RecordingSid")||"";
 if(!SID.call.test(call)||!SID.record.test(rec)||params.get("RecordingStatus")!=="completed")
   return json({received:true,accepted:false});
 const cons=await db("GET","humkin_radio_line_call_consents",
  "select=owner_id,caller_tag,topic&call_sid=eq."+encodeURIComponent(call)+
   "&expires_at=gt."+encodeURIComponent(new Date().toISOString())+"&limit=1");
 if(!cons?.length)return json({received:true,accepted:false});
 const duration=Number(params.get("RecordingDuration"));
 if(!Number.isFinite(duration)||duration<1||duration>120)return json({received:true,accepted:false});
 const c=cons[0];
 await db("POST","humkin_radio_line_inbox","on_conflict=provider_sid",
  {owner_id:c.owner_id,provider_sid:rec,transport:"voicemail",topic:c.topic,
   body:"",recording_sid:rec,duration_seconds:Math.round(duration),
   caller_tag:c.caller_tag,moderation_status:"pending",
   permission_to_broadcast:false},
  {"Prefer":"resolution=ignore-duplicates,return=minimal"});
 await db("DELETE","humkin_radio_line_call_consents",
  "call_sid=eq."+encodeURIComponent(call));
 return json({received:true,accepted:true});
}
function smsTopic(body){
 if(/^\s*(?:song|request)\s*[:\s]/i.test(body))return "song";
 if(/^\s*(?:story|poem)\s*[:\s]/i.test(body))return "story";
 if(/^\s*(?:community|event)\s*[:\s]/i.test(body))return "community";
 return "other";
}
async function ingestSms(params){
 const from=params.get("From"),text=(params.get("Body")||"").trim();
 const sid=params.get("MessageSid")||params.get("SmsSid")||"";
 if(!matchingNumber(params)||!SID.message.test(sid))return noMessage();
 const tag=await callerTag(from);
 if(!tag||!text||text.length>650)return noMessage();
 if(/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT|START|YES|HELP)$/i.test(text))return noMessage();
 const recent=await db("GET","humkin_radio_line_inbox",
  "select=id&caller_tag=eq."+tag+
  "&created_at=gte."+encodeURIComponent(new Date(Date.now()-3600000).toISOString())+
  "&limit=7");
 if(recent.length>=5)return noMessage(); // rate-limit; do not generate billable reply
 await db("POST","humkin_radio_line_inbox","on_conflict=provider_sid",
  {owner_id:await owner(),provider_sid:sid,transport:"sms",
   topic:smsTopic(text),body:text,caller_tag:tag,
   moderation_status:"pending",permission_to_broadcast:false},
  {"Prefer":"resolution=ignore-duplicates,return=minimal"});
 return noMessage(); // No outbound SMS or automated AI-generated replies
}
Deno.serve(async req=>{
 const route=new URL(req.url);
 const sub=route.pathname.slice(new URL(BASE).pathname.length);
 if(req.method==="GET"&&sub==="/health")
  return json({service:"humkin-radio-line",version:1,ready:ready(),enabled:ready(),
   ai_host_connected:false,
   auto_broadcast:false,outbound_sms:false});
 if(req.method!=="POST"||!["/sms","/voice","/choose","/consent","/recording","/done"].includes(sub))
  return json({error:"not_found"},404);
 if(!ready())return json({error:"line_not_configured"},503);
 if(!(req.headers.get("content-type")||"").includes("application/x-www-form-urlencoded"))
  return json({error:"content_type"},415);
 const raw=await req.text();
 if(raw.length>15000)return json({error:"too_large"},413);
 try{
  if(!(await validTwilio(req,raw)))return json({error:"invalid_signature"},401);
  const params=new URLSearchParams(raw);
  if(!matchingAccount(params))return json({error:"account_mismatch"},401);
  if(sub==="/sms")return await ingestSms(params);
  if(sub==="/voice")return matchingNumber(params)?greeting():xml(say("No station line available.")+"<Hangup/>");
  if(sub==="/choose")return matchingNumber(params)?chosen(params):xml("<Hangup/>");
  if(sub==="/consent")return await consent(params,route);
  if(sub==="/done")return xml(say("Thanks for leaving a message. A producer may review it. Nothing goes on air automatically. Take care.")+"<Hangup/>");
  if(sub==="/recording")return await ingestRecording(params);
 }catch{
  // Errors are intentionally opaque; do not log caller numbers, message text,
  // unsigned form data, auth token, service key or recording URLs.
  return json({error:"temporarily_unavailable"},503);
 }
 return json({error:"not_found"},404);
});
