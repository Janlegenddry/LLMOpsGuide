import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRecord, mergeRecords } from '../src/lib/radar-store.mjs';
import { renderTechnicalFigure, renderNumericalFigure, xml } from '../src/lib/report-figures.mjs';
const records = JSON.parse(await readFile(new URL('../src/content/radar.json', import.meta.url), 'utf8'));
const h20 = records.find(r => r.id === 'h20-serving-slo');
const sglang = records.find(r => r.id === 'sglang-v0-5-21');
const figures = r => r.report.sections.flatMap(s => s.blocks).filter(b => ['diagram', 'bars'].includes(b.type));
const graph = r => figures(r).find(b => b.type === 'diagram');
const render = (b, compact, id) => b.type === 'diagram' ? renderTechnicalFigure(b, { compact, id }) : renderNumericalFigure(b, { compact, id });

// Geometric containment catches clipped panels when rank counts or comparison counts grow.
function contained(svg) {
  const [, width, height] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  for (const element of svg.matchAll(/<(?:rect|text|line)\b([^>]*)>/g)) {
    const attrs = Object.fromEntries([...element[1].matchAll(/([a-z\d]+)="([\d.-]+)"/g)].map(m => [m[1], Number(m[2])]));
    for (const key of ['x', 'x1', 'x2']) if (key in attrs) assert.ok(attrs[key] >= 0 && attrs[key] <= width, `${key} outside canvas`);
    for (const key of ['y', 'y1', 'y2']) if (key in attrs) assert.ok(attrs[key] >= 0 && attrs[key] <= height, `${key} outside canvas`);
    if ('x' in attrs && 'width' in attrs) assert.ok(attrs.x + attrs.width <= width + .01);
    if ('y' in attrs && 'height' in attrs) assert.ok(attrs.y + attrs.height <= height + .01);
  }
}

test('new figure metadata is preserved and old full-report payloads remain idempotent', () => {
  for (const r of [h20, sglang]) assert.deepEqual(validateRecord(r).report, r.report);
  const old = structuredClone(h20);
  for (const b of figures(old)) {
    delete b.presentation; delete b.layout;
    for (const n of b.nodes || []) { delete n.shortLabel; delete n.subtitle; delete n.tone; }
    for (const e of b.edges || []) delete e.shortLabel;
    for (const s of b.series || []) { delete s.rankTimes; delete s.deliveredTokens; }
  }
  const validated = validateRecord(old);
  assert.deepEqual(validated.report, old.report);
  assert.equal(mergeRecords([validated], [old]).unchanged, 1);
});

test('figure groups reject unknown roles, repeated or missing nodes and unknown fields', () => {
  const mutations = [
    b => b.presentation.kind = '__proto__',
    b => b.presentation.kind = 'arbitrary-svg',
    b => b.presentation.panels[0].tone = '#abc',
    b => b.presentation.panels[0].nodeIds[0] = 'missing',
    b => b.presentation.panels[0].nodeIds[1] = b.presentation.panels[0].nodeIds[0],
    b => b.presentation.panels[0].nodeIds.pop(),
    b => b.nodes.push({id:'extra',label:'多余',detail:'未分组节点',column:3,row:3}),
    b => b.nodes[0].tone = 'unknown',
    b => b.presentation.rawSVG = '<svg/>',
  ];
  for (const mutate of mutations) { const r = structuredClone(sglang); mutate(graph(r)); assert.throws(() => validateRecord(r)); }
});

test('numerical figures require a true slowest rank and actual committed token denominator', () => {
  const mutations = [
    b => b.rank.series[0].rankTimes[3] = 11,
    b => b.rank.series[0].rankTimes[0] = 0,
    b => b.rank.series[0].segments.pop(),
    b => b.cost.series[0].deliveredTokens = 0,
    b => b.cost.series[0].deliveredTokens = 1.5,
    b => b.cost.series[0].segments.push({label:'重复计算',value:3}),
    b => b.cost.series[0].rankTimes = [1,2],
  ];
  for (const mutate of mutations) {
    const r = structuredClone(h20), all = figures(r); mutate({rank:all.find(b => b.layout === 'rank-timeline'),cost:all.find(b => b.layout === 'token-cost')});
    assert.throws(() => validateRecord(r));
  }
});

test('all report figures fit desktop and compact canvases with distinct accessible SVG IDs', () => {
  const ids = new Set();
  for (const r of [sglang, h20]) for (const [i, b] of figures(r).entries()) for (const compact of [false,true]) {
    for (const p of render(b, compact, `${r.id}-${i}-${compact}`)) {
      assert.equal(p.width, compact ? 320 : 760); contained(p.svg);
      assert.ok(p.svg.includes('role="img"') && p.svg.includes('<title') && p.svg.includes('<desc'));
      for (const m of p.svg.matchAll(/\bid="([^"]+)"/g)) { assert.ok(!ids.has(m[1]), `duplicate SVG id ${m[1]}`); ids.add(m[1]); }
      assert.ok(!p.svg.includes('foreignObject') && !p.svg.includes('<script'));
    }
  }
});

test('SVG text is escaped, English words stay intact, and rank wait and unit costs remain explicit', () => {
  assert.equal(xml('<img src="x" onerror="x"> &'), '&lt;img src=&quot;x&quot; onerror=&quot;x&quot;&gt; &amp;');
  const r = structuredClone(h20), request = graph(r);
  request.nodes[0].shortLabel = '<X>'; request.nodes[0].subtitle = 'A & B';
  const svg = renderTechnicalFigure(request)[0].svg;
  assert.ok(svg.includes('&lt;X&gt;') && svg.includes('A &amp; B'));
  assert.ok(!svg.includes('<X>'));
  assert.ok(svg.includes('>token</text>') && !svg.includes('>ken</text>'));
  const timeline = renderNumericalFigure(figures(h20).find(b => b.layout === 'rank-timeline'))[0].svg;
  assert.ok(timeline.includes('等待 8') && timeline.includes('12 ms') && timeline.includes('8 ms'));
  const costs = renderNumericalFigure(figures(h20).find(b => b.layout === 'token-cost'))[0].svg;
  for (const value of ['12 ms/token', '6 ms/token', '7 ms/token']) assert.ok(costs.includes(value));
});

test('valid expanded numerical inputs grow vertically instead of clipping the canvas', () => {
  const r = structuredClone(h20), all = figures(r), rank = all.find(b => b.layout === 'rank-timeline'), cost = all.find(b => b.layout === 'token-cost');
  rank.series.forEach(s => { s.rankTimes = Array(16).fill(s.segments[0].value); });
  cost.series = Array.from({length:12}, (_,i) => ({label:`方案 ${i}`,segments:[{label:'完整墙钟',value:18+i}],deliveredTokens:3}));
  validateRecord(r);
  for (const b of [rank,cost]) for (const compact of [false,true]) renderNumericalFigure(b,{compact}).forEach(p => contained(p.svg));
});
