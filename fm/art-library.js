/* HUMKIN RADIO shared artwork resolver: one image can belong to many tracks and shows.
 * Stored image paths are constrained to owner UUID / SHA-256 JPEG keys.
 */
(function(root){
"use strict";
const ORIGIN="https://kbhqacsdvjsstzyplqij.supabase.co";
const BUCKET="humkin-radio-art";
const PATH=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{64}\.jpg$/;
function publicUrl(path){
 if(typeof path!=="string"||!PATH.test(path))return null;
 return ORIGIN+"/storage/v1/object/public/"+BUCKET+"/"+path;
}
function libraryMap(rows){
 return new Map((Array.isArray(rows)?rows:[]).flatMap(row=>{
   const url=publicUrl(row?.storage_path);
   return url&&row.id?[[row.id,{...row,url}]]:[];
 }));
}
function effective(track,program,assets){
 const coverId=program?.art_asset_id||null;
 const trackId=track?.art_asset_id||null;
 if(coverId&&assets?.get(coverId)?.url)return assets.get(coverId).url;
 if(trackId&&assets?.get(trackId)?.url)return assets.get(trackId).url;
 return track?.artwork||null;
}
const api=Object.freeze({publicUrl,libraryMap,effective,BUCKET});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_ART=api;
})(typeof window!=="undefined"?window:globalThis);
