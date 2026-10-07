import test from 'node:test';
import assert from 'node:assert/strict';
import { splitInternalLinks, inlineText } from '../src/lib/report-inline.mjs';

test('internal report links preserve surrounding prose and expose a root path for withBase', () => {
  const value='见[异步 KV 清零专题](/radar/vllm-async-kv-zeroing/)，再核对镜像。';
  assert.deepEqual(splitInternalLinks(value),[{text:'见'},{text:'异步 KV 清零专题',path:'/radar/vllm-async-kv-zeroing/'},{text:'，再核对镜像。'}]);
  assert.equal(inlineText(value),'见异步 KV 清零专题，再核对镜像。');
});
test('external, credential, traversal, protocol and markup inputs remain literal text', () => {
  for (const value of ['<script>alert(1)</script>','[x](https://example.com/)','[x](//example.com/)','[x](javascript:alert(1))','[x](/radar/../secret/)','[x](/radar/x/?token=secret)','[x](/radar/x/#evil)','[x](/%2e%2e/)']) assert.deepEqual(splitInternalLinks(value),[{text:value}]);
});
