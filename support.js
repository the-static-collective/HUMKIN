import {AMOUNTS,RAILS,amountText,parseReceptacle,previewObservation,providerAmountStatus} from "./support-logic.mjs";
const coins=[...document.querySelectorAll("[data-cents]")];
const doors=document.getElementById("doors");
const result=document.getElementById("result");
const explain=document.getElementById("explain");
let cents=25;
let refreshDoors=()=>{};
for(const coin of coins){
  coin.addEventListener("click",()=>{
    const next=Number(coin.dataset.cents);
    if(!AMOUNTS.includes(next))return;
    cents=next;
    for(const item of coins)item.setAttribute("aria-pressed",String(item===coin));
    result.textContent="Selected "+amountText(cents)+". Nothing has been sent.";
    if(typeof refreshDoors==="function")refreshDoors();
  });
}
document.getElementById("test-drop").addEventListener("click",()=>{
  const trial=previewObservation(cents);
  result.textContent=amountText(trial.cents)+" — SIMULATED ONLY. "+trial.message;
});
function showUnavailable(message){
  doors.replaceChildren();
  const note=document.createElement("p");
  note.className="unavailable";note.textContent=message;
  doors.append(note);
  explain.textContent="No payment service is connected in this preview. You can try the make-believe coin without sending money.";
}
try{
  const response=await fetch("./support-doors.json",{cache:"no-store"});
  if(!response.ok)throw Error("Manifest unavailable");
  const manifest=parseReceptacle(await response.json());
  if(manifest.mode==="preview"){
    showUnavailable("THE JAR IS IN PRACTICE MODE. NO LIVE PAYMENT DOORS YET.");
  }else{
    doors.replaceChildren();
    const linkRows=[];
    for(const door of manifest.doors){
      const a=document.createElement("a");
      a.className="provider";a.textContent=RAILS[door.provider].label+" ↗";
      a.href=door.url;a.target="_blank";a.rel="noopener noreferrer";
      a.referrerPolicy="no-referrer";
      a.setAttribute("aria-label","Open "+RAILS[door.provider].label+" to make an optional contribution externally");
      a.addEventListener("click",()=>{
        result.textContent="Opening "+RAILS[door.provider].label+" for a suggested "+amountText(cents)+
          ". Enter the amount in the provider. This page cannot confirm payment.";
      });
      doors.append(a);
      linkRows.push({door,anchor:a});
    }
    const limitNote=document.createElement("p");
    limitNote.className="micro";
    doors.append(limitNote);
    refreshDoors=()=>{
      const blocked=[];
      for(const {door,anchor} of linkRows){
        const status=providerAmountStatus(door.provider,cents);
        anchor.hidden=!status.available;
        if(!status.available)blocked.push(RAILS[door.provider].label);
      }
      limitNote.textContent=blocked.length?
        blocked.join(", ")+" unavailable for "+amountText(cents)+" (documented minimum $1). Other providers may also have minimums or fees.":
        "Provider minimums and fees may apply.";
      explain.textContent="Selected "+amountText(cents)+". Opening a provider does not prefill or send money. Verify the recipient and enter the amount externally.";
    };
    refreshDoors();
  }
}catch{
  showUnavailable("THE JAR CANNOT VERIFY ITS CONFIGURATION. PAYMENTS DISABLED.");
}
