import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockReplaceSnapshots,
  mockListSnapshots,
  mockSaveCraftingModifierState,
  mockLoadCraftingModifierState,
  mockClearCraftingModifierState,
  mockSaveAcquisitionPlannerInputState,
  mockLoadAcquisitionPlannerInputState,
  mockClearAcquisitionPlannerInputState,
  mockSaveDropRateAcquisitionSettings,
  mockLoadDropRateAcquisitionSettings,
  mockClearDropRateAcquisitionSettings,
  mockSavePumpkinJuicePlannerState,
  mockLoadPumpkinJuicePlannerState,
  mockClearPumpkinJuicePlannerState,
  mockSavePersonalMasteryGoalsState,
  mockLoadPersonalMasteryGoalsState,
  mockClearPersonalMasteryGoalsState,
  mockSaveMasteryRaceCountsState,
  mockLoadMasteryRaceCountsState,
  mockClearMasteryRaceCountsState,
  mockSaveMuseumCompletionState,
  mockLoadMuseumCompletionState,
  mockClearMuseumCompletionState,
  mockPersistAppTheme,
  mockClearStoredAppTheme,
  mockReadStoredAppTheme,
} = vi.hoisted(() => ({
  mockReplaceSnapshots: vi.fn(),
  mockListSnapshots: vi.fn(),
  mockSaveCraftingModifierState: vi.fn(),
  mockLoadCraftingModifierState: vi.fn(),
  mockClearCraftingModifierState: vi.fn(),
  mockSaveAcquisitionPlannerInputState: vi.fn(),
  mockLoadAcquisitionPlannerInputState: vi.fn(),
  mockClearAcquisitionPlannerInputState: vi.fn(),
  mockSaveDropRateAcquisitionSettings: vi.fn(),
  mockLoadDropRateAcquisitionSettings: vi.fn(),
  mockClearDropRateAcquisitionSettings: vi.fn(),
  mockSavePumpkinJuicePlannerState: vi.fn(),
  mockLoadPumpkinJuicePlannerState: vi.fn(),
  mockClearPumpkinJuicePlannerState: vi.fn(),
  mockSavePersonalMasteryGoalsState: vi.fn(),
  mockLoadPersonalMasteryGoalsState: vi.fn(),
  mockClearPersonalMasteryGoalsState: vi.fn(),
  mockSaveMasteryRaceCountsState: vi.fn(),
  mockLoadMasteryRaceCountsState: vi.fn(),
  mockClearMasteryRaceCountsState: vi.fn(),
  mockSaveMuseumCompletionState: vi.fn(),
  mockLoadMuseumCompletionState: vi.fn(),
  mockClearMuseumCompletionState: vi.fn(),
  mockPersistAppTheme: vi.fn(),
  mockClearStoredAppTheme: vi.fn(),
  mockReadStoredAppTheme: vi.fn(),
}));

vi.mock('./storage/masterySnapshots', () => ({
  replaceSnapshots: mockReplaceSnapshots,
  listSnapshots: mockListSnapshots,
}));

vi.mock('./craftingModifierState', () => ({
  loadCraftingModifierState: mockLoadCraftingModifierState,
  saveCraftingModifierState: mockSaveCraftingModifierState,
  clearCraftingModifierState: mockClearCraftingModifierState,
}));

vi.mock('./acquisitionPlannerState', () => ({
  loadAcquisitionPlannerInputState: mockLoadAcquisitionPlannerInputState,
  saveAcquisitionPlannerInputState: mockSaveAcquisitionPlannerInputState,
  clearAcquisitionPlannerInputState: mockClearAcquisitionPlannerInputState,
}));

vi.mock('./dropRateAcquisitionSettings', () => ({
  loadDropRateAcquisitionSettings: mockLoadDropRateAcquisitionSettings,
  saveDropRateAcquisitionSettings: mockSaveDropRateAcquisitionSettings,
  clearDropRateAcquisitionSettings: mockClearDropRateAcquisitionSettings,
}));

vi.mock('./pumpkinJuicePlannerState', () => ({
  loadPumpkinJuicePlannerState: mockLoadPumpkinJuicePlannerState,
  savePumpkinJuicePlannerState: mockSavePumpkinJuicePlannerState,
  clearPumpkinJuicePlannerState: mockClearPumpkinJuicePlannerState,
}));

vi.mock('./personalMasteryGoals', () => ({
  loadPersonalMasteryGoalsState: mockLoadPersonalMasteryGoalsState,
  savePersonalMasteryGoalsState: mockSavePersonalMasteryGoalsState,
  clearPersonalMasteryGoalsState: mockClearPersonalMasteryGoalsState,
}));

vi.mock('./masteryRaceCounts', () => ({
  loadMasteryRaceCountsState: mockLoadMasteryRaceCountsState,
  saveMasteryRaceCountsState: mockSaveMasteryRaceCountsState,
  clearMasteryRaceCountsState: mockClearMasteryRaceCountsState,
}));

vi.mock('./museumCompletionState', () => ({
  loadMuseumCompletionState: mockLoadMuseumCompletionState,
  saveMuseumCompletionState: mockSaveMuseumCompletionState,
  clearMuseumCompletionState: mockClearMuseumCompletionState,
}));

vi.mock('./themePreference', () => ({
  persistAppTheme: mockPersistAppTheme,
  clearStoredAppTheme: mockClearStoredAppTheme,
  readStoredAppTheme: mockReadStoredAppTheme,
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
    acquisitionPlannerState: createAcquisitionPlannerStateFixture(),
    dropRateAcquisitionSettings: createDropRateAcquisitionSettingsFixture(),
    pumpkinJuicePlannerState: createPumpkinJuicePlannerStateFixture(),
    personalMasteryGoalsState: createPersonalMasteryGoalsStateFixture(),
    masteryRaceCountsState: createMasteryRaceCountsStateFixture(),
    museumCompletionState: createMuseumCompletionStateFixture(),
    themePreference: 'dark',
  });
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
      runeCubeActive: true,
      availableStamina: 1000,
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
          canonicalItemKey: 'large chest',
          itemName: 'Large Chest',
          ownedCount: 2,
          sourceCategory: 'container',
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
    ownedPumpkinJuiceCount: 7,
    valueThresholds: {
      enabled: false,
      minNextApSaved: 0,
      minTotalApSaved: 0,
      minNextStaminaSaved: 0,
      minTotalStaminaSaved: 0,
    },
  };
}

function createDropRateAcquisitionSettingsFixture() {
  return {
    schemaVersion: 1 as const,
    perks: {
      ironDepotActive: true,
      wandererPercent: 33,
      cinnamonSticksActive: true,
      lemonSqueezerActive: true,
      reinforcedNettingActive: true,
      fishingTrawlActive: true,
      resourceSaverPercent: 45,
      eagleEyeRunecubeActive: true,
    },
    units: {
      exploring: 'arnold_palmers' as const,
      fishing: 'large_nets' as const,
      farming: 'crops' as const,
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

function createMuseumCompletionStateFixture() {
  return {
    schemaVersion: 1 as const,
    savedAt: '2026-05-12T12:00:00.000Z',
    fullMuseumText: 'Crops Count = 1\nBeet Beet',
    personalMuseumText: 'Crops (0 / 1)\n-',
    manualMissingItems: [
      {
        id: 'manual-board',
        categoryKey: 'items',
        categoryName: 'Items',
        itemName: 'Board',
        canonicalKey: 'board',
        slotCount: 1,
        note: 'manual review',
      },
    ],
  };
}

describe('appBackupRestore', () => {
  beforeEach(() => {
    mockReplaceSnapshots.mockReset();
    mockListSnapshots.mockReset();
    mockSaveCraftingModifierState.mockReset();
    mockLoadCraftingModifierState.mockReset();
    mockClearCraftingModifierState.mockReset();
    mockSaveAcquisitionPlannerInputState.mockReset();
    mockLoadAcquisitionPlannerInputState.mockReset();
    mockClearAcquisitionPlannerInputState.mockReset();
    mockSaveDropRateAcquisitionSettings.mockReset();
    mockLoadDropRateAcquisitionSettings.mockReset();
    mockClearDropRateAcquisitionSettings.mockReset();
    mockSavePumpkinJuicePlannerState.mockReset();
    mockLoadPumpkinJuicePlannerState.mockReset();
    mockClearPumpkinJuicePlannerState.mockReset();
    mockSavePersonalMasteryGoalsState.mockReset();
    mockLoadPersonalMasteryGoalsState.mockReset();
    mockClearPersonalMasteryGoalsState.mockReset();
    mockSaveMasteryRaceCountsState.mockReset();
    mockLoadMasteryRaceCountsState.mockReset();
    mockClearMasteryRaceCountsState.mockReset();
    mockSaveMuseumCompletionState.mockReset();
    mockLoadMuseumCompletionState.mockReset();
    mockClearMuseumCompletionState.mockReset();
    mockPersistAppTheme.mockReset();
    mockClearStoredAppTheme.mockReset();
    mockReadStoredAppTheme.mockReset();
    mockListSnapshots.mockResolvedValue([]);
    mockLoadCraftingModifierState.mockReturnValue(createModifierStateFixture());
    mockLoadAcquisitionPlannerInputState.mockReturnValue(createAcquisitionPlannerStateFixture());
    mockLoadDropRateAcquisitionSettings.mockReturnValue(createDropRateAcquisitionSettingsFixture());
    mockLoadPumpkinJuicePlannerState.mockReturnValue(createPumpkinJuicePlannerStateFixture());
    mockLoadPersonalMasteryGoalsState.mockReturnValue(createPersonalMasteryGoalsStateFixture());
    mockLoadMasteryRaceCountsState.mockReturnValue(createMasteryRaceCountsStateFixture());
    mockLoadMuseumCompletionState.mockReturnValue(createMuseumCompletionStateFixture());
    mockReadStoredAppTheme.mockReturnValue('light');
  });

  it('reads a valid backup file using the shared backup schema contract', async () => {
    const payload = createBackupPayload();
    const file = {
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    } as unknown as File;

    await expect(readAppBackupFile(file)).resolves.toEqual(payload);
  });

  it('reads legacy backup snapshots after normalizing missing summary fields', async () => {
    const legacyPayload = createBackupPayload();
    const legacyParseSummary = legacyPayload.state.snapshots[0].parseSummary as unknown as Record<string, unknown>;
    delete legacyParseSummary.parsedRowsCount;
    delete legacyParseSummary.duplicateRowsCount;
    delete legacyParseSummary.skippedNonItemLinesCount;
    delete legacyParseSummary.skippedNonItemLineSamples;

    const file = {
      text: vi.fn().mockResolvedValue(JSON.stringify(legacyPayload)),
    } as unknown as File;

    const restoredPayload = await readAppBackupFile(file);

    expect(restoredPayload.state.snapshots[0].parseSummary).toMatchObject({
      parsedRowsCount: 1,
      duplicateRowsCount: 0,
      skippedNonItemLinesCount: 0,
      skippedNonItemLineSamples: [],
    });
  });

  it('restores supported local state categories with replace-style behavior', async () => {
    const payload = createBackupPayload();

    await restoreAppBackupPayload(payload);

    expect(mockReplaceSnapshots).toHaveBeenCalledWith(payload.state.snapshots);
    expect(mockSaveCraftingModifierState).toHaveBeenCalledWith(
      payload.state.preferences.craftingModifierState,
    );
    expect(mockSaveAcquisitionPlannerInputState).toHaveBeenCalledWith(
      payload.state.preferences.acquisitionPlannerState,
    );
    expect(mockSaveDropRateAcquisitionSettings).toHaveBeenCalledWith(
      payload.state.preferences.dropRateAcquisitionSettings,
    );
    expect(mockSavePumpkinJuicePlannerState).toHaveBeenCalledWith(
      payload.state.preferences.pumpkinJuicePlannerState,
    );
    expect(mockSavePersonalMasteryGoalsState).toHaveBeenCalledWith(
      payload.state.preferences.personalMasteryGoalsState,
    );
    expect(mockSaveMasteryRaceCountsState).toHaveBeenCalledWith(
      payload.state.preferences.masteryRaceCountsState,
    );
    expect(mockSaveMuseumCompletionState).toHaveBeenCalledWith(
      payload.state.preferences.museumCompletionState,
    );
    expect(mockPersistAppTheme).toHaveBeenCalledWith('dark');
    expect(mockClearCraftingModifierState).not.toHaveBeenCalled();
    expect(mockClearAcquisitionPlannerInputState).not.toHaveBeenCalled();
    expect(mockClearDropRateAcquisitionSettings).not.toHaveBeenCalled();
    expect(mockClearPumpkinJuicePlannerState).not.toHaveBeenCalled();
    expect(mockClearPersonalMasteryGoalsState).not.toHaveBeenCalled();
    expect(mockClearMasteryRaceCountsState).not.toHaveBeenCalled();
    expect(mockClearMuseumCompletionState).not.toHaveBeenCalled();
    expect(mockClearStoredAppTheme).not.toHaveBeenCalled();
  });

  it('clears nullable preference categories when the backup payload omits them', async () => {
    const payload = createAppBackupPayload({
      appVersion: '1.1.0',
      exportedAt: '2026-03-21T11:00:00.000Z',
      snapshots: [],
      craftingModifierState: null,
      acquisitionPlannerState: null,
      dropRateAcquisitionSettings: null,
      pumpkinJuicePlannerState: null,
      personalMasteryGoalsState: null,
      masteryRaceCountsState: null,
      museumCompletionState: null,
      themePreference: null,
    });

    await restoreAppBackupPayload(payload);

    expect(mockReplaceSnapshots).toHaveBeenCalledWith([]);
    expect(mockClearCraftingModifierState).toHaveBeenCalledTimes(1);
    expect(mockClearAcquisitionPlannerInputState).toHaveBeenCalledTimes(1);
    expect(mockClearDropRateAcquisitionSettings).toHaveBeenCalledTimes(1);
    expect(mockClearPumpkinJuicePlannerState).toHaveBeenCalledTimes(1);
    expect(mockClearPersonalMasteryGoalsState).toHaveBeenCalledTimes(1);
    expect(mockClearMasteryRaceCountsState).toHaveBeenCalledTimes(1);
    expect(mockClearMuseumCompletionState).toHaveBeenCalledTimes(1);
    expect(mockClearStoredAppTheme).toHaveBeenCalledTimes(1);
  });

  it('rejects obviously invalid backup files safely', async () => {
    const invalidJsonFile = {
      text: vi.fn().mockResolvedValue('not-json'),
    } as unknown as File;
    const wrongShapeFile = {
      text: vi.fn().mockResolvedValue('{"kind":"nope"}'),
    } as unknown as File;
    const unsupportedVersionFile = {
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          kind: 'farmrpg-tools-backup',
          schemaVersion: 2,
          appVersion: '1.1.0',
          exportedAt: '2026-03-21T11:00:00.000Z',
          profileId: 'default',
          restoreStrategy: 'replace',
          state: {
            snapshots: [],
            preferences: {
              craftingModifierState: null,
              acquisitionPlannerState: null,
              themePreference: 'dark',
            },
          },
        }),
      ),
    } as unknown as File;
    const missingSnapshotsFile = {
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          kind: 'farmrpg-tools-backup',
          schemaVersion: 1,
          appVersion: '1.1.0',
          exportedAt: '2026-03-21T11:00:00.000Z',
          profileId: 'default',
          restoreStrategy: 'replace',
          state: {
            preferences: {
              craftingModifierState: null,
              acquisitionPlannerState: null,
              themePreference: 'dark',
            },
          },
        }),
      ),
    } as unknown as File;

    await expect(readAppBackupFile(invalidJsonFile)).rejects.toThrow(
      'The selected file is not valid JSON.',
    );
    await expect(readAppBackupFile(wrongShapeFile)).rejects.toThrow(
      'The selected file is not a FarmRPG Tools backup.',
    );
    await expect(readAppBackupFile(unsupportedVersionFile)).rejects.toThrow(
      'Backup schema version 2 is not supported by this app.',
    );
    await expect(readAppBackupFile(missingSnapshotsFile)).rejects.toThrow(
      'The backup file is missing the required snapshots section.',
    );
  });

  it('rolls back to the previous local state if a restore write step fails', async () => {
    const payload = createBackupPayload();
    const previousSnapshots = [
      {
        snapshotId: 'snapshot-old',
        createdAt: '2026-03-20T10:00:00.000Z',
        savedAt: '2026-03-20T10:00:00.000Z',
        importedAt: '2026-03-20T10:00:00.000Z',
        rawText: 'old',
        masteryByItem: { rope: 100_000 },
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
    ];
    const previousModifierState = createModifierStateFixture();
    const previousAcquisitionPlannerState = createAcquisitionPlannerStateFixture();
    const previousDropRateAcquisitionSettings = createDropRateAcquisitionSettingsFixture();
    const previousPumpkinJuicePlannerState = createPumpkinJuicePlannerStateFixture();
    const previousPersonalMasteryGoalsState = createPersonalMasteryGoalsStateFixture();
    const previousMasteryRaceCountsState = createMasteryRaceCountsStateFixture();
    const previousMuseumCompletionState = createMuseumCompletionStateFixture();

    mockListSnapshots.mockResolvedValue(previousSnapshots);
    mockLoadCraftingModifierState.mockReturnValue(previousModifierState);
    mockLoadAcquisitionPlannerInputState.mockReturnValue(previousAcquisitionPlannerState);
    mockLoadDropRateAcquisitionSettings.mockReturnValue(previousDropRateAcquisitionSettings);
    mockLoadPumpkinJuicePlannerState.mockReturnValue(previousPumpkinJuicePlannerState);
    mockLoadPersonalMasteryGoalsState.mockReturnValue(previousPersonalMasteryGoalsState);
    mockLoadMasteryRaceCountsState.mockReturnValue(previousMasteryRaceCountsState);
    mockLoadMuseumCompletionState.mockReturnValue(previousMuseumCompletionState);
    mockReadStoredAppTheme.mockReturnValue('dark');
    mockSaveCraftingModifierState
      .mockImplementationOnce(() => {
        throw new Error('storage write failed');
      })
      .mockImplementation(() => undefined);

    await expect(restoreAppBackupPayload(payload)).rejects.toThrow(
      'Unable to restore the selected backup file. Your current local state was left unchanged.',
    );

    expect(mockReplaceSnapshots).toHaveBeenNthCalledWith(1, payload.state.snapshots);
    expect(mockReplaceSnapshots).toHaveBeenNthCalledWith(2, previousSnapshots);
    expect(mockSaveCraftingModifierState).toHaveBeenLastCalledWith(previousModifierState);
    expect(mockSaveAcquisitionPlannerInputState).toHaveBeenLastCalledWith(previousAcquisitionPlannerState);
    expect(mockSaveDropRateAcquisitionSettings).toHaveBeenLastCalledWith(previousDropRateAcquisitionSettings);
    expect(mockSavePumpkinJuicePlannerState).toHaveBeenLastCalledWith(previousPumpkinJuicePlannerState);
    expect(mockSavePersonalMasteryGoalsState).toHaveBeenLastCalledWith(previousPersonalMasteryGoalsState);
    expect(mockSaveMasteryRaceCountsState).toHaveBeenLastCalledWith(previousMasteryRaceCountsState);
    expect(mockSaveMuseumCompletionState).toHaveBeenLastCalledWith(previousMuseumCompletionState);
    expect(mockPersistAppTheme).toHaveBeenLastCalledWith('dark');
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
