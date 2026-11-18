/* HUMKIN Station Manager — user-authored magnetic groups & optional rules.
 * No topic, voice, length or fictional content creates a rule automatically.
 */
const $=id=>document.getElementById(id);
function node(tag,label,cls=""){
 const n=document.createElement(tag);
 if(label!==null&&label!==undefined)n.textContent=String(label);
 if(cls)n.className=cls;
 return n;
}
function act(label,fn,cls="secondary"){
 const b=node("button",label,cls);b.type="button";b.addEventListener("click",fn);return b;
}
function field(label,control){
 const wrap=node("label");wrap.textContent=label;
 wrap.append(control);return wrap;
}
function option(select,value,label){
 const e=node("option",label);e.value=value;select.append(e);
}
function status(message,root){const x=node("p",message,"sub");x.setAttribute("role","status");root.append(x);return x}
function toMinutes(x){if(!/^\d\d:\d\d$/.test(x||""))return NaN;
 const [h,m]=x.split(":").map(Number);return h<24&&m<60?h*60+m:NaN;}
function fromMinutes(n){return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")}
function controlInput(type,value="",placeholder=""){
 const input=node("input");input.type=type;input.value=value;input.placeholder=placeholder;
 input.style.maxWidth="100%";return input;
}
function buildPicker(container,library,chosen,label){
 container.replaceChildren();
 const query=controlInput("search","","Find a recording or original filename…");
 query.setAttribute("aria-label",label+" search");
 const count=status(chosen.size+" selected",container);
 const list=node("div");list.style.cssText="max-height:250px;overflow:auto;border:2px solid #261d3e;border-radius:8px;background:white;padding:8px";
 container.append(query,list);
 const candidates=library.filter(t=>t.kind==="bumper").sort((a,b)=>a.title.localeCompare(b.title));
 function render(){
  list.replaceChildren();
  const q=query.value.trim().toLowerCase();
  const matching=candidates.filter(t=>[t.title,t.originalName,t.id].some(v=>String(v||"").toLowerCase().includes(q)));
  for(const t of matching){
   const c=controlInput("checkbox");c.checked=chosen.has(t.id);
   const row=node("label");row.style.cssText="display:flex;gap:8px;align-items:start;font-size:.85rem;border-bottom:1px solid #ddd;padding:5px;margin:0";
   const info=node("span",t.title+" · "+Math.round(t.duration)+"s · "+(t.published&&t.enabled?"ON AIR":"OFF AIR")+
     " · "+String(t.originalName||t.id).slice(0,90));
   row.append(c,info);list.append(row);
   c.addEventListener("change",()=>{
    if(c.checked)chosen.add(t.id);else chosen.delete(t.id);
    count.textContent=chosen.size+" selected";
   });
  }
  if(!matching.length)list.append(node("p","No matching recordings."));
 }
 query.addEventListener("input",render);render();
 return chosen;
}
function renderCard(target,title,detail,actions,off=false){
 const card=node("div",null,"block"+(off?" inactive":""));
 card.style.cssText="margin:10px 0;padding:12px;box-shadow:none;border-width:2px";
 card.append(node("h3",title),node("p",detail,"sub"));
 const row=node("div",null,"row");
 for(const [caption,handler,cls] of actions)row.append(act(caption,handler,cls||"secondary"));
 card.append(row);target.append(card);
}
export function mountBumperControls({db,ownerId,library,groups,rules,selected,refresh,authorize}){
 const groupRoot=$("group-editor-root"),ruleRoot=$("rule-editor-root");
 if(!groupRoot||!ruleRoot)return;
 const selectedBumpers=ids=>[...new Set(ids)].filter(id=>library.some(t=>t.id===id&&t.kind==="bumper")).slice(0,100);
 let working=false;
 const save=async(key,value,message,feedback)=>{
  if(working)return;
  working=true;feedback.textContent="Saving…";
  try{
   await authorize();
   const response=await db.from("humkin_radio_settings")
    .update({[key]:value,updated_at:new Date().toISOString()})
    .eq("id","main").eq("owner_id",ownerId).select("id").single();
   if(response.error||!response.data)throw Error(response.error?.message||"Owner update not accepted");
   await refresh(); // Re-read what the public players will load.
  }catch(error){feedback.textContent="Save failed: "+error.message}
  finally{working=false}
 };
 function openGroup(existing=null,initial=[]){
  const editor=node("div",null,"block");editor.style.marginTop="12px";
  const name=controlInput("text",existing?.name||"","e.g. Two recordings about the same subject");name.maxLength=100;
  const type=node("select");
  option(type,"attract","ATTRACT — related recordings tend to follow");
  option(type,"repel","REPEL — keep alternate cuts separated");
  type.value=existing?.kind||"attract";
  const enabled=controlInput("checkbox");enabled.checked=existing?.enabled!==false;
  const chosen=new Set(selectedBumpers(existing?.track_ids||initial));
  editor.append(node("h3",existing?"EDIT GROUP":"NEW MAGNETIC GROUP"),
    field("Group name",name),field("Relationship",type));
  const active=field(" ACTIVE (you decide)",enabled);editor.append(active);
  editor.append(node("p","Pick two or more recordings. No relationships are inferred.","sub"));
  const pick=node("div");editor.append(pick);buildPicker(pick,library,chosen,"Group recording");
  const feedback=status("",editor);
  const row=node("div",null,"row");editor.append(row);
  row.append(act("SAVE GROUP",()=>{
   const members=selectedBumpers(chosen);
   if(!name.value.trim()||members.length<2){feedback.textContent="Name the group and select at least two bumpers.";return}
   const newRow={id:existing?.id||crypto.randomUUID(),name:name.value.trim().slice(0,100),
    kind:type.value,enabled:enabled.checked,track_ids:members};
   const next=existing?groups.map(g=>g.id===existing.id?newRow:g):[...groups,newRow];
   if(next.length>60){feedback.textContent="Maximum 60 groups.";return}
   save("bumper_groups",next,"Group saved",feedback);
  },"primary"),act("CANCEL",()=>renderGroups()));
  groupRoot.replaceChildren(editor);
 }
 function renderGroups(){
  groupRoot.replaceChildren();
  const feedback=status(groups.length+" defined group(s) · "+groups.filter(g=>g.enabled).length+" active",groupRoot);
  for(const g of groups){
   const names=(g.track_ids||[]).map(id=>library.find(t=>t.id===id)?.title||id);
   renderCard(groupRoot,(g.enabled?"ON · ":"OFF · ")+(g.kind==="repel"?"REPEL: ":"ATTRACT: ")+g.name,
     names.join(" / ")||"No recordings selected",[
      ["EDIT",()=>openGroup(g),"primary"],
      [g.enabled?"PAUSE":"ACTIVATE",()=>save("bumper_groups",groups.map(x=>x.id===g.id?{...x,enabled:!g.enabled}:x),"",feedback)],
      ["DELETE",()=>{if(confirm("Delete relationship "+g.name+"? Audio files remain untouched."))
        save("bumper_groups",groups.filter(x=>x.id!==g.id),"",feedback)},"danger"]
     ],!g.enabled);
  }
  const row=node("div",null,"row");groupRoot.append(row);
  row.append(act("+ NEW GROUP",()=>openGroup(),"primary"),
    act("GROUP CHECKED LIBRARY BUMPERS",()=>openGroup(null,[...selected])));
 }
 function ruleEditor(existing=null,kind="hold"){
  const editor=node("div",null,"block");editor.style.marginTop="12px";
  const name=controlInput("text",existing?.name||"","A private scheduling rule");name.maxLength=100;
  const type=node("select");
  option(type,"hold","MANUAL HOLD — no automatic rotation");
  option(type,"daypart","DAYS AND HOURS — only inside this window");
  option(type,"date","CALENDAR DATES — only within these dates");
  type.value=existing?.kind||kind;
  const enabled=controlInput("checkbox");enabled.checked=existing?.enabled===true;
  const dayRow=node("div");const dateRow=node("div");
  const dayTitle=node("p","Allowed days (Central Time)");
  dayRow.append(dayTitle);
  const dayInputs=[];
  const checks=node("div",null,"days");dayRow.append(checks);
  ["SUN","MON","TUE","WED","THU","FRI","SAT"].forEach((label,index)=>{
   const c=controlInput("checkbox");c.checked=(existing?.days||[0,1,2,3,4,5,6]).includes(index);
   dayInputs.push(c);checks.append(field(label,c));
  });
  const start=controlInput("time",fromMinutes(existing?.start_minute??540));
  const end=controlInput("time",fromMinutes(existing?.end_minute??1020));
  dayRow.append(field("Start time",start),field("End time",end));
  const from=controlInput("date",existing?.start_date||"");
  const through=controlInput("date",existing?.end_date||"");
  dateRow.append(field("First day",from),field("Last day (inclusive)",through));
  const refreshFields=()=>{dayRow.hidden=type.value!=="daypart";dateRow.hidden=type.value!=="date"};
  type.addEventListener("change",refreshFields);
  const chosen=new Set(selectedBumpers(existing?.track_ids||[]));
  editor.append(node("h3",existing?"EDIT OPTIONAL RULE":"NEW OPTIONAL RULE · OFF"),
    field("Rule name",name),field("Rule behavior",type),
    field(" ENABLE THIS RULE (otherwise always OFF)",enabled),
    dayRow,dateRow);
  refreshFields();
  editor.append(node("p","Choose the recordings this restriction would apply to.","sub"));
  const pick=node("div");editor.append(pick);buildPicker(pick,library,chosen,"Rule recording");
  const feedback=status("",editor);
  const row=node("div",null,"row");editor.append(row);
  row.append(act("SAVE RULE",()=>{
    const members=selectedBumpers(chosen);
    if(!name.value.trim()||!members.length){feedback.textContent="Name the rule and select at least one bumper.";return}
    const days=dayInputs.map((x,i)=>x.checked?i:-1).filter(x=>x>=0);
    const startM=toMinutes(start.value),endM=toMinutes(end.value);
    if(enabled.checked&&type.value==="daypart"&&(!days.length||!Number.isInteger(startM)||!Number.isInteger(endM)||startM>=endM)){
      feedback.textContent="Select a day and valid start/end times (overnight requires two rules).";return;
    }
    if(enabled.checked&&type.value==="date"&&(!from.value||!through.value||from.value>through.value)){
      feedback.textContent="Choose a valid first and last date.";return;
    }
    const newRow={id:existing?.id||crypto.randomUUID(),name:name.value.trim().slice(0,100),
      kind:type.value,enabled:enabled.checked,track_ids:members,
      days,start_minute:Number.isInteger(startM)?startM:540,
      end_minute:Number.isInteger(endM)?endM:1020,
      start_date:from.value,end_date:through.value};
    const next=existing?rules.map(x=>x.id===existing.id?newRow:x):[...rules,newRow];
    if(next.length>60){feedback.textContent="Maximum 60 optional rules.";return}
    save("bumper_rules",next,"Rule saved",feedback);
  },"primary"),act("CANCEL",()=>renderRules()));
  ruleRoot.replaceChildren(editor);
 }
 function renderRules(){
  ruleRoot.replaceChildren();
  const active=rules.filter(r=>r.enabled).length;
  const feedback=status(rules.length+" optional rule(s) · "+active+" enabled · "+(active?"RESTRICTIONS IN FORCE":"ALL OFF"),ruleRoot);
  if(!rules.length)ruleRoot.append(node("p",
   "No restrictions configured. Prior time-of-day, 'top of the hour', request-line, show-opener and dated-announcement assumptions are OFF.","sub"));
  for(const r of rules){
   const names=(r.track_ids||[]).map(id=>library.find(t=>t.id===id)?.title||id);
   const detail=(r.kind==="daypart"?"Time window · ":r.kind==="date"?"Date window · ":"Always hold · ")+names.join(" / ");
   renderCard(ruleRoot,(r.enabled?"ON · ":"OFF · ")+r.name,detail,[
     ["EDIT",()=>ruleEditor(r),"primary"],
     [r.enabled?"DISABLE":"ENABLE",()=>{
       if(!r.enabled&&r.kind!=="hold")return ruleEditor({...r,enabled:true});
       return save("bumper_rules",rules.map(x=>x.id===r.id?{...x,enabled:!r.enabled}:x),"",feedback);
     }],
     ["DELETE",()=>{if(confirm("Delete optional rule "+r.name+"?"))
       save("bumper_rules",rules.filter(x=>x.id!==r.id),"",feedback)},"danger"]
   ],!r.enabled);
  }
  const row=node("div",null,"row");ruleRoot.append(row);
  row.append(act("+ MANUAL HOLD",()=>ruleEditor(null,"hold"),"secondary"),
    act("+ DAYS & HOURS",()=>ruleEditor(null,"daypart"),"secondary"),
    act("+ CALENDAR DATES",()=>ruleEditor(null,"date"),"secondary"));
 }
 renderGroups();renderRules();
}
