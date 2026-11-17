// HUMKIN owner-only R2 bridge client. Uses the existing Supabase email session.
// Credentials for Cloudflare are server-only; never embed them in web code.
export const R2_BRIDGE_URL="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-r2-bridge";
export async function r2Bridge(db,action,trackId){
 const {data,error}=await db.auth.getSession();
 const session=data?.session;
 if(error||!session?.access_token)throw Error("HUMKIN owner sign-in required");
 const response=await fetch(R2_BRIDGE_URL,{
  method:"POST",headers:{"Content-Type":"application/json",
   Authorization:"Bearer "+session.access_token},
  body:JSON.stringify({action,track_id:trackId||undefined}),
  cache:"no-store"
 });
 let body;
 try{body=await response.json()}catch{throw Error("R2 bridge could not be reached. Supabase publication was not changed.")}
 if(!response.ok||body?.ok!==true){
  const code=String(body?.error||"BRIDGE_UNAVAILABLE");
  const ex=new Error(code.replaceAll("_"," "));
  ex.code=code;throw ex;
 }
 return body;
}
