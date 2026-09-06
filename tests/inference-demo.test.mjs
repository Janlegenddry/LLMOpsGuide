import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrace, toyTokens, OUTPUT, probabilities } from '../src/lib/inference-demo.ts';

test('tokenizer preserves prompt text and keeps IDs outside reserved/output ranges', () => {
  for (const input of ['重复重复 Hello\n🌍', '<script>alert(1)</script>', '字'.repeat(160)]) {
    const tokens = toyTokens(input);
    assert.equal(tokens.slice(2, -2).map(t => t.text).join(''), input);
    assert.ok(tokens.slice(2, -2).every(t => t.id >= 1000));
    for (const token of tokens.slice(2, -2)) assert.equal(tokens.find(t => t.text === token.text).id, token.id);
  }
});

test('prefill emits first token; each decode ingests previous token before next choice', () => {
  for (const input of ['解释 KV Cache', 'a', '长'.repeat(160)]) {
    const S = toyTokens(input).length;
    const trace = buildTrace(input);
    assert.equal(trace.find(f => f.key === 'stream').phase, 'Prefill');
    for (let round = 0; round <= OUTPUT.length; round++) {
      const steps = trace.filter(f => f.round === round);
      const choice = steps.find(f => f.key === 'sample');
      const rope = steps.find(f => f.key === 'rope');
      assert.deepEqual(rope.cache, [S + round, ...(round ? [S + round - 1, S + round - 1, S + round - 1] : [0, 0, 0])]);
      assert.ok(choice.cache.every(n => n === S + round));
      assert.equal(choice.delivered, round);
      assert.equal(choice.generated, Math.min(round + 1, OUTPUT.length));
      if (round < OUTPUT.length) assert.equal(steps.find(f => f.key === 'stream').delivered, round + 1);
      else assert.equal(steps.some(f => f.key === 'stream'), false);
    }
    assert.deepEqual(trace.at(-1).cache, [0, 0, 0, 0]);
    assert.equal(trace.at(-1).delivered, OUTPUT.length);
    assert.deepEqual(trace[0].cache, [0, 0, 0, 0]);
  }
});

test('a new request starts independently; softmax is normalized and numerically stable', () => {
  const first = buildTrace('first');
  first[0].cache[0] = 999;
  assert.equal(buildTrace('second')[0].cache[0], 0);
  const p = probabilities([10003.2, 10001.6, 10000.8, 9999.6]);
  assert.ok(Math.abs(p.reduce((a, b) => a + b) - 1) < 1e-12);
  assert.ok(p[0] > p[1] && p[1] > p[2] && p[2] > p[3]);
});
