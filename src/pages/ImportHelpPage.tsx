import { Link } from 'react-router-dom';

import { PageIntro } from '../components/PageIntro';

export function ImportHelpPage() {
  return (
    <div className="page-stack">
      <PageIntro
        title="Import Help"
        description="Copy a complete FarmRPG mastery export, check that all mastery tiers are included, then save it as your latest local snapshot."
        storageKey="import-help"
      />

      <section className="page-card page-stack" aria-labelledby="import-help-steps-title">
        <div>
          <h2 id="import-help-steps-title">Copy A Complete Export</h2>
          <p className="supporting-text">
            The app needs the full Item Mastery list. If a mastery tier is collapsed in FarmRPG when you copy, those
            items may be missing from the paste.
          </p>
        </div>

        <ol className="data-list">
          <li>Open the FarmRPG Item Mastery page.</li>
          <li>Expand each mastery tier so the item rows are visible before copying.</li>
          <li>Copy the page text, including item names and progress lines.</li>
          <li>Paste the text into Import Mastery Snapshot and choose Parse Preview.</li>
          <li>Review the trust summary, then save the snapshot if the import looks complete.</li>
        </ol>
      </section>

      <section className="page-card page-stack" aria-labelledby="import-help-warning-title">
        <h2 id="import-help-warning-title">What To Watch For</h2>
        <ul className="data-list">
          <li>
            A low-confidence import usually means too few rows were found or one of the expected mastery tiers appears
            to be missing.
          </li>
          <li>
            Ignored header, navigation, and percent-only lines are normal. The trust summary will call out anything
            that needs attention.
          </li>
          <li>
            If you are moving between browsers or hosted/local copies, export a backup from Settings before restoring
            somewhere else.
          </li>
        </ul>
      </section>

      <section className="page-card page-stack" aria-labelledby="import-help-next-title">
        <h2 id="import-help-next-title">Next Step</h2>
        <div className="quick-link-grid">
          <Link className="quick-link-card" to="/import">
            <span className="quick-link-card__title">Back to Import</span>
            <span className="quick-link-card__description">Paste and preview your mastery export.</span>
          </Link>
          <Link className="quick-link-card" to="/settings#settings-backup-title">
            <span className="quick-link-card__title">Backup Settings</span>
            <span className="quick-link-card__description">Export or restore your local FarmRPG Tools data.</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
