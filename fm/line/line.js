(async()=>{
 const $=id=>document.getElementById(id);
 const make=(label,href)=>{
  const a=document.createElement("a");a.className="action";a.textContent=label;a.href=href;
  $("actions").append(a);
 };
 try{
  const [r,live]=await Promise.all([
   fetch("./config.json",{cache:"no-store"}),
   fetch("https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-radio-line/health",
     {cache:"no-store"}).catch(()=>null)
  ]);
  if(!r.ok)throw Error("public config unavailable");
  const config=await r.json();
  const health=live?.ok?await live.json().catch(()=>null):null;
  if(config.state==="active"&&health?.ready===true&&
    /^\+[1-9][0-9]{7,14}$/.test(config.number||"")){
   $("state").textContent="THE REQUEST LINE IS OPEN";
   $("phone").textContent=config.number;
   if(config.voice_enabled)make("☎ CALL THE STATION","tel:"+config.number);
   if(config.sms_enabled)make("✉ TEXT THE STATION","sms:"+config.number);
  }else{
   $("state").textContent="THE SWITCHBOARD IS BEING WIRED";
   $("phone").textContent="No public telephone number yet.";
   $("actions").replaceChildren();
  }
 }catch{
  $("state").textContent="THE SWITCHBOARD IS NOT CONFIRMED ONLINE";
  $("phone").textContent="No verified telephone number is available.";
 }
})();