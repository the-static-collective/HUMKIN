/* HUMKIN Commons v0.1: discovery metadata only. No network upload, tracking, or automatic license grant. */
const SYMBOLS = {video:"▣",music:"♫",images:"✳",manga:"▤",games:"♠",design:"✂"};
const LABELS = {
  "public-preview":"PUBLIC PREVIEW · RIGHTS REVIEW",
  "drive-inventory":"INVENTORIED · NOT RELEASED",
  "project-index":"PROJECT INDEX · NOT RELEASED",
  "local-awaiting-intake":"LOCAL FILES · NOT UPLOADED",
  "design-not-found":"SOURCE NOT LOCATED"
};
const MEDIA = new Set(["mp4","mov","m4v","webm","mkv","avi","mp3","wav","flac","ogg","m4a","aiff","png","jpeg","jpg","webp","gif","svg","pdf","psd","kra","blend","obj","gltf","glb","indd","ai","eps","zip","svg","docx","pptx","odt","txt"]);
export function canRemix(entry) {
  const r = entry?.rights;
  // Never infer rights from public availability, possession, AI generation, or a download link.
  return Boolean(r && r.status === "cleared" && r.allow_remix === true &&
    typeof r.license_id === "string" && r.license_id.trim() &&
    typeof r.license_url === "string" && /^https:\/\//i.test(r.license_url) &&
    typeof entry.asset_url === "string" && entry.asset_url.trim() &&
    entry.availability === "published-cleared");
}
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const title = String(raw.title || "").trim();
  if (!id || !title) return null;
  return {id,title,kind:String(raw.kind || "other"),availability:String(raw.availability || "unknown"),
    source:String(raw.source || "Unverified"),note:String(raw.note || ""),preview_url:raw.preview_url || null,
    asset_url:raw.asset_url || null,rights:raw.rights || {status:"review_required"},parents:Array.isArray(raw.parents)?raw.parents:[]};
}
function safeHref(raw) {
  if (!raw || typeof raw !== "string") return null;
  try { const url = new URL(raw,document.baseURI);
    if (url.protocol === "https:" || url.origin === location.origin && url.protocol === "http:") return url.href;
  } catch {} return null;
}
function node(name, cls, value) {
  const el = document.createElement(name);
  if (cls) el.className = cls;
  if (value != null) el.textContent = String(value);
  return el;
}
function link(text, href, cls) {
  const a = node("a",cls,text);
  a.href=href; if (new URL(href,document.baseURI).origin !== location.origin){a.target="_blank";a.rel="noopener noreferrer";}
  return a;
}
let catalog=[], localEntries=[];
function render() {
  const q = document.querySelector("#q").value.trim().toLowerCase();
  const kind = document.querySelector("#kind").value;
  const state = document.querySelector("#state").value;
  const filtered = catalog.filter(a=>{
    if (q && ![a.title,a.note,a.source,a.kind].join(" ").toLowerCase().includes(q)) return false;
    if (kind !== "all" && a.kind !== kind) return false;
    if (state === "remix" && !canRemix(a)) return false;
    if (state === "preview" && !["public-preview","published-cleared"].includes(a.availability)) return false;
    if (state === "inventory" && ["public-preview","published-cleared"].includes(a.availability)) return false;
    return true;
  });
  const cards=document.querySelector("#cards");
  cards.replaceChildren();
  for (const a of filtered) {
    const open=canRemix(a);
    const article=node("article","card");
    const art=node("div","card-visual");
    art.append(node("span",null,SYMBOLS[a.kind]||"◇"), node("span","badge",open?"OPEN FOR REMIX":LABELS[a.availability]||"NEEDS REVIEW"));
    const body=node("div","card-body");
    body.append(node("p","source",a.source+" · "+a.kind),node("h3",null,a.title),node("p",null,a.note));
    const actions=node("div","card-actions");
    const preview=safeHref(a.preview_url);
    if (preview) actions.append(link("VIEW EXISTING PAGE ↗",preview,"preview"));
    if (open) {
      const file=safeHref(a.asset_url), lic=safeHref(a.rights.license_url);
      if (file && lic) {
        actions.append(link("BORROW / DOWNLOAD ↓",file,"borrow"));
        actions.append(link("READ LICENSE ↗",lic,"license"));
      } else {
        actions.append(node("p",null,"Release metadata requires valid public asset and license links."));
      }
    } else {
      const sub=encodeURIComponent("HUMKIN Commons · permissions for "+a.id);
      const b=encodeURIComponent("Hello, I'm interested in using "+a.title+".\n\nMy intended use:\n\nCould you clarify the permissions?");
      actions.append(link("ASK ABOUT REUSE ↗","mailto:us@abundent.org?subject="+sub+"&body="+b,"ask"));
    }
    body.append(actions);article.append(art,body);cards.append(article);
  }
  if(!filtered.length) cards.append(node("p","empty","No matches in this filter. That does not mean the work doesn't exist."));
  document.querySelector("#counts").textContent=catalog.length+" catalog leads · "+catalog.filter(canRemix).length+" explicitly released for remix · "+filtered.length+" shown";
}
function kindFor(path) {
  const ext=path.split(".").pop()?.toLowerCase()||"";
  if (["mp4","mov","m4v","webm","mkv","avi"].includes(ext)) return "video";
  if (["mp3","wav","flac","ogg","m4a","aiff"].includes(ext)) return "music";
  if (["png","jpeg","jpg","webp","gif","svg","psd","kra"].includes(ext)) return "images";
  if (["blend","obj","gltf","glb","ai","eps"].includes(ext)) return "design";
  return "other";
}
function drawLocal() {
  const count=document.querySelector("#local-count"), sample=document.querySelector("#local-sample");
  document.querySelector("#export-json").disabled=!localEntries.length;
  document.querySelector("#export-csv").disabled=!localEntries.length;
  count.textContent=localEntries.length?localEntries.length+" file records loaded locally. Nothing uploaded.":"No files selected.";
  sample.replaceChildren();
  if(localEntries.length){const ul=node("ul");for(const a of localEntries.slice(0,15))ul.append(node("li",null,a.relative_path||a.title||a.name));sample.append(ul);
  if(localEntries.length>15)sample.append(node("p",null,"…and "+(localEntries.length-15)+" more. Export to inspect the full set."));}
}
function importFiles(files) {
  if (!files?.length) return;
  if (files.length>10000) {document.querySelector("#local-status").textContent="Too many files at once; select a smaller folder (limit 10,000).";return;}
  localEntries=Array.from(files).filter(f=>MEDIA.has((f.name.split(".").pop()||"").toLowerCase()))
    .map(f=>({title:f.name,relative_path:f.webkitRelativePath||f.name,kind:kindFor(f.name),size_bytes:f.size,
       modified_utc:new Date(f.lastModified).toISOString(),rights:{status:"review_required"},availability:"local-only"}))
    .sort((a,b)=>a.relative_path.localeCompare(b.relative_path));
  document.querySelector("#local-status").textContent=localEntries.length+" recognized creative files indexed. To capture additional file types use the offline scanner.";
  drawLocal();
}
function importJSON(file) {
  if(!file)return;
  if(file.size>10_000_000){document.querySelector("#local-status").textContent="Manifest too large for browser import (10 MB limit).";return;}
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const data=JSON.parse(String(reader.result));
      const entries=Array.isArray(data)?data:(data.entries||data.assets||data.items);
      if(!Array.isArray(entries)) throw Error("JSON needs an entries, assets, or items array.");
      if(entries.length>10000)throw Error("Limit 10,000 entries per import.");
      localEntries=entries.map(a=>({
        title:String(a.title||a.name||a.relative_path||"Untitled"),
        relative_path:String(a.relative_path||a.path||a.title||a.name||""),
        kind:String(a.kind||kindFor(a.name||a.relative_path||"")),
        size_bytes:Number(a.size_bytes||a.size||0),
        modified_utc:String(a.modified_utc||a.mtime_utc||""),
        sha256:typeof a.sha256==="string"?a.sha256:null,
        rights:{status:"review_required"},availability:"local-only"
      }));
      document.querySelector("#local-status").textContent="Imported manifest metadata locally. No permissions have been granted or assets uploaded.";
      drawLocal();
    }catch(err){document.querySelector("#local-status").textContent="Couldn't read manifest: "+err.message;}
  };
  reader.readAsText(file);
}
function save(name, text, type) {
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob),a=node("a");a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function exportLocal(asCsv) {
  if(!localEntries.length)return;
  if(asCsv) {
    const cols=["title","relative_path","kind","size_bytes","modified_utc","sha256"];
    const csv=[cols.join(","),...localEntries.map(row=>cols.map(k=>'"'+String(row[k]??"").replaceAll('"','""')+'"').join(","))].join("\r\n");
    save("humkin-commons-local-inventory.csv",csv,"text/csv;charset=utf-8");return;
  }
  const manifest={schema_version:"commons.intake.v0.1",created_utc:new Date().toISOString(),
    notice:"Local metadata only. No upload, release, rights determination or backup of the media.",entries:localEntries};
  save("humkin-commons-local-inventory.json",JSON.stringify(manifest,null,2)+"\n","application/json");
}
async function init() {
  for (const id of ["q","kind","state"])document.getElementById(id).addEventListener(id==="q"?"input":"change",render);
  try {
    const response=await fetch("./commons/catalog.json",{cache:"no-store"});
    if(!response.ok)throw Error("Catalog HTTP "+response.status);
    const data=await response.json();
    if(!Array.isArray(data.entries)) throw Error("Invalid catalog");
    catalog=data.entries.map(normalizeEntry).filter(Boolean);
    render();
  } catch(err) {
    document.querySelector("#counts").textContent="Catalog unavailable";
    document.querySelector("#library-error").textContent="Couldn't load the catalog. You can still index your local files below.";
  }
  document.querySelector("#folder").addEventListener("change",e=>importFiles(e.target.files));
  document.querySelector("#files").addEventListener("change",e=>importFiles(e.target.files));
  document.querySelector("#manifest").addEventListener("change",e=>importJSON(e.target.files?.[0]));
  document.querySelector("#export-json").addEventListener("click",()=>exportLocal(false));
  document.querySelector("#export-csv").addEventListener("click",()=>exportLocal(true));
}
if(typeof document!=="undefined")init();
