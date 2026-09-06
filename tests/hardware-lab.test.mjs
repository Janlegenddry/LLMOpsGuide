import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, cardParts, rforkParts, cardTour, rforkTour } from '../src/lib/hardware-lab.ts';

test('eight reference views have honest provenance and resolvable part selections', () => {
  assert.equal(cards.length, 8);
  assert.equal(new Set(cards.map(c => c.id)).size, 8);
  assert.equal(cards.find(c => c.id === '910c').dies, 2);
  assert.match(cards.find(c => c.id === 'l20x').family, /不等同 H200/);
  for (const card of cards) {
    assert.ok(card.evidence.length > 10);
    const steps = cardTour(card);
    assert.equal(steps.length, 6);
    assert.equal(steps[0].explode, 0);
    assert.equal(steps[1].explode, 100);
    assert.equal(steps.at(-1).explode, 0);
    for (const s of steps) assert.ok(cardParts.some(p => p.id === s.part));
  }
});

test('R-Fork READ precedes data; complete bytes are not yet model Ready', () => {
  for (const failure of [false, true]) {
    const steps = rforkTour(failure);
    for (const s of steps) {
      assert.ok(rforkParts.some(p => p.id === s.part));
      assert.ok(s.progress >= 0 && s.progress <= 100);
      if (s.ready) assert.equal(s, steps.at(-1));
    }
    const request = steps.findIndex(s => s.route === 'request');
    const data = steps.findIndex(s => s.route === 'source');
    assert.ok(request < data);
    const arrival = steps.findIndex(s => s.progress === 100);
    assert.equal(steps[arrival].ready, false);
    assert.equal(steps[arrival + 1].ready, false);
    assert.equal(steps.at(-1).ready, true);
    assert.equal(steps.at(-1).progress, 100);
  }
});

test('risk branch blocks Ready, drains old state before resubmission and resets progress', () => {
  const steps = rforkTour(true);
  const failure = steps.findIndex(s => s.kind === 'error');
  assert.equal(steps[failure].ready, false);
  assert.equal(steps[failure].progress, 45);
  assert.equal(steps[failure + 1].progress, 0);
  assert.match(steps[failure + 1].text, /取消 \/ drain \/ 同步/);
  assert.equal(steps[failure + 2].route, 'request');
  assert.match(steps[failure].text, /不声称它必然/);
  steps[0].title = 'changed';
  assert.notEqual(rforkTour(true)[0].title, 'changed');
});
