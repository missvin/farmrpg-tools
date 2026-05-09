import { useEffect, useState, type ChangeEvent } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  getFuturePetProductionEntries,
  getOwnedNowItemInputs,
  getStoredPetInventoryItemInputs,
  loadAcquisitionPlannerInputState,
  removeFuturePetProductionEntryInput,
  removeStoredPetInventoryItemInput,
  replaceStoredPetInventoryEntries,
  removeOwnedNowItemInput,
  saveAcquisitionPlannerInputState,
  upsertFuturePetProductionEntryInput,
  upsertOwnedNowItemInput,
  upsertStoredPetInventoryItemInput,
  type AcquisitionOwnedNowSourceCategory,
} from '../lib/acquisitionPlannerState';
import { exportCurrentAppBackupFile } from '../lib/appBackupExport';
import {
  readAppBackupFile,
  reloadAfterRestore,
  restoreAppBackupPayload,
} from '../lib/appBackupRestore';
import type { AppBackupPayloadV1 } from '../lib/appBackupSchema';
import { deriveFuturePetProductionForecast } from '../lib/deriveFuturePetProductionForecast';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { parseStoredPetInventoryPaste } from '../lib/parseStoredPetInventoryPaste';

function formatForecastQuantity(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
}

export function SettingsPage() {
  const [acquisitionPlannerState, setAcquisitionPlannerState] = useState(() => loadAcquisitionPlannerInputState());
  const [ownedItemName, setOwnedItemName] = useState('');
  const [ownedItemCount, setOwnedItemCount] = useState('1');
  const [ownedItemSourceCategory, setOwnedItemSourceCategory] =
    useState<AcquisitionOwnedNowSourceCategory>('stockpile');
  const [ownedItemsMessage, setOwnedItemsMessage] = useState<string | null>(null);
  const [ownedItemsError, setOwnedItemsError] = useState<string | null>(null);
  const [storedPetItemName, setStoredPetItemName] = useState('');
  const [storedPetItemCount, setStoredPetItemCount] = useState('1');
  const [storedPetImportText, setStoredPetImportText] = useState('');
  const [storedPetMessage, setStoredPetMessage] = useState<string | null>(null);
  const [storedPetError, setStoredPetError] = useState<string | null>(null);
  const [storedPetWarnings, setStoredPetWarnings] = useState<string[]>([]);
  const [futurePetForecastEnabled, setFuturePetForecastEnabled] = useState(
    acquisitionPlannerState.pets.futureProduction.enabled,
  );
  const [futurePetForecastHorizonDays, setFuturePetForecastHorizonDays] = useState(
    String(acquisitionPlannerState.pets.futureProduction.horizonDays),
  );
  const [futurePetForecastOfflineHoursCap, setFuturePetForecastOfflineHoursCap] = useState(
    String(acquisitionPlannerState.pets.futureProduction.offlineHoursCap),
  );
  const [futurePetForecastRespectSeasonality, setFuturePetForecastRespectSeasonality] = useState(
    acquisitionPlannerState.pets.futureProduction.respectSeasonality,
  );
  const [futurePetForecastCrunchyOmeletteActive, setFuturePetForecastCrunchyOmeletteActive] = useState(
    acquisitionPlannerState.pets.futureProduction.crunchyOmeletteActive,
  );
  const [futurePetItemName, setFuturePetItemName] = useState('');
  const [futurePetName, setFuturePetName] = useState('');
  const [futurePetLevel, setFuturePetLevel] = useState('1');
  const [futurePetSeasonalActive, setFuturePetSeasonalActive] = useState(true);
  const [futurePetMessage, setFuturePetMessage] = useState<string | null>(null);
  const [futurePetError, setFuturePetError] = useState<string | null>(null);
  const [futurePetWarnings, setFuturePetWarnings] = useState<string[]>([]);
  const [knownItemKeys, setKnownItemKeys] = useState<Set<string> | null>(null);
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
  const storedPetEntries = getStoredPetInventoryItemInputs(acquisitionPlannerState);
  const futurePetEntries = getFuturePetProductionEntries(acquisitionPlannerState);
  const futurePetForecast = deriveFuturePetProductionForecast(acquisitionPlannerState);

  useEffect(() => {
    let cancelled = false;

    void loadMasteryDifficulty()
      .then((data) => {
        if (!cancelled) {
          setKnownItemKeys(new Set(Object.keys(data.byCanonicalKey)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKnownItemKeys(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  function handleSaveStoredPetItem(): void {
    const normalizedCount = Number(storedPetItemCount);

    if (storedPetItemName.trim().length === 0) {
      setStoredPetMessage(null);
      setStoredPetWarnings([]);
      setStoredPetError('Enter an item name to save a stored pet inventory entry.');
      return;
    }

    if (!Number.isFinite(normalizedCount) || normalizedCount < 0) {
      setStoredPetMessage(null);
      setStoredPetWarnings([]);
      setStoredPetError('Enter a non-negative quantity for the stored pet inventory entry.');
      return;
    }

    try {
      const nextState = upsertStoredPetInventoryItemInput(acquisitionPlannerState, {
        itemName: storedPetItemName,
        storedCount: normalizedCount,
      });
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setStoredPetError(null);
      setStoredPetWarnings([]);
      setStoredPetMessage(
        normalizedCount > 0
          ? `Saved ${storedPetItemName.trim()} as stored pet inventory.`
          : `Removed ${storedPetItemName.trim()} from stored pet inventory.`,
      );
      setStoredPetItemName('');
      setStoredPetItemCount('1');
    } catch (error) {
      setStoredPetMessage(null);
      setStoredPetWarnings([]);
      setStoredPetError(
        error instanceof Error ? error.message : 'Unable to save the stored pet inventory entry.',
      );
    }
  }

  function handleImportStoredPetInventory(): void {
    const parsedResult = parseStoredPetInventoryPaste(storedPetImportText, {
      knownCanonicalKeys: knownItemKeys ?? undefined,
    });

    if (parsedResult.entries.length === 0) {
      setStoredPetMessage(null);
      setStoredPetWarnings(parsedResult.warnings);
      setStoredPetError('No stored pet inventory entries were imported from the pasted text.');
      return;
    }

    try {
      const nextState = replaceStoredPetInventoryEntries(acquisitionPlannerState, parsedResult.entries);
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setStoredPetError(null);
      setStoredPetWarnings(parsedResult.warnings);
      setStoredPetMessage(
        `Imported ${parsedResult.entries.length.toLocaleString()} stored pet inventory entr${parsedResult.entries.length === 1 ? 'y' : 'ies'}.`,
      );
      setStoredPetImportText('');
    } catch (error) {
      setStoredPetMessage(null);
      setStoredPetWarnings(parsedResult.warnings);
      setStoredPetError(
        error instanceof Error ? error.message : 'Unable to import the stored pet inventory text.',
      );
    }
  }

  function handleRemoveStoredPetItem(canonicalItemKey: string): void {
    try {
      const nextState = removeStoredPetInventoryItemInput(acquisitionPlannerState, canonicalItemKey);
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setStoredPetError(null);
      setStoredPetWarnings([]);
      setStoredPetMessage(`Removed ${canonicalItemKey} from stored pet inventory.`);
    } catch (error) {
      setStoredPetMessage(null);
      setStoredPetWarnings([]);
      setStoredPetError(
        error instanceof Error ? error.message : 'Unable to remove the stored pet inventory entry.',
      );
    }
  }

  function handleSaveFuturePetForecastSettings(): void {
    const normalizedHorizonDays = Number(futurePetForecastHorizonDays);
    const normalizedOfflineHoursCap = Number(futurePetForecastOfflineHoursCap);

    if (!Number.isFinite(normalizedHorizonDays) || normalizedHorizonDays < 0) {
      setFuturePetMessage(null);
      setFuturePetWarnings([]);
      setFuturePetError('Enter a non-negative forecast horizon in days.');
      return;
    }

    if (!Number.isFinite(normalizedOfflineHoursCap) || normalizedOfflineHoursCap < 0) {
      setFuturePetMessage(null);
      setFuturePetWarnings([]);
      setFuturePetError('Enter a non-negative offline hours cap for the future pet forecast.');
      return;
    }

    try {
      const savedState = saveAcquisitionPlannerInputState({
        ...acquisitionPlannerState,
        pets: {
          ...acquisitionPlannerState.pets,
          futureProduction: {
            ...acquisitionPlannerState.pets.futureProduction,
            enabled: futurePetForecastEnabled,
            horizonDays: normalizedHorizonDays,
            respectSeasonality: futurePetForecastRespectSeasonality,
            offlineHoursCap: normalizedOfflineHoursCap,
            crunchyOmeletteActive: futurePetForecastCrunchyOmeletteActive,
          },
        },
      });

      setAcquisitionPlannerState(savedState);
      setFuturePetError(null);
      setFuturePetWarnings([]);
      setFuturePetMessage('Saved future pet forecast assumptions.');
    } catch (error) {
      setFuturePetMessage(null);
      setFuturePetWarnings([]);
      setFuturePetError(
        error instanceof Error ? error.message : 'Unable to save the future pet forecast assumptions.',
      );
    }
  }

  function handleSaveFuturePetEntry(): void {
    const normalizedPetLevel = Number(futurePetLevel);
    const warnings: string[] = [];

    if (futurePetItemName.trim().length === 0) {
      setFuturePetMessage(null);
      setFuturePetWarnings([]);
      setFuturePetError('Enter an item name to save a future pet production entry.');
      return;
    }

    if (futurePetName.trim().length === 0) {
      setFuturePetMessage(null);
      setFuturePetWarnings([]);
      setFuturePetError('Enter a pet name to save a future pet production entry.');
      return;
    }

    if (!Number.isFinite(normalizedPetLevel) || normalizedPetLevel < 0) {
      setFuturePetMessage(null);
      setFuturePetWarnings([]);
      setFuturePetError('Enter a non-negative pet level for the future pet production entry.');
      return;
    }

    try {
      const nextState = upsertFuturePetProductionEntryInput(acquisitionPlannerState, {
        itemName: futurePetItemName,
        petName: futurePetName,
        petLevel: normalizedPetLevel,
        seasonalActive: futurePetSeasonalActive,
      });
      const savedState = saveAcquisitionPlannerInputState(nextState);

      if (knownItemKeys) {
        const canonicalItemKey = savedState.pets.futureProduction.entries.find((entry) => {
          return (
            entry.itemName === futurePetItemName.trim() &&
            entry.petName.toLocaleLowerCase() === futurePetName.trim().toLocaleLowerCase()
          );
        })?.canonicalItemKey;

        if (canonicalItemKey && !knownItemKeys.has(canonicalItemKey)) {
          warnings.push(`Future pet item "${futurePetItemName.trim()}" was not found in local reference data and was kept as entered.`);
        }
      }

      setAcquisitionPlannerState(savedState);
      setFuturePetError(null);
      setFuturePetWarnings(warnings);
      setFuturePetMessage(
        normalizedPetLevel > 0
          ? `Saved ${futurePetName.trim()} -> ${futurePetItemName.trim()} for future pet production forecasting.`
          : `Removed ${futurePetName.trim()} -> ${futurePetItemName.trim()} from future pet production forecasting.`,
      );
      setFuturePetItemName('');
      setFuturePetName('');
      setFuturePetLevel('1');
      setFuturePetSeasonalActive(true);
    } catch (error) {
      setFuturePetMessage(null);
      setFuturePetWarnings([]);
      setFuturePetError(
        error instanceof Error ? error.message : 'Unable to save the future pet production entry.',
      );
    }
  }

  function handleRemoveFuturePetEntry(canonicalItemKey: string, petName: string): void {
    try {
      const nextState = removeFuturePetProductionEntryInput(acquisitionPlannerState, canonicalItemKey, petName);
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setFuturePetError(null);
      setFuturePetWarnings([]);
      setFuturePetMessage(`Removed ${petName} -> ${canonicalItemKey} from future pet production forecasting.`);
    } catch (error) {
      setFuturePetMessage(null);
      setFuturePetWarnings([]);
      setFuturePetError(
        error instanceof Error ? error.message : 'Unable to remove the future pet production entry.',
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
        description="Manage local backups, restore a saved backup, and adjust planner assumptions stored in this browser."
        storageKey="settings"
      />

      <section className="page-card page-stack" aria-labelledby="settings-backup-title">
        <div>
          <h2 id="settings-backup-title">Local Backup</h2>
          <p className="supporting-text">
            Export one versioned backup file for this local profile. The backup currently includes snapshot history,
            crafting and planner modifier settings, acquisition planner inputs, Pumpkin Juice planning, personal
            mastery goals, race-count context, and your saved theme preference.
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

      <section className="page-card page-stack" aria-labelledby="settings-stored-pet-title">
        <div>
          <h2 id="settings-stored-pet-title">Stored Pet Inventory</h2>
          <p className="supporting-text">
            Track already-produced pet items you have on hand right now. This stays separate from owned stockpiles and
            future pet production estimates.
          </p>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="stored-pet-item-name">
            Pet item name
          </label>
          <input
            id="stored-pet-item-name"
            className="text-input"
            type="text"
            value={storedPetItemName}
            onChange={(event) => {
              setStoredPetItemName(event.target.value);
            }}
            placeholder="Honey"
          />
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="stored-pet-item-count">
            Stored quantity
          </label>
          <input
            id="stored-pet-item-count"
            className="text-input"
            type="number"
            min="0"
            step="1"
            value={storedPetItemCount}
            onChange={(event) => {
              setStoredPetItemCount(event.target.value);
            }}
          />
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={handleSaveStoredPetItem}
          >
            Save Stored Pet Item
          </button>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="stored-pet-import-text">
            Paste pet inventory
          </label>
          <textarea
            id="stored-pet-import-text"
            className="text-input"
            rows={6}
            value={storedPetImportText}
            onChange={(event) => {
              setStoredPetImportText(event.target.value);
            }}
            placeholder={`Honey\nFrom Owl\n22,528 currently in Inventory\nFound 4,706`}
          />
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={handleImportStoredPetInventory}
          >
            Import Stored Pet Inventory
          </button>
        </div>

        <p className="supporting-text">
          Supported paste format: the Pets collected-items export structure with repeating item blocks such as
          <code> Item Name / From Pet / currently in Inventory / Found N</code>. Simple one-line
          <code> Item Name, Count</code> pairs still work as a fallback.
        </p>

        {storedPetEntries.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Stored count</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {storedPetEntries.map((entry) => (
                <tr key={entry.canonicalItemKey}>
                  <td>{entry.itemName}</td>
                  <td>{entry.storedCount.toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        handleRemoveStoredPetItem(entry.canonicalItemKey);
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
          <p className="supporting-text">No stored pet inventory saved yet.</p>
        )}

        {storedPetMessage ? <p className="status-message status-message--success">{storedPetMessage}</p> : null}
        {storedPetError ? <p className="status-message status-message--error">{storedPetError}</p> : null}
        {storedPetWarnings.length > 0 ? (
          <ul className="supporting-text">
            {storedPetWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="settings-future-pet-title">
        <div>
          <h2 id="settings-future-pet-title">Future Pet Production</h2>
          <p className="supporting-text">
            Track a simple future-only pet production estimate separately from stored pet inventory. This first slice
            assumes one collection window capped by offline hours instead of a full cadence-aware planner.
          </p>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={futurePetForecastEnabled}
            onChange={(event) => {
              setFuturePetForecastEnabled(event.target.checked);
            }}
          />
          <span>Enable future pet production forecast</span>
        </label>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="future-pet-horizon-days">
            Forecast horizon (days)
          </label>
          <input
            id="future-pet-horizon-days"
            className="text-input"
            type="number"
            min="0"
            step="1"
            value={futurePetForecastHorizonDays}
            onChange={(event) => {
              setFuturePetForecastHorizonDays(event.target.value);
            }}
          />
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="future-pet-offline-hours-cap">
            Offline hours cap
          </label>
          <input
            id="future-pet-offline-hours-cap"
            className="text-input"
            type="number"
            min="0"
            step="1"
            value={futurePetForecastOfflineHoursCap}
            onChange={(event) => {
              setFuturePetForecastOfflineHoursCap(event.target.value);
            }}
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={futurePetForecastRespectSeasonality}
            onChange={(event) => {
              setFuturePetForecastRespectSeasonality(event.target.checked);
            }}
          />
          <span>Respect seasonal pet availability</span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={futurePetForecastCrunchyOmeletteActive}
            onChange={(event) => {
              setFuturePetForecastCrunchyOmeletteActive(event.target.checked);
            }}
          />
          <span>Use Crunchy Omelette while collecting from pets (1.5x)</span>
        </label>

        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={handleSaveFuturePetForecastSettings}
          >
            Save Future Pet Forecast Settings
          </button>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="future-pet-name">
            Pet name
          </label>
          <input
            id="future-pet-name"
            className="text-input"
            type="text"
            value={futurePetName}
            onChange={(event) => {
              setFuturePetName(event.target.value);
            }}
            placeholder="Owl"
          />
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="future-pet-item-name">
            Produced item name
          </label>
          <input
            id="future-pet-item-name"
            className="text-input"
            type="text"
            value={futurePetItemName}
            onChange={(event) => {
              setFuturePetItemName(event.target.value);
            }}
            placeholder="Honey"
          />
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="future-pet-level">
            Pet level
          </label>
          <input
            id="future-pet-level"
            className="text-input"
            type="number"
            min="0"
            step="1"
            value={futurePetLevel}
            onChange={(event) => {
              setFuturePetLevel(event.target.value);
            }}
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={futurePetSeasonalActive}
            onChange={(event) => {
              setFuturePetSeasonalActive(event.target.checked);
            }}
          />
          <span>Seasonal pet currently active</span>
        </label>

        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={handleSaveFuturePetEntry}
          >
            Save Future Pet Entry
          </button>
        </div>

        <p className="supporting-text">
          This estimate uses <strong>{futurePetForecast.forecastHours.toLocaleString()}</strong> forecast hours from
          the current horizon and offline-cap assumptions. Crunchy Omelette applies only as an explicit
          collection-time multiplier when checked.
        </p>

        {futurePetEntries.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Pet</th>
                <th scope="col">Item</th>
                <th scope="col">Level</th>
                <th scope="col">Seasonal active</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {futurePetEntries.map((entry) => (
                <tr key={`${entry.petName}:${entry.canonicalItemKey}`}>
                  <td>{entry.petName}</td>
                  <td>{entry.itemName}</td>
                  <td>{entry.petLevel.toLocaleString()}</td>
                  <td>{entry.seasonalActive ? 'Yes' : 'No'}</td>
                  <td>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        handleRemoveFuturePetEntry(entry.canonicalItemKey, entry.petName);
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
          <p className="supporting-text">No future pet production entries saved yet.</p>
        )}

        {futurePetForecast.enabled && futurePetForecast.entries.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Forecast quantity</th>
                <th scope="col">Source pets</th>
              </tr>
            </thead>
            <tbody>
              {futurePetForecast.entries.map((entry) => (
                <tr key={entry.canonicalItemKey}>
                  <td>{entry.itemName}</td>
                  <td>{formatForecastQuantity(entry.forecastQuantity)}</td>
                  <td>{entry.sourcePetCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : futurePetForecast.enabled ? (
          <p className="supporting-text">Future pet forecast is enabled, but no pet entries are saved yet.</p>
        ) : (
          <p className="supporting-text">Future pet forecast is currently disabled.</p>
        )}

        {futurePetMessage ? <p className="status-message status-message--success">{futurePetMessage}</p> : null}
        {futurePetError ? <p className="status-message status-message--error">{futurePetError}</p> : null}
        {futurePetWarnings.length > 0 ? (
          <ul className="supporting-text">
            {futurePetWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
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
              <div className="summary-grid__item">
                <dt>Pumpkin Juice planner</dt>
                <dd>{restorePreview.payload.state.preferences.pumpkinJuicePlannerState ? 'Included' : 'Not included'}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Personal goals</dt>
                <dd>{restorePreview.payload.state.preferences.personalMasteryGoalsState ? 'Included' : 'Not included'}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Race counts</dt>
                <dd>{restorePreview.payload.state.preferences.masteryRaceCountsState ? 'Included' : 'Not included'}</dd>
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
