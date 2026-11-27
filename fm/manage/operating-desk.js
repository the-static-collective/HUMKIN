/* Hash-addressable workspaces. No owner/session or station API changes. */
(() => {
 const panels=[...document.querySelectorAll("[data-desk-view]")];
 const links=[...document.querySelectorAll("[data-desk-link]")];
 if(!panels.length||panels.length!==links.length)return;
 const overview=panels.find(p=>p.dataset.deskView==="overview");
 if(!overview)return;
 function route(){
  let id="";
  try{id=decodeURIComponent(location.hash.slice(1))}catch{}
  const target=id?document.getElementById(id):null;
  const panel=target?.closest("[data-desk-view]")||overview;
  return {panel,target:target&&panel.contains(target)?target:null};
 }
 function render({focus=false,scroll=false}={}){
  const {panel,target}=route();
  for(const p of panels)p.hidden=p!==panel;
  for(const a of links){
   if(a.dataset.deskLink===panel.dataset.deskView)a.setAttribute("aria-current","page");
   else a.removeAttribute("aria-current");
  }
  if(scroll&&target&&target!==panel)target.scrollIntoView({block:"start"});
  else if(focus){
   panel.querySelector("h2")?.focus({preventScroll:true});
   panel.scrollIntoView({block:"start"});
  }
 }
 render({scroll:Boolean(location.hash)});
 window.addEventListener("hashchange",()=>render({focus:true,scroll:true}));
 // Repeated clicks on an already selected department still bring its heading into view.
 for(const link of links)link.addEventListener("click",()=>{
  if(location.hash===link.hash)render({focus:true});
 });
})();
