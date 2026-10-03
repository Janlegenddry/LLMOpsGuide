import { createHash } from 'node:crypto';
import { validateReport } from './radar-report.mjs';
import { officialSource } from './radar-sources.mjs';

export const topics = ['SGLang', 'GPU 通信', 'KV Cache', 'PD 分离', '投机解码', '故障分析', 'vLLM', 'NPU/昇腾', '推理编译', '服务调度', '分布式训练'];
export const kindNames = { release: '版本动态', analysis: '深度解读', reading: '阅读清单' };
const fail = (message) => { throw new Error(message); };
const keys = (object, allowed, name) => {
  if (!object || typeof object !== 'object' || Array.isArray(object)) fail(`${name} 必须是对象`);
  for (const key of Object.keys(object)) if (!allowed.includes(key)) fail(`${name} 不支持字段 ${key}`);
};
const str = (value, name, max = 1500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${name} 必须是 1–${max} 字符的文本`);
  if (/<\/?(?:script|iframe|style|img|svg|object)\b/i.test(value) || /(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN .*PRIVATE KEY)/.test(value)) fail(`${name} 不得包含脚本或凭证`);
  return value.trim();
};
const date = (value, name) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(`${name} 必须是有效 YYYY-MM-DD`);
  if (value > new Date().toISOString().slice(0, 10)) fail(`${name} 不能是未来日期`);
  return value;
};
const array = (value, name, min = 0, max = 30) => {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${name} 必须有 ${min}–${max} 项`);
  return value;
};
export function sourceURL(raw) {
  const url = new URL(str(raw, 'source.url', 500));
  const source = officialSource(url);
  if (!source) fail('来源必须在已核验的官方 AI Infra 来源表中，使用 HTTPS 且无认证或查询参数');
  // The root migration was checked on 2026-10-03; article redirects need collector verification.
  if (url.hostname === 'blog.vllm.ai' && url.pathname === '/') {
    url.hostname = 'vllm.ai';
    url.pathname = '/blog';
  }
  if (source.repository) {
    const suffix = url.pathname.split('/').slice(3).join('/');
    url.pathname = `/${source.repository}${suffix ? `/${suffix}` : ''}`;
  }
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}
export function validateRecord(raw) {
  keys(raw, ['schemaVersion', 'id', 'kind', 'title', 'summary', 'publishedAt', 'reviewedAt', 'topics', 'visibility', 'containsPrivateData', 'sources', 'claims', 'questions', 'related', 'diagram', 'example', 'report'], 'record');
  if (raw.schemaVersion !== 1) fail('schemaVersion 必须为 1');
  if (typeof raw.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.id) || raw.id.length > 80) fail('id 必须是稳定的英文 slug');
  if (!Object.hasOwn(kindNames, raw.kind)) fail('kind 必须是 release、analysis 或 reading');
  if (raw.visibility !== 'public' || raw.containsPrivateData !== false) fail('只能导入已检查为不含私人资料的公开内容');
  const publishedAt = date(raw.publishedAt, 'publishedAt');
  const reviewedAt = date(raw.reviewedAt, 'reviewedAt');
  if (reviewedAt < publishedAt) fail('reviewedAt 不得早于原文日期');
  const recordTopics = [...new Set(array(raw.topics, 'topics', 1, 6))];
  if (recordTopics.some(t => !topics.includes(t))) fail('topics 包含未知主题');
  const sources = array(raw.sources, 'sources', 1, 30).map((s, i) => {
    keys(s, ['title', 'url', 'publishedAt', 'accessedAt'], `sources[${i}]`);
    if (s.publishedAt === undefined && s.accessedAt === undefined) fail('来源必须注明原文日期或在线资料查阅日期');
    const out = { title: str(s.title, 'source.title', 200), url: sourceURL(s.url) };
    if (s.publishedAt !== undefined) out.publishedAt = date(s.publishedAt, 'source.publishedAt');
    if (s.accessedAt !== undefined) out.accessedAt = date(s.accessedAt, 'source.accessedAt');
    if ([out.publishedAt, out.accessedAt].some(d => d && d > reviewedAt)) fail('来源日期不得晚于核对日期');
    if (out.publishedAt && out.accessedAt && out.accessedAt < out.publishedAt) fail('查阅日期不得早于原文日期');
    return out;
  });
  if (publishedAt !== sources[0].publishedAt) fail('publishedAt 必须是第一条原文的日期');
  const claims = array(raw.claims, 'claims', 1, 24).map((c, i) => {
    keys(c, ['status', 'text', 'sourceIndices'], `claims[${i}]`);
    if (!['confirmed', 'inference', 'pending'].includes(c.status)) fail('claim.status 必须是 confirmed、inference 或 pending');
    const indices = [...new Set(array(c.sourceIndices, 'claim.sourceIndices', c.status === 'confirmed' ? 1 : 0, 30))];
    if (indices.some(index => !Number.isInteger(index) || index < 0 || index >= sources.length)) fail('claim 引用了不存在的来源');
    return { status: c.status, text: str(c.text, 'claim.text'), sourceIndices: indices };
  });
  const questions = array(raw.questions, 'questions', 1, 12).map(q => str(q, 'question', 500));
  const related = array(raw.related, 'related', 0, 10).map(r => {
    keys(r, ['title', 'path'], 'related');
    if (typeof r.path !== 'string' || !/^\/[a-z0-9/-]+\/$/.test(r.path) || r.path.includes('//') || r.path.includes('..')) fail('关联路径必须是站内文章路径');
    return { title: str(r.title, 'related.title', 150), path: r.path };
  });
  const out = { schemaVersion: 1, id: raw.id, kind: raw.kind, title: str(raw.title, 'title', 160), summary: str(raw.summary, 'summary', 800), publishedAt, reviewedAt, topics: recordTopics, visibility: 'public', containsPrivateData: false, sources, claims, questions, related };
  if (raw.diagram !== undefined) {
    keys(raw.diagram, ['title', 'steps'], 'diagram');
    out.diagram = { title: str(raw.diagram.title, 'diagram.title', 160), steps: array(raw.diagram.steps, 'diagram.steps', 2, 8).map(s => {
      keys(s, ['label', 'detail'], 'diagram.step');
      return { label: str(s.label, 'step.label', 80), detail: str(s.detail, 'step.detail', 240) };
    }) };
  }
  if (raw.example !== undefined) {
    keys(raw.example, ['title', 'text'], 'example');
    out.example = { title: str(raw.example.title, 'example.title', 160), text: str(raw.example.text, 'example.text') };
  }
  if (raw.report !== undefined) out.report = validateReport(raw.report, sources, { keys, str, array, fail });
  return out;
}
export function parsePayload(payload) {
  if (!Array.isArray(payload) && payload?.records !== undefined) {
    keys(payload, ['records'], 'payload');
    payload = payload.records;
  }
  return array(Array.isArray(payload) ? payload : [payload], 'records', 0, 50).map(validateRecord);
}
const identity = r => `${r.kind}:${r.sources[0].url}`;
export const digest = r => createHash('sha256').update(JSON.stringify(r)).digest('hex');
export function mergeRecords(existing, incoming) {
  const records = array(existing, 'store', 0, 10000).map(validateRecord);
  const ids = new Map();
  const identities = new Map();
  for (const r of records) {
    if (ids.has(r.id) || identities.has(identity(r))) fail('存储含重复 ID 或来源');
    ids.set(r.id, r); identities.set(identity(r), r.id);
  }
  let added = 0, updated = 0, unchanged = 0;
  const batchIDs = new Set();
  for (let r of incoming.map(validateRecord)) {
    if (batchIDs.has(r.id)) fail('同批 payload 含重复 ID');
    batchIDs.add(r.id);
    const prior = ids.get(r.id);
    if (identities.has(identity(r)) && identities.get(identity(r)) !== r.id) fail('同一分类与原文必须沿用既有 ID');
    if (prior && identity(prior) !== identity(r)) fail('更新不能修改既有 ID 的分类或第一条来源');
    if (prior && r.reviewedAt < prior.reviewedAt) fail('拒绝用旧核对日期覆盖新版本');
    if (prior?.report && !r.report) {
      if (prior.sources.some((s, i) => r.sources[i]?.url !== s.url)) fail('省略 report 的摘要更新必须保留原来源顺序，避免改写长文证据');
      r = validateRecord({ ...r, report: prior.report });
    }
    if (prior && digest(prior) === digest(r)) { unchanged++; continue; }
    prior ? updated++ : added++;
    ids.set(r.id, r); identities.set(identity(r), r.id);
  }
  return { records: [...ids.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)), added, updated, unchanged };
}
