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

export type AppBackupPayloadValidationErrorCode =
  | 'invalid_payload'
  | 'invalid_kind'
  | 'missing_schema_version'
  | 'unsupported_schema_version'
  | 'missing_restore_strategy'
  | 'unsupported_restore_strategy'
  | 'unsupported_profile'
  | 'missing_app_version'
  | 'missing_exported_at'
  | 'missing_state'
  | 'missing_snapshots'
  | 'invalid_snapshot'
  | 'missing_preferences'
  | 'invalid_theme_preference'
  | 'invalid_modifier_state';

export type AppBackupPayloadValidationResult =
  | { ok: true; payload: AppBackupPayloadV1 }
  | { ok: false; code: AppBackupPayloadValidationErrorCode; message: string };

function isBoolean(value: unknown): value is boolean {
  return value === true || value === false;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

function isValidThemePreference(value: unknown): value is AppTheme | null {
  return value === null || value === 'light' || value === 'dark';
}

function isValidCraftingModifierState(value: unknown): value is UserCraftingModifierState {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }

  const persistent = value.persistent;
  const temporary = value.temporary;
  const planning = value.planning;

  if (!isRecord(persistent) || !isRecord(temporary) || !isRecord(planning)) {
    return false;
  }

  return (
    isBoolean(persistent.resourceSaver1Unlocked) &&
    isBoolean(persistent.resourceSaver2Unlocked) &&
    isBoolean(persistent.resourceSaver3Unlocked) &&
    isBoolean(temporary.mushroomStewActive) &&
    isFiniteNonNegativeNumber(temporary.eventMasteryBonusPercent) &&
    isFiniteNonNegativeNumber(temporary.eventResourceSaverBonusPercent) &&
    isBoolean(planning.includeExcludedRecipes) &&
    isBoolean(planning.ironDepotActive)
  );
}

function isValidParseSummary(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNonNegativeNumber(value.itemsParsed) &&
    isFiniteNonNegativeNumber(value.parsedRowsCount) &&
    isFiniteNonNegativeNumber(value.duplicateRowsCount) &&
    isFiniteNonNegativeNumber(value.skippedNonItemLinesCount) &&
    Array.isArray(value.skippedNonItemLineSamples) &&
    isFiniteNonNegativeNumber(value.unknownItemsCount) &&
    Array.isArray(value.tiersDetected) &&
    Array.isArray(value.warnings)
  );
}

function isValidMasteryByItem(value: unknown): boolean {
  if (!isStringRecord(value)) {
    return false;
  }

  return Object.values(value).every((entry) => isFiniteNonNegativeNumber(entry));
}

function isValidSnapshot(value: unknown): value is MasterySnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const savedAt = value.savedAt;
  const importedAt = value.importedAt;

  return (
    typeof value.snapshotId === 'string' &&
    value.snapshotId.length > 0 &&
    typeof value.createdAt === 'string' &&
    value.createdAt.length > 0 &&
    (savedAt === undefined || typeof savedAt === 'string') &&
    (importedAt === undefined || typeof importedAt === 'string') &&
    typeof value.rawText === 'string' &&
    isValidMasteryByItem(value.masteryByItem) &&
    isValidParseSummary(value.parseSummary)
  );
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

export function validateAppBackupPayloadV1(value: unknown): AppBackupPayloadValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      code: 'invalid_payload',
      message: 'The selected file is not a supported FarmRPG Tools backup.',
    };
  }

  if (value.kind !== APP_BACKUP_PAYLOAD_KIND) {
    return {
      ok: false,
      code: 'invalid_kind',
      message: 'The selected file is not a FarmRPG Tools backup.',
    };
  }

  if (!('schemaVersion' in value)) {
    return {
      ok: false,
      code: 'missing_schema_version',
      message: 'The backup file is missing required schema version metadata.',
    };
  }

  if (!isSupportedAppBackupSchemaVersion(value.schemaVersion)) {
    return {
      ok: false,
      code: 'unsupported_schema_version',
      message: `Backup schema version ${String(value.schemaVersion)} is not supported by this app.`,
    };
  }

  if (!('restoreStrategy' in value)) {
    return {
      ok: false,
      code: 'missing_restore_strategy',
      message: 'The backup file is missing required restore strategy metadata.',
    };
  }

  if (value.restoreStrategy !== APP_BACKUP_RESTORE_STRATEGY) {
    return {
      ok: false,
      code: 'unsupported_restore_strategy',
      message: 'The backup file uses an unsupported restore strategy.',
    };
  }

  if (value.profileId !== 'default') {
    return {
      ok: false,
      code: 'unsupported_profile',
      message: 'The backup file targets an unsupported profile for this app.',
    };
  }

  if (typeof value.appVersion !== 'string' || value.appVersion.length === 0) {
    return {
      ok: false,
      code: 'missing_app_version',
      message: 'The backup file is missing the exporting app version.',
    };
  }

  if (typeof value.exportedAt !== 'string' || value.exportedAt.length === 0) {
    return {
      ok: false,
      code: 'missing_exported_at',
      message: 'The backup file is missing the export timestamp.',
    };
  }

  if (!isRecord(value.state)) {
    return {
      ok: false,
      code: 'missing_state',
      message: 'The backup file is missing the required backup state section.',
    };
  }

  if (!Array.isArray(value.state.snapshots)) {
    return {
      ok: false,
      code: 'missing_snapshots',
      message: 'The backup file is missing the required snapshots section.',
    };
  }

  if (!value.state.snapshots.every((snapshot) => isValidSnapshot(snapshot))) {
    return {
      ok: false,
      code: 'invalid_snapshot',
      message: 'The backup file contains malformed snapshot data.',
    };
  }

  if (!isRecord(value.state.preferences)) {
    return {
      ok: false,
      code: 'missing_preferences',
      message: 'The backup file is missing the required preferences section.',
    };
  }

  if (!isValidThemePreference(value.state.preferences.themePreference)) {
    return {
      ok: false,
      code: 'invalid_theme_preference',
      message: 'The backup file contains an unsupported theme preference value.',
    };
  }

  const craftingModifierState = value.state.preferences.craftingModifierState;
  if (craftingModifierState !== null && !isValidCraftingModifierState(craftingModifierState)) {
    return {
      ok: false,
      code: 'invalid_modifier_state',
      message: 'The backup file contains malformed crafting or planner modifier state.',
    };
  }

  return {
    ok: true,
    payload: value as AppBackupPayloadV1,
  };
}

export function isAppBackupPayloadV1(value: unknown): value is AppBackupPayloadV1 {
  return validateAppBackupPayloadV1(value).ok;
}
