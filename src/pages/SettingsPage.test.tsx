import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ACQUISITION_PLANNER_STATE_STORAGE_KEY,
  createDefaultAcquisitionPlannerInputState,
  loadAcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import { createAppBackupPayload } from '../lib/appBackupSchema';
import {
  DROP_RATE_ACQUISITION_SETTINGS_STORAGE_KEY,
  loadDropRateAcquisitionSettings,
} from '../lib/dropRateAcquisitionSettings';

const {
  mockExportCurrentAppBackupFile,
  mockReadAppBackupFile,
  mockRestoreAppBackupPayload,
  mockReloadAfterRestore,
  mockLoadMasteryDifficulty,
} = vi.hoisted(() => ({
  mockExportCurrentAppBackupFile: vi.fn(),
  mockReadAppBackupFile: vi.fn(),
  mockRestoreAppBackupPayload: vi.fn(),
  mockReloadAfterRestore: vi.fn(),
  mockLoadMasteryDifficulty: vi.fn(),
}));

vi.mock('../lib/appBackupExport', () => ({
  exportCurrentAppBackupFile: mockExportCurrentAppBackupFile,
}));

vi.mock('../lib/appBackupRestore', () => ({
  readAppBackupFile: mockReadAppBackupFile,
  restoreAppBackupPayload: mockRestoreAppBackupPayload,
  reloadAfterRestore: mockReloadAfterRestore,
}));

vi.mock('../lib/loadMasteryDifficulty', () => ({
  loadMasteryDifficulty: mockLoadMasteryDifficulty,
}));

import { SettingsPage } from './SettingsPage';

function createBackupPayload() {
  return createAppBackupPayload({
    appVersion: '1.1.0',
    exportedAt: '2026-03-21T11:00:00.000Z',
    snapshots: [
      {
        snapshotId: 'snapshot-1',
        createdAt: '2026-03-21T10:00:00.000Z',
        savedAt: '2026-03-21T10:00:00.000Z',
        importedAt: '2026-03-21T10:00:00.000Z',
        rawText: 'example',
        masteryByItem: { twine: 10_000 },
        parseSummary: {
          itemsParsed: 1,
          parsedRowsCount: 1,
          tiersDetected: [],
          duplicateRowsCount: 0,
          skippedNonItemLinesCount: 0,
          skippedNonItemLineSamples: [],
          unknownItemsCount: 0,
          warnings: [],
        },
      },
    ],
    craftingModifierState: {
      schemaVersion: 1,
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: false,
      },
      temporary: {
        mushroomStewActive: false,
        eventMasteryBonusPercent: 0,
        eventResourceSaverBonusPercent: 0,
      },
      planning: {
        includeExcludedRecipes: false,
        ironDepotActive: false,
      },
    },
    acquisitionPlannerState: {
      ...createDefaultAcquisitionPlannerInputState(),
      ownedNow: {
        entries: [
          {
            canonicalItemKey: 'mystery bag',
            itemName: 'Mystery Bag',
            ownedCount: 5,
            sourceCategory: 'stockpile',
          },
        ],
      },
    },
    themePreference: 'dark',
  });
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockExportCurrentAppBackupFile.mockReset();
    mockReadAppBackupFile.mockReset();
    mockRestoreAppBackupPayload.mockReset();
    mockReloadAfterRestore.mockReset();
    mockLoadMasteryDifficulty.mockReset();
    mockLoadMasteryDifficulty.mockResolvedValue({
      entries: [],
      byCanonicalKey: {
        honey: { canonicalKey: 'honey' },
        apple: { canonicalKey: 'apple' },
      },
    });
    window.localStorage.removeItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY);
    window.localStorage.removeItem(DROP_RATE_ACQUISITION_SETTINGS_STORAGE_KEY);
  });

  it('exports the full local backup file from the settings page', async () => {
    const user = userEvent.setup();

    mockExportCurrentAppBackupFile.mockResolvedValue({
      payload: {},
      content: '{}\n',
      filename: 'farmrpg-tools-backup-2026-03-21T10-30-00-000Z.json',
    });

    render(<SettingsPage />);

    await user.click(screen.getByRole('button', { name: 'Export Backup' }));

    expect(mockExportCurrentAppBackupFile).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Backup downloaded as farmrpg-tools-backup-2026-03-21T10-30-00-000Z.json.'),
    ).toBeInTheDocument();
  });

  it('surfaces a readable export error without changing local state', async () => {
    const user = userEvent.setup();

    mockExportCurrentAppBackupFile.mockRejectedValue(new Error('IndexedDB is not available in this browser.'));

    render(<SettingsPage />);

    await user.click(screen.getByRole('button', { name: 'Export Backup' }));

    expect(
      await screen.findByText('IndexedDB is not available in this browser.'),
    ).toBeInTheDocument();
  });

  it('loads a backup file, requires confirmation, and restores supported local state', async () => {
    const user = userEvent.setup();
    const payload = createBackupPayload();
    const file = new File([JSON.stringify(payload)], 'backup.json', {
      type: 'application/json',
    });

    mockReadAppBackupFile.mockResolvedValue(payload);
    mockRestoreAppBackupPayload.mockResolvedValue(undefined);

    render(<SettingsPage />);

    await user.upload(screen.getByLabelText('Backup file'), file);

    expect(mockReadAppBackupFile).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('backup.json')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Confirm Restore Backup' })).toBeInTheDocument();
    expect(screen.getByText('Acquisition planner')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm Restore Backup' }));

    expect(mockRestoreAppBackupPayload).toHaveBeenCalledWith(payload);
    expect(mockReloadAfterRestore).toHaveBeenCalledTimes(1);
  });

  it('surfaces invalid backup files safely before any restore happens', async () => {
    const user = userEvent.setup();
    const file = new File(['bad'], 'backup.json', {
      type: 'application/json',
    });

    mockReadAppBackupFile.mockRejectedValue(
      new Error('The selected file is not a supported FarmRPG Tools backup.'),
    );

    render(<SettingsPage />);

    await user.upload(screen.getByLabelText('Backup file'), file);

    expect(
      await screen.findByText('The selected file is not a supported FarmRPG Tools backup.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm Restore Backup' })).not.toBeInTheDocument();
    expect(mockRestoreAppBackupPayload).not.toHaveBeenCalled();
  });

  it('saves and removes owned-now stockpile inputs through shared local planner state', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.type(screen.getByLabelText('Item name'), 'Large Chest');
    await user.selectOptions(screen.getByLabelText('Owned-now source type'), 'container');
    await user.clear(screen.getByLabelText('Owned quantity'));
    await user.type(screen.getByLabelText('Owned quantity'), '4');
    await user.click(screen.getByRole('button', { name: 'Save Owned Item' }));

    expect(await screen.findByText('Large Chest')).toBeInTheDocument();
    expect(loadAcquisitionPlannerInputState().ownedNow.entries).toEqual([
      {
        canonicalItemKey: 'large chest',
        itemName: 'Large Chest',
        ownedCount: 4,
        sourceCategory: 'container',
      },
    ]);

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.getByText('No owned-now stockpile items saved yet.')).toBeInTheDocument();
    expect(loadAcquisitionPlannerInputState().ownedNow.entries).toEqual([]);
  });

  it('saves local drop-rate assumptions from settings', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.click(screen.getByLabelText('Iron Depot'));
    await user.clear(screen.getByLabelText('Wanderer %'));
    await user.type(screen.getByLabelText('Wanderer %'), '7');
    await user.selectOptions(screen.getByLabelText('Exploring unit'), 'stamina');
    await user.selectOptions(screen.getByLabelText('Fishing unit'), 'fish');
    await user.selectOptions(screen.getByLabelText('Farming unit'), 'harvest_alls');
    await user.click(screen.getByRole('button', { name: 'Save Drop-Rate Assumptions' }));

    expect(await screen.findByText('Saved drop-rate assumptions.')).toBeInTheDocument();
    expect(loadDropRateAcquisitionSettings()).toMatchObject({
      perks: {
        ironDepotActive: false,
        wandererPercent: 7,
      },
      units: {
        exploring: 'stamina',
        fishing: 'fish',
        farming: 'harvest_alls',
      },
    });
  });

  it('saves and imports stored pet inventory separately from owned-now stockpiles', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.type(screen.getByLabelText('Pet item name'), 'Honey');
    await user.clear(screen.getByLabelText('Stored quantity'));
    await user.type(screen.getByLabelText('Stored quantity'), '12');
    await user.click(screen.getByRole('button', { name: 'Save Stored Pet Item' }));

    expect(await screen.findByText('Honey')).toBeInTheDocument();
    expect(loadAcquisitionPlannerInputState().pets.storedInventoryEntries).toEqual([
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        storedCount: 12,
      },
    ]);
    expect(loadAcquisitionPlannerInputState().ownedNow.entries).toEqual([]);

    await user.clear(screen.getByLabelText('Paste pet inventory'));
    await user.type(
      screen.getByLabelText('Paste pet inventory'),
      'Honey{enter}From Bear{enter}22,528 currently in Inventory{enter}Found 601{enter}Honey{enter}From Owl{enter}22,528 currently in Inventory{enter}Found 4,706{enter}Mystery Relic{enter}From Test Pet{enter}0 currently in Inventory{enter}Found 7',
    );
    await user.click(screen.getByRole('button', { name: 'Import Stored Pet Inventory' }));

    expect(await screen.findByText('Imported 2 stored pet inventory entries.')).toBeInTheDocument();
    expect(screen.getByText('Line 9 item "Mystery Relic" was not found in local reference data and was kept as entered.')).toBeInTheDocument();
    expect(loadAcquisitionPlannerInputState().pets.storedInventoryEntries).toEqual([
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        storedCount: 5307,
      },
      {
        canonicalItemKey: 'mystery relic',
        itemName: 'Mystery Relic',
        storedCount: 7,
      },
    ]);

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(loadAcquisitionPlannerInputState().pets.storedInventoryEntries).toEqual([
      {
        canonicalItemKey: 'mystery relic',
        itemName: 'Mystery Relic',
        storedCount: 7,
      },
    ]);
  });

  it('saves future pet forecast assumptions and applies the Crunchy Omelette checkbox in forecast output', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.click(screen.getByLabelText('Enable future pet production forecast'));
    await user.clear(screen.getByLabelText('Forecast horizon (days)'));
    await user.type(screen.getByLabelText('Forecast horizon (days)'), '1');
    await user.clear(screen.getByLabelText('Offline hours cap'));
    await user.type(screen.getByLabelText('Offline hours cap'), '24');
    await user.click(screen.getByLabelText('Use Crunchy Omelette while collecting from pets (1.5x)'));
    await user.click(screen.getByRole('button', { name: 'Save Future Pet Forecast Settings' }));

    expect(await screen.findByText('Saved future pet forecast assumptions.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Pet name'), 'Owl');
    await user.type(screen.getByLabelText('Produced item name'), 'Honey');
    await user.clear(screen.getByLabelText('Pet level'));
    await user.type(screen.getByLabelText('Pet level'), '6');
    await user.click(screen.getByRole('button', { name: 'Save Future Pet Entry' }));

    expect(await screen.findByText('Saved Owl -> Honey for future pet production forecasting.')).toBeInTheDocument();
    expect(loadAcquisitionPlannerInputState().pets.storedInventoryEntries).toEqual([]);
    expect(loadAcquisitionPlannerInputState().pets.futureProduction).toMatchObject({
      enabled: true,
      horizonDays: 1,
      offlineHoursCap: 24,
      crunchyOmeletteActive: true,
      entries: [
        {
          canonicalItemKey: 'honey',
          itemName: 'Honey',
          petName: 'Owl',
          petLevel: 6,
          seasonalActive: true,
        },
      ],
    });
    expect(screen.getByText('432')).toBeInTheDocument();
  });
});
