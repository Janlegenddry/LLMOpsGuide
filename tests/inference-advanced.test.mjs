import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdvancedTrace, mechanisms } from '../src/lib/inference-advanced.ts';
import { toyTokens, OUTPUT } from '../src/lib/inference-demo.ts';

const prompts = ['解释 KV Cache', 'a', '字'.repeat(160), '<script>alert(1)</script> 🌍'];
test('speculative branches truncate at first mismatch and only stream confirmed tokens', () => {
  for (const prompt of prompts) for (const [scenario, accepted] of [['partial', 2], ['all', 3], ['reject', 0]]) {
    const s = toyTokens(prompt).length;
    const frames = buildAdvancedTrace('speculative', scenario, prompt);
    const find = key => frames.find(f => f.key === key);
    assert.equal(find('verify').kv, s + 3);
    assert.equal(find('decision').accepted, accepted);
    assert.deepEqual(find('decision').lanes[0].cells.map(c => c.state), [0, 1, 2].map(i => i < accepted ? 'accepted' : 'rejected'));
    assert.equal(find('rollback').kv, s + accepted);
    assert.equal(find('rollback').delivered, 0);
    assert.equal(find('spec-stream').delivered, accepted + 1);
    assert.equal(find('spec-stream').kv, s + accepted);
    for (const f of frames.filter(f => f.key.startsWith('spec-tail-'))) assert.equal(f.kv, s + f.delivered - 1);
    assert.equal(frames.at(-1).delivered, OUTPUT.length);
    assert.equal(frames.at(-1).kv, 0);
  }
});

test('prefix reuse keeps complete blocks, computes a suffix, and separates retained from active KV', () => {
  for (const prompt of prompts) for (const scenario of ['hit', 'miss', 'evicted']) {
    const s = toyTokens(prompt).length;
    const retained = Math.floor((s - 1) / 4) * 4;
    const frames = buildAdvancedTrace('prefix', scenario, prompt);
    const find = key => frames.find(f => f.key === key);
    assert.equal(find('prefix-retain').kv, 0);
    assert.equal(find('prefix-retain').retained, retained);
    assert.ok(retained < s && retained % 4 === 0);
    assert.equal(find('prefix-hit').kv, scenario === 'hit' ? retained : 0);
    assert.equal(find('prefix-query').retained, scenario === 'evicted' ? 0 : retained);
    assert.equal(find('prefix-suffix').kv, s);
    assert.equal(find('prefix-suffix').delivered, 0);
    assert.equal(find('prefix-first').delivered, 1);
    assert.equal(frames.at(-1).kv, s + 1);
  }
});

test('P/D waits for complete KV and ACK; failed transfer cannot emit a duplicate first token', () => {
  for (const prompt of prompts) for (const scenario of ['success', 'retry']) {
    const s = toyTokens(prompt).length;
    const frames = buildAdvancedTrace('pd', scenario, prompt);
    const ack = frames.findIndex(f => f.key === 'pd-ack');
    for (const f of frames.slice(0, ack)) { assert.equal(f.ready, false); assert.ok(f.delivered <= 1); }
    assert.equal(frames[ack].transferred, s * 128);
    assert.equal(frames[ack].ready, true);
    const decode = frames.find(f => f.key === 'pd-decode');
    assert.ok(frames.indexOf(decode) > ack);
    assert.equal(decode.kv, s + 1);
    assert.equal(decode.delivered, 1);
    if (scenario === 'retry') {
      const failure = frames.find(f => f.key === 'pd-failed');
      assert.equal(failure.transferred, 0);
      assert.equal(failure.kv, s);
      assert.equal(failure.delivered, 1);
    }
    assert.equal(frames.at(-1).delivered, 2);
  }
});

test('all eight scenarios have independent snapshots and monotonic user output', () => {
  for (const [mode, config] of Object.entries(mechanisms)) for (const [scenario] of config.scenarios) {
    const frames = buildAdvancedTrace(mode, scenario, 'hello');
    assert.equal(new Set(frames.map(f => f.key)).size, frames.length);
    for (let i = 1; i < frames.length; i++) assert.ok(frames[i].delivered >= frames[i - 1].delivered);
    const fresh = structuredClone(frames);
    frames[0].lanes[0].detail = 'mutated';
    assert.deepEqual(frames.slice(1), fresh.slice(1));
    assert.deepEqual(buildAdvancedTrace(mode, scenario, 'hello'), fresh);
  }
});
