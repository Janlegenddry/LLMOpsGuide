import { isIP } from 'node:net';
import { realpathSync, statSync, existsSync, readdirSync, lstatSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { libraryDomains } from './library-taxonomy.ts';

const fail = message => { throw new Error(`知识导航：${message}`); };
const keys = (value, allowed, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} 必须是对象`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${name} 未知字段 ${key}`);
};
const text = (value, name, max = 160) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>\u0000-\u001f]|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN .*PRIVATE KEY/.test(value)) fail(`${name} 必须是无脚本或凭证的 1–${max} 字符文本`);
  return value.trim();
};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value && value <= new Date().toISOString().slice(0,10);

export function knowledgeURL(raw, { local = false } = {}) {
  const value = text(raw, '链接', 1000);
  if (local && /^\/knowledge-files\/(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9._-]*\.pdf$/i.test(value) && !value.includes('..')) return value;
  let url; try { url = new URL(value); } catch { fail('链接须为 HTTPS 公开来源或 /knowledge-files/ 下的文件'); }
  const host = url.hostname;
  const privateHost = /(?:^|\.)(?:localhost|local|localdomain|internal|intranet|lan|home|test|invalid|example|onion)$/.test(host) || /(?:^|\.)(?:nip\.io|sslip\.io|localtest\.me|lvh\.me|vcap\.me)$/.test(host);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(host.replace(/^\[|\]$/g, '')) || privateHost || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(host)) fail('外链必须是 HTTPS 公网域名，不得包含凭证、端口、IP 或内网地址');
  const allowed = new Set(['id', 'p', 'v', 'doi', 'paper', 'paperid', 'article', 'articleid', 'page']); const seen = new Set();
  for (const [key, value] of url.searchParams) {
    if (!allowed.has(key.toLowerCase()) || seen.has(key.toLowerCase()) || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,159}$/.test(value)) fail('外链只允许公开文献标识参数，不接受授权、签名或跳转参数');
    seen.add(key.toLowerCase()); text(value, '链接参数');
  }
  if (url.hash && !/^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,159}$/u.test(decodeURIComponent(url.hash.slice(1)))) fail('链接锚点无效');
  url.searchParams.sort(); return url.href;
}

export function validateKnowledge(raw, { publicRoot } = {}) {
  if (!Array.isArray(raw) || raw.length > 1000) fail('目录必须是最多 1000 条记录的数组');
  const ids = new Set(), sources = new Set(), hosted = new Set();
  const records = raw.map((item, index) => {
    const name = `第 ${index + 1} 条`;
    keys(item, ['schemaVersion', 'id', 'title', 'summary', 'institution', 'publishedAt', 'addedAt', 'domain', 'topics', 'keywords', 'format', 'source', 'readUrl', 'downloadUrl', 'publicationApproved', 'containsPrivateData', 'distribution'], name);
    if (item.schemaVersion !== 1 || typeof item.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || item.id.length > 80 || ids.has(item.id)) fail(`${name} 的版本、稳定 ID 或唯一性无效`);
    ids.add(item.id);
    if (item.publicationApproved !== true || item.containsPrivateData !== false) fail(`${name} 必须明确获准公开且不含私有材料`);
    if (!['link-only', 'redistributable'].includes(item.distribution)) fail(`${name} 必须说明仅链接或允许再分发`);
    if (!libraryDomains.some(t => t.id === item.domain)) fail(`${name} 知识领域无效`);
    if (!Array.isArray(item.topics) || item.topics.length < 1 || item.topics.length > 6) fail(`${name} 主题须有 1–6 项`);
    if (!['PDF', 'HTML'].includes(item.format)) fail(`${name} 格式须为 PDF 或 HTML`);
    if (item.publishedAt !== null && !validDate(item.publishedAt)) fail(`${name} 原文日期须为真实 YYYY-MM-DD；未知时显式填 null`);
    if (!validDate(item.addedAt) || (item.publishedAt && item.addedAt < item.publishedAt)) fail(`${name} 收录日期须为真实 YYYY-MM-DD，不早于原文日期`);
    if (!Array.isArray(item.keywords) || item.keywords.length < 1 || item.keywords.length > 12) fail(`${name} 关键词须有 1–12 项`);
    keys(item.source, ['title', 'url'], `${name} 来源`);
    const source = { title: text(item.source.title, '来源名称'), url: knowledgeURL(item.source.url) };
    if (sources.has(source.url)) fail(`${name} 来源已在目录中，更新原 ID 即可`); sources.add(source.url);
    const readUrl = knowledgeURL(item.readUrl, { local: true });
    const downloadUrl = item.downloadUrl === undefined ? undefined : knowledgeURL(item.downloadUrl, { local: true });
    for (const link of [readUrl, downloadUrl].filter(Boolean)) {
      if (!link.startsWith('/')) continue;
      if (item.distribution !== 'redistributable') fail(`${name} 仅链接材料不得托管本地文件`);
      if (publicRoot) {
        let file, root;
        try { root = realpathSync(resolve(publicRoot, 'knowledge-files')); file = realpathSync(resolve(publicRoot, `.${link}`)); } catch { fail(`${name} 本地文件不存在：${link}`); }
        if (!root.startsWith(realpathSync(publicRoot) + sep) || !file.startsWith(root + sep) || !statSync(file).isFile()) fail(`${name} 文件须在 public/knowledge-files 内，不能是目录或越界符号链接`);
        if (statSync(file).size > 20 * 1024 * 1024) fail(`${name} 文件超过 20 MiB，请使用原始来源外链`);
        const fd = openSync(file,'r'); const header = Buffer.alloc(8);
        try { readSync(fd,header,0,8,0); } finally { closeSync(fd); }
        if (!header.toString().startsWith('%PDF-')) fail(`${name} 本地文件不是 PDF`);
        hosted.add(file);
      }
    }
    if (readUrl.startsWith('/') && extname(readUrl).toLowerCase() !== `.${item.format.toLowerCase()}`) fail(`${name} 本地阅读文件后缀与格式不一致`);
    const record = { schemaVersion: 1, id: item.id, title: text(item.title, '标题'), summary: text(item.summary, '摘要', 1000), institution: text(item.institution, '机构'), publishedAt: item.publishedAt, addedAt: item.addedAt, domain: item.domain, topics: [...new Set(item.topics.map(t => text(t, '主题', 40)))], keywords: [...new Set(item.keywords.map(k => text(k, '关键词', 60)))], format: item.format, source, readUrl, publicationApproved: true, containsPrivateData: false, distribution: item.distribution };
    if (downloadUrl !== undefined) record.downloadUrl = downloadUrl;
    return record;
  }).sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '') || a.id.localeCompare(b.id));
  if (publicRoot && existsSync(resolve(publicRoot,'knowledge-files'))) {
    const inspect = directory => {
      if (lstatSync(directory).isSymbolicLink()) fail('knowledge-files 不允许符号链接');
      for (const entry of readdirSync(directory,{withFileTypes:true})) {
        const path = resolve(directory,entry.name);
        if (entry.isSymbolicLink()) fail('knowledge-files 不允许符号链接');
        if (entry.isDirectory()) inspect(path);
        else if (!hosted.has(realpathSync(path))) fail(`发现未登记的公开文件：${entry.name}；先确认公开授权并填写元数据`);
      }
    };
    inspect(resolve(publicRoot,'knowledge-files'));
  }
  return records;
}
