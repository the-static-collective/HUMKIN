import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const URL_BASE="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const ENDPOINT=URL_BASE+"/functions/v1/humkin-participation";
const db=createClient(URL_BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const node=(tag,content)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=String(content);return e};
let busy=false;
function note(t){$("review-status").textContent=t}
async function ownerToken(){
 const {data,error}=await db.auth.getSession();
 if(error||!data.session?.access_token)throw Error("Sign in as the station owner in Crate Loader first.");
 return data.session.access_token;
}
async function request(path,body=null){
 const token=await ownerToken();
 const res=await fetch(ENDPOINT+path,{cache:"no-store",method:body?"POST":"GET",
  headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  ...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json();
 if(!res.ok||data.error)throw Error(data.error||"Review server returned "+res.status);
 return data;
}
function goodLink(raw){
 try{const u=new URL(raw);
  return u.protocol==="https:"&&u.hostname.includes(".")&&!u.username&&!u.password?u.href:null;
 }catch{return null}
}
function itemCard(item){
 const card=node("article");card.className="review-card";
 const top=node("div");top.className="overline";
 top.append(node("span",item.kind.toUpperCase()+" · "+item.state.replace("_"," ")),
   node("span","PROPOSED "+item.potential_hum+" HUM"));
 card.append(top,node("h2",item.title));
 card.append(node("small",item.id+" · "+new Date(item.created_at).toLocaleString()));
 if(item.platform!=="none"||item.public_handle)
  card.append(node("p",item.platform.toUpperCase()+(item.public_handle?" / "+item.public_handle:"")));
 if(item.details)card.append(node("p",item.details));
 if(item.length_seconds)card.append(node("p","DECLARED DURATION: "+item.length_seconds+"s (NOT INDEPENDENTLY VERIFIED)"));
 if(item.reference_url){
  const a=node("a","OPEN PUBLIC EVIDENCE ↗");
  const href=goodLink(item.reference_url);
  if(href){a.href=href;a.target="_blank";a.rel="noopener noreferrer";card.append(a)}
 }else if(item.kind==="street"){card.append(node("p","MISSING PUBLIC PROOF URL"))}
 if(item.media_url){
  const media=item.kind==="video"?document.createElement("video"):document.createElement("audio");
  media.controls=true;media.preload="none";media.src=item.media_url;
  media.setAttribute("controlsList","nodownload");card.append(media);
  const info=node("small","PRIVATE MEDIA: signed review-only link expires in five minutes.");
  card.append(info);
 }
 if(item.state==="awaiting_upload"){
  card.append(node("p","FILE INCOMPLETE · Creator must finish the upload. No acceptance possible."));
  return card;
 }
 const instruction=node("p","Check rights, disclosure for promotional posts, originality, duration and whether this work was actually delivered. A submission does not authorize airtime.");
 instruction.style.fontSize="12px";card.append(instruction);
 const rights=node("label"),check=document.createElement("input");check.type="checkbox";
 rights.append(check,node("span","I reviewed this contribution and checked quality, permissions and required disclosures."));
 card.append(rights);
 const noteArea=node("textarea");noteArea.placeholder="Private reviewer note (optional, max 500 characters).";
 noteArea.maxLength=500;card.append(noteArea);
 const actions=node("div");actions.className="actions";
 const yes=node("button","ACCEPT & GRANT "+item.potential_hum+" VERIFIED HUM");
 const no=node("button","DECLINE");no.className="no";
 yes.type=no.type="button";
 yes.addEventListener("click",()=>decide(item,true,check,noteArea,yes,no));
 no.addEventListener("click",()=>decide(item,false,check,noteArea,yes,no));
 actions.append(yes,no);card.append(actions);
 return card;
}
async function decide(item,accept,check,noteArea,yes,no){
 if(busy)return;
 if(accept&&!check.checked){alert("Read the work and confirm rights and quality first.");return}
 if(!confirm((accept?"ACCEPT and award "+item.potential_hum+" verified HUM":"DECLINE")+" for "+item.title+"? This affects the private reward ledger."))return;
 busy=true;yes.disabled=no.disabled=true;note("Recording the reviewed disposition…");
 try{
  const result=await request("",{action:"review",id:item.id,accept,
   rights_checked:check.checked,note:noteArea.value.trim()});
  note("Recorded: "+result.decision+" · "+result.awarded_hum+" HUM awarded. Not auto-scheduled.");
  await load();
 }catch(e){note("REVIEW FAILED · "+e.message)}
 finally{busy=false;yes.disabled=no.disabled=false}
}
async function load(){
 if(busy)return;
 note("Checking the private station queue…");
 try{
  const data=await request("?mode=owner");
  if(data.schema!=="humkin.participation.owner.v1")throw Error("Unexpected owner response");
  const box=$("review-list");box.replaceChildren();
  note("OWNER ACCESS VERIFIED · "+data.items.length+" PRIVATE WORK ORDERS");
  if(!data.items.length){box.append(node("p","THE COMMITTEE HAS NO WORK. IT IS DEEPLY CONCERNED."));return}
  for(const item of data.items)box.append(itemCard(item));
 }catch(e){
  $("review-list").replaceChildren();
  note("ACCESS UNAVAILABLE · "+e.message);
 }
}
$("reload").addEventListener("click",load);
load();
