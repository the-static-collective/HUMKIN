import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {compileCatalog,projectSkills} from '../game/skill-tree/v1/kernel.mjs';

const base=join(dirname(fileURLToPath(import.meta.url)),'..','game','skill-tree','v1');
const load=f=>JSON.parse(readFileSync(join(base,f),'utf8'));
const manifest=load('catalog.json');
const source=Object.fromEntries(manifest.slices.map(f=>[f,load(f)]));
const tree=compileCatalog(manifest,source);
const project=(facts={},admissions=[])=>projectSkills(tree,facts,admissions);

test('a new listener sees radio, outpost and only a teased Orchard',()=>{
  const fresh=project({level:1,module_tower:0,module_archive:0,module_crew:0});
  assert.equal(fresh.byId('radio.receiver').status,'AVAILABLE');
  assert.equal(fresh.byId('radio.outpost').status,'AVAILABLE');
  assert.equal(fresh.byId('outpost.orchard').status,'LOCKED');
  assert.equal(fresh.byId('outpost.bootleg').status,'HIDDEN');
  assert.equal(fresh.byId('world.jubilee').status,'HIDDEN');
  assert.equal(fresh.byId('radio.weather').status,'HELD');
  assert(!fresh.availableCapabilities.includes('humkin.radio.weather.v1'));
  assert(!fresh.visible.some(n=>n.id==='world.jubilee'));
});

test('the existing level-4 Orchard and level-7 Bootleg gates are unchanged',()=>{
  assert.equal(project({level:3}).byId('outpost.orchard').status,'LOCKED');
  assert.equal(project({level:4}).byId('outpost.orchard').status,'AVAILABLE');
  assert.equal(project({level:4}).byId('outpost.bootleg').status,'LOCKED');
  assert.equal(project({level:6}).byId('outpost.bootleg').status,'LOCKED');
  assert.equal(project({level:7}).byId('outpost.bootleg').status,'AVAILABLE');
  assert.equal(project({level:7}).byId('frequency.personal').status,'AVAILABLE');
});

test('existing module upgrades operate as independent nested branches',()=>{
  const p=project({level:4,module_tower:2,module_archive:1,module_crew:0});
  assert.equal(p.byId('outpost.antenna.beacon').status,'AVAILABLE');
  assert.equal(p.byId('outpost.archive').status,'AVAILABLE');
  assert.equal(p.byId('outpost.archive.press').status,'LOCKED');
  assert.equal(p.byId('outpost.crew').status,'LOCKED');
  assert.equal(p.byId('outpost.antenna.community').status,'LOCKED');
});

test('huge XP and asserted admission cannot make unbuilt branches operational',()=>{
  const p=project({level:99,module_tower:9,module_archive:9,module_crew:9},
    ['humkin.orchard.network.owner-admit.v1','humkin.frequency.relay.owner-admit.v1','relatte.humkin.world.owner-admit.v1']);
  for(const id of ['orchard.network','frequency.relay','world.junction','radio.weather']){
    assert.equal(p.byId(id).status,'HELD');
    assert.equal(p.byId(id).capability,null);
  }
  for(const id of ['outpost.antenna.community','outpost.archive.trade','outpost.crew.relay']){
    assert.equal(p.byId(id).status,'PLANNED');
    assert.equal(p.byId(id).capability,null);
  }
  assert.equal(p.byId('world.webz').status,'HIDDEN');
});

test('invalid references, duplicate nodes and fabricated gate types fail closed',()=>{
  const clone=()=>JSON.parse(JSON.stringify(source));
  let s=clone();s['slices/receiver.json'].nodes[0].parent='outpost.crew';
  assert.throws(()=>compileCatalog(manifest,s),/BAD_ROOT_VISIBILITY|MULTIPLE_ROOTS/);
  s=clone();s['slices/outpost.json'].nodes.push({...s['slices/outpost.json'].nodes[0]});
  assert.throws(()=>compileCatalog(manifest,s),/DUPLICATE_NODE/);
  s=clone();s['slices/orchard.json'].nodes[0].requires=[{payment:999}];
  assert.throws(()=>compileCatalog(manifest,s),/UNKNOWN_GATE/);
  s=clone();s['slices/outpost.json'].nodes[1].parent='orchard.garden';
  assert.throws(()=>compileCatalog(manifest,s),/CROSS_SLICE_PARENT/);
});

test('a future repository may mount a separately governed new slice',()=>{
  const s=JSON.parse(JSON.stringify(source));
  const m=JSON.parse(JSON.stringify(manifest));
  m.slices.push('slices/another.json');
  s['slices/another.json']={schema:'humkin.skill-tree.slice/v1',id:'another',mount_at:'frequency.personal',
    nodes:[{id:'another.choice',parent:'frequency.personal',title:'Another Door',
      release:'pilot',reveal:'on-parent',requires:[],capability:'another.proposal.v1',
      description:'Another world can offer something without acquiring authority.'}]};
  const expanded=compileCatalog(m,s);
  assert.equal(projectSkills(expanded,{level:7}).byId('another.choice').status,'HELD');
});
