#!/usr/bin/env node
/**
 * Inspect the emerging skill tree without launching the Android game or
 * committing to a UI skin. Prints only revealed nodes.
 *
 * node game/skill-tree/v1/demo.mjs 1
 * node game/skill-tree/v1/demo.mjs 4 2 1 0
 * node game/skill-tree/v1/demo.mjs 7 2 2 2
 */
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileCatalog,projectSkills} from './kernel.mjs';

const base=dirname(fileURLToPath(import.meta.url));
const read=path=>JSON.parse(readFileSync(join(base,path),'utf8'));
const manifest=read('catalog.json');
const source=Object.fromEntries(manifest.slices.map(path=>[path,read(path)]));
const argumentsIn=process.argv.slice(2);
const integers=argumentsIn.length?argumentsIn.map(v=>Number(v)):[1,0,0,0];
if(integers.some(v=>!Number.isSafeInteger(v)||v<0)||integers.length>4){
  process.stderr.write('Usage: demo.mjs [level] [antennaTier] [archiveTier] [crewTier]\n');
  process.exitCode=2;
}else{
  const [level=1,module_tower=0,module_archive=0,module_crew=0]=integers;
  const state=projectSkills(compileCatalog(manifest,source),{
    level,module_tower,module_archive,module_crew
  });
  console.log('HUMKIN / EMERGING WORLD — READ-ONLY DEV PREVIEW');
  console.log('Facts:',{level,module_tower,module_archive,module_crew});
  console.log('');
  for(const n of state.visible){
    const glyph=n.status==='AVAILABLE'?'●':n.status==='LOCKED'?'○':n.status==='HELD'?'◇':'·';
    console.log(' '.repeat(n.depth*2)+glyph+' '+n.title+'  ['+n.status+']');
    if(n.missing.length)console.log(' '.repeat(n.depth*2+3)+n.missing.join(' · '));
  }
  console.log('');
  console.log('Actual available capability IDs: '+state.availableCapabilities.length);
  console.log('No action, reward, queue, server, or radio setting changed.');
}
