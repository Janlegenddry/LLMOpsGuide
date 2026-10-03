export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'llmops-reader-theme-v1';
export function preferredTheme(saved: string | null): Theme {
  return saved === 'dark' ? 'dark' : 'light';
}

// A bfcache-restored page keeps its old DOM. Read the current preference again.
export function syncThemeOnPageShow({
  lifecycle,
  readSavedTheme,
  applyTheme,
}: {
  lifecycle: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readSavedTheme: () => string | null;
  applyTheme: (theme: Theme) => void;
}): () => void {
  const refresh = () => {
    let saved: string | null = null;
    try { saved = readSavedTheme(); } catch { /* Storage may be unavailable. */ }
    applyTheme(preferredTheme(saved));
  };
  lifecycle.addEventListener('pageshow', refresh);
  refresh();
  return () => lifecycle.removeEventListener('pageshow', refresh);
}
