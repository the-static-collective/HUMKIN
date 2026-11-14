/* Local cover preparation. No source image leaves the device; only the new JPEG uploads.
 * Keep browser-side work bounded for modest Android memory and data plans.
 */
export async function prepareCover(file){
 const types=new Set(["image/jpeg","image/png","image/webp"]);
 if(!file||!types.has(file.type))throw Error("Choose a JPG, PNG or WebP image.");
 if(file.size>10*1024*1024)throw Error("Choose an image under 10 MB.");
 const input=URL.createObjectURL(file),image=new Image();
 try{
   await new Promise((resolve,reject)=>{
     image.onload=resolve;
     image.onerror=()=>reject(Error("The browser could not open this picture."));
     image.src=input;
   });
   const w=image.naturalWidth,h=image.naturalHeight;
   if(!w||!h||w>6000||h>6000)throw Error("Image must be 1–6000 pixels wide and high.");
   const size=Math.min(1024,w,h);
   const side=Math.min(w,h);
   const canvas=document.createElement("canvas");
   canvas.width=size;canvas.height=size;
   const ctx=canvas.getContext("2d");
   if(!ctx)throw Error("This browser cannot prepare the image.");
   ctx.fillStyle="#ffffff";ctx.fillRect(0,0,size,size);
   ctx.drawImage(image,(w-side)/2,(h-side)/2,side,side,0,0,size,size);
   const jpeg=await new Promise((resolve,reject)=>{
     canvas.toBlob(blob=>blob?resolve(blob):reject(Error("Could not create JPEG.")),"image/jpeg",0.84);
   });
   if(jpeg.size>5*1024*1024)throw Error("Compressed image too large for the art shelf.");
   return {file:new File([jpeg],"humkin-cover.jpg",{type:"image/jpeg"}),
     width:size,height:size};
 }finally{URL.revokeObjectURL(input)}
}
