import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTechnicalFigure, xml } from '../src/lib/report-figures.mjs';
import { validateRecord } from '../src/lib/radar-store.mjs';
const figures=JSON.parse(await readFile(new URL('./fixtures/fault-mechanism-figures.json',import.meta.url),'utf8'));
const records=JSON.parse(await readFile(new URL('../src/content/radar.json',import.meta.url),'utf8'));
const template=records.find(r=>r.id==='sglang-v0-5-21');
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function crosses(a,b,box) {
  if(a[0]===b[0])return a[0]>box.x&&a[0]<box.x+box.w&&Math.max(a[1],b[1])>box.y&&Math.min(a[1],b[1])<box.y+box.h;
  assert.equal(a[1],b[1]);
  return a[1]>box.y&&a[1]<box.y+box.h&&Math.max(a[0],b[0])>box.x&&Math.min(a[0],b[0])<box.x+box.w;
}
test('fault layouts reject missing roles and preserve complete graph data',()=>{
  for(const figure of figures){
    const r=structuredClone(template),f=structuredClone(figure);f.sourceIndices=[0];
    r.report.sections.find(s=>s.id==='mechanism').blocks=[f];
    assert.deepEqual(validateRecord(r).report.sections.find(s=>s.id==='mechanism').blocks[0],f);
    f.presentation.panels[0].nodeIds.pop();assert.throws(()=>validateRecord(r));
  }
});
test('fault routes and labels stay inside both canvases and never cross cards or text',()=>{
  const ids=new Set();
  for(const [i,f]of figures.entries())for(const compact of [false,true]){
    const views=renderTechnicalFigure(f,{compact,id:`fault-${i}-${compact}`});assert.equal(views.length,1);
    const {svg,width,geometry:g}=views[0];assert.equal(width,compact?320:760);
    assert.equal((svg.match(/<polyline /g)||[]).length,f.edges.length);assert.equal(g.routes.length,f.edges.length);
    assert.equal(g.nodes.length,f.nodes.length);
    for(const n of g.nodes)assert.ok(n.x>=0&&n.y>=0&&n.x+n.w<=g.width&&n.y+n.h<=g.height);
    for(const [j,r]of g.routes.entries()){
      assert.equal(r.from,f.edges[j].from);assert.equal(r.to,f.edges[j].to);assert.equal(r.label,f.edges[j].shortLabel||f.edges[j].label);
      const b=r.labelBox;assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=g.width&&b.y+b.h<=g.height);
      for(const node of g.nodes)assert.ok(!overlap(b,node),`${f.presentation.kind}: label overlaps ${node.id}`);
      for(const other of g.routes.slice(j+1))assert.ok(!overlap(b,other.labelBox));
      for(let k=1;k<r.points.length;k++){
        const a=r.points[k-1],z=r.points[k];
        for(const p of [a,z])assert.ok(p[0]>=0&&p[0]<=g.width&&p[1]>=0&&p[1]<=g.height);
        for(const node of g.nodes)assert.ok(!crosses(a,z,node),`${f.presentation.kind}: crosses ${node.id}`);
        for(const label of g.routes)assert.ok(!crosses(a,z,label.labelBox),`${f.presentation.kind}: crosses label ${label.label}`);
      }
      assert.ok(svg.includes(xml(r.label)));
    }
    for(const m of svg.matchAll(/\bid="([^"]+)"/g)){assert.ok(!ids.has(m[1]));ids.add(m[1]);}
    assert.ok(svg.includes('role="img"')&&svg.includes(xml(f.caption))&&!svg.includes('<script')&&!svg.includes('foreignObject'));
  }
});
test('ownership refresh, new retry copies, open timeout and five unfilled gates keep distinct meanings',()=>{
  const [ownership,socket,gates]=figures;
  assert.equal(ownership.presentation.panels.length,3);
  assert.ok(ownership.edges.some(e=>e.from==='retry-path'&&e.to==='owned-ids'&&e.label.includes('新标识')));
  assert.ok(!ownership.edges.some(e=>e.from==='retry-path'&&e.to==='borrowed-ids'));
  assert.ok(!ownership.edges.some(e=>e.from==='new-snapshot-b'&&e.to==='invalid-read'));
  assert.ok(socket.edges.some(e=>e.from==='peer-closed'&&e.to==='old-sigpipe'));
  assert.ok(socket.edges.some(e=>e.from==='socket-write'&&e.to==='timeout-pending'));
  assert.equal(gates.presentation.panels[0].nodeIds.length,5);
  assert.deepEqual(gates.edges.filter(e=>e.from==='release-tag').map(e=>e.to),['build-includes']);
  assert.ok(gates.nodes.slice(0,5).every(n=>n.subtitle.startsWith('○')));
  for(const compact of [false,true]){
    const svg=renderTechnicalFigure(socket,{compact})[0].svg;
    assert.ok(svg.includes('SO_RCVTIMEO')&&svg.includes('<path d="M'));
    const g=renderTechnicalFigure(gates,{compact})[0];assert.ok(g.geometry.routes.every(e=>e.dashed));
    assert.equal((g.svg.match(/fill="#fff" stroke="[^"]+" stroke-width="1.5" stroke-dasharray="5 4"/g)||[]).length,5);
    const f=structuredClone(ownership);f.nodes[0].shortLabel='<快照>';f.nodes[0].subtitle='A & B';
    assert.ok(renderTechnicalFigure(f,{compact})[0].svg.includes('&lt;快照&gt;'));
  }
});
test('release evidence sidebar reflects the payload title after an adjacent PR merges',()=>{
  const r=records.find(r=>r.id==='vllm-async-kv-zeroing');
  const f=structuredClone(r.report.sections.flatMap(s=>s.blocks).find(b=>b.presentation?.kind==='release-gates'));
  f.presentation.panels[1].title='相邻修复 · 分开核对交付';
  for(const compact of [false,true]){
    const svg=renderTechnicalFigure(f,{compact})[0].svg;
    assert.ok(svg.includes(f.presentation.panels[1].title));assert.ok(!svg.includes('相邻开放 PR · 未合入'));
  }
});
