import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateEvents } from '../src/lib/events-store.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const records=validateEvents(JSON.parse(read('src/content/events.json'))),html=read('dist/events/index.html');
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
assert.deepEqual(JSON.parse(read('dist/api/events.json')),{schemaVersion:1,records});
assert.equal((html.match(/data-event-record(?:\s|>)/g)||[]).length,records.length);
for(const item of records){
  for(const value of [item.title,item.organizer,item.venue,item.startDate,item.endDate,item.timeZone,item.verifiedAt,item.summary,item.registration.note,item.livestream.note,item.replay.note,...item.topics])assert.ok(html.includes(escape(value)),`Missing ${item.id}: ${value}`);
  for(const url of [item.officialUrl,item.agendaUrl,item.registration.url,item.livestream.url,item.replay.url,...item.sources.map(s=>s.url)].filter(Boolean))assert.ok(html.includes(`href="${escape(url)}"`),`Missing official link: ${url}`);
}
for(const page of ['dist/index.html','dist/jobs/index.html','dist/library/index.html','dist/radar/index.html'])assert.ok(read(page).includes('href="/LLMOpsGuide/events/"'),`Missing events navigation: ${page}`);
for(const id of ['events-query','events-view','events-phase','events-reset','events-empty'])assert.ok(html.includes(`id="${id}"`));
assert.ok(!/<(?:iframe|img)\b[^>]*(?:cncf|luma|qr)/i.test(html),'Do not embed registration or copied QR assets');
console.log(JSON.stringify({events:records.length,publicJSON:'complete',officialLinks:'preserved',navigation:'connected',registration:'links only'}));
