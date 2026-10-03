import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, stat, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRecord, parsePayload, mergeRecords } from '../src/lib/radar-store.mjs';
import { importPayload } from '../scripts/import-radar.mjs';
import { matchesRadar } from '../src/lib/radar-filter.ts';
const sample = JSON.parse(await readFile(new URL('../examples/radar-record.json', import.meta.url), 'utf8'));
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
