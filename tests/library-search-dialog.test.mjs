import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { normalizeSearch } from '../src/lib/library-filter.ts';

test('shared search supports keyboard open/select/enter/escape, safe text, empty results and focus restoration', () => {
  const astro=readFileSync(new URL('../src/components/SearchDialog.astro',import.meta.url),'utf8');
  const source=astro.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^\s*import[^\n]+\n/,'');
  let active=null,openedHref=null;
  class Element extends EventTarget {
    value='';textContent='';hidden=false;open=false;children=[];attributes={};className='';
    classList={toggle:()=>{}};
    focus(){active=this;}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}
    showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}
    scrollIntoView(){}click(){openedHref=this.href;}
    set innerHTML(_value){this.children=[];}querySelector(key){this.parts??={};return this.parts[key]??=new Element();}
    append(child){this.children.push(child);}
  }
  const elements=Object.fromEntries(['search-dialog','search-close','search-input','search-results','search-count','search-empty','search-data'].map(id=>[`#${id}`,new Element()]));
  const opener=new Element(),frame=new Element();
  elements['#search-data'].textContent=JSON.stringify([{title:'KV Cache <示意>',description:'资料 & 证据',section:'完整报告',href:'/LLMOpsGuide/radar/test/',search:'KV Cache GPU 缓存'}, {title:'学习路线',description:'系统知识地图',section:'文章',href:'/LLMOpsGuide/roadmap/llmops-roadmap/',search:'学习路线 地图'}]);
  const document=new EventTarget();Object.defineProperty(document,'activeElement',{get:()=>active});
  document.querySelector=key=>key==='.site-frame'?frame:elements[key];
  document.querySelectorAll=key=>key==='[data-search-open]'?[opener]:elements['#search-results'].children;
  document.createElement=()=>new Element();
  active=opener;
  vm.runInNewContext(stripTypeScriptTypes(source),{document,HTMLElement:Element,normalizeSearch,window:{setTimeout:fn=>fn()}});
  function key(value,mod=false){const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:value,ctrlKey:mod,metaKey:false});document.dispatchEvent(event);return event;}
  key('k',true);assert.ok(elements['#search-dialog'].open);assert.equal(active,elements['#search-input']);assert.ok('inert' in frame.attributes);
  key('ArrowDown');key('Enter');assert.equal(openedHref,'/LLMOpsGuide/roadmap/llmops-roadmap/');
  elements['#search-input'].value='ｋｖ GPU';elements['#search-input'].dispatchEvent(new Event('input'));assert.equal(elements['#search-results'].children.length,1);
  assert.equal(elements['#search-results'].children[0].querySelector('strong').textContent,'KV Cache <示意>');
  elements['#search-input'].value='none';elements['#search-input'].dispatchEvent(new Event('input'));assert.ok(!elements['#search-empty'].hidden);assert.equal(elements['#search-results'].children.length,0);
  key('Escape');assert.equal(elements['#search-dialog'].open,false);assert.equal(active,opener);assert.ok(!('inert' in frame.attributes));
});
