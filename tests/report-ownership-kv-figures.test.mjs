import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRecord} from '../src/lib/radar-store.mjs';
import {renderTechnicalFigure,xml} from '../src/lib/report-figures.mjs';
import {ownershipEdgeStyle} from '../src/lib/report-ownership-kv-figures.mjs';
const figures=JSON.parse(await readFile(new URL('./fixtures/ownership-kv-figures.json',import.meta.url),'utf8'));
const records=JSON.parse(await readFile(new URL('../src/content/radar.json',import.meta.url),'utf8'));
const template=records.find(r=>r.id==='sglang-v0-5-21');
const validate=figure=>{const r=structuredClone(template),f=structuredClone(figure);f.sourceIndices=[0];r.report.sections.find(s=>s.id==='mechanism').blocks=[f];return validateRecord(r).report.sections.find(s=>s.id==='mechanism').blocks[0];};
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const crosses=(a,b,box)=>a[0]===b[0]?a[0]>box.x&&a[0]<box.x+box.w&&Math.max(a[1],b[1])>box.y&&Math.min(a[1],b[1])<box.y+box.h:a[1]>box.y&&a[1]<box.y+box.h&&Math.max(a[0],b[0])>box.x&&Math.min(a[0],b[0])<box.x+box.w;
test('four new semantic contracts accept exact roles and reject misplaced or missing data',()=>{
 for(const f of figures){
  const expected=structuredClone(f);expected.sourceIndices=[0];assert.deepEqual(validate(f),expected);
  const mutations=[x=>x.presentation.panels.pop(),x=>x.nodes.pop(),x=>x.presentation.panels[0].nodeIds.push(x.presentation.panels[1].nodeIds[0]),x=>x.nodes[0].row=4,x=>{x.nodes[1].row=x.nodes[0].row;x.nodes[1].column=x.nodes[0].column;},x=>x.edges[0].to='missing',x=>x.edges.pop(),x=>x.presentation.kind='rdma-retirement'];
  if(f.presentation.kind!=='task-pointer-lifetime')mutations.push(x=>{const n=x.nodes.find(n=>n.id===x.presentation.panels[0].nodeIds[0]);n.column=3-n.column;});
  else mutations.push(x=>x.presentation.panels[0].nodeIds.reverse());
  for(const mutate of mutations){const bad=structuredClone(f);mutate(bad);assert.throws(()=>validate(bad),f.presentation.kind);}
 }
});
test('all declared connections and full legends avoid cards and labels on both screens',()=>{
 for(const [i,f] of figures.entries())for(const compact of [false,true]){
  const [{svg,geometry:g}]=renderTechnicalFigure(f,{compact,id:'ownership-'+i+'-'+compact});
  assert.equal(g.width,compact?320:760);assert.equal(g.nodes.length,f.nodes.length);assert.equal(g.routes.length,f.edges.length);
  assert.equal((svg.match(/<polyline /g)||[]).length,f.edges.length);
  for(const n of g.nodes)assert.ok(n.x>=0&&n.y>=0&&n.x+n.w<=g.width&&n.y+n.h<=g.height);
  for(const [j,r] of g.routes.entries()){
   assert.deepEqual([r.from,r.to,r.label],[f.edges[j].from,f.edges[j].to,f.edges[j].label]);assert.equal(g.legendBoxes[j].text,r.label);
   for(const box of [r.labelBox,g.legendBoxes[j]]){assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=g.width&&box.y+box.h<=g.height);for(const n of g.nodes)assert.ok(!overlap(box,n));}
   for(const other of g.routes.slice(j+1))assert.ok(!overlap(r.labelBox,other.labelBox));
   for(let k=1;k<r.points.length;k++)for(const box of [...g.nodes,...g.routes.map(r=>r.labelBox),...g.legendBoxes])assert.ok(!crosses(r.points[k-1],r.points[k],box),f.presentation.kind+' '+(box.id||box.text||'label'));
  }
 }
});
test('Ascend registration cleanup retains separate KV ownership and missing-notification effects',()=>{
 const [before,fixed]=figures,old=renderTechnicalFigure(before)[0].geometry,newer=renderTechnicalFigure(fixed)[0].geometry;
 assert.equal(old.nodes.length,10);assert.equal(newer.nodes.length,11);
 for(const route of old.routes.filter(r=>r.from==='worker-filter'))assert.ok(route.dashed&&route.category==='missing-notification');
 assert.ok(newer.routes.some(r=>r.from==='core-output'&&r.to==='reg-clean'));
 assert.ok(newer.routes.some(r=>r.from==='reg-clean'&&r.to==='core-free'));
 assert.notEqual(newer.nodes.find(n=>n.id==='reg-clean').x,newer.nodes.find(n=>n.id==='core-free').x);
 assert.ok(!newer.routes.some(r=>r.from==='recv-done'&&r.to==='core-free'));
});
test('bidirectional KV preserves both data transfers and four metadata arrows',()=>{
 const f=figures[2];
 for(const compact of [false,true]){
  const [{svg,geometry:g}]=renderTechnicalFigure(f,{compact});
  assert.equal(g.routes.filter(r=>r.category==='metadata').length,4);
  assert.ok(g.routes.filter(r=>r.category==='metadata').every(r=>r.dashed&&r.width===1.7));
  const data=g.routes.filter(r=>r.category==='data');assert.equal(data.length,2);assert.ok(data.every(r=>!r.dashed&&r.width===3.4));
  assert.ok(data.some(r=>r.from==='d-serve'&&r.to==='p-pull'));assert.ok(data.some(r=>r.from==='p-compute'&&r.to==='d-pull'));
  assert.ok(svg.includes('D→P数据')&&svg.includes('P→D数据')&&svg.includes('KV不经路由器')&&svg.includes('拟议'));
  assert.ok(g.nodes.find(n=>n.id==='router-gate').pending);
  assert.equal(ownershipEdgeStyle(f.presentation.kind,{from:'p-export',to:'d-pull'}).category,'metadata');
 }
});
test('task pointer lifetime is six roles with two hollow pending boundaries, separate from WR retirement',()=>{
 const f=figures[3];
 for(const compact of [false,true]){
  const [{svg,geometry:g}]=renderTechnicalFigure(f,{compact});
  assert.equal(g.nodes.length,6);assert.equal(g.routes.length,5);assert.deepEqual(g.nodes.filter(n=>n.pending).map(n=>n.id).sort(),['business','free']);
  assert.ok(g.routes.find(r=>r.from==='free'&&r.to==='count').dashed);assert.ok(g.routes.find(r=>r.from==='count'&&r.to==='business').dashed);
  assert.notEqual(g.routes.find(r=>r.from==='free').points[3][0],g.routes.find(r=>r.to==='business').points[3][0]);
  assert.ok(svg.includes('原子性≠所有权'));assert.ok(!svg.includes('W3信号'));
 }
});
test('old RDMA figure SVG bytes stay unchanged',async()=>{
 const snapshots=[{"i":0,"compact":false,"sha256":"c91a31a1b811f3613714d5f28858b4f32fc4e810b55b2fec60e8b9284bd03103"},{"i":0,"compact":true,"sha256":"ac12a0051b8af8e7b2aa7b371a94bf179ca8cead8613f80c91f5984b98c5c9a1"},{"i":1,"compact":false,"sha256":"0dd0680ddeaa90785bf427503d53d28026d5caa6700bed241f2e8730a0186dba"},{"i":1,"compact":true,"sha256":"4fcefc5d02ce2a2f0a770f61bf4acecf5c072c153067de0da7581b5187b1629d"}];
 const old=JSON.parse(await readFile(new URL('./fixtures/restore-rdma-figures.json',import.meta.url),'utf8')).slice(2,4);
 for(const s of snapshots){const svg=renderTechnicalFigure(old[s.i],{compact:s.compact,id:'preserve-rdma-'+s.i+'-'+s.compact})[0].svg;assert.equal(createHash('sha256').update(svg).digest('hex'),s.sha256);}
});
test('SVG titles, captions and labels remain accessible and XML escaped',()=>{
 for(const [i,f] of figures.entries()){const copy=structuredClone(f);copy.nodes[0].shortLabel='<角色>';copy.edges[0].label='A & B';const [{svg}]=renderTechnicalFigure(copy,{id:'escaped-ownership-'+i});assert.ok(svg.includes('&lt;角色&gt;')&&svg.includes('A &amp; B')&&svg.includes(xml(f.caption)));assert.ok(svg.includes('role="img"')&&svg.includes('<title')&&svg.includes('<desc'));assert.ok(!svg.includes('<script')&&!svg.includes('foreignObject'));}
});
