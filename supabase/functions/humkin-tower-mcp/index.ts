// TOWER 012c — native MCP adapter. Uses Supabase Auth OAuth 2.1 for consent
// and the existing Tower 012a-b owner/RLS HTTP command gate for state changes.
// THIS IS NOT AN UNAUTHENTICATED MCP SERVER OR A BROAD SQL TOOL.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createMcpHandler,McpServer} from "npm:@modelcontextprotocol/server@2.0.0";
import {pipeline} from "npm:@supabase/middleware@1.0.0";
import {withOAuthProtectedResource,withSupabase} from "npm:@supabase/server@1.6.0";
import {z} from "npm:zod@4.3.6";

const OWNER="us@abundent.org";
const API=Deno.env.get("SUPABASE_URL")||"";
const PUBLIC_KEY=Deno.env.get("SUPABASE_ANON_KEY")||"";
const GATE=API+"/functions/v1/humkin-tower-chat";
const station=z.literal("station-one");
const uuid=z.string().uuid();
const controls=z.enum(["queue_next","queue_end","hold","release","more","less"]);
const response=(value:unknown,isError=false)=>({isError,content:[{type:"text",text:JSON.stringify(value)}]});
const sanitizeCode=(s:unknown)=>typeof s==="string"&&/^[A-Z0-9_]{1,80}$/.test(s)?s:"REQUEST_FAILED";

Deno.serve(pipeline(
  [
    // Handles unauthenticated discovery, WWW-Authenticate, PKCE OAuth 2.1
    // protected resource metadata, then validates the actual user access token.
    withOAuthProtectedResource(),
    withSupabase({auth:"user"})
  ],
  async (req,{supabase})=>{
    // The OAuth consent may be granted to some other existing pantry-gate user.
    // This MCP server itself is owner-only, including read-only status/catalog.
    const {data,error}=await supabase.auth.getUser();
    if(error||!data?.user||
       data.user.email?.toLowerCase()!==OWNER||
       !data.user.email_confirmed_at){
      return Response.json({error:"OWNER_NOT_AUTHORIZED"},{status:403,
        headers:{"Cache-Control":"no-store"}});
    }
    const token=req.headers.get("authorization");
    if(!token||!/^Bearer\s+\S+$/i.test(token)||!PUBLIC_KEY)
      return Response.json({error:"OWNER_SESSION_UNAVAILABLE"},{status:401,
        headers:{"Cache-Control":"no-store"}});

    async function send(action:string,body:Record<string,unknown>={}){
      if(!API.startsWith("https://"))throw Error("TOWER_BACKEND_UNAVAILABLE");
      const payload={action,station_id:"station-one",...body};
      let res:Response;
      try{
        res=await fetch(GATE,{
          method:"POST",
          headers:{"Authorization":token,"apikey":PUBLIC_KEY,
            "Content-Type":"application/json"},
          body:JSON.stringify(payload),
          signal:AbortSignal.timeout(10000)
        });
      }catch{throw Error("TOWER_BACKEND_UNAVAILABLE")}
      const contentLength=Number(res.headers.get("content-length")||0);
      if(contentLength>100000)throw Error("TOWER_RESPONSE_TOO_LARGE");
      let result:Record<string,unknown>;
      try{result=await res.json()}catch{throw Error("TOWER_RESPONSE_UNAVAILABLE")}
      if(!res.ok||result.ok!==true)
        throw Error(sanitizeCode(result.error||result.reason));
      return result;
    }
    const handler=createMcpHandler(()=>{
      const server=new McpServer({name:"humkin-radio-tower",version:"0.1.0"});
      server.registerTool("tower_live_schedule",{
        title:"HUMKIN Cloud HOUSE live schedule",
        description:"Read verified current Cloud HOUSE program, now/next, future cues, published revision, and effective/pending request cursors. This is NOT proof a particular receiver heard it.",
        inputSchema:z.object({station_id:station}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async()=>{try{return response(await send("status"))}catch(e){return response({verified:false,error:String(e?.message||"UNVERIFIED")},true)}});
      server.registerTool("tower_search_catalog",{
        title:"Search published HUMKIN recordings",
        description:"Search approved, enabled public R2 catalog by title, album or artist. Return immutable UUID to disambiguate versions before any scheduling.",
        inputSchema:z.object({station_id:station,query:z.string().max(120).default("")}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({query})=>{try{return response(await send("catalog",{query}))}catch(e){return response({error:String(e?.message||"CATALOG_UNAVAILABLE")},true)}});
      server.registerTool("tower_recent_requests",{
        title:"HUMKIN Tower request receipts",
        description:"Inspect recent owner control request IDs with independently checked schedule acceptance/effective status. No listener-heard claim.",
        inputSchema:z.object({station_id:station}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async()=>{try{return response(await send("intents"))}catch(e){return response({error:String(e?.message||"REQUEST_UNAVAILABLE")},true)}});
      server.registerTool("tower_request_control",{
        title:"Submit one owner-approved future Tower control request",
        description:"WRITES one idempotent owner-scoped future-schedule request: queue next/end, hold/release or song weight +/-1. Call only after the owner explicitly requests this exact change. Never interrupts the playing audio, publishes HLS, or claims the request has aired. A fresh stable request_id UUID prevents duplicate retries.",
        inputSchema:z.object({
          station_id:station,
          track_id:uuid,
          command:controls,
          request_id:uuid,
          owner_confirmed:z.literal(true).describe("Must reflect the owner's explicit instruction for this exact track/action, not inferred from a suggestion")
        }),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({track_id,command,request_id})=>{
        try{return response(await send("control_request",{track_id,command,request_id}))}
        catch(e){return response({state:"UNVERIFIED",error:String(e?.message||"COMMAND_NOT_RECORDED"),
          note:"Do not issue a fresh request_id if this call timed out; verify prior receipt first."},true)}
      });
      return server;
    });
    return handler.fetch(req);
  }
));
