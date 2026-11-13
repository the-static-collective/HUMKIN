import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {canRemix,normalizeEntry} from '../commons.mjs';

const root=resolve(import.meta.dirname,'..');
const catalog=JSON.parse(readFileSync(join(root,'commons/catalog.json'),'utf8'));

test('catalog candidates are indexed but not silently licensed or published',()=>{
  assert.ok(catalog.entries.length>=15);
  assert.ok(catalog.entries.some(a=>a.title.includes('Manga assemblies')));
  assert.ok(catalog.entries.some(a=>a.title.includes('Flow')));
  const ids=new Set();
  for(const a of catalog.entries){
    assert.ok(a.id && a.title && a.kind);
    assert.ok(!ids.has(a.id),'duplicate '+a.id);
    ids.add(a.id);
    assert.equal(canRemix(a),false,'candidate prematurely granted remix: '+a.id);
    assert.equal(a.rights.status,'review_required');
    assert.ok(!JSON.stringify(a).includes('drive.google.com/'),'do not expose internal Drive links');
  }
});

test('remix gate requires every authorization component, not merely a public URL',()=>{
  const good={id:'test',title:'test',availability:'published-cleared',
    asset_url:'https://media.example.org/test.mp4',
    rights:{status:'cleared',allow_remix:true,license_id:'CC-BY-4.0',
      license_url:'https://creativecommons.org/licenses/by/4.0/'}};
  assert.equal(canRemix(good),true);
  assert.equal(canRemix({...good,availability:'public-preview'}),false);
  assert.equal(canRemix({...good,rights:{...good.rights,allow_remix:false}}),false);
  assert.equal(canRemix({...good,rights:{...good.rights,license_url:null}}),false);
  assert.equal(canRemix({...good,asset_url:null}),false);
  assert.equal(canRemix({...good,rights:{...good.rights,license_id:null}}),false);
  assert.equal(canRemix(normalizeEntry({id:'x',title:'Title'})),false);
});

test('offline scan inventories with relative paths and does not alter originals',()=>{
  const dir=mkdtempSync(join(tmpdir(),'humkin-commons-'));
  try{
    const src=join(dir,'videos'),out=join(dir,'out','index.json');
    mkdirSync(src,{recursive:true});
    mkdirSync(join(src,'.hidden'));mkdirSync(join(src,'sub'));
    writeFileSync(join(src,'a.mp4'),'MOCK-VIDEO');
    writeFileSync(join(src,'sub','copy.mov'),'MOCK-VIDEO');
    writeFileSync(join(src,'sub','notes.txt'),'NOTES');
    writeFileSync(join(src,'.hidden','hidden.mp4'),'NOT PUBLIC');
    const before=statSync(join(src,'a.mp4'));
    const cmd=spawnSync('python3',[join(root,'tools','scan_creative_library.py'),src,'--out',out,'--hash'],{encoding:'utf8'});
    assert.equal(cmd.status,0,cmd.stderr);
    const manifest=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(manifest.entries.length,3);
    assert.ok(manifest.entries.every(a=>!a.relative_path.startsWith('/')));
    assert.ok(manifest.entries.every(a=>a.rights.status==='review_required'));
    assert.equal(manifest.entries.filter(a=>a.duplicate_of).length,1);
    assert.equal(statSync(join(src,'a.mp4')).size,before.size);
    assert.ok(readFileSync(out.replace('.json','.csv'),'utf8').includes('relative_path'));
    assert.ok(!JSON.stringify(manifest).includes(dir),'must not export absolute local paths');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
