import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTechnicalFigure } from '../src/lib/report-figures.mjs';
import { validateRecord } from '../src/lib/radar-store.mjs';
const records = JSON.parse(await readFile(new URL('../src/content/radar.json', import.meta.url)));
const regressions = JSON.parse(await readFile(new URL('./fixtures/nov3-lifecycle-routing.json', import.meta.url)));
const figures = [
  ...records.flatMap(r => r.report?.sections.flatMap(s => s.blocks.filter(b => b.presentation?.kind === 'lifecycle')) || []),
  ...regressions.map(r => r.diagram),
];
const synthetic = structuredClone(figures[0]);
synthetic.title = '合成职责图：跨组、逆向与跳过节点';
synthetic.caption = '仅验证布局和关系保留，不表示产品状态或实测时间。';
synthetic.basis = 'inference'; synthetic.sourceIndices = [];
synthetic.nodes = ['a','b'].flatMap((group,column) => Array.from({length:4},(_,row) => ({id:group+row,label:`职责 ${group}${row}`,detail:'合成角色，不隐含相邻依赖。',column,row,tone:'neutral'})));
synthetic.presentation.panels = ['a','b'].map(group => ({title:group==='a'?'请求侧责任':'资源侧责任',tone:'control',nodeIds:Array.from({length:4},(_,i)=>group+i)}));
synthetic.edges = [
  {from:'a0',to:'b1',label:'跨组分配'}, {from:'b1',to:'a3',label:'跨组返回'},
  {from:'a1',to:'b0',label:'跨组检查'}, {from:'b3',to:'b0',label:'组内逆向检查'},
];
const overlap = (a,b) => a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const crosses = (a,b,n) => a[0]===b[0] ? a[0]>n.x&&a[0]<n.x+n.w&&Math.max(a[1],b[1])>n.y&&Math.min(a[1],b[1])<n.y+n.h : a[1]>n.y&&a[1]<n.y+n.h&&Math.max(a[0],b[0])>n.x&&Math.min(a[0],b[0])<n.x+n.w;

test('every stored lifecycle figure renders its own roles, colors and exact declared relations',()=>{
  assert.ok(figures.length>=3);
  for(const f of figures)for(const compact of [false,true]){
    const views=renderTechnicalFigure(f,{compact,id:f.nodes[0].id+'-'+compact});assert.equal(views.length,1);
    const [{svg,geometry:g}]=views;assert.equal(g.nodes.length,8);assert.equal(g.routes.length,f.edges.length);
    assert.deepEqual(g.routes.map(r=>[r.from,r.to,r.label]),f.edges.map(e=>[e.from,e.to,e.label]));
    assert.equal((svg.match(/data-lifecycle-edge=/g)||[]).length,f.edges.length);
    assert.ok(!svg.includes('危险窗口：页面已属于 B')&&!svg.includes('页和元数据暂留：不能提前复用')&&!svg.includes('页已复用，旧写入仍可能迟到'));
    for(const panel of f.presentation.panels)assert.ok(svg.includes(panel.title));
  }
});
test('cross-panel, reverse and nonadjacent relations survive on both screens without invented sequence edges',()=>{
  const r=structuredClone(records.find(r=>r.id==='sglang-v0-5-21'));r.report.sections.find(s=>s.id==='mechanism').blocks=[synthetic];validateRecord(r);
  for(const compact of [false,true]){
    const [{svg,geometry:g}]=renderTechnicalFigure(synthetic,{compact});assert.equal(g.routes.length,4);assert.equal(g.routes.filter(r=>r.crossPanel).length,3);
    assert.ok(g.routes.some(r=>r.from==='b3'&&r.to==='b0'));assert.ok(!g.routes.some(r=>r.from==='a0'&&r.to==='a1'));
    assert.equal((svg.match(/<polyline /g)||[]).length,4);
    for(const edge of synthetic.edges)assert.ok(g.legendBoxes.some(l=>l.from===edge.from&&l.to===edge.to&&l.text===edge.label));
  }
});
test('lifecycle paths and numbered legends avoid nodes, headings and other labels',()=>{
  for(const f of [...figures,synthetic])for(const compact of [false,true]){
    const [{geometry:g}]=renderTechnicalFigure(f,{compact});assert.equal(g.width,compact?320:760);
    for(const n of g.nodes)assert.ok(n.x>=0&&n.y>=0&&n.x+n.w<=g.width&&n.y+n.h<=g.height);
    for(const text of g.textBoxes){const n=g.nodes.find(n=>n.id===text.id);assert.ok(text.x>=n.x&&text.y>=n.y&&text.x+text.w<=n.x+n.w&&text.y+text.h<=n.y+n.h);}
    for(const [i,route] of g.routes.entries()){
      for(const p of route.points)assert.ok(p[0]>=0&&p[0]<=g.width&&p[1]>=0&&p[1]<=g.height);
      for(const n of g.nodes)assert.ok(!overlap(route.labelBox,n));
      for(const other of g.routes.slice(i+1))assert.ok(!overlap(route.labelBox,other.labelBox));
      for(let j=1;j<route.points.length;j++)for(const box of [...g.nodes,...g.headerBoxes,...g.routes.map(r=>r.labelBox),...g.legendBoxes])assert.ok(!crosses(route.points[j-1],route.points[j],box),`${f.title}: ${route.from}→${route.to}`);
    }
  }
});
test('long labels grow safely, explicit pending stays hollow and XML remains escaped',()=>{
  const f=structuredClone(synthetic);f.nodes[0].shortLabel='<X>';f.nodes[0].subtitle='A & B';
  f.nodes[1].label='中'.repeat(40);f.nodes[1].subtitle='长'.repeat(60);f.nodes[2].label='待验证的资源边界';
  for(const compact of [false,true]){
    const [{svg,geometry:g}]=renderTechnicalFigure(f,{compact});assert.ok(svg.includes('&lt;X&gt;')&&svg.includes('A &amp; B'));assert.ok(!svg.includes('<X>'));
    assert.ok(g.nodes.find(n=>n.id==='a2').pending);assert.ok(svg.includes('role="img"')&&svg.includes('<title')&&svg.includes('<desc'));
    for(const t of g.textBoxes){const n=g.nodes.find(n=>n.id===t.id);assert.ok(t.y>=n.y&&t.y+t.h<=n.y+n.h);}
  }
});
test('held-request branches and ACK paths retain every relation without shared rails',()=>{
  for(const {diagram:f} of regressions)for(const compact of [false,true]){
    const before=structuredClone(f);
    const [{geometry:g}]=renderTechnicalFigure(f,{compact});
    assert.deepEqual(f,before,'rendering must not rewrite the report');
    assert.deepEqual(g.routes.map(r=>[r.from,r.to,r.label]),f.edges.map(e=>[e.from,e.to,e.label]));
    const segments=g.routes.flatMap((r,edge)=>r.points.slice(1).map((b,i)=>({edge,a:r.points[i],b})));
    for(let i=0;i<segments.length;i++)for(const q of segments.slice(i+1)){
      const p=segments[i];if(p.edge===q.edge)continue;
      let shared=0;
      if(p.a[0]===p.b[0]&&q.a[0]===q.b[0]&&p.a[0]===q.a[0])
        shared=Math.min(Math.max(p.a[1],p.b[1]),Math.max(q.a[1],q.b[1]))-Math.max(Math.min(p.a[1],p.b[1]),Math.min(q.a[1],q.b[1]));
      if(p.a[1]===p.b[1]&&q.a[1]===q.b[1]&&p.a[1]===q.a[1])
        shared=Math.min(Math.max(p.a[0],p.b[0]),Math.max(q.a[0],q.b[0]))-Math.max(Math.min(p.a[0],p.b[0]),Math.min(q.a[0],q.b[0]));
      assert.ok(shared<=1,`${f.title}: edges ${p.edge+1}/${q.edge+1} share ${shared}px`);
    }
  }
});
