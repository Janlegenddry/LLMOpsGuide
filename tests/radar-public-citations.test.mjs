import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateRecord, parsePayload, mergeRecords, sourceURL } from '../src/lib/radar-store.mjs';
import { sourceName, sourceReviewLabel, isOfficialCitation } from '../src/lib/radar-sources.mjs';
import { importPayload } from '../scripts/import-radar.mjs';
const sample = JSON.parse(await readFile(new URL('../examples/radar-record.json', import.meta.url), 'utf8'));
const full = JSON.parse(await readFile(new URL('../examples/radar-report-record.json', import.meta.url), 'utf8'));
const citation = (category = 'paper', status = 'attributed') => ({
  title: '测试引用；不作为新增报告发布', url: 'https://arxiv.org/abs/2309.06180',
  publishedAt: sample.publishedAt, accessedAt: sample.reviewedAt,
  review: { category, publisher: 'arXiv', status, note: '核对范围仅为原文作者陈述，结果未经本站独立验证。', ...(category === 'paper' ? {peerReview:'preprint'} : {}) },
});
const record = (source = citation()) => {
  const r = structuredClone(sample); r.sources[0] = source;
  r.claims.forEach(c => { c.status = 'inference'; }); return r;
};
const reportRecord = (status = 'attributed') => {
  const r = structuredClone(full); r.sources[0] = {...citation('paper',status),publishedAt:r.publishedAt};
  r.claims.forEach(c => { c.status = 'inference'; });
  for (const s of r.report.sections) for (const b of s.blocks) for (const p of b.type === 'table' ? b.rows : [b]) {
    if (p.sourceIndices?.includes(0) && p.basis === 'official') p.basis = 'author';
  }
  return r;
};

test('papers, independent blogs, news and communities enter through explicit public review metadata', () => {
  const cases = [
    ['paper','arXiv','https://arxiv.org/abs/2309.06180'],
    ['paper','OpenReview','https://openreview.net/forum?id=ExamplePaper123'],
    ['blog','独立技术博客','https://research.example.org/inference/cache'],
    ['news','技术新闻','https://news.example.org/ai-infra'],
    ['community','GitHub 社区','https://github.com/other-owner/inference/issues/123'],
    ['community','Hacker News','https://news.ycombinator.com/item?id=123456'],
    ['community','公开论坛','https://forum.example.org/t/inference/123'],
  ];
  for (const [category,publisher,url] of cases) {
    const source=citation(category); source.url=url; source.review.publisher=publisher;
    const validated=validateRecord(record(source));
    assert.deepEqual(validated.sources[0],source);
    assert.ok(sourceName(validated.sources[0]).startsWith(publisher));
    assert.equal(isOfficialCitation(validated.sources[0]),false);
    assert.equal(sourceReviewLabel(source),'已核对原文陈述 · 未独立验证');
    assert.throws(()=>sourceURL(url), /review/);
  }
});

test('paper provenance requires explicit peer-review state and review cannot self-declare official or verified', () => {
  for (const state of ['preprint','peer-reviewed','unknown']) {
    const r=record(); r.sources[0].review.peerReview=state; assert.equal(validateRecord(r).sources[0].review.peerReview,state);
    assert.ok(!sourceName(r.sources[0]).includes('undefined'));
  }
  const mutations = [
    s=>delete s.review.peerReview,
    s=>s.review.peerReview='assumed-reviewed',
    s=>s.review.status='verified',
    s=>s.review.category='official',
    s=>s.review.category='__proto__',
    s=>s.review.note='',
    s=>s.review.publisher='',
    s=>s.review.rawHTML='<p>untrusted</p>',
    s=>s.review.note='<script>bad()</script>',
    s=>delete s.accessedAt,
    s=>s.accessedAt='9999-01-01',
    s=>s.review.category='blog', // peerReview then becomes an invalid extra field
  ];
  for (const mutate of mutations) { const s=citation();mutate(s);assert.throws(()=>validateRecord(record(s))); }
});

test('community posts and comments never inherit official status from a registered repository', () => {
  for (const url of ['https://github.com/sgl-project/sglang/issues/1','https://github.com/sgl-project/sglang/discussions/1','https://github.com/sgl-project/sglang/pull/1#issuecomment-123','https://github.com/sgl-project/sglang/%69ssues/1','https://github.com/sgl-project/sglang/pull/1#%69ssuecomment-123']) {
    assert.throws(()=>sourceURL(url),/review/);
    const s=citation('community');s.url=url;assert.equal(validateRecord(record(s)).sources[0].url,url);
    assert.equal(sourceName(url),'来源待核对');assert.equal(isOfficialCitation(s),false);
    s.review.category='news';assert.throws(()=>validateRecord(record(s)),/community/);
  }
  const old=validateRecord(sample);
  assert.equal(isOfficialCitation(old.sources[0]),true);
  assert.deepEqual(old,sample);
});

test('reviewed citation URLs reject private addresses, local names, credentials and dangerous query/fragment values', () => {
  const unsafe = [
    'http://arxiv.org/abs/2309.06180','javascript:alert(1)','data:text/html,abc','file:///etc/hosts',
    'https://user:secret@arxiv.org/abs/1','https://arxiv.org:8443/abs/1',
    'https://localhost/a','https://foo.localhost/a','https://host.internal/a','https://host.local/a','https://intranet/a',
    'https://example.test/a','https://example.invalid/a','https://host.onion/a',
    'https://127.0.0.1/a','https://2130706433/a','https://0x7f000001/a','https://0177.0.0.1/a','https://10.0.0.1/a','https://172.16.0.1/a','https://192.168.1.1/a','https://169.254.169.254/a','https://8.8.8.8/a',
    'https://[::1]/a','https://[fc00::1]/a','https://[::ffff:127.0.0.1]/a','https://127.0.0.1.nip.io/a','https://127-0-0-1.sslip.io/a',
    'https://openreview.net/forum?id=1&token=secret','https://news.example.org/a?api_key=secret','https://news.example.org/a?signature=secret','https://news.example.org/a?utm_source=tracking',
    'https://openreview.net/forum?id=1&id=2','https://openreview.net/forum?id=https%3A%2F%2Flocalhost','https://openreview.net/forum?id=%2F%2Fevil.org',
    'https://openreview.net/forum?id=%73k-1234567890123456789012345',
    'https://blog.example.org/a#access_token=secret','https://blog.example.org/a#javascript:alert(1)',
  ];
  for(const url of unsafe){const s=citation('blog');s.url=url;assert.throws(()=>validateRecord(record(s)),url);}
});

test('public identifier queries normalize deterministically while source anchors remain usable', () => {
  const s=citation('community');s.url='https://forum.example.org/view?page=2&id=123#comment-456';
  const a=validateRecord(record(s));assert.equal(a.sources[0].url,'https://forum.example.org/view?id=123&page=2#comment-456');
  s.url='https://forum.example.org/view?id=123&page=2#comment-456';
  assert.equal(mergeRecords([a],[record(s)]).unchanged,1);
  assert.deepEqual(parsePayload({records:[a]})[0],a);
});

test('checked nonofficial attribution cannot become confirmed or official; unverified citations cannot become author results', () => {
  const r=record();r.claims[0].status='confirmed';r.claims[0].sourceIndices=[0];assert.throws(()=>validateRecord(r),/已确认事实/);
  const fullRecord=reportRecord();assert.doesNotThrow(()=>validateRecord(fullRecord));
  const referenced=fullRecord.report.sections.flatMap(s=>s.blocks).find(b=>b.sourceIndices?.includes(0));referenced.basis='official';assert.throws(()=>validateRecord(fullRecord),/官方事实/);
  assert.throws(()=>validateRecord(reportRecord('unverified')),/作者报告结果/);
  const pending=reportRecord('unverified');
  for (const s of pending.report.sections) for (const b of s.blocks) for (const p of b.type==='table'?b.rows:[b]) if(p.sourceIndices?.includes(0))p.basis='pending';
  assert.doesNotThrow(()=>validateRecord(pending));
  const validated=validateRecord(reportRecord());const update=structuredClone(validated);delete update.report;update.sources[0].review.status='unverified';
  assert.throws(()=>mergeRecords([validated],[update]),/作者报告结果/);
});

test('new citation metadata retains atomic imports, stable identity, long reports and private-data refusal', async () => {
  const dir=await mkdtemp(join(tmpdir(),'public-citations-')),file=join(dir,'radar.json');
  try {
    const r=reportRecord();await importPayload(r,file);const before=await readFile(file,'utf8');
    assert.equal((await importPayload(r,file)).unchanged,1);
    const bad=structuredClone(r);bad.sources[0].url='https://localhost/private';await assert.rejects(importPayload(bad,file));assert.equal(await readFile(file,'utf8'),before);
    const privateRecord=structuredClone(r);privateRecord.containsPrivateData=true;assert.throws(()=>validateRecord(privateRecord));
    const summary=structuredClone(r);delete summary.report;summary.summary+=' 核对范围保持。';
    assert.deepEqual(mergeRecords([r],[summary]).records[0].report,r.report);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
