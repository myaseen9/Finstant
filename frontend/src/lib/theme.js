import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Theme mode: what the user chose. Theme: what that resolves to right now.
 *
 * The distinction matters because "System" is a standing instruction, not a
 * value — it has to keep tracking the OS after the choice is made.
 */

/** The single key. Replaces `finance_engine_theme` and `finstant_theme`,
 *  both of which are migrated by the bootstrap script in _document.jsx. */
export const THEME_STORAGE_KEY = 'finstant-theme';

export const THEME_MODES = ['light', 'dark', 'system'];

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Must match the SSR default on <html> in _document.jsx. */
const SSR_THEME = 'light';
const SSR_MODE = 'light';

const FALLBACK_TRANSITION_MS = 420;

function prefersDark() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  );
}

export function resolveThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return 'light';
}

/**
 * Reads --dur-theme rather than duplicating 420ms here, so the class is
 * always removed exactly when the CSS cross-fade ends. Two hardcoded numbers
 * would drift the first time the token is retuned.
 */
function themeTransitionMs() {
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--dur-theme')
      .trim();
    if (raw.endsWith('ms')) return parseFloat(raw);
    if (raw.endsWith('s')) return parseFloat(raw) * 1000;
  } catch {
    /* fall through */
  }
  return FALLBACK_TRANSITION_MS;
}

export function useThemeMode() {
  // Initialised to the SSR values so the first client render matches the
  // server. The DOM is already correct by this point — the bootstrap script
  // in _document.jsx set it before paint — so this only syncs React's copy.
  const [mode, setMode] = useState(SSR_MODE);
  const [theme, setTheme] = useState(SSR_THEME);

  const timerRef = useRef(null);
  const hasMounted = useRef(false);

  /**
   * Writes the resolved theme to <html>, cross-fading only when asked.
   *
   * `animate` is false on mount: there is nothing to fade from, and a
   * cross-fade on first paint would look like a bug rather than a switch.
   */
  const applyTheme = useCallback((next, { animate }) => {
    const root = document.documentElement;
    if (root.getAttribute('data-theme') === next) return;

    if (animate) {
      root.classList.add('theme-transitioning');
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        root.classList.remove('theme-transitioning');
      }, themeTransitionMs());
    }

    root.setAttribute('data-theme', next);
  }, []);

  // Adopt whatever the bootstrap script settled on.
  useEffect(() => {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      /* private mode — fall back to system */
    }

    const initialMode = THEME_MODES.includes(stored) ? stored : 'system';
    const initialTheme = resolveThemeMode(initialMode);

    setMode(initialMode);
    setTheme(initialTheme);
    applyTheme(initialTheme, { animate: false });

    hasMounted.current = true;

    return () => window.clearTimeout(timerRef.current);
  }, [applyTheme]);

  // Persist and paint on every deliberate change.
  useEffect(() => {
    if (!hasMounted.current) return;

    const next = resolveThemeMode(mode);
    setTheme(next);
    applyTheme(next, { animate: true });

    document.documentElement.setAttribute('data-theme-mode', mode);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* preference is not worth throwing over */
    }
  }, [mode, applyTheme]);

  // Follow the OS while, and only while, the mode is System.
  useEffect(() => {
    if (mode !== 'system') return;
    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event) => {
      const next = event.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next, { animate: true });
    };

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode, applyTheme]);

  /** Retained for the components that still call it. Steps to the opposite
   *  of what is currently on screen, which leaves System explicitly. */
  const toggleTheme = useCallback(() => {
    setMode(resolveThemeMode(mode) === 'dark' ? 'light' : 'dark');
  }, [mode]);

  const setThemeMode = useCallback((next) => {
    if (THEME_MODES.includes(next)) setMode(next);
  }, []);

  return { theme, themeMode: mode, setThemeMode, toggleTheme };
}
