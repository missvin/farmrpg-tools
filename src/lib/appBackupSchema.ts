import type { UserCraftingModifierState } from './craftingModifierState';
import type { AppTheme } from './themePreference';
import type { MasterySnapshot } from './storage/masterySnapshots';

export const APP_BACKUP_PAYLOAD_KIND = 'farmrpg-tools-backup';
export const APP_BACKUP_SCHEMA_VERSION = 1;
export const APP_BACKUP_RESTORE_STRATEGY = 'replace';

export type AppBackupPayloadKind = typeof APP_BACKUP_PAYLOAD_KIND;
export type AppBackupSchemaVersion = typeof APP_BACKUP_SCHEMA_VERSION;
export type AppBackupRestoreStrategy = typeof APP_BACKUP_RESTORE_STRATEGY;

export type AppBackupStateV1 = {
  snapshots: MasterySnapshot[];
  preferences: {
    craftingModifierState: UserCraftingModifierState | null;
    themePreference: AppTheme | null;
  };
};

export type AppBackupPayloadV1 = {
  kind: AppBackupPayloadKind;
  schemaVersion: AppBackupSchemaVersion;
  appVersion: string;
  exportedAt: string;
  profileId: 'default';
  restoreStrategy: AppBackupRestoreStrategy;
  state: AppBackupStateV1;
};

export type CreateAppBackupPayloadInput = {
  appVersion: string;
  exportedAt: string;
  snapshots: MasterySnapshot[];
  craftingModifierState: UserCraftingModifierState | null;
  themePreference: AppTheme | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createAppBackupPayload(input: CreateAppBackupPayloadInput): AppBackupPayloadV1 {
  return {
    kind: APP_BACKUP_PAYLOAD_KIND,
    schemaVersion: APP_BACKUP_SCHEMA_VERSION,
    appVersion: input.appVersion,
    exportedAt: input.exportedAt,
    profileId: 'default',
    // v1 restore is intentionally replace-style rather than merge-heavy.
    restoreStrategy: APP_BACKUP_RESTORE_STRATEGY,
    state: {
      snapshots: [...input.snapshots],
      preferences: {
        craftingModifierState: input.craftingModifierState,
        themePreference: input.themePreference,
      },
    },
  };
}

export function isSupportedAppBackupSchemaVersion(
  value: unknown,
): value is AppBackupSchemaVersion {
  return value === APP_BACKUP_SCHEMA_VERSION;
}

export function isAppBackupPayloadV1(value: unknown): value is AppBackupPayloadV1 {
  if (!isRecord(value)) {
    return false;
  }

  if (value.kind !== APP_BACKUP_PAYLOAD_KIND) {
    return false;
  }

  if (!isSupportedAppBackupSchemaVersion(value.schemaVersion)) {
    return false;
  }

  if (value.restoreStrategy !== APP_BACKUP_RESTORE_STRATEGY) {
    return false;
  }

  if (value.profileId !== 'default') {
    return false;
  }

  if (typeof value.appVersion !== 'string' || value.appVersion.length === 0) {
    return false;
  }

  if (typeof value.exportedAt !== 'string' || value.exportedAt.length === 0) {
    return false;
  }

  if (!isRecord(value.state)) {
    return false;
  }

  if (!Array.isArray(value.state.snapshots)) {
    return false;
  }

  if (!isRecord(value.state.preferences)) {
    return false;
  }

  const themePreference = value.state.preferences.themePreference;
  if (themePreference !== null && themePreference !== 'light' && themePreference !== 'dark') {
    return false;
  }

  const craftingModifierState = value.state.preferences.craftingModifierState;
  if (craftingModifierState !== null && !isRecord(craftingModifierState)) {
    return false;
  }

  return true;
}
