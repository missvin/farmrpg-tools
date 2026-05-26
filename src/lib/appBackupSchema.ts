import type { AcquisitionPlannerInputState } from './acquisitionPlannerState';
import type { UserCraftingModifierState } from './craftingModifierState';
import type { DropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import type { MasteryRaceCountsState } from './masteryRaceCounts';
import type { MuseumCompletionState } from './museumCompletionState';
import type { PersonalMasteryGoalsState } from './personalMasteryGoals';
import type { PumpkinJuicePlannerState } from './pumpkinJuicePlannerState';
import type { AppTheme } from './themePreference';
import type { MasterySnapshot } from './storage/masterySnapshots';
import type { TargetOutputPlannerState } from './targetOutputPlannerState';

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
    acquisitionPlannerState?: AcquisitionPlannerInputState | null;
    dropRateAcquisitionSettings?: DropRateAcquisitionSettings | null;
    pumpkinJuicePlannerState?: PumpkinJuicePlannerState | null;
    personalMasteryGoalsState?: PersonalMasteryGoalsState | null;
    masteryRaceCountsState?: MasteryRaceCountsState | null;
    museumCompletionState?: MuseumCompletionState | null;
    targetOutputPlannerState?: TargetOutputPlannerState | null;
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
  acquisitionPlannerState: AcquisitionPlannerInputState | null;
  dropRateAcquisitionSettings?: DropRateAcquisitionSettings | null;
  pumpkinJuicePlannerState?: PumpkinJuicePlannerState | null;
  personalMasteryGoalsState?: PersonalMasteryGoalsState | null;
  masteryRaceCountsState?: MasteryRaceCountsState | null;
  museumCompletionState?: MuseumCompletionState | null;
  targetOutputPlannerState?: TargetOutputPlannerState | null;
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
  | 'invalid_modifier_state'
  | 'invalid_acquisition_planner_state'
  | 'invalid_drop_rate_acquisition_settings'
  | 'invalid_pumpkin_juice_planner_state'
  | 'invalid_personal_mastery_goals_state'
  | 'invalid_mastery_race_counts_state'
  | 'invalid_museum_completion_state'
  | 'invalid_target_output_planner_state';

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

function isValidOwnedNowEntry(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.canonicalItemKey === 'string' &&
    value.canonicalItemKey.length > 0 &&
    typeof value.itemName === 'string' &&
    value.itemName.length > 0 &&
    isFiniteNonNegativeNumber(value.ownedCount) &&
    (value.sourceCategory === 'stockpile' || value.sourceCategory === 'container')
  );
}

function isValidStoredPetInventoryEntry(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.canonicalItemKey === 'string' &&
    value.canonicalItemKey.length > 0 &&
    typeof value.itemName === 'string' &&
    value.itemName.length > 0 &&
    isFiniteNonNegativeNumber(value.storedCount)
  );
}

function isValidFuturePetProductionEntry(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.canonicalItemKey === 'string' &&
    value.canonicalItemKey.length > 0 &&
    typeof value.itemName === 'string' &&
    value.itemName.length > 0 &&
    typeof value.petName === 'string' &&
    value.petName.length > 0 &&
    isFiniteNonNegativeNumber(value.petLevel) &&
    isBoolean(value.seasonalActive)
  );
}

function isValidAcquisitionPlannerState(value: unknown): value is AcquisitionPlannerInputState {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }

  if (!isRecord(value.sourcePolicy) || !isRecord(value.explore) || !isRecord(value.consumables)) {
    return false;
  }

  if (!isRecord(value.ownedNow) || !isRecord(value.pets)) {
    return false;
  }

  if (
    value.sourcePolicy.planningHorizon !== 'immediate_only' &&
    value.sourcePolicy.planningHorizon !== 'include_future'
  ) {
    return false;
  }

  if (!isRecord(value.sourcePolicy.sourceOverrides)) {
    return false;
  }

  if (
    !isBoolean(value.explore.runeCubeActive) ||
    !isFiniteNonNegativeNumber(value.explore.availableStamina) ||
    !isFiniteNonNegativeNumber(value.explore.wandererPercent) ||
    !isFiniteNonNegativeNumber(value.explore.exploringEffectivenessPercent) ||
    !isBoolean(value.explore.cinnamonSticksActive) ||
    !isBoolean(value.explore.neighActive)
  ) {
    return false;
  }

  if (!Array.isArray(value.ownedNow.entries) || !value.ownedNow.entries.every((entry) => isValidOwnedNowEntry(entry))) {
    return false;
  }

  if (
    !isRecord(value.pets.futureProduction) ||
    !Array.isArray(value.pets.storedInventoryEntries) ||
    !value.pets.storedInventoryEntries.every((entry) => isValidStoredPetInventoryEntry(entry)) ||
    !isBoolean(value.pets.futureProduction.enabled) ||
    !isFiniteNonNegativeNumber(value.pets.futureProduction.horizonDays) ||
    !Array.isArray(value.pets.futureProduction.entries) ||
    !value.pets.futureProduction.entries.every((entry) => isValidFuturePetProductionEntry(entry)) ||
    !isBoolean(value.pets.futureProduction.respectSeasonality) ||
    !isFiniteNonNegativeNumber(value.pets.futureProduction.offlineHoursCap) ||
    !isBoolean(value.pets.futureProduction.crunchyOmeletteActive)
  ) {
    return false;
  }

  const consumableValues = [
    value.consumables.appleCider,
    value.consumables.lemonade,
    value.consumables.arnoldPalmer,
    value.consumables.orangeJuice,
  ];

  if (
    !consumableValues.every((entry) => {
      return (
        isRecord(entry) &&
        isFiniteNonNegativeNumber(entry.ownedCount) &&
        isFiniteNonNegativeNumber(entry.craftableNowCount) &&
        isFiniteNonNegativeNumber(entry.futureCraftableCount)
      );
    })
  ) {
    return false;
  }

  const lemonade = value.consumables.lemonade as Record<string, unknown>;
  const arnoldPalmer = value.consumables.arnoldPalmer as Record<string, unknown>;

  return (
    isBoolean(lemonade.lemonSqueezerActive) &&
    isBoolean(lemonade.quandaryChowderActive) &&
    isBoolean(arnoldPalmer.lemonSqueezerActive) &&
    isBoolean(arnoldPalmer.quandaryChowderActive) &&
    isFiniteNonNegativeNumber(arnoldPalmer.lemonSeltzerUsesRemaining) &&
    isBoolean(arnoldPalmer.lemonCreamPieActive)
  );
}

function isValidPumpkinJuicePlannerState(value: unknown): value is PumpkinJuicePlannerState {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.valueThresholds)) {
    return false;
  }

  return (
    isFiniteNonNegativeNumber(value.ownedPumpkinJuiceCount) &&
    isBoolean(value.valueThresholds.enabled) &&
    isFiniteNonNegativeNumber(value.valueThresholds.minNextApSaved) &&
    isFiniteNonNegativeNumber(value.valueThresholds.minTotalApSaved) &&
    isFiniteNonNegativeNumber(value.valueThresholds.minNextStaminaSaved) &&
    isFiniteNonNegativeNumber(value.valueThresholds.minTotalStaminaSaved)
  );
}

function isValidDropRateAcquisitionSettings(
  value: unknown,
): value is DropRateAcquisitionSettings {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.perks) || !isRecord(value.units)) {
    return false;
  }

  return (
    isBoolean(value.perks.ironDepotActive) &&
    isFiniteNonNegativeNumber(value.perks.wandererPercent) &&
    value.perks.wandererPercent <= 100 &&
    isBoolean(value.perks.cinnamonSticksActive) &&
    isBoolean(value.perks.lemonSqueezerActive) &&
    isBoolean(value.perks.reinforcedNettingActive) &&
    isBoolean(value.perks.fishingTrawlActive) &&
    isFiniteNonNegativeNumber(value.perks.resourceSaverPercent) &&
    value.perks.resourceSaverPercent <= 100 &&
    isBoolean(value.perks.eagleEyeRunecubeActive) &&
    (
      value.units.exploring === 'explores' ||
      value.units.exploring === 'stamina' ||
      value.units.exploring === 'orange_juices' ||
      value.units.exploring === 'apple_ciders' ||
      value.units.exploring === 'lemonades' ||
      value.units.exploring === 'arnold_palmers'
    ) &&
    (
      value.units.fishing === 'fish' ||
      value.units.fishing === 'fishing_nets' ||
      value.units.fishing === 'large_nets'
    ) &&
    (
      value.units.farming === 'crops' ||
      value.units.farming === 'seeds' ||
      value.units.farming === 'harvest_alls'
    )
  );
}

function isValidPersonalMasteryGoal(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.goalId === 'string' &&
    value.goalId.length > 0 &&
    typeof value.itemName === 'string' &&
    value.itemName.length > 0 &&
    typeof value.canonicalKey === 'string' &&
    value.canonicalKey.length > 0 &&
    (value.targetTier === 'M' || value.targetTier === 'GM' || value.targetTier === 'MM') &&
    typeof value.createdAt === 'string' &&
    value.createdAt.length > 0 &&
    typeof value.updatedAt === 'string' &&
    value.updatedAt.length > 0
  );
}

function isValidPersonalMasteryGoalsState(value: unknown): value is PersonalMasteryGoalsState {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.goals)) {
    return false;
  }

  return value.goals.every((goal) => isValidPersonalMasteryGoal(goal));
}

function isValidMasteryRaceCountEntry(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const validOptionalCount = (count: unknown): boolean => {
    return count === null || isFiniteNonNegativeNumber(count);
  };

  return (
    typeof value.canonicalKey === 'string' &&
    value.canonicalKey.length > 0 &&
    typeof value.itemName === 'string' &&
    value.itemName.length > 0 &&
    validOptionalCount(value.masteredCount) &&
    validOptionalCount(value.grandMasteredCount) &&
    validOptionalCount(value.megaMasteredCount) &&
    typeof value.updatedAt === 'string' &&
    value.updatedAt.length > 0
  );
}

function isValidMasteryRaceCountsState(value: unknown): value is MasteryRaceCountsState {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
    return false;
  }

  return value.entries.every((entry) => isValidMasteryRaceCountEntry(entry));
}

function isValidMuseumCompletionState(value: unknown): value is MuseumCompletionState {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }

  const manualMissingItems = value.manualMissingItems;

  return (
    (value.savedAt === null || typeof value.savedAt === 'string') &&
    typeof value.fullMuseumText === 'string' &&
    typeof value.personalMuseumText === 'string' &&
    (manualMissingItems === undefined ||
      (Array.isArray(manualMissingItems) &&
        manualMissingItems.every((entry) => {
          return (
            isRecord(entry) &&
            typeof entry.id === 'string' &&
            entry.id.length > 0 &&
            typeof entry.categoryKey === 'string' &&
            entry.categoryKey.length > 0 &&
            typeof entry.categoryName === 'string' &&
            entry.categoryName.length > 0 &&
            typeof entry.itemName === 'string' &&
            entry.itemName.length > 0 &&
            typeof entry.canonicalKey === 'string' &&
            entry.canonicalKey.length > 0 &&
            isFiniteNonNegativeNumber(entry.slotCount) &&
            entry.slotCount >= 1 &&
            typeof entry.note === 'string'
          );
        })))
  );
}

function isValidTargetOutputPlannerTarget(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.targetId === undefined || typeof value.targetId === 'string') &&
    typeof value.itemName === 'string' &&
    value.itemName.length > 0 &&
    typeof value.canonicalKey === 'string' &&
    value.canonicalKey.length > 0 &&
    isFiniteNonNegativeNumber(value.desiredQuantity) &&
    value.desiredQuantity > 0
  );
}

function isValidTargetOutputSupplyOverride(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.itemName === 'string' &&
    value.itemName.length > 0 &&
    typeof value.canonicalKey === 'string' &&
    value.canonicalKey.length > 0 &&
    isFiniteNonNegativeNumber(value.quantity)
  );
}

function isValidTargetOutputPlannerState(value: unknown): value is TargetOutputPlannerState {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }

  return (
    Array.isArray(value.targets) &&
    value.targets.every((target) => isValidTargetOutputPlannerTarget(target)) &&
    Array.isArray(value.supplyOverrides) &&
    value.supplyOverrides.every((override) => isValidTargetOutputSupplyOverride(override))
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

function normalizeMissingLegacyNumber(
  value: Record<string, unknown>,
  fieldName: string,
  fallback: number,
): void {
  if (!(fieldName in value)) {
    value[fieldName] = fallback;
  }
}

function normalizeMissingLegacyArray(
  value: Record<string, unknown>,
  fieldName: string,
): void {
  if (!(fieldName in value)) {
    value[fieldName] = [];
  }
}

function normalizeLegacyParseSummary(
  value: unknown,
  parsedRows: unknown,
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const normalized = { ...value };
  const parsedRowsFallback = Array.isArray(parsedRows)
    ? parsedRows.length
    : isFiniteNonNegativeNumber(normalized.itemsParsed)
      ? normalized.itemsParsed
      : 0;

  normalizeMissingLegacyNumber(normalized, 'parsedRowsCount', parsedRowsFallback);
  normalizeMissingLegacyNumber(normalized, 'duplicateRowsCount', 0);
  normalizeMissingLegacyNumber(normalized, 'skippedNonItemLinesCount', 0);
  normalizeMissingLegacyArray(normalized, 'skippedNonItemLineSamples');
  normalizeMissingLegacyNumber(normalized, 'unknownItemsCount', 0);
  normalizeMissingLegacyArray(normalized, 'warnings');

  return normalized;
}

function normalizeLegacySnapshot(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    parseSummary: normalizeLegacyParseSummary(value.parseSummary, value.parsedRows),
  };
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
          acquisitionPlannerState: input.acquisitionPlannerState,
          dropRateAcquisitionSettings: input.dropRateAcquisitionSettings ?? null,
          pumpkinJuicePlannerState: input.pumpkinJuicePlannerState ?? null,
          personalMasteryGoalsState: input.personalMasteryGoalsState ?? null,
          masteryRaceCountsState: input.masteryRaceCountsState ?? null,
          museumCompletionState: input.museumCompletionState ?? null,
          targetOutputPlannerState: input.targetOutputPlannerState ?? null,
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

  const normalizedSnapshots = value.state.snapshots.map((snapshot) => normalizeLegacySnapshot(snapshot));

  if (!normalizedSnapshots.every((snapshot) => isValidSnapshot(snapshot))) {
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

  const acquisitionPlannerState = value.state.preferences.acquisitionPlannerState;
  if (
    acquisitionPlannerState !== undefined &&
    acquisitionPlannerState !== null &&
    !isValidAcquisitionPlannerState(acquisitionPlannerState)
  ) {
    return {
      ok: false,
      code: 'invalid_acquisition_planner_state',
      message: 'The backup file contains malformed acquisition planner state.',
    };
  }

  const pumpkinJuicePlannerState = value.state.preferences.pumpkinJuicePlannerState;
  if (
    pumpkinJuicePlannerState !== undefined &&
    pumpkinJuicePlannerState !== null &&
    !isValidPumpkinJuicePlannerState(pumpkinJuicePlannerState)
  ) {
    return {
      ok: false,
      code: 'invalid_pumpkin_juice_planner_state',
      message: 'The backup file contains malformed Pumpkin Juice planner state.',
    };
  }

  const dropRateAcquisitionSettings = value.state.preferences.dropRateAcquisitionSettings;
  if (
    dropRateAcquisitionSettings !== undefined &&
    dropRateAcquisitionSettings !== null &&
    !isValidDropRateAcquisitionSettings(dropRateAcquisitionSettings)
  ) {
    return {
      ok: false,
      code: 'invalid_drop_rate_acquisition_settings',
      message: 'The backup file contains malformed drop-rate acquisition settings.',
    };
  }

  const personalMasteryGoalsState = value.state.preferences.personalMasteryGoalsState;
  if (
    personalMasteryGoalsState !== undefined &&
    personalMasteryGoalsState !== null &&
    !isValidPersonalMasteryGoalsState(personalMasteryGoalsState)
  ) {
    return {
      ok: false,
      code: 'invalid_personal_mastery_goals_state',
      message: 'The backup file contains malformed personal mastery goals state.',
    };
  }

  const masteryRaceCountsState = value.state.preferences.masteryRaceCountsState;
  if (
    masteryRaceCountsState !== undefined &&
    masteryRaceCountsState !== null &&
    !isValidMasteryRaceCountsState(masteryRaceCountsState)
  ) {
    return {
      ok: false,
      code: 'invalid_mastery_race_counts_state',
      message: 'The backup file contains malformed mastery race-count state.',
    };
  }

  const museumCompletionState = value.state.preferences.museumCompletionState;
  if (
    museumCompletionState !== undefined &&
    museumCompletionState !== null &&
    !isValidMuseumCompletionState(museumCompletionState)
  ) {
    return {
      ok: false,
      code: 'invalid_museum_completion_state',
      message: 'The backup file contains malformed museum completion state.',
    };
  }

  const targetOutputPlannerState = value.state.preferences.targetOutputPlannerState;
  if (
    targetOutputPlannerState !== undefined &&
    targetOutputPlannerState !== null &&
    !isValidTargetOutputPlannerState(targetOutputPlannerState)
  ) {
    return {
      ok: false,
      code: 'invalid_target_output_planner_state',
      message: 'The backup file contains malformed target-output planner state.',
    };
  }

  return {
    ok: true,
    payload: {
      ...value,
      state: {
        ...value.state,
        snapshots: normalizedSnapshots,
      },
    } as AppBackupPayloadV1,
  };
}

export function isAppBackupPayloadV1(value: unknown): value is AppBackupPayloadV1 {
  return validateAppBackupPayloadV1(value).ok;
}
