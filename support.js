import {AMOUNTS,RAILS,amountText,parseReceptacle,previewObservation} from "./support-logic.mjs";
const coins=[...document.querySelectorAll("[data-cents]")];
const doors=document.getElementById("doors");
const result=document.getElementById("result");
const explain=document.getElementById("explain");
let cents=25;
for(const coin of coins){
  coin.addEventListener("click",()=>{
    const next=Number(coin.dataset.cents);
    if(!AMOUNTS.includes(next))return;
    cents=next;
    for(const item of coins)item.setAttribute("aria-pressed",String(item===coin));
    result.textContent="Selected "+amountText(cents)+". Nothing has been sent.";
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
  if(manifest.mode!=="live"){
    showUnavailable("THE JAR IS IN PRACTICE MODE. NO LIVE PAYMENT DOORS YET.");
  }else{
    doors.replaceChildren();
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
    }
    explain.textContent="Selected "+amountText(cents)+". The provider link does not prefill or transfer money. Verify the recipient and enter the amount in that app. Provider minimums and fees may apply.";
    for(const coin of coins)coin.addEventListener("click",()=>{
      explain.textContent="Selected "+amountText(cents)+". Verify the recipient and enter this amount in the external app; the selection is not a payment.";
    });
  }
}catch{
  showUnavailable("THE JAR CANNOT VERIFY ITS CONFIGURATION. PAYMENTS DISABLED.");
}
