import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MasterySnapshot } from './storage/masterySnapshots';

const {
  mockListSnapshots,
  mockLoadCraftingModifierState,
  mockLoadAcquisitionPlannerInputState,
  mockLoadPumpkinJuicePlannerState,
  mockLoadPersonalMasteryGoalsState,
  mockLoadMasteryRaceCountsState,
  mockReadStoredAppTheme,
} = vi.hoisted(() => ({
  mockListSnapshots: vi.fn<() => Promise<MasterySnapshot[]>>(),
  mockLoadCraftingModifierState: vi.fn(),
  mockLoadAcquisitionPlannerInputState: vi.fn(),
  mockLoadPumpkinJuicePlannerState: vi.fn(),
  mockLoadPersonalMasteryGoalsState: vi.fn(),
  mockLoadMasteryRaceCountsState: vi.fn(),
  mockReadStoredAppTheme: vi.fn(),
}));

vi.mock('./storage/masterySnapshots', () => ({
  listSnapshots: mockListSnapshots,
}));

vi.mock('./craftingModifierState', () => ({
  loadCraftingModifierState: mockLoadCraftingModifierState,
}));

vi.mock('./acquisitionPlannerState', () => ({
  loadAcquisitionPlannerInputState: mockLoadAcquisitionPlannerInputState,
}));

vi.mock('./pumpkinJuicePlannerState', () => ({
  loadPumpkinJuicePlannerState: mockLoadPumpkinJuicePlannerState,
}));

vi.mock('./personalMasteryGoals', () => ({
  loadPersonalMasteryGoalsState: mockLoadPersonalMasteryGoalsState,
}));

vi.mock('./masteryRaceCounts', () => ({
  loadMasteryRaceCountsState: mockLoadMasteryRaceCountsState,
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

function createAcquisitionPlannerStateFixture() {
  return {
    schemaVersion: 1 as const,
    sourcePolicy: {
      planningHorizon: 'include_future' as const,
      sourceOverrides: {
        manual_explore: 'default',
        stamina: 'default',
        apple_cider: 'default',
        lemonade: 'default',
        arnold_palmer: 'default',
        orange_juice: 'default',
        owned_containers: 'default',
        owned_stockpiles: 'default',
        stored_pet_inventory: 'default',
        future_pet_production: 'default',
        one_time_rewards: 'default',
        flea_market: 'default',
        exchange_center: 'default',
      },
    },
    explore: {
      runeCubeActive: false,
      availableStamina: 0,
      wandererPercent: 0,
      exploringEffectivenessPercent: 0,
      cinnamonSticksActive: false,
      neighActive: false,
    },
    consumables: {
      appleCider: { ownedCount: 0, craftableNowCount: 0, futureCraftableCount: 0 },
      lemonade: {
        ownedCount: 0,
        craftableNowCount: 0,
        futureCraftableCount: 0,
        lemonSqueezerActive: false,
        quandaryChowderActive: false,
      },
      arnoldPalmer: {
        ownedCount: 0,
        craftableNowCount: 0,
        futureCraftableCount: 0,
        lemonSqueezerActive: false,
        quandaryChowderActive: false,
        lemonSeltzerUsesRemaining: 0,
        lemonCreamPieActive: false,
      },
      orangeJuice: { ownedCount: 0, craftableNowCount: 0, futureCraftableCount: 0 },
    },
    ownedNow: {
      entries: [
        {
          canonicalItemKey: 'mystery bag',
          itemName: 'Mystery Bag',
          ownedCount: 3,
          sourceCategory: 'stockpile',
        },
      ],
    },
    pets: {
      storedInventoryEntries: [],
      futureProduction: {
        enabled: false,
        horizonDays: 7,
        entries: [],
        respectSeasonality: true,
        offlineHoursCap: 48,
        crunchyOmeletteActive: false,
      },
    },
  };
}

function createPumpkinJuicePlannerStateFixture() {
  return {
    schemaVersion: 1 as const,
    ownedPumpkinJuiceCount: 12,
    valueThresholds: {
      enabled: false,
      minNextApSaved: 0,
      minTotalApSaved: 0,
      minNextStaminaSaved: 0,
      minTotalStaminaSaved: 0,
    },
  };
}

function createPersonalMasteryGoalsStateFixture() {
  return {
    schemaVersion: 1 as const,
    goals: [
      {
        goalId: 'goal-1',
        itemName: 'Board',
        canonicalKey: 'board',
        targetTier: 'GM' as const,
        createdAt: '2026-05-08T00:00:00.000Z',
        updatedAt: '2026-05-08T00:00:00.000Z',
      },
    ],
  };
}

function createMasteryRaceCountsStateFixture() {
  return {
    schemaVersion: 1 as const,
    entries: [
      {
        canonicalKey: 'board',
        itemName: 'Board',
        masteredCount: 1000,
        grandMasteredCount: 42,
        megaMasteredCount: null,
        updatedAt: '2026-05-08T00:00:00.000Z',
      },
    ],
  };
}

describe('appBackupExport', () => {
  beforeEach(() => {
    mockListSnapshots.mockReset();
    mockLoadCraftingModifierState.mockReset();
    mockLoadAcquisitionPlannerInputState.mockReset();
    mockLoadPumpkinJuicePlannerState.mockReset();
    mockLoadPersonalMasteryGoalsState.mockReset();
    mockLoadMasteryRaceCountsState.mockReset();
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
    const acquisitionPlannerState = createAcquisitionPlannerStateFixture();
    const pumpkinJuicePlannerState = createPumpkinJuicePlannerStateFixture();
    const personalMasteryGoalsState = createPersonalMasteryGoalsStateFixture();
    const masteryRaceCountsState = createMasteryRaceCountsStateFixture();

    mockListSnapshots.mockResolvedValue(snapshots);
    mockLoadCraftingModifierState.mockReturnValue(craftingModifierState);
    mockLoadAcquisitionPlannerInputState.mockReturnValue(acquisitionPlannerState);
    mockLoadPumpkinJuicePlannerState.mockReturnValue(pumpkinJuicePlannerState);
    mockLoadPersonalMasteryGoalsState.mockReturnValue(personalMasteryGoalsState);
    mockLoadMasteryRaceCountsState.mockReturnValue(masteryRaceCountsState);
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
    expect(payload.state.preferences.acquisitionPlannerState).toEqual(acquisitionPlannerState);
    expect(payload.state.preferences.pumpkinJuicePlannerState).toEqual(pumpkinJuicePlannerState);
    expect(payload.state.preferences.personalMasteryGoalsState).toEqual(personalMasteryGoalsState);
    expect(payload.state.preferences.masteryRaceCountsState).toEqual(masteryRaceCountsState);
    expect(payload.state.preferences.themePreference).toBe('dark');
  });

  it('serializes a versioned backup payload and uses a timestamped filename', async () => {
    mockListSnapshots.mockResolvedValue([createSnapshot('snapshot-1')]);
    mockLoadCraftingModifierState.mockReturnValue(createModifierStateFixture());
    mockLoadAcquisitionPlannerInputState.mockReturnValue(createAcquisitionPlannerStateFixture());
    mockLoadPumpkinJuicePlannerState.mockReturnValue(createPumpkinJuicePlannerStateFixture());
    mockLoadPersonalMasteryGoalsState.mockReturnValue(createPersonalMasteryGoalsStateFixture());
    mockLoadMasteryRaceCountsState.mockReturnValue(createMasteryRaceCountsStateFixture());
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
    mockLoadAcquisitionPlannerInputState.mockReturnValue(createAcquisitionPlannerStateFixture());
    mockLoadPumpkinJuicePlannerState.mockReturnValue(createPumpkinJuicePlannerStateFixture());
    mockLoadPersonalMasteryGoalsState.mockReturnValue(createPersonalMasteryGoalsStateFixture());
    mockLoadMasteryRaceCountsState.mockReturnValue(createMasteryRaceCountsStateFixture());
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
