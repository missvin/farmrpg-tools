import { Link } from 'react-router-dom';

import { PageIntro } from '../components/PageIntro';

export function LocksmithImportPage() {
  return (
    <div className="page-stack">
      <PageIntro
        title="Locksmith Import"
        storageKey="locksmith-import"
        description="A future import page for openable item stockpiles."
      />

      <section className="page-card page-stack" aria-labelledby="locksmith-placeholder-title">
        <div>
          <h2 id="locksmith-placeholder-title">Coming Soon</h2>
          <p className="supporting-text">
            This page will parse openable item counts for planning. For now, keep using manual saved supplies in
            Settings.
          </p>
        </div>

        <div className="button-row">
          <Link className="button" to="/settings">
            Open Settings
          </Link>
        </div>
      </section>
    </div>
  );
}
