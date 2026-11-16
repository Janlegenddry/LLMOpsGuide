import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function publicURL(value) {
  const url=new URL(value),host=url.hostname;
  assert.ok(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash,'Infra site links must be canonical public HTTPS URLs');
  assert.ok(host.includes('.')&&!isIP(host.replace(/^\[|\]$/g,''))&&!/(?:^|\.)(localhost|local|internal|intranet|test|invalid|onion|nip\.io|sslip\.io|localtest\.me|lvh\.me)$/.test(host),'Infra site links must not address local or private resources');
}
export function verifyInfraSites() {
  const records=JSON.parse(read('src/content/infra-sites.json')),html=read('dist/infra-sites/index.html');
  assert.ok(Array.isArray(records)&&records.length<=1000);
  const keys=['schemaVersion','id','title','url','repositoryUrl','type','maintainer','description','topics','refreshNote','verifiedAt','publicationApproved','containsPrivateData'],ids=new Set(),urls=new Set();
  for(const item of records) {
    assert.ok(item&&keys.every(k=>Object.hasOwn(item,k))&&Object.keys(item).every(k=>keys.includes(k)),'Infra site fields are missing or unknown');
    assert.equal(item.schemaVersion,1);assert.equal(item.publicationApproved,true);assert.equal(item.containsPrivateData,false);
    assert.match(item.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.ok(!ids.has(item.id)&&!urls.has(item.url));ids.add(item.id);urls.add(item.url);
    for(const field of ['title','url','type','maintainer','description','refreshNote'])assert.ok(typeof item[field]==='string'&&item[field].trim()&&item[field].length<=1200&&!/[<>\u0000-\u001f]/.test(item[field]),`Invalid ${field}`);
    publicURL(item.url);if(item.repositoryUrl!==null)publicURL(item.repositoryUrl);
    assert.match(item.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);assert.ok(Number.isFinite(Date.parse(item.verifiedAt))&&new Date(item.verifiedAt).toISOString().slice(0,10)===item.verifiedAt&&item.verifiedAt<=new Date().toISOString().slice(0,10));
    assert.ok(Array.isArray(item.topics)&&item.topics.length>0&&item.topics.length<=12);
    for(const text of [item.title,item.type,item.maintainer,item.description,item.refreshNote,item.verifiedAt,...item.topics]){assert.ok(typeof text==='string'&&text.trim()&&!/[<>\u0000-\u001f]/.test(text));assert.ok(html.includes(escape(text)),`Missing site text: ${item.id}`);}
    for(const url of [item.url,item.repositoryUrl].filter(Boolean))assert.ok(html.includes(`href="${escape(url)}" target="_blank" rel="noopener noreferrer"`),`Missing accessible external link: ${url}`);
    assert.ok(html.includes(`id="${item.id}"`));
  }
  assert.equal((html.match(/data-infra-site-record(?:\s|>)/g)||[]).length,records.length);
  assert.ok(!/<iframe\b/i.test(html),'The directory must not embed external sites');
  for(const page of ['dist/index.html','dist/library/index.html'])assert.ok(read(page).includes('href="/LLMOpsGuide/infra-sites/"'),`Missing directory entrance: ${page}`);
  return records.length;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))console.log(JSON.stringify({infraSites:verifyInfraSites(),links:'preserved'}));
