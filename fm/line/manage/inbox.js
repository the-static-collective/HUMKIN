import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const db=createClient("https://kbhqacsdvjsstzyplqij.supabase.co",
 "sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o",
 {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const OWNER="us@abundent.org",$=id=>document.getElementById(id);
const statuses=["pending","hold","rejected","cleared","aired","returned"];
let user=null,busy=false;
function node(tag,txt,cls){
 const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);
 if(cls)x.className=cls;return x;
}
function label(text,input){
 const l=node("label",text);l.append(input);return l;
}
function feedback(text){$("feedback").textContent=text}
function requireConfirmation(row,status,permitted){
 if(status==="aired"&&(!permitted||!["cleared","aired","returned"].includes(row.moderation_status))){
  alert("A message must first be cleared, with independent broadcast permission documented, before you can confirm it aired.");
  return false;
 }
 if(status==="aired"&&!confirm("Confirm this message ACTUALLY AIRED? A planned or queued segment is not an aired occurrence."))return false;
 if(status==="returned"&&row.moderation_status!=="aired"&&row.moderation_status!=="returned"){
  alert("RETURNED requires a confirmed prior airing.");return false;
 }
 if(permitted&&!row.permission_to_broadcast&&!confirm(
 "You must have verified the speaker/author gave permission for this specific broadcast use. A recorded voicemail or SMS alone does not establish that permission. Confirm independent review?"))return false;
 return true;
}
function render(rows){
 $("count").textContent=rows.length+" most recent listener items · statuses and permissions are private";
 const list=$("inbox");list.replaceChildren();
 if(!rows.length){list.append(node("p","No messages yet. The phone line is not activated until a real number is provisioned."));return}
 for(const row of rows){
  const card=node("article",undefined,"item");
  const meta=node("p",row.transport.toUpperCase()+" · "+row.topic.toUpperCase()+
   " · "+new Date(row.created_at).toLocaleString()+" · Caller code "+row.caller_tag.slice(0,6),"meta");
  const heading=node("h3",row.transport==="voicemail"?"RECORDED MESSAGE":"TEXT MESSAGE");
  const text=node("p",row.transport==="sms"?row.body:
   "PRIVATE AUDIO AT TWILIO · Recording ID "+row.recording_sid+
    " · "+row.duration_seconds+" seconds. Locate the SID inside the owner-controlled Twilio console.");
  const selector=node("select");selector.setAttribute("aria-label","Moderation status");
  for(const s of statuses){
   const opt=node("option",s.toUpperCase());opt.value=s;selector.append(opt);
  }
  selector.value=row.moderation_status;
  const checkbox=node("input");checkbox.type="checkbox";
  checkbox.checked=row.permission_to_broadcast;
  const permitted=label(" Permission independently verified for broadcast",checkbox);
  const notes=node("textarea");notes.value=row.editorial_notes||"";
  notes.maxLength=1500;notes.setAttribute("aria-label","Private producer notes");
  const save=node("button","SAVE REVIEW");
  save.addEventListener("click",async()=>{
   if(busy)return;
   const next=selector.value,rights=checkbox.checked;
   if(!requireConfirmation(row,next,rights))return;
   if((next==="aired"||next==="returned")&&!rights){
    return feedback("Cannot mark a message aired or returned without independently verified broadcast permission.");
   }
   busy=true;save.disabled=true;
   try{
    const result=await db.from("humkin_radio_line_inbox").update({
      moderation_status:next,permission_to_broadcast:rights,
      editorial_notes:notes.value.trim().slice(0,1500),updated_at:new Date().toISOString()
     }).eq("id",row.id).eq("owner_id",user.id).select("id").single();
    if(result.error||!result.data)throw result.error||Error("Owner write not confirmed");
    feedback("Reviewed and saved; no audio has been sent to the station.");
    await load();
   }catch(err){feedback("Update unsuccessful: "+err.message)}
   finally{busy=false;save.disabled=false}
  });
  card.append(meta,heading,text,permitted,node("label","PRIVATE PRODUCER NOTES"),notes,
   node("label","REVIEW DISPOSITION"),selector,save);
  list.append(card);
 }
}
async function load(){
 $("auth").textContent="Checking private switchboard access…";
 const session=await db.auth.getSession();
 const account=session.data?.session?.user;
 if(session.error||account?.email?.toLowerCase()!==OWNER){
  user=null;$("desk").classList.add("hidden");
  $("login").classList.remove("hidden");
  $("auth").textContent="Owner sign-in required. Use the Crate Loader login on this device first.";
  return;
 }
 user=account;$("login").classList.add("hidden");
 $("auth").textContent="UNLOCKED · "+user.email;
 try{
  const r=await db.from("humkin_radio_line_inbox")
   .select("id,owner_id,provider_sid,transport,topic,body,recording_sid,duration_seconds,caller_tag,moderation_status,permission_to_broadcast,editorial_notes,created_at")
   .eq("owner_id",user.id).order("created_at",{ascending:false}).limit(100);
  if(r.error)throw r.error;
  $("desk").classList.remove("hidden");render(r.data||[]);
 }catch(err){
  $("desk").classList.add("hidden");feedback("Private inbox unavailable: "+err.message);
 }
}
$("refresh").addEventListener("click",load);
db.auth.onAuthStateChange(event=>{
 if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(load,0);
});
load();