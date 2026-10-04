import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceURL, topics, validateRecord, mergeRecords } from '../src/lib/radar-store.mjs';
import { sourceName, webSources, isOfficialCitation } from '../src/lib/radar-sources.mjs';
const examples = JSON.parse(await readFile(new URL('../examples/radar-official-sources.json', import.meta.url), 'utf8'));
const report = JSON.parse(await readFile(new URL('../examples/radar-report-record.json', import.meta.url), 'utf8'));

test('all curated official source examples validate and display the correct project', () => {
  for (const example of examples) {
    assert.doesNotThrow(() => sourceURL(example.url), example.url);
    assert.equal(sourceName(example.url), example.name, example.url);
    assert.ok(example.topics.every(t => topics.includes(t)), example.url);
  }
  assert.equal(sourceName('https://docs.vllm.ai/projects/ascendish/'), 'vLLM · Docs');
  assert.equal(sourceName('https://github.com/private-org/internal'), '来源待核对');
});

test('curated repositories allow release, PR and source paths but reject other repositories and lookalikes', () => {
  for (const repo of ['vllm-project/vllm', 'vllm-project/vllm-ascend', 'flashinfer-ai/flashinfer', 'kvcache-ai/Mooncake', 'NVIDIA/nccl', 'pytorch/pytorch', 'triton-lang/triton', 'ai-dynamo/dynamo']) {
    for (const path of ['/releases', '/pull/1', '/blob/main/README.md']) assert.doesNotThrow(() => sourceURL(`https://github.com/${repo}${path}`));
  }
  for (const url of [
    'https://github.com/vllm-project/vllm-evil/releases',
    'https://github.com/evil-vllm-project/vllm/releases',
    'https://github.com/vllm-project/not-approved',
    'https://github.com/fork/vllm',
    'https://github.com/pytorch/serve',
    'https://github.com/vllm-project',
    'https://github.com/vllm-project/vllm%2Fprivate',
    'https://github.com/vllm-project/vllm/%2e%2e/private',
    'https://github.com.evil.test/vllm-project/vllm',
  ]) assert.throws(() => sourceURL(url), url);
});

test('website matching uses exact hosts and segment boundaries with HTTPS and no credentials', () => {
  for (const url of [
    'http://docs.vllm.ai/en/latest/',
    'https://docs.vllm.ai.evil.test/en/latest/',
    'https://evil.docs.flashinfer.ai/',
    'https://docs.vllm.ai@evil.test/',
    'https://user:secret@docs.vllm.ai/',
    'https://docs.vllm.ai:444/',
    'https://docs.vllm.ai/?token=secret',
    'https://docs.vllm.ai/?redirect=https://evil.test/',
    'https://vllm.ai/blogger/post',
    'https://vllm.ai/private/',
    'https://vllm.ai/blog/%2e%2e/private',
    'https://kvcache-ai.github.io/Mooncake-evil/',
    'https://kvcache-ai.github.io/private/',
    'https://docs.nvidia.com/deeplearning/nccl-evil/docs/',
    'https://docs.nvidia.com/dynamo-evil/',
    'https://docs.nvidia.com/cuda/',
    'https://developer.nvidia.com/blogger/',
    'https://pytorch.org/blogger/',
    'https://triton-lang.org.evil.test/',
  ]) assert.throws(() => sourceURL(url), url);
});

test('repository casing, anchors and trailing slashes canonicalize without changing record identity', () => {
  assert.equal(sourceURL('https://github.com/nvidia/NCCL/releases/#section'), 'https://github.com/NVIDIA/nccl/releases');
  assert.equal(sourceURL('https://github.com/KVCACHE-AI/mooncake/'), 'https://github.com/kvcache-ai/Mooncake');
  assert.equal(sourceURL('https://blog.vllm.ai/'), 'https://vllm.ai/blog');
  const r = structuredClone(report);
  r.sources[0].url = 'https://github.com/VLLM-PROJECT/VLLM/releases/tag/example';
  r.topics = ['vLLM', '服务调度'];
  const first = mergeRecords([], [r]);
  r.sources[0].url = 'https://github.com/vllm-project/vllm/releases/tag/example/';
  assert.equal(mergeRecords(first.records, [r]).unchanged, 1);
  assert.deepEqual(first.records[0].report, report.report);
});

test('individually verified CUDA, extension, wheel and API evidence permits only its exact page', () => {
  const exact = webSources.filter(s => s.exact);
  assert.equal(exact.length, 8);
  for (const s of exact) {
    const url = `https://${s.hostname}${s.path}`;
    assert.equal(sourceURL(url), url);
    assert.equal(sourceURL(`${url}/#public-section`), url);
    assert.equal(sourceName(url), s.name);
    assert.ok(isOfficialCitation({url}));
    for (const suffix of ['/private', '-lookalike', '?token=secret', '?page=1']) assert.throws(() => sourceURL(url + suffix), url + suffix);
  }
  for (const url of ['https://api.github.com/repos/private-org/internal', 'https://api.github.com/repos/pytorch/pytorch/releases/tags/v2.14.2', 'https://download.pytorch.org/whl/cu132/torch-unknown.whl', 'https://download-r2.pytorch.org/whl/cu132/private.metadata', 'https://docs.pytorch.org/docs/2.14/private.html', 'https://docs.nvidia.com/cuda/archive/13.2.2/private.html']) assert.throws(() => sourceURL(url), url);
});

test('new generic topics retain original topics, six-tag limit, private-data refusal and full report checks', () => {
  for (const topic of ['SGLang', 'GPU 通信', 'KV Cache', 'PD 分离', '投机解码', '故障分析']) assert.ok(topics.includes(topic));
  const r = structuredClone(report);
  r.topics = ['vLLM', 'NPU/昇腾', '推理编译', '服务调度', '分布式训练', 'GPU 通信'];
  assert.doesNotThrow(() => validateRecord(r));
  r.containsPrivateData = true; assert.throws(() => validateRecord(r)); r.containsPrivateData = false;
  r.report.sections[0].blocks[0].basis = 'official'; r.report.sections[0].blocks[0].sourceIndices = [];
  assert.throws(() => validateRecord(r));
  r.report = report.report;
  r.topics.push('KV Cache'); assert.throws(() => validateRecord(r));
  r.topics = ['任意标签']; assert.throws(() => validateRecord(r));
});
