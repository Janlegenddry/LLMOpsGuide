import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, stat, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRecord, parsePayload, mergeRecords } from '../src/lib/radar-store.mjs';
import { importPayload } from '../scripts/import-radar.mjs';
import { matchesRadar } from '../src/lib/radar-filter.ts';
const sample = JSON.parse(await readFile(new URL('../examples/radar-record.json', import.meta.url), 'utf8'));
const reportSample = JSON.parse(await readFile(new URL('../examples/radar-report-record.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(sample);

test('public source boundaries reject private payloads, credential URLs and nonofficial hosts', () => {
  for (const mutate of [r => r.containsPrivateData = true, r => r.visibility = 'private', r => r.sources[0].url = 'https://lmsys.org.evil.test/blog/foo', r => r.sources[0].url = 'https://lmsys.org/blog/foo?token=secret', r => r.sources[0].url = 'http://www.lmsys.org/blog/foo', r => r.sources[0].url = 'https://github.com/private-org/internal/issues/1']) {
    const r = copy(); mutate(r); assert.throws(() => validateRecord(r));
  }
  const unsafe = copy(); unsafe.summary = '<script>alert(1)</script>'; assert.throws(() => validateRecord(unsafe));
});
test('record validation catches invalid dates, unsupported fields, missing evidence and unsafe IDs', () => {
  for (const mutate of [r => r.id = '../../other', r => r.id = 12, r => r.publishedAt = '2026-02-30', r => r.reviewedAt = '2026-01-01', r => r.claims[0].sourceIndices = [], r => r.claims[0].sourceIndices = [99], r => r.topics = ['未知'], r => r.html = 'extra', r => r.related = [{ title: 'bad', path: '//example/' }]]) {
    const r = copy(); mutate(r); assert.throws(() => validateRecord(r));
  }
});
test('same public event is idempotent; corrections retain identity and reject stale revisions', () => {
  const first = mergeRecords([], parsePayload(sample));
  assert.equal(first.added, 1);
  assert.equal(mergeRecords(first.records, parsePayload({ records: [sample] })).unchanged, 1);
  const corrected = copy(); corrected.summary += ' 补充验证边界。';
  assert.equal(mergeRecords(first.records, [corrected]).updated, 1);
  const duplicate = copy(); duplicate.id = 'another-id';
  assert.throws(() => mergeRecords(first.records, [duplicate]), /沿用既有 ID/);
  const changedSource = copy(); changedSource.sources[0].url = 'https://github.com/sgl-project/sglang/releases/tag/v0.5.20';
  assert.throws(() => mergeRecords(first.records, [changedSource]), /不能修改/);
  const stale = copy(); stale.reviewedAt = sample.publishedAt;
  assert.throws(() => mergeRecords(first.records, [stale]), /旧核对日期/);
  assert.throws(() => mergeRecords([], [sample, sample]), /重复 ID/);
  assert.equal(mergeRecords(first.records, parsePayload([])).records.length, 1);
});
test('imports are atomic, unchanged imports do not touch file, and locks avoid lost concurrent updates', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'radar-import-'));
  const file = join(dir, 'radar.json');
  try {
    await importPayload(sample, file);
    const before = await readFile(file, 'utf8'); const mtime = (await stat(file)).mtimeMs;
    assert.equal((await importPayload(sample, file)).unchanged, 1);
    assert.equal((await stat(file)).mtimeMs, mtime);
    const update = copy(); update.summary += ' 修正。';
    await importPayload(update, file, { dryRun: true });
    assert.equal(await readFile(file, 'utf8'), before);
    const bad = copy(); bad.claims[0].sourceIndices = [99];
    await assert.rejects(importPayload([update, bad], file));
    assert.equal(await readFile(file, 'utf8'), before);
    await mkdir(`${file}.lock`);
    await assert.rejects(importPayload(update, file), /另一项内容导入/);
    assert.equal(await readFile(file, 'utf8'), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('combined filters match Chinese, case and whitespace; empty results stay empty', () => {
  const r = { search: 'SGLang v0.5.21 KV Cache 原创解读', kind: 'release', month: '2026-10', topics: ['SGLang', 'KV Cache'] };
  const all = { query: '', kind: 'all', month: 'all', topic: 'all' };
  assert.equal(matchesRadar(r, all), true);
  assert.equal(matchesRadar(r, { query: 'kv cache', kind: 'release', month: '2026-10', topic: 'KV Cache' }), true);
  for (const f of [{ query: '不存在' }, { kind: 'analysis' }, { month: '2026-08' }, { topic: 'PD 分离' }]) assert.equal(matchesRadar(r, { ...all, ...f }), false);
});
test('all checked-in records validate as a unique public store', async () => {
  const data = JSON.parse(await readFile(new URL('../src/content/radar.json', import.meta.url), 'utf8'));
  assert.equal(mergeRecords(data, []).records.length, data.length);
});

test('full reports preserve long text, nested tables, graph data and provenance without truncation', () => {
  const record = structuredClone(reportSample);
  const block = record.report.sections[0].blocks[0];
  block.text = '完整解释\n' + '较长的原创机制与验证说明。'.repeat(1000) + '\n最后一段必须保留。';
  const validated = validateRecord(record);
  assert.deepEqual(validated.report, record.report);
  assert.ok(validated.report.sections[0].blocks[0].text.endsWith('最后一段必须保留。'));
  assert.deepEqual(parsePayload({ records: [record] })[0].report, record.report);
  assert.equal(mergeRecords([validated], [record]).unchanged, 1);
});

test('incomplete reports, ungrounded facts and invalid diagrams fail explicitly', () => {
  const mutations = [
    r => r.report.sections.pop(),
    r => r.report.sections[1].id = 'conclusion',
    r => r.report.sections.find(s => s.id === 'mechanism').blocks = [r.report.sections[0].blocks[0]],
    r => r.report.sections.find(s => s.id === 'evidence').blocks = [r.report.sections[0].blocks[0]],
    r => { const b = r.report.sections[0].blocks[0]; b.basis = 'official'; b.sourceIndices = []; },
    r => r.report.sections[0].blocks[0].sourceIndices = [99],
    r => r.report.sections[0].blocks[0].type = 'raw-html',
    r => r.report.sections[0].blocks[0].html = '<p>extra</p>',
    r => r.report.sections[0].blocks[0].text = '<svg onload="bad()">',
    r => r.report.sections[0].blocks[0].text = '长'.repeat(20001),
    r => r.report.sections.find(s => s.id === 'mechanism').blocks.find(b => b.type === 'diagram').nodes[0].column = -1,
    r => { const n = r.report.sections.find(s => s.id === 'mechanism').blocks.find(b => b.type === 'diagram').nodes; n[1].id = n[0].id; },
    r => r.report.sections.find(s => s.id === 'mechanism').blocks.find(b => b.type === 'diagram').edges[0].to = 'missing',
    r => r.report.sections.find(s => s.id === 'evidence').blocks.find(b => b.type === 'table').rows[0].cells.pop(),
  ];
  for (const mutate of mutations) { const r = structuredClone(reportSample); mutate(r); assert.throws(() => validateRecord(r)); }
});

test('summary-only updates preserve a saved report and cannot relabel its evidence', () => {
  const initial = validateRecord(reportSample);
  const update = structuredClone(initial); delete update.report; update.summary += ' 更新摘记。';
  const merged = mergeRecords([initial], [update]);
  assert.equal(merged.updated, 1);
  assert.deepEqual(merged.records[0].report, initial.report);
  assert.equal(mergeRecords(merged.records, [update]).unchanged, 1);
  [update.sources[1], update.sources[2]] = [update.sources[2], update.sources[1]];
  assert.throws(() => mergeRecords([initial], [update]), /保留原来源顺序/);
  const erase = structuredClone(initial); erase.report = null;
  assert.throws(() => mergeRecords([initial], [erase]));
});

test('long-report imports are idempotent and invalid replacement leaves the entire store intact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'radar-report-'));
  const file = join(dir, 'radar.json');
  try {
    await importPayload(reportSample, file);
    const before = await readFile(file, 'utf8'); const mtime = (await stat(file)).mtimeMs;
    assert.equal((await importPayload(reportSample, file)).unchanged, 1);
    assert.equal((await stat(file)).mtimeMs, mtime);
    const valid = structuredClone(reportSample); valid.report.sections[0].blocks[0].text += ' 修订解释。';
    const invalid = structuredClone(sample); invalid.report = { version: 1, scope: '不能作为完整报告', sections: [] };
    await assert.rejects(importPayload([valid, invalid], file));
    assert.equal(await readFile(file, 'utf8'), before);
    assert.deepEqual(JSON.parse(before)[0].report, reportSample.report);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('living sources use access dates and the NCCL allowance stays limited to official documentation', () => {
  const record = structuredClone(reportSample);
  assert.equal(validateRecord(record).sources[5].publishedAt, undefined);
  assert.equal(validateRecord(record).sources[5].accessedAt, record.reviewedAt);
  record.sources.push({ title: 'NCCL', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/api/colls.html', accessedAt: record.reviewedAt });
  assert.doesNotThrow(() => validateRecord(record));
  for (const url of ['https://docs.nvidia.com/private/foo', 'https://docs.nvidia.com.evil.test/deeplearning/nccl/user-guide/docs/api/colls.html']) {
    record.sources.at(-1).url = url; assert.throws(() => validateRecord(record));
  }
});

test('oversized reports and invalid numerical charts are rejected instead of shortened', () => {
  const oversized = structuredClone(reportSample);
  oversized.report.sections[0].blocks = Array.from({ length: 30 }, () => ({ type: 'paragraph', basis: 'inference', sourceIndices: [], text: '长'.repeat(4000) }));
  assert.throws(() => validateRecord(oversized), /200000/);
  const chart = { type: 'bars', title: '非实测算例', caption: '忽略重叠的教学对比。', basis: 'inference', sourceIndices: [], unit: 'ms', series: [{ label: 'A', segments: [{ label: '计算', value: 10 }, { label: '通信', value: 2 }] }, { label: 'B', segments: [{ label: '计算', value: 4 }, { label: '通信', value: 4 }] }] };
  const valid = structuredClone(reportSample); valid.report.sections[0].blocks.push(chart);
  assert.doesNotThrow(() => validateRecord(valid));
  chart.series[0].segments[0].value = -1;
  assert.throws(() => validateRecord(valid), /有限正数/);
});
