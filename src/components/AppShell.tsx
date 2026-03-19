import { useEffect, useState, type PropsWithChildren } from 'react';

import {
  getInitialAppTheme,
  persistAppTheme,
  type AppTheme,
} from '../lib/themePreference';
import { TopNav } from './TopNav';

export function AppShell({ children }: PropsWithChildren) {
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => getInitialAppTheme());

  useEffect(() => {
    function updateScrollToTopVisibility(): void {
      setShowScrollToTop(window.scrollY > 0);
    }

    updateScrollToTopVisibility();
    window.addEventListener('scroll', updateScrollToTopVisibility, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateScrollToTopVisibility);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    persistAppTheme(theme);
  }, [theme]);

  function handleScrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function handleThemeToggle(): void {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__top">
            <div>
              <p className="site-title">FarmRPG Mastery Tracker</p>
              <p className="site-tagline">Local-first snapshot tools for mastery progress.</p>
            </div>
            <button
              type="button"
              className="button site-theme-toggle"
              onClick={handleThemeToggle}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-pressed={theme === 'dark'}
            >
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </button>
          </div>
          <TopNav />
        </div>
      </header>
      <main id="main-content" className="page-container">
        {children}
      </main>
      {showScrollToTop ? (
        <div className="scroll-to-top-floating">
          <button type="button" className="button scroll-to-top-button" onClick={handleScrollToTop}>
            Back to top
          </button>
        </div>
      ) : null}
    </div>
  );
}
