import type { PropsWithChildren } from 'react';

import { TopNav } from './TopNav';

export function AppShell({ children }: PropsWithChildren) {
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
      <div className="scroll-to-top-bar">
        <button type="button" className="button scroll-to-top-button" onClick={handleScrollToTop}>
          Back to top
        </button>
      </div>
    </div>
  );
}
