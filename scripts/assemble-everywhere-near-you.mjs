/**
 * Assemble original MP3 preview bytes from verified binary Git parts.
 *
 * GitHub's text-only connector could not upload MP3s directly. Binary parts
 * were staged as native Git blobs, and are byte-concatenated here before the
 * GitHub Pages artifact is built. No transcoding or lossy conversion occurs.
 *
 * Do not use these preview encodes as lossless distribution masters.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
const folder=resolve('releases/everywhere-near-you/audio');
const parts=join(folder,'.parts');
const expected={
 '01_home_with_you.mp3':'2217d11b7f3473049af00502cf6f266390c9dc864fb7e72ac6528e3cec1d784b',
 '02_rose_mary_water.mp3':'ca888a1c8a0c24540b8fd4450728e5f5597e7e19e33be1da0f930b92627443ed',
 '03_hopeful_resilience.mp3':'207e50cf71efb20fb7d4c5cf0e895b357adacd1f1c48b29d4e8173c5f400f302',
 '04_blue_night_morning_bloom.mp3':'6ae3a6916c6214f7582da048246596d36a6cf355effe1dd68c47d685fef3acc6',
 '05_lovely_blue_bloom.mp3':'b01b66e5892ced0a2af274460de331e6cb43119277ad42ab49308e04a8904046',
 '06_there_by_two.mp3':'171f7637aaed355e0b48f635c072d42fae91c2c1a1fd97e6c4dee351bef11b9b',
 '07_blue_bowl_rings.mp3':'c2496d221cc25689fc612b7ba1edbfaff3590b1e710de19482e02f22c56b1e30'
};
for(const [name,digest] of Object.entries(expected)){
 const target=join(folder,name);
 let buffer;
 if(existsSync(parts)){
  const source=join(parts,name);
  if(!existsSync(source))throw new Error('Missing part directory: '+source);
  const files=readdirSync(source).filter(n=>/^\d{3}\.part$/.test(n)).sort();
  if(files.length<1||files.some((s,i)=>s!==String(i).padStart(3,'0')+'.part'))throw new Error('Incomplete fragment sequence: '+name);
  buffer=Buffer.concat(files.map(n=>readFileSync(join(source,n))));
 }else if(existsSync(target)){buffer=readFileSync(target)}
 else throw new Error('Missing audio and parts: '+name);
 const hash=createHash('sha256').update(buffer).digest('hex');
 if(hash!==digest)throw new Error('Checksum mismatch for '+name+': '+hash);
 if(buffer.subarray(0,3).toString('ascii')!=='ID3' && buffer[0]!==0xff)throw new Error('Unexpected MP3 header '+name);
 writeFileSync(target,buffer);
 console.log('Verified '+name+' ('+statSync(target).size+' bytes)');
}
if(existsSync(parts))rmSync(parts,{recursive:true,force:true});
const cover=readFileSync(resolve('releases/everywhere-near-you/cover.jpg'));
const coverHash=createHash('sha256').update(cover).digest('hex');
if(coverHash!=='cf754189c3f86aa029dd3a192690783c669297e54eb68c59de3a2ec1227ed0ce')throw new Error('Album cover checksum mismatch');
console.log('All 7 songs and cover verified; distributable preview directory assembled.');
