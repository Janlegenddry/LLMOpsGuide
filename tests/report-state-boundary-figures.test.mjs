import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTechnicalFigure } from '../src/lib/report-figures.mjs';
import { validateRecord } from '../src/lib/radar-store.mjs';
const figures=JSON.parse(await readFile(new URL('./fixtures/state-boundary-figures.json',import.meta.url),'utf8'));
const records=JSON.parse(await readFile(new URL('../src/content/radar.json',import.meta.url),'utf8'));
const template=records.find(r=>r.id==='sglang-v0-5-21');
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function crosses(a,b,box){
  if(a[0]===b[0])return a[0]>box.x&&a[0]<box.x+box.w&&Math.max(a[1],b[1])>box.y&&Math.min(a[1],b[1])<box.y+box.h;
  assert.equal(a[1],b[1]);
  return a[1]>box.y&&a[1]<box.y+box.h&&Math.max(a[0],b[0])>box.x&&Math.min(a[0],b[0])<box.x+box.w;
}
test('state boundary layouts reject missing roles without losing graph data',()=>{
  for(const figure of figures){
    const r=structuredClone(template),f=structuredClone(figure);f.sourceIndices=[0];
    r.report.sections.find(s=>s.id==='mechanism').blocks=[f];
    assert.deepEqual(validateRecord(r).report.sections.find(s=>s.id==='mechanism').blocks[0],f);
    f.presentation.panels[0].nodeIds.pop();assert.throws(()=>validateRecord(r));
  }
});
test('state boundary arrows and labels fit both screens and avoid cards and labels',()=>{
  const ids=new Set();
  for(const [i,f]of figures.entries())for(const compact of [false,true]){
    const views=renderTechnicalFigure(f,{compact,id:`state-boundary-${i}-${compact}`});assert.equal(views.length,1);
    const {svg,width,geometry:g}=views[0];assert.equal(width,compact?320:760);
    assert.equal((svg.match(/<polyline /g)||[]).length,f.edges.length);assert.equal(g.routes.length,f.edges.length);
    assert.equal(g.nodes.length,f.nodes.length);
    for(const n of g.nodes)assert.ok(n.x>=0&&n.y>=0&&n.x+n.w<=g.width&&n.y+n.h<=g.height);
    for(const [j,r]of g.routes.entries()){
      assert.equal(r.from,f.edges[j].from);assert.equal(r.to,f.edges[j].to);
      const b=r.labelBox;assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=g.width&&b.y+b.h<=g.height);
      for(const node of g.nodes)assert.ok(!overlap(b,node));
      for(const other of g.routes.slice(j+1))assert.ok(!overlap(b,other.labelBox));
      for(let k=1;k<r.points.length;k++){
        const a=r.points[k-1],z=r.points[k];
        for(const point of [a,z])assert.ok(point[0]>=0&&point[0]<=g.width&&point[1]>=0&&point[1]<=g.height);
        for(const node of g.nodes)assert.ok(!crosses(a,z,node),`${f.presentation.kind} crosses ${node.id}`);
        for(const label of g.routes)assert.ok(!crosses(a,z,label.labelBox),`${f.presentation.kind} crosses label ${label.label}`);
      }
    }
    for(const m of svg.matchAll(/\bid="([^"]+)"/g)){assert.ok(!ids.has(m[1]));ids.add(m[1]);}
    assert.ok(svg.includes('role="img"')&&svg.includes('<title')&&svg.includes('<desc'));
  }
});
test('address ownership, drain responsibility, test synchronization and deferred reconnect stay distinct',()=>{
  const [identity,drain,barrier,tcp]=figures;
  const targets=(f,from)=>f.edges.filter(e=>e.from===from).map(e=>e.to);
  for(const [g,b]of [['old-graph-a','old-buffer-a'],['old-graph-b','old-buffer-b'],['new-graph-a','new-buffer'],['new-graph-b','new-buffer']])assert.deepEqual(targets(identity,g),[b]);
  assert.ok(!targets(identity,'live-layout').includes('old-buffer-a'));
  assert.equal(targets(drain,'stuck').length,0);assert.deepEqual(targets(drain,'queued-hold'),['resumed']);
  assert.ok(!targets(drain,'excluded').includes('finished'));
  assert.ok(barrier.edges.find(e=>e.to==='old-timeout').label.includes('若'));
  assert.ok(barrier.caption.includes('不是生产 pause API'));
  assert.deepEqual(targets(tcp,'peer-closed'),['disconnect']);assert.deepEqual(targets(tcp,'unexpected-byte'),['disconnect']);
  assert.deepEqual(targets(tcp,'disconnect'),['next-pump']);assert.ok(!tcp.edges.some(e=>e.to==='request-result'));
});
test('future observations remain hollow and all labels are escaped',()=>{
  for(const compact of [false,true]){
    for(const [i,f]of figures.entries()){
      const copy=structuredClone(f);copy.nodes[0].shortLabel='<角色>';copy.nodes[0].subtitle='A & B';
      const svg=renderTechnicalFigure(copy,{compact,id:`escaped-state-${i}-${compact}`})[0].svg;
      assert.ok(svg.includes('&lt;角色&gt;')&&svg.includes('A &amp; B')&&!svg.includes('<script')&&!svg.includes('foreignObject'));
      if(i===1||i===3)assert.ok(svg.includes('fill="#fff" stroke=')&&svg.includes('stroke-dasharray="5 4"'));
    }
  }
});
