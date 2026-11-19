import {validatePack,candidateTags,reviewRecord,unreviewRecord,
 publicEnrichment,shortlist,normalizeTagText} from "./catalog-review.mjs";
const $=id=>document.getElementById(id);
let pack=null,page=0,visible=[];
const PAGE=50;
function status(s){$("status").textContent=s}
function download(name,data){
 const blob=new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function small(parent,text,cls="meta"){
 const node=document.createElement("p");node.className=cls;node.textContent=text;
 parent.append(node);
}
function trackCard(r){
 const article=document.createElement("article");article.className="track";
 const label=document.createElement("strong");
 label.textContent=r.title||r.filename||"Untitled recording";
 article.append(label);
 small(article,(r.artist||"Unknown artist")+" · "+(r.album||"Unknown album")+
  " · "+(r.duration_seconds||0)+" sec · "+r.mp3_sha256.slice(0,13));
 const proposed=candidateTags(r);
 small(article, "Suggested: "+(proposed.join(" · ")||"No style evidence"),
  "muted");
 if(r.possible_family_hashes?.length)
  small(article,"POSSIBLE ALTERNATE VERSION · review; never auto-merge","note");
 const tags=document.createElement("textarea");
 tags.setAttribute("aria-label","Review tags for "+r.title);
 tags.value=(r.reviewed_tags||proposed).join(", ");
 tags.addEventListener("input",()=>{
  r.reviewed_tags=null;unreviewRecord(r);
  reviewButton.textContent="APPROVE TAGS";
 });
 article.append(tags);
 const actions=document.createElement("div");actions.className="inline";
 const reviewButton=document.createElement("button");
 reviewButton.type="button";
 reviewButton.textContent=r.approved_for_tag_publication?"RE-APPROVE TAGS":"APPROVE TAGS";
 reviewButton.addEventListener("click",()=>{
  try{reviewRecord(r,tags.value);reviewButton.textContent="REVIEWED ✓";
   status("Reviewed "+(r.title||r.filename)+". No public change made.");
  }catch(e){status(e.message)}
 });
 const withdraw=document.createElement("button");withdraw.type="button";
 withdraw.className="secondary";withdraw.textContent="WITHHOLD";
 withdraw.addEventListener("click",()=>{
  unreviewRecord(r);reviewButton.textContent="APPROVE TAGS";
  status("Metadata withheld for "+(r.title||r.filename)+".");
 });
 actions.append(reviewButton,withdraw);article.append(actions);
 const details=document.createElement("details");
 const summary=document.createElement("summary");
 summary.textContent="Evidence / human description (LOCAL ONLY)";
 details.append(summary);
 const pre=document.createElement("pre");
 pre.textContent=JSON.stringify({suno_style:r.suno_style,
  human_description:r.human_description,
  metadata_provenance:r.metadata_provenance,
  suggestions:r.suggestions,possible_family_hashes:r.possible_family_hashes},null,2);
 details.append(pre);article.append(details);
 return article;
}
function redraw(){
 if(!pack){$("items").textContent="Open a local candidates file first.";return}
 visible=shortlist(pack,$("search").value,$("filter").value);
 page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(visible.length/PAGE)-1)));
 const rows=visible.slice(page*PAGE,(page+1)*PAGE);
 const root=$("items");root.replaceChildren();
 for(const row of rows)root.append(trackCard(row));
 $("prev").disabled=page===0;
 $("next").disabled=(page+1)*PAGE>=visible.length;
 $("page").textContent=(visible.length?page*PAGE+1:0)+"–"+
  Math.min(visible.length,(page+1)*PAGE)+" of "+visible.length+" matches";
 const reviewed=pack.tracks.filter(r=>r.approved_for_tag_publication).length;
 status(pack.tracks.length+" tracks · "+reviewed+" reviewed · "+
  (pack.tracks.length-reviewed)+" unreviewed. Nothing has been published.");
}
$("load").addEventListener("change",async()=>{
 const file=$("load").files?.[0];if(!file)return;
 if(file.size>60*1024*1024){status("File exceeds 60 MiB review limit.");return}
 try{
  const next=validatePack(JSON.parse(await file.text()));
  pack=next;page=0;redraw();
 }catch(e){status("Cannot load: "+e.message)}
});
$("search").addEventListener("input",()=>{page=0;redraw()});
$("filter").addEventListener("change",()=>{page=0;redraw()});
$("prev").addEventListener("click",()=>{page--;redraw()});
$("next").addEventListener("click",()=>{page++;redraw()});
$("approve-page").addEventListener("click",()=>{
 if(!pack)return;
 const rows=visible.slice(page*PAGE,(page+1)*PAGE);
 try{
  for(const r of rows)reviewRecord(r,(r.reviewed_tags||candidateTags(r)).join(", "));
  redraw();status(rows.length+" visible candidates reviewed. Still local only.");
 }catch(e){status(e.message)}
});
$("clear-page").addEventListener("click",()=>{
 if(!pack)return;
 const rows=visible.slice(page*PAGE,(page+1)*PAGE);
 for(const r of rows)unreviewRecord(r);
 redraw();status(rows.length+" visible candidates withheld.");
});
$("save-review").addEventListener("click",()=>{
 if(!pack)return status("Open a catalogue first.");
 download("humkin-catalog-private-review.json",pack);
 status("Private draft saved locally; contains source descriptions. Do not publicly commit.");
});
$("export-public").addEventListener("click",()=>{
 if(!pack)return status("Open a catalogue first.");
 try{
  const manifest=publicEnrichment(pack);
  download("catalog-enrichment.json",manifest);
  status(manifest.tracks.length+" reviewed tag sets exported. Commit separately to publish.");
 }catch(e){status(e.message)}
});
