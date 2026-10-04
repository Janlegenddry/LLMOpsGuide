import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateKnowledge, knowledgeURL } from '../src/lib/knowledge-store.mjs';
import { knowledgeHref } from '../src/lib/library-taxonomy.ts';
import { emptyLibraryFilter, matchesLibrary, readLibraryFilter, writeLibraryFilter } from '../src/lib/library-filter.ts';
import { mountLibraryIndex } from '../src/scripts/library-index.ts';
const paper = () => ({schemaVersion:1,id:'test-reference',title:'测试资料，仅用于测试',summary:'KV Cache 与 GPU 通信的校验样例，不是馆藏。',institution:'测试机构',publishedAt:null,addedAt:'2026-10-04',domain:'ai-infra',topics:['KV Cache'],keywords:['缓存','GPU'],format:'PDF',source:{title:'测试来源',url:'https://research.example.com/original'},readUrl:'https://research.example.com/paper.pdf',publicationApproved:true,containsPrivateData:false,distribution:'link-only'});

test('whitepaper catalog starts empty and requires explicit public scope, original metadata and distinct identity', () => {
  assert.deepEqual(validateKnowledge([]),[]);
  const entry=paper(); assert.equal(validateKnowledge([entry])[0].publishedAt,null);
  for(const change of [r=>delete r.id,r=>r.id='../private',r=>r.publicationApproved=false,r=>r.containsPrivateData=true,r=>r.distribution='unknown',r=>r.domain='finance',r=>r.publishedAt='2026-02-30',r=>r.publishedAt='2099-01-01',r=>delete r.publishedAt,r=>delete r.addedAt,r=>r.addedAt='2099-01-01',r=>{r.publishedAt='2026-10-01';r.addedAt='2026-09-30';},r=>r.format='EXE',r=>r.topics=[],r=>r.keywords=[],r=>r.summary='<script>alert(1)</script>',r=>r.extra='ignored']) {const bad=paper();change(bad);assert.throws(()=>validateKnowledge([bad]));}
  assert.throws(()=>validateKnowledge([entry,entry]));
  assert.throws(()=>validateKnowledge([entry,{...entry,id:'different'}]));
});

test('knowledge links reject credentials, signed/private addresses and local path escapes, preserving public identifiers', () => {
  for(const url of ['javascript:alert(1)','http://research.example.com/paper','https://user:pass@research.example.com/paper','https://127.0.0.1/paper','https://0x7f000001/paper','https://[::1]/paper','https://docs.internal/paper','https://onehost/paper','https://research.example.com:444/paper','https://research.example.com/paper?token=private','https://research.example.com/paper?redirect=https://private','//research.example.com/paper','/knowledge-files/../secret.pdf','/knowledge-files/%2e%2e/private.pdf','/knowledge-files/private.html','/LLMOpsGuide/knowledge-files/file.pdf']) assert.throws(()=>knowledgeURL(url,{local:true}),url);
  assert.equal(knowledgeURL('https://research.example.com/paper?id=abc#part-1'),'https://research.example.com/paper?id=abc#part-1');
  assert.equal(knowledgeHref('/knowledge-files/test.pdf','/LLMOpsGuide/'),'/LLMOpsGuide/knowledge-files/test.pdf');
  assert.equal(knowledgeHref('/knowledge-files/test.pdf','/'),'/knowledge-files/test.pdf');
  assert.equal(knowledgeHref('https://research.example.com/paper','/LLMOpsGuide/'),'https://research.example.com/paper');
});

test('hosted PDFs need redistribution scope, a real contained PDF and a complete inventory; fixtures never enter public', () => {
  const dir=mkdtempSync(join(tmpdir(),'library-files-')),publicRoot=join(dir,'public'),files=join(publicRoot,'knowledge-files');mkdirSync(files,{recursive:true});
  const r={...paper(),readUrl:'/knowledge-files/test.pdf',downloadUrl:'/knowledge-files/test.pdf',distribution:'redistributable'};
  try {
    assert.throws(()=>validateKnowledge([r],{publicRoot}));
    writeFileSync(join(files,'test.pdf'),'%PDF-1.7\nfixture only\n');assert.equal(validateKnowledge([r],{publicRoot}).length,1);
    assert.throws(()=>validateKnowledge([{...r,distribution:'link-only'}],{publicRoot}));
    writeFileSync(join(files,'orphan.pdf'),'%PDF-1.7');assert.throws(()=>validateKnowledge([r],{publicRoot}));rmSync(join(files,'orphan.pdf'));
    writeFileSync(join(files,'test.pdf'),'not a PDF');assert.throws(()=>validateKnowledge([r],{publicRoot}));
    writeFileSync(join(files,'test.pdf'),'%PDF-1.7');truncateSync(join(files,'test.pdf'),21*1024*1024);assert.throws(()=>validateKnowledge([r],{publicRoot}));rmSync(join(files,'test.pdf'));
    writeFileSync(join(dir,'private.pdf'),'%PDF-1.7');symlinkSync(join(dir,'private.pdf'),join(files,'test.pdf'));assert.throws(()=>validateKnowledge([r],{publicRoot}));rmSync(join(files,'test.pdf'));
    rmSync(files,{recursive:true});symlinkSync(dir,files);assert.throws(()=>validateKnowledge([r],{publicRoot}));
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('library search combines query words, Unicode width, domain, type, topic and reading state independently', () => {
  const record={search:'SGLang GPU KV Cache 缓存',domain:'ai-infra',type:'report',topics:['KV Cache'],state:'organized'};
  assert.ok(matchesLibrary(record,{...emptyLibraryFilter,query:'  ｓｇｌａｎｇ  缓存 GPU '}));
  for(const patch of [{query:'unknown'},{domain:'other'},{type:'whitepaper'},{topic:'other'},{state:'unread'}])assert.equal(matchesLibrary(record,{...emptyLibraryFilter,...patch}),false);
  const options={domain:['ai-infra'],type:['report'],topic:['KV Cache'],state:['organized']};
  const filter=readLibraryFilter(new URLSearchParams('query=KV+Cache&type=report&topic=invalid'),options);assert.equal(filter.topic,'all');assert.equal(filter.type,'report');
  const url=writeLibraryFilter(new URL('https://local.invalid/LLMOpsGuide/library/?keep=1&type=whitepaper#top'),filter);assert.equal(url.searchParams.get('keep'),'1');assert.equal(url.hash,'#top');assert.equal(url.searchParams.get('query'),'KV Cache');
  const cleared=writeLibraryFilter(url,emptyLibraryFilter);assert.equal(cleared.search,'?keep=1');
  assert.equal(writeLibraryFilter(cleared,{...emptyLibraryFilter,query:'   '}).search,'?keep=1');
});

test('directory controller restores URL on refresh/back, filters, exposes empty results and resets focus', () => {
  class Element extends EventTarget {value='';hidden=false;textContent='';dataset={};options=[];focused=false;focus(){this.focused=true;}}
  const input=new Element(),count=new Element(),empty=new Element(),reset=new Element(),form=new Element();
  const nodes={'#library-query':input,'#library-count':count,'#library-empty':empty,'#library-reset':reset,'form':form};
  for(const [key,values]of Object.entries({domain:['all','ai-infra'],type:['all','article','report','whitepaper'],topic:['all','KV Cache'],state:['all','organized','unread']})){const select=new Element();select.value='all';select.options=values.map(value=>({value}));nodes[`#library-${key}`]=select;}
  const records=[{search:'GPU KV Cache',domain:'ai-infra',type:'report',topics:['KV Cache'],state:'organized'},{search:'Learning route',domain:'ai-infra',type:'article',topics:['学习路线'],state:'organized'}].map(data=>{const record=new Element();record.dataset={...data,topics:JSON.stringify(data.topics)};return record;});
  const root={dataset:{},querySelector:key=>nodes[key],querySelectorAll:()=>records};
  const saved=Object.fromEntries(['window','location','history'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  try {
    globalThis.window=new EventTarget();globalThis.location=new URL('https://local.invalid/LLMOpsGuide/library/?query=GPU&type=report');globalThis.history={replaceState(_state,_title,url){globalThis.location=new URL(url);}};
    mountLibraryIndex(root);assert.equal(input.value,'GPU');assert.equal(count.textContent,'1 项内容');assert.equal(records[1].hidden,true);
    input.value='absent';input.dispatchEvent(new Event('input'));assert.equal(count.textContent,'0 项内容');assert.equal(empty.hidden,false);assert.equal(reset.hidden,false);
    reset.dispatchEvent(new Event('click'));assert.equal(count.textContent,'2 项内容');assert.equal(empty.hidden,true);assert.equal(reset.hidden,true);assert.equal(input.focused,true);assert.equal(location.search,'');
    globalThis.location=new URL('https://local.invalid/LLMOpsGuide/library/?type=whitepaper');window.dispatchEvent(new Event('popstate'));assert.equal(count.textContent,'0 项内容');
    globalThis.location=new URL('https://local.invalid/LLMOpsGuide/library/?topic=KV+Cache');window.dispatchEvent(new Event('pageshow'));assert.equal(count.textContent,'1 项内容');
    const submitted=new Event('submit',{cancelable:true});form.dispatchEvent(submitted);assert.ok(submitted.defaultPrevented);
  } finally {for(const [key,descriptor]of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
