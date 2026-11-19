// HUMKIN MESH RADIO 001: portable link blocks; no central server or credentials.
// A recording's byte identity, the nodes that report copies, and playable URLs
// are separate facts. None of these declarations grants publication permission.
export const SCHEMA = "humkin.mesh/linkblocks/v1";
const SHA = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const MAX_RECORDINGS = 30000, MAX_ROUTES = 90000;
const STATION = Object.freeze({id:"compost-heap",name:"The Compost Heap",selection:"least-played",scope:"all"});
const text = (value,max=240) => typeof value==="string" ? value.trim().slice(0,max) : "";
export const idFor = hash => {
  if(!SHA.test(hash))throw Error("A recording needs a SHA-256 fingerprint.");
  return "sha256:"+hash;
};
export const blank = () => ({schema:SCHEMA,nodes:[],recordings:[],routes:[],stations:[{...STATION}]});
const clone = x => JSON.parse(JSON.stringify(x));
function sourceId(source){return "node:"+source}
function addNode(graph,node){
  const old=graph.nodes.find(n=>n.id===node.id);
  if(old)return old;
  graph.nodes.push(node);
  return node;
}
function addRecording(graph,data){
  const id=idFor(data.sha256);
  const existing=graph.recordings.find(r=>r.id===id);
  if(existing){
    // Prefer informative metadata, but never invent a different byte identity.
    for(const key of ["title","artist","album"]){
      if(!existing[key]&&text(data[key]))existing[key]=text(data[key],key==="artist"?160:240);
    }
    if(!existing.duration_seconds&&Number(data.duration_seconds)>0)
      existing.duration_seconds=Number(data.duration_seconds);
    return existing;
  }
  if(graph.recordings.length>=MAX_RECORDINGS)throw Error("Split this crate into smaller manifests.");
  const record={id,sha256:data.sha256,title:text(data.title)||"Untitled recording",
    artist:text(data.artist,160),album:text(data.album),duration_seconds:
      Number(data.duration_seconds)>0&&Number(data.duration_seconds)<=86400?
        Number(data.duration_seconds):null};
  graph.recordings.push(record);
  return record;
}
function addRoute(graph,route){
  if(!graph.recordings.some(r=>r.id===route.recording))throw Error("Unknown recording for route.");
  if(!graph.nodes.some(n=>n.id===route.node))throw Error("Unknown node for route.");
  if(graph.routes.some(x=>x.recording===route.recording&&x.node===route.node&&
    x.transport===route.transport&&(x.url||"")===(route.url||"")))return false;
  if(graph.routes.length>=MAX_ROUTES)throw Error("Too many locations for one manifest.");
  graph.routes.push(route);
  return true;
}
export function safeAudioUrl(value){
  if(typeof value!=="string"||value.length>1600||!value.trim())throw Error("Missing public audio URL.");
  let url;
  try{url=new URL(value)}catch{throw Error("Invalid public audio URL.")}
  if(url.protocol!=="https:"||url.username||url.password||url.hash||!url.hostname||
     /^(localhost|.*\.localhost|.*\.local)$/i.test(url.hostname)||
     /^(127\.|10\.|192\.168\.|0\.|169\.254\.)/.test(url.hostname)||
     /^172\.(1[6-9]|2[0-9]|3[01])\./.test(url.hostname))
    throw Error("Use a public HTTPS media address, without credentials or a local network address.");
  for(const key of url.searchParams.keys()){
    if(/(?:token|key|secret|password|signature|sig|auth|credential|code)/i.test(key))
      throw Error("Signed and credential-bearing URLs cannot become permanent routes.");
  }
  if(!/\.(mp3|m4a|wav|ogg|opus|flac|aac)(?:$|[?])/i.test(url.pathname+url.search))
    throw Error("Link directly to an audio file, not a login, player, or webpage.");
  return url.href;
}
// Existing scanner inventories identify bytes and devices; they cannot prove
// that a device is currently online or that its private audio can be fetched.
export function ingestInventory(graph,inventory){
  if(inventory?.schema!=="humkin.mesh/inventory/v1"||
    !UUID.test(inventory.node_id||"")||!Array.isArray(inventory.files)||
    inventory.files.length>100000)throw Error("Not a supported HUMKIN MESH inventory.");
  const node=sourceId(inventory.node_id);
  addNode(graph,{id:node,label:text(inventory.label,120)||"Music computer",kind:"device"});
  let copies=0;
  for(const row of inventory.files){
    if(!row||!SHA.test(row.sha256||""))continue;
    const record=addRecording(graph,row);
    if(addRoute(graph,{recording:record.id,node,transport:"device"}))copies++;
  }
  return {node,copies};
}
export function addBrowserFile(graph,{sha256,title,duration_seconds}){
  const record=addRecording(graph,{sha256,title,duration_seconds,artist:"",album:""});
  addNode(graph,{id:"node:browser",label:"Files selected in this browser",kind:"device"});
  addRoute(graph,{recording:record.id,node:"node:browser",transport:"device"});
  return record;
}
export function addHosted(graph,{sha256,url,provider="https",title=""}){
  const id=idFor(sha256),record=graph.recordings.find(r=>r.id===id);
  if(!record)throw Error("First add or discover the recording's fingerprint.");
  const safe=safeAudioUrl(url);
  const normalized=text(provider.toLowerCase(),63).replace(/[^a-z0-9-]/g,"-");
  if(!HANDLE.test(normalized))throw Error("Choose a short host name.");
  const node="host:"+normalized;
  addNode(graph,{id:node,label:normalized,kind:"host"});
  addRoute(graph,{recording:id,node,transport:"https",url:safe});
  if(title&&!record.title)record.title=text(title);
  return record;
}
export function ingestPublishedCrate(graph,rows){
  if(!Array.isArray(rows)||rows.length>3000)throw Error("Unexpected published radio catalog.");
  let count=0;
  for(const row of rows){
    if(!SHA.test(row?.sha256||"")||row?.enabled!==true||row?.kind==="bumper"||
       row?.storage_provider!=="r2"||!row?.published_at||
       !/^tracks\/[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/.test(row?.r2_object_key||"")||
       !row.r2_object_key.endsWith("/"+row.sha256+".mp3"))continue;
    addRecording(graph,{sha256:row.sha256,title:row.title,artist:row.artist,
      album:row.album,duration_seconds:row.duration_seconds});
    const url="https://media.abundent.org/"+row.r2_object_key;
    addHosted(graph,{sha256:row.sha256,url,provider:"humkin-r2"});
    count++;
  }
  return count;
}
export function portable(graph){
  validate(graph);
  // No directory names, relative paths, blob URLs, sessions, keys, playback
  // history, or private storage object names are carried in this format.
  return clone({schema:SCHEMA,nodes:graph.nodes,recordings:graph.recordings,
    routes:graph.routes,stations:graph.stations});
}
export function validate(input){
  if(!input||input.schema!==SCHEMA||!Array.isArray(input.nodes)||
     !Array.isArray(input.recordings)||!Array.isArray(input.routes)||
     !Array.isArray(input.stations)||input.nodes.length>4000||
     input.recordings.length>MAX_RECORDINGS||input.routes.length>MAX_ROUTES)
    throw Error("Not a supported bounded Linkblocks manifest.");
  const nodeIds=new Set(),recIds=new Set();
  for(const node of input.nodes){
    if(!node||!/^node:[a-z0-9-]{1,63}$|^host:[a-z0-9-]{1,63}$/.test(node.id||"")||
       !["host","device"].includes(node.kind)||!text(node.label,120))
      throw Error("Invalid node.");
    if(nodeIds.has(node.id))throw Error("Duplicate node.");
    nodeIds.add(node.id);
  }
  for(const row of input.recordings){
    if(!row||!SHA.test(row.sha256||"")||row.id!==idFor(row.sha256)||
       !text(row.title)||row.title.length>240||
       typeof row.artist!=="string"||row.artist.length>160||
       typeof row.album!=="string"||row.album.length>240||
       !(row.duration_seconds===null||
          (typeof row.duration_seconds==="number"&&row.duration_seconds>0&&row.duration_seconds<=86400)))
      throw Error("Invalid recording.");
    if(recIds.has(row.id))throw Error("Duplicate recording.");
    recIds.add(row.id);
  }
  const keys=new Set();
  for(const r of input.routes){
    if(!r||!recIds.has(r.recording)||!nodeIds.has(r.node)||
       !["device","https"].includes(r.transport)||
       (r.transport==="https"&&safeAudioUrl(r.url)!==r.url)||
       (r.transport==="device"&&("url" in r))||
       (r.transport==="https"&&!r.node.startsWith("host:"))||
       (r.transport==="device"&&!r.node.startsWith("node:")))
      throw Error("Invalid location route.");
    const key=[r.recording,r.node,r.transport,r.url||""].join("|");
    if(keys.has(key))throw Error("Duplicate location.");
    keys.add(key);
  }
  for(const s of input.stations){
    if(!s||s.id!==STATION.id||s.selection!==STATION.selection||s.scope!=="all")
      throw Error("Unrecognized station recipe.");
  }
  if(input.stations.length!==1)throw Error("Compost Heap recipe is required.");
  return input;
}
export function merge(graph,incoming){
  validate(incoming);
  for(const n of incoming.nodes)addNode(graph,clone(n));
  for(const r of incoming.recordings)addRecording(graph,r);
  for(const route of incoming.routes)addRoute(graph,clone(route));
  return graph;
}
export function sources(graph,sha256,browserFiles=new Map(),failed=new Set()){
  const id=idFor(sha256),result=[];
  if(browserFiles.has(sha256)&&!failed.has("browser:"+sha256))
    result.push({key:"browser:"+sha256,url:browserFiles.get(sha256).url,provider:"This computer"});
  for(const r of graph.routes){
    if(r.recording!==id||r.transport!=="https")continue;
    const key=r.node+"|"+r.url;
    if(!failed.has(key))result.push({key,url:r.url,provider:r.node.slice(5)});
  }
  return result;
}
export function nextCompost(graph,playHistory={},browserFiles=new Map(),failed=new Set(),exclude=""){
  const playable=graph.recordings.filter(r=>r.sha256!==exclude&&
    sources(graph,r.sha256,browserFiles,failed).length);
  playable.sort((a,b)=>{
    const ah=playHistory[a.sha256]||{},bh=playHistory[b.sha256]||{};
    return (Number(ah.count)||0)-(Number(bh.count)||0)||
      (Number(ah.last)||0)-(Number(bh.last)||0)||
      a.id.localeCompare(b.id);
  });
  return playable[0]||null;
}
