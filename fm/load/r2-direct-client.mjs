// Private R2 transfer client. The owner session authorizes metadata operations;
// one short-lived, object-scoped presigned PUT goes directly from browser to R2.
export const DIRECT_URL="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-r2-direct";
const PUBLIC_KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
export async function r2Direct(db,action,fields={}){
 const {data,error}=await db.auth.getSession();
 if(error||!data?.session?.access_token)throw Error("Sign in as owner to use direct R2 upload.");
 const response=await fetch(DIRECT_URL,{method:"POST",
  headers:{"Content-Type":"application/json","Authorization":"Bearer "+data.session.access_token,
   "apikey":PUBLIC_KEY},
  body:JSON.stringify({action,...fields})});
 let body;try{body=await response.json()}catch{throw Error("Direct R2 service did not respond with JSON.");}
 if(!response.ok||body?.ok!==true){
  const reason=String(body?.error||"R2_DIRECT_UNAVAILABLE");
  const err=Error(reason);err.code=reason;throw err;
 }
 return body;
}
export function putPrivateMp3(file,signedUrl,onProgress=()=>{}){
 const u=new URL(signedUrl);
 // Never transmit local audio to a non-R2 endpoint.
 if(u.protocol!=="https:"||!/^[0-9a-f]{32}\.r2\.cloudflarestorage\.com$/i.test(u.hostname)||
   !/^\/[a-z0-9-]+\/stage\/[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/i.test(u.pathname))
  return Promise.reject(Error("Rejected unexpected R2 upload URL."));
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open("PUT",u.href,true);
  xhr.timeout=180000;xhr.setRequestHeader("Content-Type","audio/mpeg");
  xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(event.loaded,event.total)};
  xhr.onload=()=>{
   if(xhr.status>=200&&xhr.status<300){onProgress(file.size,file.size);resolve();}
   else reject(Error("Private R2 upload failed (HTTP "+xhr.status+"). Retry the crate."));
  };
  xhr.onerror=()=>reject(Error("Network error while uploading to R2. Retry the crate."));
  xhr.ontimeout=()=>reject(Error("R2 upload timed out. Retry the crate."));
  xhr.send(file);
 });
}
