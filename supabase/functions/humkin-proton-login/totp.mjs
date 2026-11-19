// TOTP RFC 6238 / RFC 4226: pure Web Crypto; shared by Edge and tests.
// This is a separate HUMKIN Radio entry in Proton, not the Tower TOTP seed.
const ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function encodeBase32(bytes){
  let value=0,bits=0,result="";
  for(const byte of bytes){
    value=value*256+byte;bits+=8;
    while(bits>=5){bits-=5;result+=ALPHABET[(value/2**bits|0)&31];value%=2**bits;}
  }
  if(bits)result+=ALPHABET[(value*2**(5-bits))&31];
  return result;
}
export function decodeBase32(value){
  if(typeof value!=="string"||!/^[A-Z2-7]{16,64}$/.test(value))throw Error("Invalid authenticator secret.");
  let bits=0,held=0,out=[];
  for(const letter of value){
    held=(held<<5)|ALPHABET.indexOf(letter);bits+=5;
    if(bits>=8){bits-=8;out.push((held>>bits)&255);}
  }
  return new Uint8Array(out);
}
export function generateSeed(){
  const bytes=new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32(bytes);
}
export async function codeAt(seed,step,digits=6){
  if(!Number.isSafeInteger(step)||step<0)throw Error("Invalid TOTP time step.");
  const key=await crypto.subtle.importKey("raw",decodeBase32(seed),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const input=new Uint8Array(8),view=new DataView(input.buffer);
  view.setUint32(0,Math.floor(step/4294967296));view.setUint32(4,step>>>0);
  const h=new Uint8Array(await crypto.subtle.sign("HMAC",key,input));
  const offset=h[h.length-1]&15;
  const code=(((h[offset]&127)<<24)|((h[offset+1]&255)<<16)|
    ((h[offset+2]&255)<<8)|(h[offset+3]&255))>>>0;
  return String(code%(10**digits)).padStart(digits,"0");
}
export async function matchCode(seed,input,now=Date.now(),lastStep=-1){
  if(typeof input!=="string"||!/^[0-9]{6}$/.test(input))return null;
  const current=Math.floor(now/30000);
  for(const step of [current,current-1,current+1]){
    if(step<=lastStep||step<0)continue;
    const expected=await codeAt(seed,step);
    // Fixed length comparisons; no actual token value is logged or returned.
    let diff=0;
    for(let i=0;i<6;i++)diff|=input.charCodeAt(i)^expected.charCodeAt(i);
    if(diff===0)return step;
  }
  return null;
}
export function provisioningUrl(seed,issuer="HUMKIN Radio",account="us@abundent.org"){
  return "otpauth://totp/"+encodeURIComponent(issuer+":"+account)+"?"+
    new URLSearchParams({secret:seed,issuer,algorithm:"SHA1",digits:"6",period:"30"}).toString();
}
