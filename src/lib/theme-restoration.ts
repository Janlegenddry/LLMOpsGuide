export type Theme = 'light' | 'dark';

// A bfcache-restored page keeps its old DOM. Read the current preference again.
export function syncThemeOnPageShow({
  lifecycle,
  readSavedTheme,
  prefersDark,
  applyTheme,
}: {
  lifecycle: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readSavedTheme: () => string | null;
  prefersDark: () => boolean;
  applyTheme: (theme: Theme) => void;
}): () => void {
  const refresh = () => {
    let saved: string | null = null;
    try { saved = readSavedTheme(); } catch { /* Storage may be unavailable. */ }
    applyTheme(saved === 'light' || saved === 'dark' ? saved : prefersDark() ? 'dark' : 'light');
  };
  lifecycle.addEventListener('pageshow', refresh);
  refresh();
  return () => lifecycle.removeEventListener('pageshow', refresh);
}
