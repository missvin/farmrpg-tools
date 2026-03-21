import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockReplaceSnapshots,
  mockSaveCraftingModifierState,
  mockClearCraftingModifierState,
  mockPersistAppTheme,
  mockClearStoredAppTheme,
} = vi.hoisted(() => ({
  mockReplaceSnapshots: vi.fn(),
  mockSaveCraftingModifierState: vi.fn(),
  mockClearCraftingModifierState: vi.fn(),
  mockPersistAppTheme: vi.fn(),
  mockClearStoredAppTheme: vi.fn(),
}));

vi.mock('./storage/masterySnapshots', () => ({
  replaceSnapshots: mockReplaceSnapshots,
}));

vi.mock('./craftingModifierState', () => ({
  saveCraftingModifierState: mockSaveCraftingModifierState,
  clearCraftingModifierState: mockClearCraftingModifierState,
}));

vi.mock('./themePreference', () => ({
  persistAppTheme: mockPersistAppTheme,
  clearStoredAppTheme: mockClearStoredAppTheme,
}));

import {
  readAppBackupFile,
  reloadAfterRestore,
  restoreAppBackupPayload,
} from './appBackupRestore';
import { createAppBackupPayload } from './appBackupSchema';

function createModifierStateFixture() {
  return {
    schemaVersion: 1 as const,
    persistent: {
      resourceSaver1Unlocked: false,
      resourceSaver2Unlocked: true,
      resourceSaver3Unlocked: false,
    },
    temporary: {
      mushroomStewActive: false,
      eventMasteryBonusPercent: 0,
      eventResourceSaverBonusPercent: 5,
    },
    planning: {
      includeExcludedRecipes: false,
      ironDepotActive: true,
    },
  };
}

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
    craftingModifierState: createModifierStateFixture(),
    themePreference: 'dark',
  });
}

describe('appBackupRestore', () => {
  beforeEach(() => {
    mockReplaceSnapshots.mockReset();
    mockSaveCraftingModifierState.mockReset();
    mockClearCraftingModifierState.mockReset();
    mockPersistAppTheme.mockReset();
    mockClearStoredAppTheme.mockReset();
  });

  it('reads a valid backup file using the shared backup schema contract', async () => {
    const payload = createBackupPayload();
    const file = {
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    } as unknown as File;

    await expect(readAppBackupFile(file)).resolves.toEqual(payload);
  });

  it('restores supported local state categories with replace-style behavior', async () => {
    const payload = createBackupPayload();

    await restoreAppBackupPayload(payload);

    expect(mockReplaceSnapshots).toHaveBeenCalledWith(payload.state.snapshots);
    expect(mockSaveCraftingModifierState).toHaveBeenCalledWith(
      payload.state.preferences.craftingModifierState,
    );
    expect(mockPersistAppTheme).toHaveBeenCalledWith('dark');
    expect(mockClearCraftingModifierState).not.toHaveBeenCalled();
    expect(mockClearStoredAppTheme).not.toHaveBeenCalled();
  });

  it('clears nullable preference categories when the backup payload omits them', async () => {
    const payload = createAppBackupPayload({
      appVersion: '1.1.0',
      exportedAt: '2026-03-21T11:00:00.000Z',
      snapshots: [],
      craftingModifierState: null,
      themePreference: null,
    });

    await restoreAppBackupPayload(payload);

    expect(mockReplaceSnapshots).toHaveBeenCalledWith([]);
    expect(mockClearCraftingModifierState).toHaveBeenCalledTimes(1);
    expect(mockClearStoredAppTheme).toHaveBeenCalledTimes(1);
  });

  it('rejects obviously invalid backup files safely', async () => {
    const invalidJsonFile = {
      text: vi.fn().mockResolvedValue('not-json'),
    } as unknown as File;
    const wrongShapeFile = {
      text: vi.fn().mockResolvedValue('{"kind":"nope"}'),
    } as unknown as File;

    await expect(readAppBackupFile(invalidJsonFile)).rejects.toThrow(
      'The selected file is not valid JSON.',
    );
    await expect(readAppBackupFile(wrongShapeFile)).rejects.toThrow(
      'The selected file is not a supported FarmRPG Tools backup.',
    );
  });

  it('reloads the application after a successful restore', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        reload: reloadSpy,
      },
      writable: true,
      configurable: true,
    });

    reloadAfterRestore();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
