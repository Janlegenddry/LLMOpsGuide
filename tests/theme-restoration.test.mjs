import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { syncThemeOnPageShow, THEME_STORAGE_KEY } from '../src/lib/theme-restoration.ts';

test('returning from a detail page updates a cached light page to the current dark preference', () => {
  const lifecycle = new EventTarget();
  let saved = 'light';
  const view = { theme: 'light', pressed: 'false', label: '切换深色模式' };
  syncThemeOnPageShow({ lifecycle, readSavedTheme: () => saved, applyTheme: theme => {
    view.theme = theme;
    view.pressed = String(theme === 'dark');
    view.label = theme === 'dark' ? '切换浅色模式' : '切换深色模式';
  } });
  // Another document changes storage while this one is held in the bfcache.
  saved = 'dark';
  assert.equal(view.theme, 'light');
  lifecycle.dispatchEvent(new Event('pageshow'));
  assert.deepEqual(view, { theme: 'dark', pressed: 'true', label: '切换浅色模式' });
  saved = 'light'; lifecycle.dispatchEvent(new Event('pageshow'));
  assert.equal(view.theme, 'light'); assert.equal(view.pressed, 'false');
});

test('new reader defaults to light; only an explicit new preference enables dark', () => {
  const lifecycle = new EventTarget();
  let saved = null, theme;
  const stop = syncThemeOnPageShow({ lifecycle, readSavedTheme: () => saved, applyTheme: next => theme = next });
  assert.equal(theme, 'light');
  saved = 'dark'; lifecycle.dispatchEvent(new Event('pageshow'));
  assert.equal(theme, 'dark');
  saved = 'invalid'; lifecycle.dispatchEvent(new Event('pageshow'));
  assert.equal(theme, 'light');
  stop(); saved = 'dark'; lifecycle.dispatchEvent(new Event('pageshow'));
  assert.equal(theme, 'light');
});

test('unavailable storage does not prevent theme restoration', () => {
  const lifecycle = new EventTarget();
  let theme;
  syncThemeOnPageShow({ lifecycle, readSavedTheme: () => { throw new Error('blocked'); }, applyTheme: next => theme = next });
  assert.equal(theme, 'light');
  assert.doesNotThrow(() => lifecycle.dispatchEvent(new Event('pageshow')));
});

test('head bootstrap ignores legacy dark storage and OS dark, but honors an active new choice', () => {
  const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
  const bootstrap = layout.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
  const storage = new Map([['theme', 'dark']]);
  const root = { dataset: {} };
  const run = () => vm.runInNewContext(bootstrap, {
    document: { documentElement: root },
    localStorage: { getItem: key => storage.get(key) || null },
    window: { matchMedia: () => ({ matches: true }) },
  });
  run(); assert.equal(root.dataset.theme, 'light');
  storage.set(THEME_STORAGE_KEY, 'dark'); run(); assert.equal(root.dataset.theme, 'dark');
  storage.set(THEME_STORAGE_KEY, 'light'); run(); assert.equal(root.dataset.theme, 'light');
});
