import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../',import.meta.url)), dist = join(root,'dist');
const read = path => readFileSync(join(dist,path),'utf8');
const home = read('index.html'), directory = read('library/index.html'), papers = read('knowledge/index.html');
const index = html => JSON.parse(html.match(/<script[^>]*id="search-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const catalog = index(directory);
assert.deepEqual(index(home),catalog); assert.deepEqual(index(papers),catalog);
assert.equal(new Set(catalog.map(item => item.href)).size,catalog.length,'Search duplicates a catalog item');
assert.equal((directory.match(/data-library-record(?:\s|>)/g)||[]).length,catalog.length);
assert.ok(home.includes('Guanzhi Library') && home.includes('id="notes"') && home.includes('id="path"'));
assert.ok(home.includes('action="/LLMOpsGuide/library/"'));
const knowledge = JSON.parse(readFileSync(join(root,'src/content/knowledge.json'),'utf8'));
assert.equal((papers.match(/data-library-record(?:\s|>)/g)||[]).length,knowledge.length);
if (!knowledge.length) assert.ok(papers.includes('白皮书还未收录') && !papers.includes('type="file"'));
let links = 0, pages = 0;
function inspect(folder) {
  for (const entry of readdirSync(folder,{withFileTypes:true})) {
    const path = join(folder,entry.name);
    if(entry.isDirectory()) inspect(path);
    else if(entry.name.endsWith('.html')) {
      pages++; const html = readFileSync(path,'utf8');
      assert.ok(/<title>[^<]*Guanzhi Library<\/title>/.test(html),'old brand in page title');
      const marks = [...html.matchAll(/<img\b[^>]*src="\/LLMOpsGuide\/brand\/guanzhi-library-mark\.png"[^>]*>/g)];
      assert.equal(marks.length,2,`Missing sidebar or mobile brand: ${path}`);
      for (const mark of marks) assert.ok(/\balt=""/.test(mark[0]),'Brand image must be decorative alongside accessible text');
      assert.equal((html.match(/aria-label="Guanzhi Library 首页"/g)||[]).length,2);
      for (const filename of ['favicon.ico','favicon-32.png','favicon-48.png','apple-touch-icon.png']) {
        assert.ok(html.includes(`href="/LLMOpsGuide/${filename}"`),`Missing brand icon: ${path}`);
      }
      const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,`duplicate ID: ${path}`);
      for(const match of html.matchAll(/(?:href|src|action)="(\/[^"]*)"/g)) {
        const url=new URL(match[1].replaceAll('&amp;','&'),'https://local.invalid');
        if(!url.pathname.startsWith('/LLMOpsGuide/')) throw Error(`Missing base: ${match[1]}`);
        const relative=decodeURIComponent(url.pathname.slice('/LLMOpsGuide/'.length));
        const target=relative.endsWith('/')||!relative ? join(dist,relative,'index.html'):join(dist,relative);
        readFileSync(target);links++;
        if(url.hash && target.endsWith('.html')) assert.ok(readFileSync(target,'utf8').includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),`Missing anchor: ${match[1]}`);
      }
    }
  }
}
inspect(dist);
console.log(JSON.stringify({catalog:catalog.length,whitepapers:knowledge.length,pages,localLinks:links,search:'one index',legacyAnchors:'preserved'}));
