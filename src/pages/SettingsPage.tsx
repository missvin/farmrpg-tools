import { useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { exportCurrentAppBackupFile } from '../lib/appBackupExport';

export function SettingsPage() {
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExportBackup(): Promise<void> {
    setIsExporting(true);
    setExportMessage(null);
    setExportError(null);

    try {
      const result = await exportCurrentAppBackupFile();
      setExportMessage(`Backup downloaded as ${result.filename}.`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Unable to export the local backup file.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Settings"
        description="Configure local app behavior and future data preferences here."
      />

      <section className="page-card page-stack" aria-labelledby="settings-backup-title">
        <div>
          <h2 id="settings-backup-title">Local Backup</h2>
          <p className="supporting-text">
            Export one versioned backup file for this local profile. The backup currently includes snapshot history,
            crafting and planner modifier settings, and your saved theme preference.
          </p>
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              void handleExportBackup();
            }}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export Backup'}
          </button>
        </div>

        <p className="supporting-text">
          This is a local-only backup download for safekeeping or device migration. Restore/import will land
          separately.
        </p>

        {exportMessage ? <p className="status-message status-message--success">{exportMessage}</p> : null}
        {exportError ? <p className="status-message status-message--error">{exportError}</p> : null}
      </section>
    </div>
  );
}
