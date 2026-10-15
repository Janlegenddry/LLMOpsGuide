import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRecord } from '../src/lib/radar-store.mjs';
import { renderTechnicalFigure } from '../src/lib/report-figures.mjs';
const figures = JSON.parse(await readFile(new URL('./fixtures/frontier-figures.json', import.meta.url)));
const records = JSON.parse(await readFile(new URL('../src/content/radar.json', import.meta.url)));
const validate = f => {
  const record = structuredClone(records.find(r => r.id === 'sglang-v0-5-21'));
  const figure = structuredClone(f); figure.sourceIndices = [0];
  record.report.sections.find(s => s.id === 'mechanism').blocks = [figure];
  return validateRecord(record).report.sections.find(s => s.id === 'mechanism').blocks[0];
};
const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
const crosses = (a,b,n) => a[0]===b[0] ? a[0]>n.x&&a[0]<n.x+n.w&&Math.max(a[1],b[1])>n.y&&Math.min(a[1],b[1])<n.y+n.h : a[1]>n.y&&a[1]<n.y+n.h&&Math.max(a[0],b[0])>n.x&&Math.min(a[0],b[0])<n.x+n.w;

test('six frontier contracts reject missing, duplicate, reversed and invented roles or edges', () => {
  for (const f of figures) {
    const expected = structuredClone(f); expected.sourceIndices=[0]; assert.deepEqual(validate(f), expected);
    for (const mutate of [x=>x.edges.pop(),x=>x.edges.push(x.edges[0]),x=>{[x.edges[0].from,x.edges[0].to]=[x.edges[0].to,x.edges[0].from];},x=>x.presentation.panels.reverse(),x=>x.presentation.panels[0].nodeIds.push('invented'),x=>x.nodes.pop(),x=>x.nodes[0].row=4,x=>x.nodes[0].column=(x.nodes[0].column+1)%4,x=>x.nodes[0].id='invented']) {
      const bad=structuredClone(f); mutate(bad); assert.throws(()=>validate(bad),f.presentation.kind);
    }
  }
});
test('dedicated topologies render only declared edges with readable legends and bounded geometry', () => {
  for (const f of figures) for (const compact of [false,true]) {
    const [{svg,geometry:g}] = renderTechnicalFigure(f,{compact,id:f.presentation.kind+'-'+compact});
    assert.equal(g.kind,f.presentation.kind);assert.equal(g.width,compact?320:760);
    assert.equal(g.nodes.length,f.nodes.length);assert.equal(g.routes.length,f.edges.length);
    assert.equal((svg.match(/<polyline /g)||[]).length,f.edges.length);
    for(const n of g.nodes)assert.ok(n.x>=0&&n.y>=0&&n.x+n.w<=g.width&&n.y+n.h<=g.height);
    for(const [i,r] of g.routes.entries()) {
      assert.deepEqual([r.from,r.to,r.label],[f.edges[i].from,f.edges[i].to,f.edges[i].label]);
      for(const point of r.points)assert.ok(point[0]>=0&&point[0]<=g.width&&point[1]>=0&&point[1]<=g.height);
      for(const box of [r.labelBox,g.legendBoxes[i]])for(const n of g.nodes)assert.ok(!overlap(box,n),f.presentation.kind+' label '+n.id);
      for(let j=1;j<r.points.length;j++)for(const n of g.nodes) {
        if(n.id===r.from&&j===1)continue;
        assert.ok(!crosses(r.points[j-1],r.points[j],n),f.presentation.kind+' '+r.from+'→'+r.to+' through '+n.id);
      }
    }
    assert.ok(svg.includes('role="img"')&&svg.includes('<title')&&svg.includes('<desc'));
  }
});
test('Mamba uses two equal six-slot rows, retained tail, first-three read brackets and no automatic fix', () => {
  const f=figures.find(f=>f.presentation.kind==='conv-checkpoint-window');
  for(const compact of [false,true]) {
    const [{svg,geometry:g}]=renderTechnicalFigure(f,{compact});const [old,newer]=g.slotRows;
    assert.equal(old.cells.length,6);assert.equal(newer.cells.length,6);assert.equal(old.cells[0].w,newer.cells[0].w);
    assert.deepEqual(old.cells.map(c=>c.value),['34','35','36','37','38','39']);
    assert.deepEqual(newer.cells.map(c=>c.value),['37','38','39','原值','原值','原值']);
    assert.deepEqual(newer.firstRead,[0,1,2]);assert.ok(newer.cells.slice(3).every(c=>c.retained));
    assert.ok(svg.includes('W=3')&&svg.includes('P=6')&&svg.includes('S=3')&&svg.includes('保留原值')&&svg.includes('非实测'));
    assert.ok(!g.routes.some(r=>r.from.startsWith('old')&&r.to.startsWith('new')));
  }
  for(const text of ['新槽位：[37,38,39 | 0,0,0]','新物理行：容量5槽','尾部已清理']) {
    const bad=structuredClone(f);bad.nodes.find(n=>n.id==='new-state').detail=text;assert.throws(()=>validate(bad));
  }
  const bad=structuredClone(f);bad.edges.push({from:'old-state',to:'new-state',label:'自动修复'});assert.throws(()=>validate(bad));
});
test('FlashInfer has query tiles, bypass switch, partial strips and a frozen capsule without replay guards',()=>{
  const f=figures.find(f=>f.presentation.kind==='verify-plan-dispatch');
  for(const compact of [false,true]) {
    const [{svg,geometry:g}]=renderTechnicalFigure(f,{compact});
    assert.deepEqual(g.glyphs.map(g=>g.type).sort(),['ragged-query-tiles','uniform-query-tiles','eligibility-switch','partial-strips','merge-operator','frozen-graph-capsule'].sort());
    const text=svg.replace(/<[^>]*>/g,'');assert.ok(text.includes('CPU plan/capture')&&text.includes('GPU execution')&&text.includes('排除 eager')&&text.includes('接线待验'));
    assert.ok(!g.routes.some(r=>r.from==='replay'));assert.ok(g.routes.some(r=>r.from==='gates'&&r.to==='stock'));
  }
});
test('RunAI evidence gates stay hollow, fail-open branches distinct and metrics separate from SLO',()=>{
  const boundary=figures.find(f=>f.presentation.kind==='gpu-fractioning-boundaries'),acceptance=figures.find(f=>f.presentation.kind==='gpu-fractioning-acceptance');
  for(const compact of [false,true]) {
    const b=renderTechnicalFigure(boundary,{compact})[0].geometry,a=renderTechnicalFigure(acceptance,{compact})[0].geometry;
    assert.ok(b.nodes.find(n=>n.id==='driver').pending&&b.nodes.find(n=>n.id==='verify').pending);
    assert.ok(!b.routes.some(r=>r.from==='metrics'&&r.to==='slo'));assert.ok(!b.routes.some(r=>r.from==='no-adjust'&&r.to==='driver'));
    assert.equal(a.nodes.filter(n=>n.pending).length,4);assert.equal(a.glyphs.length,4);
    assert.ok(!a.routes.some(r=>r.from==='stop'));assert.equal(a.routes.filter(r=>r.to==='stop').length,4);
  }
});
test('Delta has same-input isolated ID comparison branches and no recovery-to-model edge',()=>{
  const f=figures.find(f=>f.presentation.kind==='token-id-frontier');
  for(const compact of [false,true]) {
    const [{svg,geometry:g}]=renderTechnicalFigure(f,{compact});assert.ok(svg.includes('同一最终输入')&&svg.includes('拟议接入验收'));
    assert.ok(g.routes.some(r=>r.from==='text'&&r.to==='reference'));assert.ok(g.routes.some(r=>r.from==='guard'&&r.to==='apply'));
    assert.equal(g.routes.filter(r=>r.to==='compare').length,2);assert.ok(!g.routes.some(r=>r.from==='stop'));
  }
});
