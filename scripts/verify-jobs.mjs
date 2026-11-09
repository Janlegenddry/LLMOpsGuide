import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateJobs } from '../src/lib/jobs-store.mjs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const records=validateJobs(JSON.parse(read('src/content/jobs.json')));
const html=read('dist/jobs/index.html');
const api=JSON.parse(read('dist/api/jobs.json'));
assert.deepEqual(api.records,records,'Public jobs JSON diverges from validated records');
assert.equal((html.match(/data-job-record(?:\s|>)/g)||[]).length,records.length);
for(const record of records) {
  assert.ok(html.includes(`id="${record.id}"`));assert.ok(html.includes(record.verifiedAt));
  assert.ok(html.includes(record.url.replaceAll('&','&amp;')));
  for(const value of [...record.matchReasons,...record.gaps]) assert.ok(html.includes(value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')),`Missing assessment for ${record.id}`);
}
for(const page of ['dist/index.html','dist/radar/index.html','dist/library/index.html'])assert.ok(read(page).includes('href="/LLMOpsGuide/jobs/"'),`Missing jobs navigation in ${page}`);
assert.ok(html.includes('来源有层级')&&html.includes('匹配有边界')&&html.includes('申请前再确认'));
console.log(JSON.stringify({jobs:records.length,companies:new Set(records.map(r=>r.company)).size,publicJSON:'matches',assessments:'preserved',navigation:'connected'}));
