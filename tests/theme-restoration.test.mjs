import test from 'node:test';
import assert from 'node:assert/strict';
import { syncThemeOnPageShow } from '../src/lib/theme-restoration.ts';

test('returning from a detail page updates a cached light page to the current dark preference', () => {
  const lifecycle = new EventTarget();
  let saved = 'light';
  const view = { theme: 'light', pressed: 'false', label: '切换深色模式' };
  syncThemeOnPageShow({ lifecycle, readSavedTheme: () => saved, prefersDark: () => false, applyTheme: theme => {
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

test('without a valid saved preference a restored page reads the current system preference', () => {
  const lifecycle = new EventTarget();
  let systemDark = false, saved = null, theme;
  const stop = syncThemeOnPageShow({ lifecycle, readSavedTheme: () => saved, prefersDark: () => systemDark, applyTheme: next => theme = next });
  assert.equal(theme, 'light');
  systemDark = true; lifecycle.dispatchEvent(new Event('pageshow'));
  assert.equal(theme, 'dark');
  saved = 'invalid'; systemDark = false; lifecycle.dispatchEvent(new Event('pageshow'));
  assert.equal(theme, 'light');
  stop(); saved = 'dark'; lifecycle.dispatchEvent(new Event('pageshow'));
  assert.equal(theme, 'light');
});

test('unavailable storage does not prevent theme restoration', () => {
  const lifecycle = new EventTarget();
  let theme;
  syncThemeOnPageShow({ lifecycle, readSavedTheme: () => { throw new Error('blocked'); }, prefersDark: () => true, applyTheme: next => theme = next });
  assert.equal(theme, 'dark');
  assert.doesNotThrow(() => lifecycle.dispatchEvent(new Event('pageshow')));
});
