import { describe, expect, it } from 'vitest';

import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { createDefaultDropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import { createDefaultPumpkinJuicePlannerState } from './pumpkinJuicePlannerState';
import {
  APP_BACKUP_PAYLOAD_KIND,
  APP_BACKUP_RESTORE_STRATEGY,
  APP_BACKUP_SCHEMA_VERSION,
  createAppBackupPayload,
  isAppBackupPayloadV1,
  isSupportedAppBackupSchemaVersion,
  validateAppBackupPayloadV1,
} from './appBackupSchema';
import type { MasterySnapshot } from './storage/masterySnapshots';

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

function createAcquisitionPlannerStateFixture() {
  return {
    ...createDefaultAcquisitionPlannerInputState(),
    explore: {
      runeCubeActive: true,
      availableStamina: 0,
      wandererPercent: 0,
      exploringEffectivenessPercent: 0,
      cinnamonSticksActive: false,
      neighActive: false,
    },
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
  };
}

describe('appBackupSchema', () => {
  it('creates a versioned full-app backup payload with the current v1 state categories', () => {
    const snapshots = [createSnapshot('snapshot-1'), createSnapshot('snapshot-2')];
    const craftingModifierState = {
      ...createDefaultCraftingModifierState(),
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: false,
      },
    };
    const acquisitionPlannerState = createAcquisitionPlannerStateFixture();
    const dropRateAcquisitionSettings = createDefaultDropRateAcquisitionSettings();
    const pumpkinJuicePlannerState = createDefaultPumpkinJuicePlannerState();
    const personalMasteryGoalsState = {
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
    const masteryRaceCountsState = {
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
    const museumCompletionState = {
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

    const payload = createAppBackupPayload({
      appVersion: '1.1.0',
      exportedAt: '2026-03-21T09:00:00.000Z',
      snapshots,
      craftingModifierState,
      acquisitionPlannerState,
      dropRateAcquisitionSettings,
      pumpkinJuicePlannerState,
      personalMasteryGoalsState,
      masteryRaceCountsState,
      museumCompletionState,
      themePreference: 'dark',
    });

    expect(payload).toEqual({
      kind: APP_BACKUP_PAYLOAD_KIND,
      schemaVersion: APP_BACKUP_SCHEMA_VERSION,
      appVersion: '1.1.0',
      exportedAt: '2026-03-21T09:00:00.000Z',
      profileId: 'default',
      restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
      state: {
        snapshots,
        preferences: {
          craftingModifierState,
          acquisitionPlannerState,
          dropRateAcquisitionSettings,
          pumpkinJuicePlannerState,
          personalMasteryGoalsState,
          masteryRaceCountsState,
          museumCompletionState,
          themePreference: 'dark',
        },
      },
    });
  });

  it('recognizes supported schema version and the current payload shape', () => {
    const payload = createAppBackupPayload({
      appVersion: '1.1.0',
      exportedAt: '2026-03-21T09:00:00.000Z',
      snapshots: [createSnapshot('snapshot-1')],
      craftingModifierState: createDefaultCraftingModifierState(),
      acquisitionPlannerState: createAcquisitionPlannerStateFixture(),
      themePreference: 'light',
    });

    expect(isSupportedAppBackupSchemaVersion(1)).toBe(true);
    expect(isSupportedAppBackupSchemaVersion(2)).toBe(false);
    expect(isAppBackupPayloadV1(payload)).toBe(true);
  });

  it('normalizes missing legacy snapshot summary fields during validation', () => {
    const legacySnapshot = createSnapshot('legacy-snapshot') as unknown as Record<string, unknown>;
    legacySnapshot.parsedRows = [{ rawItemName: 'Twine' }, { rawItemName: 'Rope' }];

    const legacyParseSummary = {
      ...(legacySnapshot.parseSummary as Record<string, unknown>),
    };
    delete legacyParseSummary.parsedRowsCount;
    delete legacyParseSummary.duplicateRowsCount;
    delete legacyParseSummary.skippedNonItemLinesCount;
    delete legacyParseSummary.skippedNonItemLineSamples;
    legacySnapshot.parseSummary = legacyParseSummary;

    const payload = createAppBackupPayload({
      appVersion: '1.1.0',
      exportedAt: '2026-03-21T09:00:00.000Z',
      snapshots: [legacySnapshot as unknown as MasterySnapshot],
      craftingModifierState: createDefaultCraftingModifierState(),
      acquisitionPlannerState: createAcquisitionPlannerStateFixture(),
      themePreference: 'dark',
    });

    const validationResult = validateAppBackupPayloadV1(payload);

    expect(validationResult.ok).toBe(true);
    if (!validationResult.ok) {
      throw new Error(validationResult.message);
    }

    expect(validationResult.payload.state.snapshots[0].parseSummary).toMatchObject({
      parsedRowsCount: 2,
      duplicateRowsCount: 0,
      skippedNonItemLinesCount: 0,
      skippedNonItemLineSamples: [],
    });
  });

  it('still rejects present malformed snapshot summary fields', () => {
    const malformedSnapshot = createSnapshot('malformed-snapshot');
    (malformedSnapshot.parseSummary as unknown as Record<string, unknown>).duplicateRowsCount = '0';

    const payload = createAppBackupPayload({
      appVersion: '1.1.0',
      exportedAt: '2026-03-21T09:00:00.000Z',
      snapshots: [malformedSnapshot],
      craftingModifierState: createDefaultCraftingModifierState(),
      acquisitionPlannerState: createAcquisitionPlannerStateFixture(),
      themePreference: 'dark',
    });

    expect(validateAppBackupPayloadV1(payload)).toEqual({
      ok: false,
      code: 'invalid_snapshot',
      message: 'The backup file contains malformed snapshot data.',
    });
  });

  it('rejects malformed or incompatible payloads at the schema boundary', () => {
    expect(isAppBackupPayloadV1(null)).toBe(false);
    expect(
      isAppBackupPayloadV1({
        kind: APP_BACKUP_PAYLOAD_KIND,
        schemaVersion: 999,
        appVersion: '1.1.0',
        exportedAt: '2026-03-21T09:00:00.000Z',
        profileId: 'default',
        restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
        state: {
          snapshots: [],
          preferences: {
            craftingModifierState: null,
            acquisitionPlannerState: null,
            themePreference: 'dark',
          },
        },
      }),
    ).toBe(false);
    expect(
      isAppBackupPayloadV1({
        kind: APP_BACKUP_PAYLOAD_KIND,
        schemaVersion: APP_BACKUP_SCHEMA_VERSION,
        appVersion: '1.1.0',
        exportedAt: '2026-03-21T09:00:00.000Z',
        profileId: 'default',
        restoreStrategy: 'merge',
        state: {
          snapshots: [],
          preferences: {
            craftingModifierState: null,
            acquisitionPlannerState: null,
            themePreference: 'dark',
          },
        },
      }),
    ).toBe(false);
    expect(
      isAppBackupPayloadV1({
        kind: APP_BACKUP_PAYLOAD_KIND,
        schemaVersion: APP_BACKUP_SCHEMA_VERSION,
        appVersion: '1.1.0',
        exportedAt: '2026-03-21T09:00:00.000Z',
        profileId: 'default',
        restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
        state: {
          snapshots: [],
          preferences: {
            craftingModifierState: null,
            acquisitionPlannerState: null,
            themePreference: 'sepia',
          },
        },
      }),
    ).toBe(false);
  });

  it('returns explicit validation messages for unsupported versions and malformed state', () => {
    expect(
      validateAppBackupPayloadV1({
        kind: APP_BACKUP_PAYLOAD_KIND,
        schemaVersion: 2,
        appVersion: '1.1.0',
        exportedAt: '2026-03-21T09:00:00.000Z',
        profileId: 'default',
        restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
        state: {
          snapshots: [],
          preferences: {
            craftingModifierState: null,
            acquisitionPlannerState: null,
            themePreference: 'dark',
          },
        },
      }),
    ).toEqual({
      ok: false,
      code: 'unsupported_schema_version',
      message: 'Backup schema version 2 is not supported by this app.',
    });

    expect(
      validateAppBackupPayloadV1({
        kind: APP_BACKUP_PAYLOAD_KIND,
        schemaVersion: APP_BACKUP_SCHEMA_VERSION,
        appVersion: '1.1.0',
        exportedAt: '2026-03-21T09:00:00.000Z',
        profileId: 'default',
        restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
        state: {
          snapshots: [{}],
          preferences: {
            craftingModifierState: null,
            acquisitionPlannerState: null,
            themePreference: 'dark',
          },
        },
      }),
    ).toEqual({
      ok: false,
      code: 'invalid_snapshot',
      message: 'The backup file contains malformed snapshot data.',
    });

    expect(
      validateAppBackupPayloadV1({
        kind: APP_BACKUP_PAYLOAD_KIND,
        schemaVersion: APP_BACKUP_SCHEMA_VERSION,
        appVersion: '1.1.0',
        exportedAt: '2026-03-21T09:00:00.000Z',
        profileId: 'default',
        restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
        state: {
          snapshots: [],
          preferences: {
            craftingModifierState: null,
            acquisitionPlannerState: {
              schemaVersion: 1,
              sourcePolicy: {
                planningHorizon: 'include_future',
                sourceOverrides: {},
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
                entries: [{ itemName: 'Bag', ownedCount: 2, sourceCategory: 'stockpile' }],
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
            },
            themePreference: 'dark',
          },
        },
      }),
    ).toEqual({
      ok: false,
      code: 'invalid_acquisition_planner_state',
      message: 'The backup file contains malformed acquisition planner state.',
    });

    expect(
      validateAppBackupPayloadV1({
        kind: APP_BACKUP_PAYLOAD_KIND,
        schemaVersion: APP_BACKUP_SCHEMA_VERSION,
        appVersion: '1.1.0',
        exportedAt: '2026-03-21T09:00:00.000Z',
        profileId: 'default',
        restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
        state: {
          snapshots: [],
          preferences: {
            craftingModifierState: null,
            acquisitionPlannerState: null,
            dropRateAcquisitionSettings: {
              ...createDefaultDropRateAcquisitionSettings(),
              perks: {
                ...createDefaultDropRateAcquisitionSettings().perks,
                resourceSaverPercent: 150,
              },
            },
            themePreference: 'dark',
          },
        },
      }),
    ).toEqual({
      ok: false,
      code: 'invalid_drop_rate_acquisition_settings',
      message: 'The backup file contains malformed drop-rate acquisition settings.',
    });

    expect(
      validateAppBackupPayloadV1({
        kind: APP_BACKUP_PAYLOAD_KIND,
        schemaVersion: APP_BACKUP_SCHEMA_VERSION,
        appVersion: '1.1.0',
        exportedAt: '2026-03-21T09:00:00.000Z',
        profileId: 'default',
        restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
        state: {
          snapshots: [],
          preferences: {
            craftingModifierState: null,
            acquisitionPlannerState: null,
            museumCompletionState: {
              schemaVersion: 1,
              savedAt: null,
              fullMuseumText: '',
              personalMuseumText: '',
              manualMissingItems: [
                {
                  id: 'manual-board',
                  categoryKey: 'items',
                  categoryName: 'Items',
                  itemName: 'Board',
                  canonicalKey: 'board',
                  slotCount: 0,
                  note: 'manual review',
                },
              ],
            },
            themePreference: 'dark',
          },
        },
      }),
    ).toEqual({
      ok: false,
      code: 'invalid_museum_completion_state',
      message: 'The backup file contains malformed museum completion state.',
    });
  });
});
