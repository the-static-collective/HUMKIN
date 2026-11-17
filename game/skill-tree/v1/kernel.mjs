/**
 * Universal Joy / HUMKIN: UI-neutral skill tree kernel.
 *
 * Slices are append-only, versioned proposals. This interpreter only projects
 * existing facts into affordances: no clocks, networking, spending, signing,
 * playable rewards, purchases, or execution of tool routes.
 */
const IDENT=/^[a-z][a-z0-9._-]{2,100}$/;
const FACT=/^[a-z][a-z0-9_]{1,64}$/;
const RELEASES=new Set(['live','pilot','planned']);
const REVEALS=new Set(['always','tease','on-parent']);
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const deny=s=>{throw new Error('SKILL_KERNEL_'+s);};

function validateNode(node) {
  if(!isRecord(node)||!IDENT.test(node.id||'')||
     (node.parent!==null&&!IDENT.test(node.parent||'')))deny('BAD_NODE');
  if(typeof node.title!=='string'||!node.title.trim()||node.title.length>100||
     typeof node.description!=='string'||node.description.length>400||
     !IDENT.test(node.capability||''))deny('BAD_METADATA');
  if(!RELEASES.has(node.release)||!REVEALS.has(node.reveal)||
     !Array.isArray(node.requires)||node.requires.length>8)deny('BAD_RULES');
  if((node.parent===null)!==(node.reveal==='always'))deny('BAD_ROOT_VISIBILITY');
  for(const g of node.requires){
    if(!isRecord(g))deny('BAD_GATE');
    const keys=Object.keys(g);
    if(Object.hasOwn(g,'fact')){
      if(keys.length!==2||!FACT.test(g.fact||'')||
         !Number.isSafeInteger(g.gte)||g.gte<0)deny('BAD_FACT_GATE');
    }else if(Object.hasOwn(g,'admission')){
      if(keys.length!==1||!IDENT.test(g.admission||''))deny('BAD_ADMISSION_GATE');
    }else deny('UNKNOWN_GATE');
  }
}

/** Compile a manifest and a map of relative slice paths -> JSON objects.
 * No network or mutable globals. Throws on broken ancestry, cycles, etc.
 */
export function compileCatalog(manifest,source) {
  if(!isRecord(manifest)||manifest.schema!=='humkin.skill-tree.catalog/v1'||
     !IDENT.test(manifest.root||'')||!Array.isArray(manifest.slices)||
     manifest.slices.length<1||manifest.slices.length>32||
     !isRecord(manifest.limits)||
     !Number.isInteger(manifest.limits.max_nodes)||
     !Number.isInteger(manifest.limits.max_depth)||
     manifest.limits.max_nodes<1||manifest.limits.max_nodes>256||
     manifest.limits.max_depth<1||manifest.limits.max_depth>24)deny('BAD_CATALOG');
  if(!isRecord(source))deny('BAD_SOURCE');
  const nodes=new Map(),owners=new Map(),mounts=[],seenPaths=new Set();
  for(const path of manifest.slices){
    if(typeof path!=='string'||!/^slices\/[a-z0-9_-]+\.json$/.test(path)||
       seenPaths.has(path))deny('BAD_SLICE_PATH');
    seenPaths.add(path);
    const s=source[path];
    if(!isRecord(s)||s.schema!=='humkin.skill-tree.slice/v1'||
       !IDENT.test(s.id||'')||
       (s.mount_at!==null&&!IDENT.test(s.mount_at||''))||
       !Array.isArray(s.nodes)||s.nodes.length<1||s.nodes.length>64)deny('BAD_SLICE');
    if(mounts.some(x=>x.id===s.id))deny('DUPLICATE_SLICE');
    const slot={id:s.id,mount:s.mount_at,rootCount:0};
    mounts.push(slot);
    for(const node of s.nodes){
      validateNode(node);
      if(nodes.has(node.id))deny('DUPLICATE_NODE');
      if(node.parent===s.mount_at)slot.rootCount++;
      nodes.set(node.id,Object.freeze({...node,
        requires:Object.freeze(node.requires.map(g=>Object.freeze({...g})))}));
      owners.set(node.id,s.id);
    }
  }
  if(nodes.size>manifest.limits.max_nodes||!nodes.has(manifest.root))deny('BOUNDS_OR_ROOT');
  const roots=[...nodes.values()].filter(n=>n.parent===null);
  if(roots.length!==1||roots[0].id!==manifest.root)deny('MULTIPLE_ROOTS');
  for(const slot of mounts){
    if(slot.rootCount<1||(slot.mount!==null&&!nodes.has(slot.mount)))deny('UNMOUNTED_SLICE');
    for(const n of nodes.values()){
      if(owners.get(n.id)!==slot.id||n.parent===null)continue;
      if(!nodes.has(n.parent))deny('ORPHAN');
      if(owners.get(n.parent)!==slot.id&&n.parent!==slot.mount)deny('CROSS_SLICE_PARENT');
    }
  }
  const depths=new Map(),visiting=new Set();
  function depth(id){
    if(depths.has(id))return depths.get(id);
    if(visiting.has(id))deny('CYCLE');
    const n=nodes.get(id);if(!n)deny('ORPHAN');
    visiting.add(id);
    const d=n.parent===null?0:depth(n.parent)+1;
    visiting.delete(id);
    if(d>manifest.limits.max_depth)deny('MAX_DEPTH');
    depths.set(id,d);
    return d;
  }
  for(const id of nodes.keys())depth(id);
  const ordered=[...nodes.values()].sort((a,b)=>
    depths.get(a.id)-depths.get(b.id)||a.id.localeCompare(b.id));
  return Object.freeze({
    schema:manifest.schema,root:manifest.root,
    ordered:Object.freeze(ordered),nodes,depths
  });
}

/** admissions may ONLY come from an owner-authorized, verified receiver.
 * A string in this call is NOT proof of cryptographic admission.
 */
export function projectSkills(compiled,facts={},admissions=[]){
  if(!compiled||!Array.isArray(compiled.ordered)||!isRecord(facts)||
     !Array.isArray(admissions))deny('BAD_PROJECTION');
  const accepted=new Set(admissions.filter(x=>typeof x==='string'));
  const projected=new Map();
  for(const n of compiled.ordered){
    const parent=n.parent===null?null:projected.get(n.parent);
    const visible=n.parent===null||(
      parent&&parent.status!=='HIDDEN'&&
      (n.reveal==='tease'||parent.status==='AVAILABLE')
    );
    let status='HIDDEN',missing=[];
    if(visible){
      missing=n.requires.filter(g=>Object.hasOwn(g,'fact')?
        !(Number.isSafeInteger(facts[g.fact])&&facts[g.fact]>=g.gte):
        !accepted.has(g.admission)).map(g=>Object.hasOwn(g,'fact')?
        g.fact+'>='+g.gte:'admit:'+g.admission);
      const parentAvailable=parent===null||parent.status==='AVAILABLE';
      const lacksLocalFact=missing.some(s=>!s.startsWith('admit:'));
      if(!parentAvailable||lacksLocalFact)status='LOCKED';
      else if(n.release==='planned')status='PLANNED';
      else if(n.release==='pilot')status='HELD';
      else if(missing.length)status='HELD';
      else status='AVAILABLE';
    }
    projected.set(n.id,Object.freeze({
      id:n.id,title:n.title,parent:n.parent,depth:compiled.depths.get(n.id),
      release:n.release,status,
      capability:status==='AVAILABLE'?n.capability:null,
      missing:Object.freeze(missing),description:n.description
    }));
  }
  const visible=Object.freeze([...projected.values()].filter(p=>p.status!=='HIDDEN'));
  return Object.freeze({
    schema:'humkin.skill-tree.projection/v1',visible,
    availableCapabilities:Object.freeze(visible.filter(x=>x.status==='AVAILABLE').map(x=>x.capability)),
    byId:id=>projected.get(id)||null
  });
}
