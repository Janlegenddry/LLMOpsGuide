import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderTechnicalFigure } from '../src/lib/report-figures.mjs';
import { validateRecord } from '../src/lib/radar-store.mjs';

const figures = JSON.parse(await readFile(new URL('./fixtures/delivery-layout-figures.json', import.meta.url), 'utf8'));
const records = JSON.parse(await readFile(new URL('../src/content/radar.json', import.meta.url), 'utf8'));
const template = records.find(r => r.id === 'sglang-v0-5-21');
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function crosses(a, b, box) {
  if (a[0] === b[0]) return a[0] > box.x && a[0] < box.x + box.w && Math.max(a[1], b[1]) > box.y && Math.min(a[1], b[1]) < box.y + box.h;
  assert.equal(a[1], b[1]);
  return a[1] > box.y && a[1] < box.y + box.h && Math.max(a[0], b[0]) > box.x && Math.min(a[0], b[0]) < box.x + box.w;
}

test('delivery layouts preserve full graph data and enforce fixed roles', () => {
  for (const figure of figures) {
    const record = structuredClone(template), copy = structuredClone(figure);
    copy.sourceIndices = [0];
    record.report.sections.find(s => s.id === 'mechanism').blocks = [copy];
    assert.deepEqual(validateRecord(record).report.sections.find(s => s.id === 'mechanism').blocks[0], copy);
    copy.presentation.panels[0].nodeIds.pop();
    assert.throws(() => validateRecord(record));
  }
});

test('delivery arrows and labels fit desktop and mobile without crossing cards', () => {
  const svgIds = new Set();
  for (const [index, figure] of figures.entries()) for (const compact of [false, true]) {
    const views = renderTechnicalFigure(figure, { compact, id: `delivery-${index}-${compact}` });
    assert.equal(views.length, 1);
    const { svg, width, geometry: g } = views[0];
    assert.equal(width, compact ? 320 : 760);
    assert.equal(g.nodes.length, figure.nodes.length);
    assert.equal(g.routes.length, figure.edges.length);
    assert.equal((svg.match(/<polyline /g) || []).length, figure.edges.length);
    for (const node of g.nodes) assert.ok(node.x >= 0 && node.y >= 0 && node.x + node.w <= g.width && node.y + node.h <= g.height);
    for (const [i, route] of g.routes.entries()) {
      assert.equal(route.from, figure.edges[i].from);
      assert.equal(route.to, figure.edges[i].to);
      const label = route.labelBox;
      assert.ok(label.x >= 0 && label.y >= 0 && label.x + label.w <= g.width && label.y + label.h <= g.height);
      for (const node of g.nodes) assert.ok(!overlap(label, node));
      for (const other of g.routes.slice(i + 1)) assert.ok(!overlap(label, other.labelBox));
      for (let j = 1; j < route.points.length; j++) {
        const a = route.points[j - 1], b = route.points[j];
        for (const point of [a, b]) assert.ok(point[0] >= 0 && point[0] <= g.width && point[1] >= 0 && point[1] <= g.height);
        for (const node of g.nodes) assert.ok(!crosses(a, b, node), `${figure.presentation.kind} crosses ${node.id}`);
        for (const other of g.routes) assert.ok(!crosses(a, b, other.labelBox), `${figure.presentation.kind} crosses label ${other.label}`);
      }
    }
    for (const match of svg.matchAll(/\bid="([^"]+)"/g)) { assert.ok(!svgIds.has(match[1])); svgIds.add(match[1]); }
    assert.ok(svg.includes('role="img"') && svg.includes('<title') && svg.includes('<desc'));
  }
});

test('evidence gates, independent input witnesses and receive exits keep separate meanings', () => {
  const [delivery, witnesses, receive] = figures;
  const targets = (figure, from) => figure.edges.filter(edge => edge.from === from).map(edge => edge.to);
  for (const id of ['upstream-pin', 'main-excluded', 'lifetime-reference']) {
    const figure = id === 'lifetime-reference' ? witnesses : delivery;
    assert.ok(!figure.edges.some(edge => edge.from === id || edge.to === id));
  }
  for (const [input, compare] of [['rewrite-activations', 'compare-activations'], ['rewrite-route-ids', 'compare-route-ids'], ['rewrite-route-weights', 'compare-route-weights']]) {
    assert.deepEqual(targets(witnesses, input), [compare]);
    assert.deepEqual(targets(witnesses, compare), ['correctness-observation']);
  }
  assert.deepEqual(targets(receive, 'receive-rejected'), []);
  assert.deepEqual(targets(receive, 'pairing-unresolved'), []);
  assert.deepEqual(targets(receive, 'receive-e2e'), []);
  assert.deepEqual(targets(receive, 'valid-and-tail'), ['receive-e2e']);
  assert.ok(receive.caption.includes('没有自动成功或回退边'));
});

test('independent input comparisons never share vertical rails and mobile pairs each witness', () => {
  const figure = figures[1];
  for (const compact of [false, true]) {
    const { geometry: g } = renderTechnicalFigure(figure, { compact, id: `witness-rails-${compact}` })[0];
    const branches = g.routes.filter(route => route.from.startsWith('rewrite-'));
    for (const [i, route] of branches.entries()) {
      for (const other of branches.slice(i + 1)) {
        for (let a = 1; a < route.points.length; a++) for (let b = 1; b < other.points.length; b++) {
          const [x, z] = [route.points[a - 1], route.points[a]], [u, v] = [other.points[b - 1], other.points[b]];
          const vertical = x[0] === z[0] && u[0] === v[0] && x[0] === u[0];
          const shared = Math.min(Math.max(x[1], z[1]), Math.max(u[1], v[1])) > Math.max(Math.min(x[1], z[1]), Math.min(u[1], v[1]));
          assert.ok(!(vertical && shared));
        }
      }
    }
    if (compact) {
      const ordered = [...g.nodes].sort((a, b) => a.y - b.y).map(node => node.id);
      for (const route of branches) assert.equal(ordered.indexOf(route.to), ordered.indexOf(route.from) + 1);
    }
  }
});

test('unexecuted observations remain hollow when IDs change and labels are escaped', () => {
  for (const [i, figure] of figures.entries()) for (const compact of [false, true]) {
    const copy = structuredClone(figure);
    const mapping = new Map(copy.nodes.map((node, j) => [node.id, `custom-${j}`]));
    for (const node of copy.nodes) node.id = mapping.get(node.id);
    for (const edge of copy.edges) { edge.from = mapping.get(edge.from); edge.to = mapping.get(edge.to); }
    for (const panel of copy.presentation.panels) panel.nodeIds = panel.nodeIds.map(id => mapping.get(id));
    copy.nodes[0].shortLabel = '<角色>';
    copy.nodes[0].subtitle = 'A & B';
    const svg = renderTechnicalFigure(copy, { compact, id: `escaped-delivery-${i}-${compact}` })[0].svg;
    assert.ok(svg.includes('&lt;角色&gt;') && svg.includes('A &amp; B') && !svg.includes('<script') && !svg.includes('foreignObject'));
    assert.equal((svg.match(/fill="#fff" stroke="[^"]+" stroke-width="1.5" stroke-dasharray="5 4"/g) || []).length, [4, 7, 1][i]);
  }
});
