import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const BASE="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const ENDPOINT=BASE+"/functions/v1/humkin-program-proposals";
const db=createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e};
let busy=false;
function message(s){$("director-status").textContent=s;}
async function ownerToken(){
 const {data,error}=await db.auth.getSession();
 if(error||!data.session?.access_token)throw Error("Sign in with your existing Crate Loader owner session first.");
 return data.session.access_token;
}
async function api(query="",body=null){
 const token=await ownerToken();
 const res=await fetch(ENDPOINT+query,{cache:"no-store",method:body?"POST":"GET",
   headers:{"Authorization":"Bearer "+token,"Accept":"application/json",
     ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json();
 if(!res.ok||data.error)throw Error(data.error||"Programming review service unavailable");
 return data;
}
function download(obj,name){
 const blob=new Blob([JSON.stringify(obj,null,2)+"\n"],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function disposition(item,approve,checkbox,note,yes,no){
 if(busy)return;
 if(approve&&!checkbox.checked){message("Review the eligible media and confirm catalog checks first.");return;}
 const decision=approve?"APPROVE FOR OWNER EXPORT (NOT BROADCAST)":"DECLINE";
 if(!confirm(decision+" — "+item.title+"?"))return;
 busy=true;yes.disabled=no.disabled=true;
 try{
  const result=await api("",{action:"review",id:item.id,approve,
    catalog_checked:approve&&checkbox.checked,note:note.value.trim()});
  message(result.state.toUpperCase()+" · no airtime assigned.");
  await refresh();
 }catch(e){message("REVIEW FAILED: "+e.message);}
 finally{busy=false;yes.disabled=no.disabled=false;}
}
function programCard(item){
 const caseEl=node("article");caseEl.className="case";
 caseEl.append(node("small",item.state.toUpperCase()+" · "+item.id),
   node("h2",item.title),
   node("p",item.day+" · "+item.start_local+" Central · "+item.duration_minutes+
     " minutes · "+item.station_id));
 const list=node("ol");
 for(const rule of item.proposal.rules){
  const li=node("li",(rule.enabled?"ACTIVE":"DISABLED")+" WHEN "+rule.when+" THEN "+rule.action);
  list.append(li);
 }
 caseEl.append(list);
 if(item.proposal.note)caseEl.append(node("p","CONTRIBUTOR NOTE: "+item.proposal.note));
 if(item.state==="approved"){
  const exportBtn=node("button","DOWNLOAD APPROVED PROGRAM PROPOSAL");
  exportBtn.type="button";
  exportBtn.addEventListener("click",async()=>{
   try{
    const packet=await api("?mode=approved&id="+encodeURIComponent(item.id));
    if(packet.schema!=="humkin.program.reviewed/v1")throw Error("Invalid export receipt");
    download(packet,"humkin-approved-gambits-"+item.id+".json");
    message("Reviewed packet exported. The R2 operator must still independently verify media and publish.");
   }catch(e){message("EXPORT FAILED: "+e.message)}
  });
  caseEl.append(exportBtn);
  return caseEl;
 }
 const confirmLabel=node("label");
 const checkbox=node("input");checkbox.type="checkbox";
 confirmLabel.append(checkbox,node("span",
   "I checked the approved station catalog, rights, scheduling context and this deck's priorities. This is editorial approval only."));
 const note=node("textarea");note.maxLength=500;note.placeholder="Editorial note (optional)";
 const actions=node("div");actions.className="actions";
 const yes=node("button","APPROVE FOR EXPORT"),no=node("button","DECLINE");
 yes.type=no.type="button";
 yes.addEventListener("click",()=>disposition(item,true,checkbox,note,yes,no));
 no.addEventListener("click",()=>disposition(item,false,checkbox,note,yes,no));
 actions.append(yes,no);
 caseEl.append(confirmLabel,note,actions);
 return caseEl;
}
async function refresh(){
 message("Reading private editorial queue…");
 try{
  const result=await api("?mode=owner");
  if(result.schema!=="humkin.program.owner/v1")throw Error("Unexpected response");
  const board=$("director-proposals");board.replaceChildren();
  message("OWNER VERIFIED · "+result.items.length+" PROPOSALS");
  if(!result.items.length){board.append(node("p","No programming proposals yet."));return;}
  for(const item of result.items)board.append(programCard(item));
 }catch(e){$("director-proposals").replaceChildren();message("REVIEW UNAVAILABLE · "+e.message);}
}
$("director-refresh").addEventListener("click",refresh);
refresh();
