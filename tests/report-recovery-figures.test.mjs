import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRecord } from '../src/lib/radar-store.mjs';
import { renderTechnicalFigure, xml } from '../src/lib/report-figures.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/2026-10-05-mechanism-figures.json',import.meta.url)));
const seed=JSON.parse(readFileSync(new URL('../examples/radar-report-record.json',import.meta.url)));
const allText=svg=>svg.replace(/<[^>]+>/g,'');
const contained=svg=>{
  const [,w,h]=svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  for (const element of svg.matchAll(/<(?:rect|text|line)\b([^>]*)>/g)){
    const a=Object.fromEntries([...element[1].matchAll(/([a-z\d]+)="([\d.-]+)"/g)].map(m=>[m[1],Number(m[2])]));
    for (const k of ['x','x1','x2'])if(k in a)assert.ok(a[k]>=0 && a[k]<=w);
    for (const k of ['y','y1','y2'])if(k in a)assert.ok(a[k]>=0 && a[k]<=h);
    if ('x'in a && 'width'in a)assert.ok(a.x+a.width<=w+.01);
    if ('y'in a && 'height'in a)assert.ok(a.y+a.height<=h+.01);
  }
  for (const match of svg.matchAll(/<polyline points="([^"]+)"/g))for(const point of match[1].split(' ')){
    const [x,y]=point.split(',').map(Number);assert.ok(x>=0 && x<=w && y>=0 && y<=h,point);
  }
};
test('October 5 recovery and constant figures validate without changing report version or accepting raw SVG',()=>{
  for (const f of fixtures){
    const record=structuredClone(seed),block={...structuredClone(f),sourceIndices:[]};
    record.report.sections.find(s=>s.id==='mechanism').blocks=[block];
    assert.deepEqual(validateRecord(record).report.sections.find(s=>s.id==='mechanism').blocks[0],block);
    const missing=structuredClone(record);missing.report.sections.find(s=>s.id==='mechanism').blocks[0].presentation.panels[0].nodeIds.pop();
    assert.throws(()=>validateRecord(missing));
    const injected=structuredClone(record);injected.report.sections.find(s=>s.id==='mechanism').blocks[0].presentation.svg='<svg/>';
    assert.throws(()=>validateRecord(injected));
  }
});
test('every new figure retains all nodes, escaped captions, unique IDs and contained desktop/mobile geometry',()=>{
  const ids=new Set();
  for (const [i,f]of fixtures.entries())for(const compact of [false,true]){
    const views=renderTechnicalFigure(f,{compact,id:'oct5-'+i+'-'+compact});
    const text=views.map(v=>allText(v.svg)).join('');
    for(const n of f.nodes)assert.ok(text.includes(xml(n.shortLabel || n.label)),n.id);
    for(const view of views){
      assert.equal(view.width,compact?320:760);contained(view.svg);
      assert.ok(view.svg.includes('role="img"') && view.svg.includes(xml(f.caption)));
      assert.ok(!view.svg.includes('foreignObject') && !view.svg.includes('<script'));
      for(const match of view.svg.matchAll(/\bid="([^"]+)"/g)){assert.ok(!ids.has(match[1]),match[1]);ids.add(match[1]);}
    }
    const escaped=structuredClone(f);escaped.nodes[0].shortLabel='<检查>';escaped.nodes[0].subtitle='A & B';
    const html=renderTechnicalFigure(escaped,{compact,id:'escaping'}).map(v=>v.svg).join('');
    assert.ok(html.includes('&lt;检查&gt;') && !html.includes('<检查>'));
  }
});
test('recovery diagrams keep timeout separate from ACK, skip separate from timers and old requests terminal',()=>{
  const settlement=fixtures.find(f=>f.presentation.kind==='failure-settlement');
  assert.ok(!settlement.edges.some(e=>e.from==='old-timeout' && e.to==='conditional-ack'));
  assert.ok(settlement.edges.some(e=>e.from==='captured-room' && e.to==='recovery-input'));
  const reload=fixtures.find(f=>f.presentation.kind==='peer-reload');
  assert.ok(!reload.edges.some(e=>e.from==='skip-attempt'));
  assert.ok(reload.edges.some(e=>e.from==='remove-again' && e.to==='metadata-missing'));
  assert.ok(!fixtures[0].edges.some(e=>e.from==='old-request-failed'));
  assert.ok(!fixtures[3].edges.some(e=>e.from.startsWith('observe-') && e.to==='no-success-release'));
});
test('BF16 evidence never connects old pin to fixed builder or performance to a passed numerical gate',()=>{
  const paths=fixtures.find(f=>f.presentation.kind==='constant-paths');
  assert.ok(!paths.edges.some(e=>e.from==='runtime-tensor'));
  const containment=fixtures.find(f=>f.presentation.kind==='source-containment');
  assert.ok(!containment.edges.some(e=>e.from==='triton-pinned-sha' && e.to==='fix-builder'));
  assert.ok(!containment.edges.some(e=>e.from==='installed-pending'));
  const gates=fixtures.find(f=>f.presentation.kind==='deployment-gates');
  assert.ok(!gates.edges.some(e=>e.from==='performance-independent' || e.to==='performance-independent'));
  for(const compact of [false,true]){
    const svg=renderTechnicalFigure(gates,{compact}).map(v=>v.svg).join('');
    assert.ok(svg.includes('均计划执行') && svg.includes('不抵消数值失败'));
  }
});

