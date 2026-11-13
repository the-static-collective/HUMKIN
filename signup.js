(()=>{"use strict";
const form=document.getElementById("mailing-form");
if(!form)return;
const email=form.querySelector("#mailing-email");
const consent=form.querySelector("#mailing-consent");
const website=form.querySelector("#mailing-website");
const status=form.querySelector("#mailing-status");
const button=form.querySelector("#mailing-submit");
const endpoint="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-subscribe";
function report(message,kind){status.textContent=message;status.dataset.kind=kind}
form.addEventListener("submit",async e=>{
  e.preventDefault();
  report("","");
  if(!email.validity.valid||!email.value.trim()){report("Please enter a valid email address.","error");email.focus();return}
  if(!consent.checked){report("Please check the box to join the mailing list.","error");consent.focus();return}
  button.disabled=true;
  const label=button.textContent;button.textContent="SENDING…";
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(endpoint,{method:"POST",mode:"cors",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.value,consent:true,website:website.value}),signal:controller.signal,cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw new Error(data.message||"Unable to join. Please retry.");
    report("You're on the HUMKIN list. Thanks for joining. ✳","success");
    form.reset();
  }catch(err){
    report(err.name==="AbortError"?"Connection timed out. Please retry.":(err.message||"Unable to join right now. Please retry."),"error");
  }finally{clearTimeout(timeout);button.disabled=false;button.textContent=label}
});
})();
