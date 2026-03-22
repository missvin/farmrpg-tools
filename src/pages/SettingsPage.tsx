import { useState, type ChangeEvent } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  getOwnedNowItemInputs,
  loadAcquisitionPlannerInputState,
  removeOwnedNowItemInput,
  saveAcquisitionPlannerInputState,
  upsertOwnedNowItemInput,
  type AcquisitionOwnedNowSourceCategory,
} from '../lib/acquisitionPlannerState';
import { exportCurrentAppBackupFile } from '../lib/appBackupExport';
import {
  readAppBackupFile,
  reloadAfterRestore,
  restoreAppBackupPayload,
} from '../lib/appBackupRestore';
import type { AppBackupPayloadV1 } from '../lib/appBackupSchema';

export function SettingsPage() {
  const [acquisitionPlannerState, setAcquisitionPlannerState] = useState(() => loadAcquisitionPlannerInputState());
  const [ownedItemName, setOwnedItemName] = useState('');
  const [ownedItemCount, setOwnedItemCount] = useState('1');
  const [ownedItemSourceCategory, setOwnedItemSourceCategory] =
    useState<AcquisitionOwnedNowSourceCategory>('stockpile');
  const [ownedItemsMessage, setOwnedItemsMessage] = useState<string | null>(null);
  const [ownedItemsError, setOwnedItemsError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [restorePreview, setRestorePreview] = useState<{
    filename: string;
    payload: AppBackupPayloadV1;
  } | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const ownedNowEntries = getOwnedNowItemInputs(acquisitionPlannerState);

  function handleSaveOwnedItem(): void {
    const normalizedCount = Number(ownedItemCount);

    if (ownedItemName.trim().length === 0) {
      setOwnedItemsMessage(null);
      setOwnedItemsError('Enter an item name to save an owned-now stockpile entry.');
      return;
    }

    if (!Number.isFinite(normalizedCount) || normalizedCount < 0) {
      setOwnedItemsMessage(null);
      setOwnedItemsError('Enter a non-negative quantity for the owned-now stockpile entry.');
      return;
    }

    try {
      const nextState = upsertOwnedNowItemInput(acquisitionPlannerState, {
        itemName: ownedItemName,
        ownedCount: normalizedCount,
        sourceCategory: ownedItemSourceCategory,
      });
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setOwnedItemsError(null);
      setOwnedItemsMessage(
        normalizedCount > 0
          ? `Saved ${ownedItemName.trim()} as an owned-now ${ownedItemSourceCategory} entry.`
          : `Removed ${ownedItemName.trim()} from owned-now ${ownedItemSourceCategory} entries.`,
      );
      setOwnedItemName('');
      setOwnedItemCount('1');
    } catch (error) {
      setOwnedItemsMessage(null);
      setOwnedItemsError(
        error instanceof Error ? error.message : 'Unable to save the owned-now stockpile entry.',
      );
    }
  }

  function handleRemoveOwnedItem(canonicalItemKey: string, sourceCategory: AcquisitionOwnedNowSourceCategory): void {
    try {
      const nextState = removeOwnedNowItemInput(acquisitionPlannerState, canonicalItemKey, sourceCategory);
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setOwnedItemsError(null);
      setOwnedItemsMessage(`Removed ${canonicalItemKey} from owned-now ${sourceCategory} entries.`);
    } catch (error) {
      setOwnedItemsMessage(null);
      setOwnedItemsError(
        error instanceof Error ? error.message : 'Unable to remove the owned-now stockpile entry.',
      );
    }
  }

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

  async function handleBackupFileSelection(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] ?? null;

    setRestorePreview(null);
    setRestoreMessage(null);
    setRestoreError(null);

    if (!file) {
      return;
    }

    try {
      const payload = await readAppBackupFile(file);
      setRestorePreview({
        filename: file.name,
        payload,
      });
      setRestoreMessage('Backup file loaded. Review it, then confirm restore to replace current local state.');
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Unable to read the selected backup file.');
    }
  }

  async function handleConfirmRestore(): Promise<void> {
    if (!restorePreview) {
      return;
    }

    setIsRestoring(true);
    setRestoreMessage(null);
    setRestoreError(null);

    try {
      await restoreAppBackupPayload(restorePreview.payload);
      setRestoreMessage('Backup restored. Reloading the app...');
      reloadAfterRestore();
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Unable to restore the selected backup file.');
    } finally {
      setIsRestoring(false);
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
            crafting and planner modifier settings, acquisition planner inputs, and your saved theme preference.
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
          This is a local-only backup download for safekeeping or device migration.
        </p>

        {exportMessage ? <p className="status-message status-message--success">{exportMessage}</p> : null}
        {exportError ? <p className="status-message status-message--error">{exportError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="settings-owned-stockpiles-title">
        <div>
          <h2 id="settings-owned-stockpiles-title">Owned Stockpiles</h2>
          <p className="supporting-text">
            Track immediate-use bags, chests, and similar owned-now items for later acquisition planning. These
            entries are local-only and stay separate from stored pet inventory or future production.
          </p>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="owned-stockpile-name">
            Item name
          </label>
          <input
            id="owned-stockpile-name"
            className="text-input"
            type="text"
            value={ownedItemName}
            onChange={(event) => {
              setOwnedItemName(event.target.value);
            }}
            placeholder="Large Chest"
          />
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="owned-stockpile-category">
            Owned-now source type
          </label>
          <select
            id="owned-stockpile-category"
            className="text-input"
            value={ownedItemSourceCategory}
            onChange={(event) => {
              setOwnedItemSourceCategory(event.target.value as AcquisitionOwnedNowSourceCategory);
            }}
          >
            <option value="stockpile">Stockpile item</option>
            <option value="container">Container</option>
          </select>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="owned-stockpile-count">
            Owned quantity
          </label>
          <input
            id="owned-stockpile-count"
            className="text-input"
            type="number"
            min="0"
            step="1"
            value={ownedItemCount}
            onChange={(event) => {
              setOwnedItemCount(event.target.value);
            }}
          />
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={handleSaveOwnedItem}
          >
            Save Owned Item
          </button>
        </div>

        <p className="supporting-text">
          Item identity is stored by normalized item name so unknown or unmatched entries stay non-fatal for later
          planning work.
        </p>

        {ownedNowEntries.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Type</th>
                <th scope="col">Count</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {ownedNowEntries.map((entry) => (
                <tr key={`${entry.sourceCategory}:${entry.canonicalItemKey}`}>
                  <td>{entry.itemName}</td>
                  <td>{entry.sourceCategory === 'container' ? 'Container' : 'Stockpile item'}</td>
                  <td>{entry.ownedCount.toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        handleRemoveOwnedItem(entry.canonicalItemKey, entry.sourceCategory);
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="supporting-text">No owned-now stockpile items saved yet.</p>
        )}

        {ownedItemsMessage ? <p className="status-message status-message--success">{ownedItemsMessage}</p> : null}
        {ownedItemsError ? <p className="status-message status-message--error">{ownedItemsError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="settings-restore-title">
        <div>
          <h2 id="settings-restore-title">Restore Backup</h2>
          <p className="supporting-text">
            Select a previously exported backup file, review the loaded payload, then confirm restore. Restoring a
            backup replaces the currently supported local state for this single local profile.
          </p>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="backup-restore-file">
            Backup file
          </label>
          <input
            id="backup-restore-file"
            className="text-input"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void handleBackupFileSelection(event);
            }}
          />
        </div>

        {restorePreview ? (
          <div className="page-stack">
            <p className="supporting-text">
              Loaded <strong>{restorePreview.filename}</strong>. Confirm restore to replace the current snapshot
              history, saved crafting/planner modifier state, acquisition planner inputs, and saved theme preference.
            </p>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Exported at</dt>
                <dd>{new Date(restorePreview.payload.exportedAt).toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Snapshots</dt>
                <dd>{restorePreview.payload.state.snapshots.length.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Theme preference</dt>
                <dd>{restorePreview.payload.state.preferences.themePreference ?? 'None saved'}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Modifier state</dt>
                <dd>{restorePreview.payload.state.preferences.craftingModifierState ? 'Included' : 'Not included'}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Acquisition planner</dt>
                <dd>{restorePreview.payload.state.preferences.acquisitionPlannerState ? 'Included' : 'Not included'}</dd>
              </div>
            </dl>

            <div className="button-row">
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  void handleConfirmRestore();
                }}
                disabled={isRestoring}
              >
                {isRestoring ? 'Restoring...' : 'Confirm Restore Backup'}
              </button>
            </div>
          </div>
        ) : null}

        {restoreMessage ? <p className="status-message status-message--success">{restoreMessage}</p> : null}
        {restoreError ? <p className="status-message status-message--error">{restoreError}</p> : null}
      </section>
    </div>
  );
}
