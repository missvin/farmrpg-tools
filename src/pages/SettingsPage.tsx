import { useEffect, useState, type ChangeEvent } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  getCurrentInventoryItemInputs,
  getFuturePetProductionEntries,
  getOwnedNowItemInputs,
  getStoredPetInventoryItemInputs,
  loadAcquisitionPlannerInputState,
  removeCurrentInventoryItemInput,
  removeFuturePetProductionEntryInput,
  removeStoredPetInventoryItemInput,
  replaceCurrentInventoryEntries,
  replaceStoredPetInventoryEntries,
  removeOwnedNowItemInput,
  saveAcquisitionPlannerInputState,
  upsertCurrentInventoryItemInput,
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
import {
  loadDropRateAcquisitionSettings,
  saveDropRateAcquisitionSettings,
  type DropRateExploringUnit,
  type DropRateFarmingUnit,
  type DropRateFishingUnit,
} from '../lib/dropRateAcquisitionSettings';
import {
  loadPetSourceReference,
  type PetSourceReferenceData,
} from '../lib/loadPetSourceReference';
import {
  loadLocalItemReferenceLookup,
  resolveLocalItemReference,
  type LocalItemReferenceLookup,
} from '../lib/localItemReferenceLookup';
import { parseCurrentInventoryPaste } from '../lib/parseCurrentInventoryPaste';
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
  const [dropRateSettings, setDropRateSettings] = useState(() => loadDropRateAcquisitionSettings());
  const [dropRateSettingsMessage, setDropRateSettingsMessage] = useState<string | null>(null);
  const [dropRateSettingsError, setDropRateSettingsError] = useState<string | null>(null);
  const [ownedItemName, setOwnedItemName] = useState('');
  const [ownedItemCount, setOwnedItemCount] = useState('1');
  const [ownedItemSourceCategory, setOwnedItemSourceCategory] =
    useState<AcquisitionOwnedNowSourceCategory>('stockpile');
  const [ownedItemsMessage, setOwnedItemsMessage] = useState<string | null>(null);
  const [ownedItemsError, setOwnedItemsError] = useState<string | null>(null);
  const [currentInventoryItemName, setCurrentInventoryItemName] = useState('');
  const [currentInventoryItemCount, setCurrentInventoryItemCount] = useState('1');
  const [currentInventoryImportText, setCurrentInventoryImportText] = useState('');
  const [currentInventoryMessage, setCurrentInventoryMessage] = useState<string | null>(null);
  const [currentInventoryError, setCurrentInventoryError] = useState<string | null>(null);
  const [currentInventoryWarnings, setCurrentInventoryWarnings] = useState<string[]>([]);
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
  const [localItemLookup, setLocalItemLookup] = useState<LocalItemReferenceLookup | null>(null);
  const [knownItemKeys, setKnownItemKeys] = useState<Set<string> | null>(null);
  const [petSourceReference, setPetSourceReference] = useState<PetSourceReferenceData | null>(null);
  const [petSourceReferenceError, setPetSourceReferenceError] = useState<string | null>(null);
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
  const currentInventoryEntries = getCurrentInventoryItemInputs(acquisitionPlannerState);
  const storedPetEntries = getStoredPetInventoryItemInputs(acquisitionPlannerState);
  const futurePetEntries = getFuturePetProductionEntries(acquisitionPlannerState);
  const futurePetForecast = deriveFuturePetProductionForecast(acquisitionPlannerState, {
    petSourceReference,
  });

  useEffect(() => {
    let cancelled = false;

    void loadLocalItemReferenceLookup()
      .then((data) => {
        if (!cancelled) {
          setLocalItemLookup(data);
          setKnownItemKeys(
            new Set([
              ...Object.keys(data.itemCatalog.byCanonicalKey),
              ...Object.keys(data.museumCoverage.byCanonicalKey),
              ...(data.museumCanon?.entries.map((entry) => entry.canonicalKey) ?? []),
            ]),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalItemLookup(null);
          setKnownItemKeys(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadPetSourceReference()
      .then((data) => {
        if (!cancelled) {
          setPetSourceReference(data);
          setPetSourceReferenceError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPetSourceReference(null);
          setPetSourceReferenceError(
            error instanceof Error ? error.message : 'Unable to load local pet-source reference data.',
          );
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
      setOwnedItemsError('Enter an item name to save a supply entry.');
      return;
    }

    if (!Number.isFinite(normalizedCount) || normalizedCount < 0) {
      setOwnedItemsMessage(null);
      setOwnedItemsError('Enter a non-negative quantity for the saved supply.');
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
          ? `Saved ${ownedItemName.trim()} as a saved ${ownedItemSourceCategory}.`
          : `Removed ${ownedItemName.trim()} from saved ${ownedItemSourceCategory} entries.`,
      );
      setOwnedItemName('');
      setOwnedItemCount('1');
    } catch (error) {
      setOwnedItemsMessage(null);
      setOwnedItemsError(
        error instanceof Error ? error.message : 'Unable to save the supply entry.',
      );
    }
  }

  function handleRemoveOwnedItem(canonicalItemKey: string, sourceCategory: AcquisitionOwnedNowSourceCategory): void {
    try {
      const nextState = removeOwnedNowItemInput(acquisitionPlannerState, canonicalItemKey, sourceCategory);
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setOwnedItemsError(null);
      setOwnedItemsMessage(`Removed ${canonicalItemKey} from saved ${sourceCategory} entries.`);
    } catch (error) {
      setOwnedItemsMessage(null);
      setOwnedItemsError(
        error instanceof Error ? error.message : 'Unable to remove the supply entry.',
      );
    }
  }

  function handleSaveCurrentInventoryItem(): void {
    const normalizedCount = Number(currentInventoryItemCount);

    if (currentInventoryItemName.trim().length === 0) {
      setCurrentInventoryMessage(null);
      setCurrentInventoryWarnings([]);
      setCurrentInventoryError('Enter an item name to save a current inventory entry.');
      return;
    }

    if (!Number.isFinite(normalizedCount) || normalizedCount < 0) {
      setCurrentInventoryMessage(null);
      setCurrentInventoryWarnings([]);
      setCurrentInventoryError('Enter a non-negative quantity for the current inventory entry.');
      return;
    }

    try {
      const nextState = upsertCurrentInventoryItemInput(acquisitionPlannerState, {
        itemName: currentInventoryItemName,
        inventoryCount: normalizedCount,
      });
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setCurrentInventoryError(null);
      setCurrentInventoryWarnings([]);
      setCurrentInventoryMessage(
        normalizedCount > 0
          ? `Saved ${currentInventoryItemName.trim()} as current inventory.`
          : `Removed ${currentInventoryItemName.trim()} from current inventory.`,
      );
      setCurrentInventoryItemName('');
      setCurrentInventoryItemCount('1');
    } catch (error) {
      setCurrentInventoryMessage(null);
      setCurrentInventoryWarnings([]);
      setCurrentInventoryError(
        error instanceof Error ? error.message : 'Unable to save the current inventory entry.',
      );
    }
  }

  function handleImportCurrentInventory(): void {
    const parsedResult = parseCurrentInventoryPaste(currentInventoryImportText, {
      resolveItem: localItemLookup
        ? (itemName) => {
            const result = resolveLocalItemReference(itemName, localItemLookup);

            return {
              canonicalItemKey: result.canonicalKey,
              itemName: result.displayName,
              recognized: result.recognized,
              warnings: result.recognized ? [] : result.warnings,
            };
          }
        : undefined,
    });

    if (parsedResult.entries.length === 0) {
      setCurrentInventoryMessage(null);
      setCurrentInventoryWarnings(parsedResult.warnings);
      setCurrentInventoryError('No current inventory entries were imported from the pasted text.');
      return;
    }

    try {
      const nextState = replaceCurrentInventoryEntries(acquisitionPlannerState, parsedResult.entries);
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setCurrentInventoryError(null);
      setCurrentInventoryWarnings(parsedResult.warnings);
      setCurrentInventoryMessage(
        `Imported ${parsedResult.entries.length.toLocaleString()} current inventory entr${parsedResult.entries.length === 1 ? 'y' : 'ies'}.`,
      );
      setCurrentInventoryImportText('');
    } catch (error) {
      setCurrentInventoryMessage(null);
      setCurrentInventoryWarnings(parsedResult.warnings);
      setCurrentInventoryError(
        error instanceof Error ? error.message : 'Unable to import the current inventory text.',
      );
    }
  }

  function handleRemoveCurrentInventoryItem(canonicalItemKey: string): void {
    try {
      const nextState = removeCurrentInventoryItemInput(acquisitionPlannerState, canonicalItemKey);
      const savedState = saveAcquisitionPlannerInputState(nextState);

      setAcquisitionPlannerState(savedState);
      setCurrentInventoryError(null);
      setCurrentInventoryWarnings([]);
      setCurrentInventoryMessage(`Removed ${canonicalItemKey} from current inventory.`);
    } catch (error) {
      setCurrentInventoryMessage(null);
      setCurrentInventoryWarnings([]);
      setCurrentInventoryError(
        error instanceof Error ? error.message : 'Unable to remove the current inventory entry.',
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

  function handleSaveDropRateSettings(): void {
    try {
      const savedSettings = saveDropRateAcquisitionSettings(dropRateSettings);

      setDropRateSettings(savedSettings);
      setDropRateSettingsError(null);
      setDropRateSettingsMessage('Saved drop rate settings.');
    } catch (error) {
      setDropRateSettingsMessage(null);
      setDropRateSettingsError(
        error instanceof Error ? error.message : 'Unable to save drop rate settings.',
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
        description="Manage local backups and the planning settings stored in this browser."
        storageKey="settings"
      />

      <section className="page-card page-stack" aria-labelledby="settings-backup-title">
        <div>
          <h2 id="settings-backup-title">Local Backup</h2>
          <p className="supporting-text">
            Export one versioned backup file for this local profile. The backup currently includes snapshot history,
            crafting and planner modifier settings, acquisition planner inputs, Pumpkin Juice planning, personal
            mastery goals, race-count context, Target Planner state, and your saved theme preference.
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

      <section className="page-card page-stack" aria-labelledby="settings-drop-rate-title">
        <div>
          <h2 id="settings-drop-rate-title">Drop Rate Settings</h2>
          <p className="supporting-text">
            Set the perks and display units used for Buddy.farm source estimates. These settings are saved only in
            this browser.
          </p>
        </div>

        <div className="summary-grid">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={dropRateSettings.perks.ironDepotActive}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  perks: {
                    ...dropRateSettings.perks,
                    ironDepotActive: event.target.checked,
                  },
                });
              }}
            />
            <span>Iron Depot</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={dropRateSettings.perks.cinnamonSticksActive}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  perks: {
                    ...dropRateSettings.perks,
                    cinnamonSticksActive: event.target.checked,
                  },
                });
              }}
            />
            <span>Cinnamon Sticks</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={dropRateSettings.perks.lemonSqueezerActive}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  perks: {
                    ...dropRateSettings.perks,
                    lemonSqueezerActive: event.target.checked,
                  },
                });
              }}
            />
            <span>Lemon Squeezer</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={dropRateSettings.perks.reinforcedNettingActive}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  perks: {
                    ...dropRateSettings.perks,
                    reinforcedNettingActive: event.target.checked,
                  },
                });
              }}
            />
            <span>Reinforced Netting</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={dropRateSettings.perks.fishingTrawlActive}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  perks: {
                    ...dropRateSettings.perks,
                    fishingTrawlActive: event.target.checked,
                  },
                });
              }}
            />
            <span>Fishing Trawl</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={dropRateSettings.perks.eagleEyeRunecubeActive}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  perks: {
                    ...dropRateSettings.perks,
                    eagleEyeRunecubeActive: event.target.checked,
                  },
                });
              }}
            />
            <span>Eagle Eye / Runecube</span>
          </label>
        </div>

        <div className="summary-grid">
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="drop-rate-wanderer-percent">
              Wanderer %
            </label>
            <input
              id="drop-rate-wanderer-percent"
              className="text-input"
              type="number"
              min="0"
              max="100"
              step="1"
              value={dropRateSettings.perks.wandererPercent}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  perks: {
                    ...dropRateSettings.perks,
                    wandererPercent: Number(event.target.value),
                  },
                });
              }}
            />
          </div>

          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="drop-rate-resource-saver-percent">
              Resource Saver %
            </label>
            <input
              id="drop-rate-resource-saver-percent"
              className="text-input"
              type="number"
              min="0"
              max="100"
              step="1"
              value={dropRateSettings.perks.resourceSaverPercent}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  perks: {
                    ...dropRateSettings.perks,
                    resourceSaverPercent: Number(event.target.value),
                  },
                });
              }}
            />
          </div>

          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="drop-rate-exploring-unit">
              Exploring unit
            </label>
            <select
              id="drop-rate-exploring-unit"
              className="text-input"
              value={dropRateSettings.units.exploring}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  units: {
                    ...dropRateSettings.units,
                    exploring: event.target.value as DropRateExploringUnit,
                  },
                });
              }}
            >
              <option value="explores">Explores</option>
              <option value="stamina">Stamina</option>
              <option value="orange_juices">Orange Juices</option>
              <option value="apple_ciders">Apple Ciders</option>
              <option value="lemonades">Lemonades</option>
              <option value="arnold_palmers">Arnold Palmers</option>
            </select>
          </div>

          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="drop-rate-fishing-unit">
              Fishing unit
            </label>
            <select
              id="drop-rate-fishing-unit"
              className="text-input"
              value={dropRateSettings.units.fishing}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  units: {
                    ...dropRateSettings.units,
                    fishing: event.target.value as DropRateFishingUnit,
                  },
                });
              }}
            >
              <option value="fish">Fish</option>
              <option value="fishing_nets">Fishing Nets</option>
              <option value="large_nets">Large Nets</option>
            </select>
          </div>

          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="drop-rate-farming-unit">
              Farming unit
            </label>
            <select
              id="drop-rate-farming-unit"
              className="text-input"
              value={dropRateSettings.units.farming}
              onChange={(event) => {
                setDropRateSettings({
                  ...dropRateSettings,
                  units: {
                    ...dropRateSettings.units,
                    farming: event.target.value as DropRateFarmingUnit,
                  },
                });
              }}
            >
              <option value="crops">Crops</option>
              <option value="seeds">Seeds</option>
              <option value="harvest_alls">Harvest-Alls</option>
            </select>
          </div>
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={handleSaveDropRateSettings}
          >
            Save Drop Rate Settings
          </button>
        </div>

        {dropRateSettingsMessage ? <p className="status-message status-message--success">{dropRateSettingsMessage}</p> : null}
        {dropRateSettingsError ? <p className="status-message status-message--error">{dropRateSettingsError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="settings-owned-stockpiles-title">
        <div>
          <h2 id="settings-owned-stockpiles-title">Owned Stockpiles</h2>
          <p className="supporting-text">
            Track bags, chests, and similar supplies you can use now for acquisition planning. These entries stay
            separate from stored pet inventory and future pet production.
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
            Supply type
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
          Unknown item names are kept as entered so planning can continue even when local reference data is incomplete.
        </p>

        {ownedNowEntries.length > 0 ? (
          <table className="summary-table">
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
          <p className="supporting-text">No saved supplies yet.</p>
        )}

        {ownedItemsMessage ? <p className="status-message status-message--success">{ownedItemsMessage}</p> : null}
        {ownedItemsError ? <p className="status-message status-message--error">{ownedItemsError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="settings-current-inventory-title">
        <div>
          <h2 id="settings-current-inventory-title">Current Inventory</h2>
          <p className="supporting-text">
            Import or enter items currently in your inventory so target planning can spend this supply before
            expanding remaining requirements.
          </p>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="current-inventory-item-name">
            Inventory item name
          </label>
          <input
            id="current-inventory-item-name"
            className="text-input"
            type="text"
            value={currentInventoryItemName}
            onChange={(event) => {
              setCurrentInventoryItemName(event.target.value);
            }}
            placeholder="Large Net"
          />
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="current-inventory-item-count">
            Inventory quantity
          </label>
          <input
            id="current-inventory-item-count"
            className="text-input"
            type="number"
            min="0"
            step="1"
            value={currentInventoryItemCount}
            onChange={(event) => {
              setCurrentInventoryItemCount(event.target.value);
            }}
          />
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={handleSaveCurrentInventoryItem}
          >
            Save Inventory Item
          </button>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="current-inventory-import-text">
            Paste current inventory
          </label>
          <textarea
            id="current-inventory-import-text"
            className="text-input"
            rows={6}
            value={currentInventoryImportText}
            onChange={(event) => {
              setCurrentInventoryImportText(event.target.value);
            }}
            placeholder={`566\nCabbage Stew\n1,021\nLemon Cream Pie`}
          />
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={handleImportCurrentInventory}
          >
            Import Current Inventory
          </button>
        </div>

        <p className="supporting-text">
          Supported paste formats: alternating count/item lines from FarmRPG pages, or simple one-line
          <code> Item Name, Count</code> pairs. Import replaces the saved current inventory list.
        </p>

        {currentInventoryEntries.length > 0 ? (
          <table className="summary-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Inventory count</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {currentInventoryEntries.map((entry) => (
                <tr key={entry.canonicalItemKey}>
                  <td>{entry.itemName}</td>
                  <td>{entry.inventoryCount.toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        handleRemoveCurrentInventoryItem(entry.canonicalItemKey);
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
          <p className="supporting-text">No current inventory saved yet.</p>
        )}

        {currentInventoryMessage ? <p className="status-message status-message--success">{currentInventoryMessage}</p> : null}
        {currentInventoryError ? <p className="status-message status-message--error">{currentInventoryError}</p> : null}
        {currentInventoryWarnings.length > 0 ? (
          <ul className="supporting-text">
            {currentInventoryWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
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
          <table className="summary-table">
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
            Estimate future pet items separately from stored pet inventory. This uses one collection window capped by
            offline hours.
          </p>
        </div>

        <label className="checkbox-field">
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

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={futurePetForecastRespectSeasonality}
            onChange={(event) => {
              setFuturePetForecastRespectSeasonality(event.target.checked);
            }}
          />
          <span>Respect seasonal pet availability</span>
        </label>

        <label className="checkbox-field">
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

        <label className="checkbox-field">
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
          the current horizon and offline-cap assumptions. Pet output is divided across the level item pool
          (4 before level 3, 8 before level 6, then 12), and Crunchy Omelette applies only as an explicit
          collection-time multiplier when checked.
        </p>

        {petSourceReferenceError ? (
          <p className="status-message">
            Local pet-source coverage could not be loaded. Forecasts still use the level item-pool model, but unlock
            levels may need review.
          </p>
        ) : null}

        {futurePetEntries.length > 0 ? (
          <table className="summary-table">
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
          <table className="summary-table">
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
        {futurePetForecast.warnings.length > 0 ? (
          <ul className="supporting-text">
            {futurePetForecast.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
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
            backup replaces the saved app data for this browser profile.
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
              history, saved planner settings, acquisition inputs, and saved theme preference.
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
                <dt>Drop rate settings</dt>
                <dd>{restorePreview.payload.state.preferences.dropRateAcquisitionSettings ? 'Included' : 'Not included'}</dd>
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
