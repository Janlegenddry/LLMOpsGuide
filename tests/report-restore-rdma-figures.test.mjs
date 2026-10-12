import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTechnicalFigure, xml } from '../src/lib/report-figures.mjs';
import { validateRecord } from '../src/lib/radar-store.mjs';
const figures = JSON.parse(await readFile(new URL('./fixtures/restore-rdma-figures.json', import.meta.url), 'utf8'));
const records = JSON.parse(await readFile(new URL('../src/content/radar.json', import.meta.url), 'utf8'));
const template = records.find(r => r.id === 'sglang-v0-5-21');
const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
function crosses(a,b,box) {
  if(a[0]===b[0]) return a[0]>box.x && a[0]<box.x+box.w && Math.max(a[1],b[1])>box.y && Math.min(a[1],b[1])<box.y+box.h;
  assert.equal(a[1],b[1]);
  return a[1]>box.y && a[1]<box.y+box.h && Math.max(a[0],b[0])>box.x && Math.min(a[0],b[0])<box.x+box.w;
}
test('restore and RDMA figures preserve all input data and reject incomplete roles',()=>{
  for(const figure of figures){
    const record=structuredClone(template),copy=structuredClone(figure);copy.sourceIndices=[0];
    record.report.sections.find(s=>s.id==='mechanism').blocks=[copy];
    assert.deepEqual(validateRecord(record).report.sections.find(s=>s.id==='mechanism').blocks[0],copy);
    copy.presentation.panels[0].nodeIds.pop();assert.throws(()=>validateRecord(record));
    copy.presentation.kind='unknown-restore-layout';assert.throws(()=>validateRecord(record));
  }
});
test('all declared arrows, numbered labels and complete legends fit both screens',()=>{
  const ids=new Set();
  for(const [i,f] of figures.entries()) for(const compact of [false,true]){
    const views=renderTechnicalFigure(f,{compact,id:`restore-rdma-${i}-${compact}`});assert.equal(views.length,1);
    const {svg,geometry:g}=views[0];assert.equal(g.width,compact?320:760);assert.equal(g.nodes.length,f.nodes.length);
    assert.equal(g.routes.length,f.edges.length);assert.equal((svg.match(/<polyline /g)||[]).length,f.edges.length);
    for(const node of g.nodes)assert.ok(node.x>=0 && node.y>=0 && node.x+node.w<=g.width && node.y+node.h<=g.height);
    for(const [j,r] of g.routes.entries()){
      assert.deepEqual([r.from,r.to,r.label],[f.edges[j].from,f.edges[j].to,f.edges[j].label]);
      assert.equal(g.legendBoxes[j].text,f.edges[j].label);
      for(const box of [r.labelBox,g.legendBoxes[j]]){
        assert.ok(box.x>=0 && box.y>=0 && box.x+box.w<=g.width && box.y+box.h<=g.height);
        for(const node of g.nodes)assert.ok(!overlap(box,node));
      }
      for(const other of g.routes.slice(j+1))assert.ok(!overlap(r.labelBox,other.labelBox));
      for(let k=1;k<r.points.length;k++){
        const a=r.points[k-1],b=r.points[k];
        for(const p of [a,b])assert.ok(p[0]>=0 && p[0]<=g.width && p[1]>=0 && p[1]<=g.height);
        for(const node of g.nodes)assert.ok(!crosses(a,b,node),`${f.presentation.kind}: node ${node.id}`);
        for(const label of [...g.routes.map(r=>r.labelBox),...g.legendBoxes])assert.ok(!crosses(a,b,label),`${f.presentation.kind}: label ${label.text||''}`);
      }
    }
    for(const m of svg.matchAll(/\bid="([^"]+)"/g)){assert.ok(!ids.has(m[1]));ids.add(m[1]);}
    assert.ok(svg.includes('role="img"') && svg.includes('<title') && svg.includes('<desc'));
  }
});
test('slot consensus, ledgers and independent boundaries create no extra safety claims',()=>{
  const [consensus,budget]=figures;
  const targets=(f,id)=>f.edges.filter(e=>e.from===id).map(e=>e.to);
  assert.deepEqual(targets(consensus,'same-ids'),['min']);
  assert.deepEqual(targets(consensus,'min'),['reject']);
  assert.deepEqual(targets(consensus,'local-gate'),['local-retain']);
  assert.ok(!consensus.edges.some(e=>e.from==='dma-boundary'||e.to==='dma-boundary'));
  assert.ok(consensus.caption.includes('不证明队列身份') && consensus.caption.includes('没有Failed到页释放'));
  for(const id of ['a-effective','b-effective','retired','budget-boundary'])assert.equal(targets(budget,id).length,0);
  assert.deepEqual(targets(budget,'queued'),['retired']);
  const view=renderTechnicalFigure(budget)[0];assert.equal(new Set(view.geometry.nodes.map(n=>n.w*n.h)).size,1);
  assert.ok(view.svg.includes('5000 − 0') && view.svg.includes('8000 − 3000'));
});
test('RDMA retirement preserves W3/W5 signals and partial-post retry stays a branch',()=>{
  const [,,retirement,partial]=figures;
  const targets=(f,id)=>f.edges.filter(e=>e.from===id).map(e=>e.to);
  assert.deepEqual(targets(retirement,'retire'),['quota']);
  assert.deepEqual(targets(retirement,'w4'),['w5','tail']);assert.deepEqual(targets(retirement,'w5'),['tail']);
  assert.ok(!retirement.edges.some(e=>e.from==='quota' && e.to==='tail'));
  assert.deepEqual(targets(partial,'flush'),['attempt']);assert.deepEqual(targets(partial,'attempt'),['retry','failed']);
  assert.deepEqual(targets(partial,'unposted'),[]);assert.ok(!targets(partial,'retry').includes('failed'));
  for(const compact of [false,true]){
    const svg=renderTechnicalFigure(retirement,{compact})[0].svg;
    assert.ok(svg.includes('W3信号') && svg.includes('周期信号') && svg.includes('W5信号') && svg.includes('链尾信号'));
  }
});
test('unexecuted boundaries stay hollow after ID changes and every caption is escaped',()=>{
  for(const [i,f] of figures.entries())for(const compact of [false,true]){
    const copy=structuredClone(f),mapping=new Map(copy.nodes.map((n,j)=>[n.id,`renamed-${j}`]));
    for(const n of copy.nodes)n.id=mapping.get(n.id);
    for(const e of copy.edges){e.from=mapping.get(e.from);e.to=mapping.get(e.to);}
    for(const p of copy.presentation.panels)p.nodeIds=p.nodeIds.map(id=>mapping.get(id));
    copy.nodes[0].shortLabel='<角色>';copy.edges[0].label='A & B';
    const {svg,geometry}=renderTechnicalFigure(copy,{compact,id:`escaped-restore-${i}-${compact}`})[0];
    assert.ok(svg.includes('&lt;角色&gt;') && svg.includes('A &amp; B') && svg.includes(xml(f.caption)));
    assert.equal(geometry.nodes.filter(n=>n.pending).length,[1,1,0,2,1][i]);
    assert.equal((svg.match(/fill="#fff" stroke="[^"]+" stroke-width="1.5" stroke-dasharray="5 4"/g)||[]).length,[1,1,0,2,1][i]);
    assert.ok(!svg.includes('foreignObject') && !svg.includes('<script'));
  }
});
test('storage notifications preserve cumulative work without equating ACK and persistence',()=>{
  const f=figures[4],targets=id=>f.edges.filter(e=>e.from===id).map(e=>e.to);
  assert.deepEqual(targets('read-final'),['read-next']);
  assert.deepEqual(targets('write-error'),['write-ack','data-fact']);
  assert.ok(!targets('write-ack').includes('data-fact'));
  assert.ok(!f.edges.some(e=>e.from==='boundary'||e.to==='boundary'));
  for(const compact of [false,true]){
    const {svg,geometry:g}=renderTechnicalFigure(f,{compact})[0];
    assert.ok(svg.includes('本批新增 0') && svg.replace(/<[^>]+>/g,'').replace(/\s+/g,'').includes('累计前缀保留'));
    const visible=svg.replace(/<[^>]+>/g,'').replace(/\s+/g,'');
    assert.ok(visible.includes('非全量持久化') && visible.includes('非精确落盘量'));
    if(compact){const ids=[...g.nodes].sort((a,b)=>a.y-b.y).map(n=>n.id);assert.equal(ids.indexOf('data-fact'),ids.indexOf('write-ack')+1);}
    else {const read=g.nodes.filter(n=>n.role<5),write=g.nodes.filter(n=>n.role>=5&&n.role<10);assert.equal(new Set(read.map(n=>n.y)).size,1);assert.equal(new Set(write.map(n=>n.y)).size,1);assert.ok(read[0].y<write[0].y);}
  }
});
