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

const numericAttributes=text=>Object.fromEntries([...text.matchAll(/([a-z\d]+)="([\d.-]+)"/g)].map(m=>[m[1],Number(m[2])]));
const boxesOverlap=(a,b)=>Math.max(a.x,b.x)<Math.min(a.x+a.width,b.x+b.width) && Math.max(a.y,b.y)<Math.min(a.y+a.height,b.y+b.height);
const lineTouchesBox=(a,b,box)=>a[0]===b[0]
  ? a[0]>=box.x && a[0]<=box.x+box.width && Math.max(Math.min(a[1],b[1]),box.y)<=Math.min(Math.max(a[1],b[1]),box.y+box.height)
  : a[1]===b[1] && a[1]>=box.y && a[1]<=box.y+box.height && Math.max(Math.min(a[0],b[0]),box.x)<=Math.min(Math.max(a[0],b[0]),box.x+box.width);
const arrowGeometry=svg=>({
  cards:[...svg.matchAll(/<rect\b([^>]*rx="8"[^>]*)\/>/g)].map(m=>numericAttributes(m[1])),
  arrows:[...svg.matchAll(/<polyline points="([^"]+)"/g)].map(m=>m[1].split(' ').map(p=>p.split(',').map(Number))),
  labels:[...svg.matchAll(/<rect\b([^>]*rx="3"[^>]*)\/><text\b[^>]*>([^<]*)<\/text>/g)].map(m=>({...numericAttributes(m[1]),text:m[2]})),
});
test('settlement branches retain every label and route outside cards with separated recovery labels',()=>{
  const f=fixtures.find(f=>f.presentation.kind==='failure-settlement');
  for(const compact of [false,true]){
    const svg=renderTechnicalFigure(f,{compact,id:'settlement-routing'})[0].svg;
    const {cards,arrows,labels}=arrowGeometry(svg);
    assert.equal(cards.length,f.nodes.length);assert.equal(arrows.length,f.edges.length);assert.equal(labels.length,f.edges.length);
    for(const e of f.edges)assert.equal(labels.filter(l=>l.text===xml(e.shortLabel)).length,1,e.shortLabel);
    for(const arrow of arrows)for(let i=1;i<arrow.length;i++)for(const card of cards)assert.ok(!lineTouchesBox(arrow[i-1],arrow[i],card),'arrow crosses card');
    for(let i=0;i<labels.length;i++){
      for(const card of cards)assert.ok(!boxesOverlap(labels[i],card),labels[i].text+' overlaps a card');
      for(let j=i+1;j<labels.length;j++)assert.ok(!boxesOverlap(labels[i],labels[j]),labels[i].text+' / '+labels[j].text);
      for(const arrow of arrows.slice(i+1))for(let j=1;j<arrow.length;j++)assert.ok(!lineTouchesBox(arrow[j-1],arrow[j],labels[i]),'later arrow crosses '+labels[i].text);
    }
  }
});
test('reload skip labels are distinct and deployment return stays clear of gate labels on both canvases',()=>{
  for(const compact of [false,true]){
    const reloadFigure=fixtures.find(f=>f.presentation.kind==='peer-reload');
    const reload=arrowGeometry(renderTechnicalFigure(reloadFigure,{compact})[0].svg);
    const selected=['无登记','未满一秒','仍缺失'].map(text=>reload.labels.find(l=>l.text===text));
    assert.ok(selected.every(Boolean));
    for(let i=0;i<selected.length;i++){
      for(const card of reload.cards)assert.ok(!boxesOverlap(selected[i],card),selected[i].text);
      for(let j=i+1;j<selected.length;j++)assert.ok(!boxesOverlap(selected[i],selected[j]));
      const edgeIndex=reloadFigure.edges.findIndex(e=>e.shortLabel===selected[i].text);
      for(const arrow of reload.arrows.slice(edgeIndex+1))for(let j=1;j<arrow.length;j++)assert.ok(!lineTouchesBox(arrow[j-1],arrow[j],selected[i]),'later arrow crosses '+selected[i].text);
    }
    const f=fixtures.find(f=>f.presentation.kind==='deployment-gates');
    const gates=arrowGeometry(renderTechnicalFigure(f,{compact})[0].svg);
    assert.equal(gates.arrows.length,f.edges.length);
    const returning=gates.arrows[f.edges.findIndex(e=>e.from==='isolation-return')];
    for(let i=1;i<returning.length;i++){
      for(const card of gates.cards)assert.ok(!lineTouchesBox(returning[i-1],returning[i],card));
      for(const label of gates.labels.filter(l=>l.text==='满足才继续'))assert.ok(!lineTouchesBox(returning[i-1],returning[i],label));
    }
  }
});
