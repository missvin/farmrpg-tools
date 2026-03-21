import { describe, expect, it } from 'vitest';

import { createDefaultCraftingModifierState } from './craftingModifierState';
import {
  APP_BACKUP_PAYLOAD_KIND,
  APP_BACKUP_RESTORE_STRATEGY,
  APP_BACKUP_SCHEMA_VERSION,
  createAppBackupPayload,
  isAppBackupPayloadV1,
  isSupportedAppBackupSchemaVersion,
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

    const payload = createAppBackupPayload({
      appVersion: '1.1.0',
      exportedAt: '2026-03-21T09:00:00.000Z',
      snapshots,
      craftingModifierState,
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
      themePreference: 'light',
    });

    expect(isSupportedAppBackupSchemaVersion(1)).toBe(true);
    expect(isSupportedAppBackupSchemaVersion(2)).toBe(false);
    expect(isAppBackupPayloadV1(payload)).toBe(true);
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
            themePreference: 'sepia',
          },
        },
      }),
    ).toBe(false);
  });
});
