import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppBackupPayload } from '../lib/appBackupSchema';

const {
  mockExportCurrentAppBackupFile,
  mockReadAppBackupFile,
  mockRestoreAppBackupPayload,
  mockReloadAfterRestore,
} = vi.hoisted(() => ({
  mockExportCurrentAppBackupFile: vi.fn(),
  mockReadAppBackupFile: vi.fn(),
  mockRestoreAppBackupPayload: vi.fn(),
  mockReloadAfterRestore: vi.fn(),
}));

vi.mock('../lib/appBackupExport', () => ({
  exportCurrentAppBackupFile: mockExportCurrentAppBackupFile,
}));

vi.mock('../lib/appBackupRestore', () => ({
  readAppBackupFile: mockReadAppBackupFile,
  restoreAppBackupPayload: mockRestoreAppBackupPayload,
  reloadAfterRestore: mockReloadAfterRestore,
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
    themePreference: 'dark',
  });
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockExportCurrentAppBackupFile.mockReset();
    mockReadAppBackupFile.mockReset();
    mockRestoreAppBackupPayload.mockReset();
    mockReloadAfterRestore.mockReset();
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
});
