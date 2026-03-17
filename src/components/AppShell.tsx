import { useEffect, useState, type PropsWithChildren } from 'react';

import { TopNav } from './TopNav';

export function AppShell({ children }: PropsWithChildren) {
  const [showScrollToTop, setShowScrollToTop] = useState(false);

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

  function handleScrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <div>
            <p className="site-title">FarmRPG Mastery Tracker</p>
            <p className="site-tagline">Local-first snapshot tools for mastery progress.</p>
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
