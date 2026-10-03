import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mergeRecords } from '../src/lib/radar-store.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const records = mergeRecords(JSON.parse(await readFile(join(root, 'src/content/radar.json'), 'utf8')), []).records;
const api = JSON.parse(await readFile(join(root, 'dist/api/radar.json'), 'utf8'));
const compact = text => text.replace(/\s+/g, ' ').trim();
const plain = html => html.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27|#\d+|#x[\da-f]+);/gi, entity => {
  const values = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&#x27;': "'" };
  return values[entity] ?? String.fromCodePoint(parseInt(entity.slice(2, -1).replace(/^x/, ''), entity.startsWith('&#x') ? 16 : 10));
});
let reports = 0, figures = 0, textChecks = 0;
for (const record of records) {
  const html = await readFile(join(root, `dist/radar/${record.id}/index.html`), 'utf8');
  if (!record.report) {
    assert.ok(!html.includes('data-report-version='), `${record.id} falsely claims a report`);
    assert.ok(html.includes(record.kind === 'reading' ? '尚未解读' : '完整报告待补充'));
    continue;
  }
  reports++;
  assert.deepEqual(api.records.find(r => r.id === record.id).report, record.report, `${record.id} API lost report data`);
  assert.ok(html.includes('阅读完整报告') && html.includes('data-report-version="1"'));
  const text = compact(plain(html));
  const contains = value => { assert.ok(text.includes(compact(value)), `${record.id} missing rendered text: ${value.slice(0, 50)}`); textChecks++; };
  contains(record.report.scope);
  let expectedFigures = 0;
  for (const section of record.report.sections) {
    assert.ok(html.includes(`id="report-${section.id}"`), `${record.id} missing section ${section.id}`);
    contains(section.title);
    for (const block of section.blocks) {
      if (block.text) contains(block.text);
      if (block.title) contains(block.title);
      if (block.caption) contains(block.caption);
      if (block.items) block.items.forEach(contains);
      if (block.type === 'table') { block.columns.forEach(contains); block.rows.forEach(row => row.cells.forEach(contains)); }
      if (block.type === 'diagram') { expectedFigures++; block.nodes.forEach(n => { contains(n.label); contains(n.detail); }); block.edges.forEach(e => contains(e.label)); }
      if (block.type === 'bars') { expectedFigures++; block.series.forEach(series => contains(series.label)); }
    }
  }
  assert.equal((html.match(/class="report-graph(?: report-bars)?"/g) || []).length, expectedFigures, `${record.id} figure count mismatch`);
  figures += expectedFigures;
}
console.log(JSON.stringify({ reports, figures, textChecks, api: 'complete', undigested: records.length - reports }));
