import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MasterySnapshot } from './storage/masterySnapshots';

const {
  mockListSnapshots,
  mockLoadCraftingModifierState,
  mockReadStoredAppTheme,
} = vi.hoisted(() => ({
  mockListSnapshots: vi.fn<() => Promise<MasterySnapshot[]>>(),
  mockLoadCraftingModifierState: vi.fn(),
  mockReadStoredAppTheme: vi.fn(),
}));

vi.mock('./storage/masterySnapshots', () => ({
  listSnapshots: mockListSnapshots,
}));

vi.mock('./craftingModifierState', () => ({
  loadCraftingModifierState: mockLoadCraftingModifierState,
}));

vi.mock('./themePreference', () => ({
  readStoredAppTheme: mockReadStoredAppTheme,
}));

import {
  APP_BACKUP_EXPORT_MIME_TYPE,
  buildCurrentAppBackupPayload,
  createAppBackupFilename,
  exportCurrentAppBackupFile,
  serializeAppBackupPayload,
} from './appBackupExport';

function createSnapshot(snapshotId: string): MasterySnapshot {
  return {
    snapshotId,
    createdAt: '2026-03-21T08:00:00.000Z',
    savedAt: '2026-03-21T08:00:00.000Z',
    importedAt: '2026-03-21T08:00:00.000Z',
    rawText: 'example',
    masteryByItem: {
      twine: 10_000,
    },
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
  };
}

function createModifierStateFixture() {
  return {
    schemaVersion: 1 as const,
    persistent: {
      resourceSaver1Unlocked: false,
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
  };
}

describe('appBackupExport', () => {
  beforeEach(() => {
    mockListSnapshots.mockReset();
    mockLoadCraftingModifierState.mockReset();
    mockReadStoredAppTheme.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the full current backup payload from local snapshot and preference state', async () => {
    const snapshots = [createSnapshot('snapshot-1'), createSnapshot('snapshot-2')];
    const craftingModifierState = {
      ...createModifierStateFixture(),
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: true,
      },
    };

    mockListSnapshots.mockResolvedValue(snapshots);
    mockLoadCraftingModifierState.mockReturnValue(craftingModifierState);
    mockReadStoredAppTheme.mockReturnValue('dark');

    const payload = await buildCurrentAppBackupPayload({
      exportedAt: '2026-03-21T10:30:00.000Z',
      appVersion: '1.1.0',
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.kind).toBe('farmrpg-tools-backup');
    expect(payload.appVersion).toBe('1.1.0');
    expect(payload.restoreStrategy).toBe('replace');
    expect(payload.state.snapshots).toEqual(snapshots);
    expect(payload.state.preferences.craftingModifierState).toEqual(craftingModifierState);
    expect(payload.state.preferences.themePreference).toBe('dark');
  });

  it('serializes a versioned backup payload and uses a timestamped filename', async () => {
    mockListSnapshots.mockResolvedValue([createSnapshot('snapshot-1')]);
    mockLoadCraftingModifierState.mockReturnValue(createModifierStateFixture());
    mockReadStoredAppTheme.mockReturnValue('light');

    const payload = await buildCurrentAppBackupPayload({
      exportedAt: '2026-03-21T10:30:00.000Z',
      appVersion: '1.1.0',
    });
    const content = serializeAppBackupPayload(payload);

    expect(content).toContain('"kind": "farmrpg-tools-backup"');
    expect(content).toContain('"schemaVersion": 1');
    expect(content).toContain('"restoreStrategy": "replace"');
    expect(createAppBackupFilename(payload.exportedAt)).toBe(
      'farmrpg-tools-backup-2026-03-21T10-30-00-000Z.json',
    );
  });

  it('downloads the assembled backup payload as one JSON file', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    const clickSpy = vi.fn();

    mockListSnapshots.mockResolvedValue([createSnapshot('snapshot-1')]);
    mockLoadCraftingModifierState.mockReturnValue(createModifierStateFixture());
    mockReadStoredAppTheme.mockReturnValue(null);

    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:backup'),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return {
          click: clickSpy,
          set href(_: string) {},
          set download(_: string) {},
        } as unknown as HTMLAnchorElement;
      }

      return originalCreateElement(tagName);
    });

    const result = await exportCurrentAppBackupFile({
      exportedAt: '2026-03-21T10:30:00.000Z',
      appVersion: '1.1.0',
    });

    expect(result.filename).toBe('farmrpg-tools-backup-2026-03-21T10-30-00-000Z.json');
    expect(result.content).toContain('"schemaVersion": 1');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const createObjectUrlMock = vi.mocked(URL.createObjectURL);
    const blobArg = createObjectUrlMock.mock.calls[0]?.[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg?.type).toBe(APP_BACKUP_EXPORT_MIME_TYPE);

    createElementSpy.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', {
      value: originalCreateObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: originalRevokeObjectURL,
      writable: true,
      configurable: true,
    });
  });
});
