import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTechnicalFigure, xml } from '../src/lib/report-figures.mjs';
import { validateRecord } from '../src/lib/radar-store.mjs';
const figures=JSON.parse(await readFile(new URL('./fixtures/release-mechanism-figures.json',import.meta.url),'utf8'));
const records=JSON.parse(await readFile(new URL('../src/content/radar.json',import.meta.url),'utf8'));
const template=records.find(r=>r.id==='sglang-v0-5-21');
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function crosses(a,b,box) {
  if(a[0]===b[0])return a[0]>box.x&&a[0]<box.x+box.w&&Math.max(a[1],b[1])>box.y&&Math.min(a[1],b[1])<box.y+box.h;
  assert.equal(a[1],b[1],'route must be orthogonal');
  return a[1]>box.y&&a[1]<box.y+box.h&&Math.max(a[0],b[0])>box.x&&Math.min(a[0],b[0])<box.x+box.w;
}
test('six release layouts validate complete roles and reject missing roles',()=>{
  for(const figure of figures){
    const r=structuredClone(template),f=structuredClone(figure);f.sourceIndices=[0];
    r.report.sections.find(s=>s.id==='mechanism').blocks=[f];
    assert.deepEqual(validateRecord(r).report.sections.find(s=>s.id==='mechanism').blocks[0],f);
    f.presentation.panels[0].nodeIds.pop();assert.throws(()=>validateRecord(r));
  }
});
test('every release edge renders once and routes, labels and cards fit both canvases without crossing text',()=>{
  const ids=new Set();
  for(const [i,f] of figures.entries())for(const compact of [false,true]){
    const views=renderTechnicalFigure(f,{compact,id:`release-${i}-${compact}`});assert.equal(views.length,1);
    const {svg,width,geometry:g}=views[0];assert.equal(width,compact?320:760);
    assert.equal((svg.match(/<polyline /g)||[]).length,f.edges.length);
    assert.equal(g.routes.length,f.edges.length);assert.equal(g.nodes.length,f.nodes.length);
    for(const n of g.nodes)assert.ok(n.x>=0&&n.y>=0&&n.x+n.w<=g.width&&n.y+n.h<=g.height);
    for(const [j,r] of g.routes.entries()){
      assert.equal(r.from,f.edges[j].from);assert.equal(r.to,f.edges[j].to);
      assert.equal(r.label,f.edges[j].shortLabel||f.edges[j].label);assert.ok(svg.includes(xml(r.label)));
      const b=r.labelBox;assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=g.width&&b.y+b.h<=g.height);
      for(const node of g.nodes)assert.ok(!overlap(b,node),`${f.presentation.kind}: label overlaps ${node.id}`);
      for(const other of g.routes.slice(j+1))assert.ok(!overlap(b,other.labelBox),`${f.presentation.kind}: overlapping labels`);
      for(let k=1;k<r.points.length;k++){
        const a=r.points[k-1],z=r.points[k];
        for(const p of [a,z])assert.ok(p[0]>=0&&p[0]<=g.width&&p[1]>=0&&p[1]<=g.height);
        for(const node of g.nodes)assert.ok(!crosses(a,z,node),`${f.presentation.kind}: route crosses ${node.id}`);
        for(const label of g.routes)assert.ok(!crosses(a,z,label.labelBox),`${f.presentation.kind}: route crosses ${label.label}`);
      }
    }
    for(const m of svg.matchAll(/\bid="([^"]+)"/g)){assert.ok(!ids.has(m[1]));ids.add(m[1]);}
    assert.ok(svg.includes('role="img"')&&svg.includes(xml(f.caption))&&!svg.includes('<script')&&!svg.includes('foreignObject'));
  }
});
test('overload, unfinished IDs and deployment restrictions preserve their separate branches',()=>{
  const k=Object.fromEntries(figures.map(f=>[f.presentation.kind,f]));
  assert.equal(k['overload-sources'].edges.filter(e=>e.to==='candidate-filter').length,3);
  assert.ok(!k['overload-sources'].edges.some(e=>e.from==='hint-expiry'&&e.to==='monitor-overload'));
  assert.equal(k['overload-sources'].nodes.find(n=>n.id==='reconsider-worker').subtitle,'不保证健康');
  assert.ok(!k['choice-cleanup'].edges.some(e=>e.from==='local-output-stop'&&e.to==='resource-observation'));
  assert.ok(k['choice-cleanup'].edges.some(e=>e.from==='late-choice-id'&&e.to==='abort-by-id'));
  assert.equal(k['choice-cleanup'].edges.filter(e=>e.to==='unfinished-ids'&&e.from.startsWith('choice-')).length,3);
  assert.equal(k['deployment-paths'].edges.filter(e=>e.to==='pause-path').length,2);
  assert.ok(k['deployment-paths'].nodes.find(n=>n.id==='per-path-acceptance').detail.includes('不是已验证成功'));
});
test('evidence stays parallel, preload conditions stay explicit and seven failed gates return to baseline',()=>{
  const k=Object.fromEntries(figures.map(f=>[f.presentation.kind,f]));
  const panels=k['release-evidence'].presentation.panels.slice(0,3);
  for(const e of k['release-evidence'].edges){const a=panels.find(p=>p.nodeIds.includes(e.from)),b=panels.find(p=>p.nodeIds.includes(e.to));if(a&&b)assert.equal(a,b,'no date-based interlane arrow');}
  for(const compact of [false,true])assert.equal((renderTechnicalFigure(k['release-evidence'],{compact})[0].svg.match(/<polyline[^>]*stroke-dasharray/g)||[]).length,3,'only the three artifact queries are dashed');
  assert.ok(k['preload-restart'].edges.some(e=>e.from==='resident-daemon'&&e.to==='engine-b-ipc'));
  assert.equal(k['preload-restart'].edges.find(e=>e.to==='disk-fallback').label,'未命中且开启回退');
  assert.equal(k['preload-restart'].edges.find(e=>e.to==='service-ready').label,'初始化及就绪通过');
  assert.equal(k['rollout-checks'].edges.filter(e=>e.to==='accepted-baseline').length,7);
  assert.ok(k['rollout-checks'].edges.some(e=>e.from==='accepted-baseline'&&e.to==='artifact-fixed'));
  for(const compact of [false,true]){const f=structuredClone(k['preload-restart']);f.nodes[0].shortLabel='<X>';f.nodes[0].subtitle='A & B';const svg=renderTechnicalFigure(f,{compact})[0].svg;assert.ok(svg.includes('&lt;X&gt;')&&svg.includes('A &amp; B'));}
});
