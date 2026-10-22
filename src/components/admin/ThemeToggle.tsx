import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'bbrunlive-theme';

function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);

  useEffect(() => {
    setTheme(getCurrentTheme());

    const handleThemeChange = (e: Event) => {
      const next = (e as CustomEvent<Theme>).detail;
      if (next === 'light' || next === 'dark') {
        setTheme(next);
      } else {
        setTheme(getCurrentTheme());
      }
    };

    window.addEventListener('bbrunlive-theme-change', handleThemeChange);
    return () => window.removeEventListener('bbrunlive-theme-change', handleThemeChange);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setTheme(next);
    window.dispatchEvent(new CustomEvent('bbrunlive-theme-change', { detail: next }));
  }

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-divider bg-surface/70 hover:bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
    >
      {isLight ? (
        <>
          <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <span>Light</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
          <span>Dark</span>
        </>
      )}
    </button>
  );
}
