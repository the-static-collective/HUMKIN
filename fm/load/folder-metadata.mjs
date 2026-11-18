/* HUMKIN desktop folder import metadata. Pure, deterministic and safe to test offline.
 * File paths remain local: only owner-reviewed title/artist/album are cataloged.
 * Layouts refer to directories beneath the selected parent folder, from left to right.
 * Additional outer grouping directories are ignored, never guessed.
 */
export const FOLDER_FIELDS = Object.freeze(["artist","album","genre","collection","disc","ignore"]);
export function titleFromFile(name){
  return String(name||"").replace(/\.(mp3|wav|m4a|flac|aif|aiff|ogg)$/i,"")
    .replace(/^\d{1,3}[\s._-]+/,"").replace(/_+/g," ").replace(/\s+/g," ").trim().slice(0,240)||"Untitled song";
}
export function parseLayout(layout){
  if(!layout||layout==="none")return [];
  const tokens=String(layout).split("/").map(s=>s.trim().toLowerCase().replace(/^\{|\}$/g,""));
  if(tokens.length>8||tokens.some(t=>!FOLDER_FIELDS.includes(t))||
    new Set(tokens.filter(t=>t!=="ignore")).size!==tokens.filter(t=>t!=="ignore").length)
    throw new Error("Folder layout: use artist, album, genre, collection, disc or ignore separated by / (max 8; no repeated fields).");
  return tokens;
}
export function inferFileMetadata(relativePath,layout="none"){
  const segments=String(relativePath||"").replace(/\\/g,"/").split("/").filter(Boolean);
  const filename=segments.at(-1)||"";
  const folders=segments.length>2?segments.slice(1,-1):[]; // the first folder is the chosen parent
  const tokens=parseLayout(layout);
  const result={title:titleFromFile(filename),artist:"",album:"",genre:"",collection:"",disc:"",
    folders:folders.join(" / "),relativePath:segments.join("/")};
  for(let i=0;i<tokens.length;i++){
    const part=folders[folders.length-tokens.length+i];
    const token=tokens[i];
    if(part&&token!=="ignore")result[token]=part.slice(0,240).trim();
  }
  return result;
}
