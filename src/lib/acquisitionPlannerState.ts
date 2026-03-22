import {
  ACQUISITION_SOURCE_CATALOG,
  type AcquisitionSourceKey,
} from './acquisitionSourceCatalog';
import type { UserCraftingModifierState } from './craftingModifierState';
import { toCanonicalItemKey } from './normalizeItemKey';

export const ACQUISITION_PLANNER_STATE_STORAGE_KEY = 'farmrpg-tools.acquisitionPlannerState';

export type AcquisitionSourcePolicyOverride = 'default' | 'force_included' | 'force_excluded';

export type AcquisitionPlanningHorizon = 'immediate_only' | 'include_future';

export type AcquisitionSourcePolicyState = {
  planningHorizon: AcquisitionPlanningHorizon;
  sourceOverrides: Record<AcquisitionSourceKey, AcquisitionSourcePolicyOverride>;
};

export type AcquisitionExplorePlannerState = {
  runeCubeActive: boolean;
  availableStamina: number;
  wandererPercent: number;
  exploringEffectivenessPercent: number;
  cinnamonSticksActive: boolean;
  neighActive: boolean;
};

export type AcquisitionConsumableAvailabilityState = {
  ownedCount: number;
  craftableNowCount: number;
  futureCraftableCount: number;
};

export type AppleCiderPlannerState = AcquisitionConsumableAvailabilityState;

export type LemonadePlannerState = AcquisitionConsumableAvailabilityState & {
  lemonSqueezerActive: boolean;
  quandaryChowderActive: boolean;
};

export type ArnoldPalmerPlannerState = AcquisitionConsumableAvailabilityState & {
  lemonSqueezerActive: boolean;
  quandaryChowderActive: boolean;
  lemonSeltzerUsesRemaining: number;
  lemonCreamPieActive: boolean;
};

export type OrangeJuicePlannerState = AcquisitionConsumableAvailabilityState;

export type AcquisitionConsumablePlannerState = {
  appleCider: AppleCiderPlannerState;
  lemonade: LemonadePlannerState;
  arnoldPalmer: ArnoldPalmerPlannerState;
  orangeJuice: OrangeJuicePlannerState;
};

export type AcquisitionOwnedNowSourceCategory = 'stockpile' | 'container';

export type AcquisitionOwnedNowItemInput = {
  canonicalItemKey: string;
  itemName: string;
  ownedCount: number;
  sourceCategory: AcquisitionOwnedNowSourceCategory;
};

export type AcquisitionOwnedNowPlannerState = {
  entries: AcquisitionOwnedNowItemInput[];
};

export type AcquisitionStoredPetInventoryItemInput = {
  canonicalItemKey: string;
  itemName: string;
  storedCount: number;
};

export type AcquisitionFuturePetProductionEntryInput = {
  canonicalItemKey: string;
  itemName: string;
  petName: string;
  petLevel: number;
  seasonalActive: boolean;
};

export type AcquisitionPetPlannerState = {
  storedInventoryEntries: AcquisitionStoredPetInventoryItemInput[];
  futureProduction: {
    enabled: boolean;
    horizonDays: number;
    entries: AcquisitionFuturePetProductionEntryInput[];
    respectSeasonality: boolean;
    offlineHoursCap: number;
    crunchyOmeletteActive: boolean;
  };
};

export type AcquisitionPlannerInputState = {
  schemaVersion: 1;
  sourcePolicy: AcquisitionSourcePolicyState;
  explore: AcquisitionExplorePlannerState;
  consumables: AcquisitionConsumablePlannerState;
  ownedNow: AcquisitionOwnedNowPlannerState;
  pets: AcquisitionPetPlannerState;
};

export type ResolvedAcquisitionSharedAssumptions = {
  runeCubeActive: boolean;
  ironDepotActive: boolean;
};

type PartialAcquisitionSourcePolicyState = Partial<AcquisitionSourcePolicyState>;
type PartialAcquisitionExplorePlannerState = Partial<AcquisitionExplorePlannerState>;
type PartialAcquisitionConsumablePlannerState = Partial<AcquisitionConsumablePlannerState>;
type PartialAcquisitionOwnedNowPlannerState = Partial<AcquisitionOwnedNowPlannerState>;
type PartialAcquisitionPetPlannerState = Partial<AcquisitionPetPlannerState>;
type PartialFuturePetProductionState = Partial<AcquisitionPetPlannerState['futureProduction']>;
type LegacyOwnedNowCountsState = {
  stockpileItemCountsByCanonicalKey?: Record<string, unknown>;
  containerItemCountsByCanonicalKey?: Record<string, unknown>;
};
type LegacyStoredPetInventoryCountsState = {
  storedInventoryByCanonicalKey?: Record<string, unknown>;
};
type LegacyFuturePetLevelsState = {
  petLevelsByCanonicalKey?: Record<string, unknown>;
};

function createDefaultSourceOverrides(): Record<AcquisitionSourceKey, AcquisitionSourcePolicyOverride> {
  return ACQUISITION_SOURCE_CATALOG.sources.reduce(
    (result, source) => {
      result[source.key] = 'default';
      return result;
    },
    {} as Record<AcquisitionSourceKey, AcquisitionSourcePolicyOverride>,
  );
}

const DEFAULT_ACQUISITION_PLANNER_INPUT_STATE: AcquisitionPlannerInputState = {
  schemaVersion: 1,
  sourcePolicy: {
    planningHorizon: 'include_future',
    sourceOverrides: createDefaultSourceOverrides(),
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
    appleCider: {
      ownedCount: 0,
      craftableNowCount: 0,
      futureCraftableCount: 0,
    },
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
    orangeJuice: {
      ownedCount: 0,
      craftableNowCount: 0,
      futureCraftableCount: 0,
    },
  },
  ownedNow: {
    entries: [],
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

function toBoolean(value: unknown): boolean {
  return value === true;
}

function clampNonNegativeNumber(value: unknown, fallback = 0): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return numericValue;
}

function normalizeRecordOfCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((result, [key, entry]) => {
    const normalizedKey = key.trim();
    const normalizedValue = clampNonNegativeNumber(entry, -1);

    if (normalizedKey.length > 0 && normalizedValue >= 0) {
      result[normalizedKey] = normalizedValue;
    }

    return result;
  }, {});
}

function normalizeOwnedNowSourceCategory(value: unknown): AcquisitionOwnedNowSourceCategory | null {
  return value === 'stockpile' || value === 'container' ? value : null;
}

function normalizeOwnedNowItemEntry(value: unknown): AcquisitionOwnedNowItemInput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sourceCategory = normalizeOwnedNowSourceCategory(record.sourceCategory);
  const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
  const canonicalItemKeyInput =
    typeof record.canonicalItemKey === 'string' ? record.canonicalItemKey.trim() : '';
  const canonicalItemKey = canonicalItemKeyInput.length > 0
    ? toCanonicalItemKey(canonicalItemKeyInput)
    : toCanonicalItemKey(itemName);
  const ownedCount = clampNonNegativeNumber(record.ownedCount, -1);

  if (!sourceCategory || canonicalItemKey.length === 0 || ownedCount < 0) {
    return null;
  }

  return {
    canonicalItemKey,
    itemName: itemName.length > 0 ? itemName : canonicalItemKey,
    ownedCount,
    sourceCategory,
  };
}

function normalizeOwnedNowEntries(value: unknown): AcquisitionOwnedNowItemInput[] {
  if (Array.isArray(value)) {
    const dedupedEntries = new Map<string, AcquisitionOwnedNowItemInput>();

    for (const entry of value) {
      const normalizedEntry = normalizeOwnedNowItemEntry(entry);

      if (!normalizedEntry) {
        continue;
      }

      dedupedEntries.set(
        `${normalizedEntry.sourceCategory}:${normalizedEntry.canonicalItemKey}`,
        normalizedEntry,
      );
    }

    return Array.from(dedupedEntries.values()).sort((left, right) => {
      return (
        left.sourceCategory.localeCompare(right.sourceCategory) ||
        left.itemName.localeCompare(right.itemName) ||
        left.canonicalItemKey.localeCompare(right.canonicalItemKey)
      );
    });
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const legacyValue = value as LegacyOwnedNowCountsState;
  const stockpileCounts = normalizeRecordOfCounts(legacyValue.stockpileItemCountsByCanonicalKey);
  const containerCounts = normalizeRecordOfCounts(legacyValue.containerItemCountsByCanonicalKey);

  return [
    ...Object.entries(stockpileCounts).map(([canonicalItemKey, ownedCount]) => ({
      canonicalItemKey,
      itemName: canonicalItemKey,
      ownedCount,
      sourceCategory: 'stockpile' as const,
    })),
    ...Object.entries(containerCounts).map(([canonicalItemKey, ownedCount]) => ({
      canonicalItemKey,
      itemName: canonicalItemKey,
      ownedCount,
      sourceCategory: 'container' as const,
    })),
  ].sort((left, right) => {
    return (
      left.sourceCategory.localeCompare(right.sourceCategory) ||
      left.itemName.localeCompare(right.itemName) ||
      left.canonicalItemKey.localeCompare(right.canonicalItemKey)
    );
  });
}

function normalizeStoredPetInventoryEntry(value: unknown): AcquisitionStoredPetInventoryItemInput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
  const canonicalItemKeyInput =
    typeof record.canonicalItemKey === 'string' ? record.canonicalItemKey.trim() : '';
  const canonicalItemKey = canonicalItemKeyInput.length > 0
    ? toCanonicalItemKey(canonicalItemKeyInput)
    : toCanonicalItemKey(itemName);
  const storedCount = clampNonNegativeNumber(record.storedCount, -1);

  if (canonicalItemKey.length === 0 || storedCount < 0) {
    return null;
  }

  return {
    canonicalItemKey,
    itemName: itemName.length > 0 ? itemName : canonicalItemKey,
    storedCount,
  };
}

function normalizeStoredPetInventoryEntries(value: unknown): AcquisitionStoredPetInventoryItemInput[] {
  if (Array.isArray(value)) {
    const dedupedEntries = new Map<string, AcquisitionStoredPetInventoryItemInput>();

    for (const entry of value) {
      const normalizedEntry = normalizeStoredPetInventoryEntry(entry);

      if (!normalizedEntry) {
        continue;
      }

      dedupedEntries.set(normalizedEntry.canonicalItemKey, normalizedEntry);
    }

    return Array.from(dedupedEntries.values()).sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalItemKey.localeCompare(right.canonicalItemKey);
    });
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const legacyValue = value as LegacyStoredPetInventoryCountsState;
  const legacyCounts = normalizeRecordOfCounts(legacyValue.storedInventoryByCanonicalKey);

  return Object.entries(legacyCounts)
    .map(([canonicalItemKey, storedCount]) => ({
      canonicalItemKey,
      itemName: canonicalItemKey,
      storedCount,
    }))
    .sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalItemKey.localeCompare(right.canonicalItemKey);
    });
}

function normalizeFuturePetProductionEntry(value: unknown): AcquisitionFuturePetProductionEntryInput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
  const petName = typeof record.petName === 'string' ? record.petName.trim() : '';
  const canonicalItemKeyInput =
    typeof record.canonicalItemKey === 'string' ? record.canonicalItemKey.trim() : '';
  const canonicalItemKey = canonicalItemKeyInput.length > 0
    ? toCanonicalItemKey(canonicalItemKeyInput)
    : toCanonicalItemKey(itemName);
  const petLevel = clampNonNegativeNumber(record.petLevel, -1);

  if (canonicalItemKey.length === 0 || itemName.length === 0 || petName.length === 0 || petLevel < 0) {
    return null;
  }

  return {
    canonicalItemKey,
    itemName,
    petName,
    petLevel,
    seasonalActive: toBoolean(record.seasonalActive),
  };
}

function normalizeFuturePetProductionEntries(value: unknown): AcquisitionFuturePetProductionEntryInput[] {
  if (Array.isArray(value)) {
    const dedupedEntries = new Map<string, AcquisitionFuturePetProductionEntryInput>();

    for (const entry of value) {
      const normalizedEntry = normalizeFuturePetProductionEntry(entry);

      if (!normalizedEntry) {
        continue;
      }

      dedupedEntries.set(
        `${normalizedEntry.petName.toLocaleLowerCase()}:${normalizedEntry.canonicalItemKey}`,
        normalizedEntry,
      );
    }

    return Array.from(dedupedEntries.values()).sort((left, right) => {
      return (
        left.itemName.localeCompare(right.itemName) ||
        left.petName.localeCompare(right.petName) ||
        left.canonicalItemKey.localeCompare(right.canonicalItemKey)
      );
    });
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const legacyValue = value as LegacyFuturePetLevelsState;
  const legacyCounts = normalizeRecordOfCounts(legacyValue.petLevelsByCanonicalKey);

  return Object.entries(legacyCounts)
    .map(([canonicalItemKey, petLevel]) => ({
      canonicalItemKey: toCanonicalItemKey(canonicalItemKey),
      itemName: canonicalItemKey,
      petName: canonicalItemKey,
      petLevel,
      seasonalActive: true,
    }))
    .sort((left, right) => {
      return (
        left.itemName.localeCompare(right.itemName) ||
        left.petName.localeCompare(right.petName) ||
        left.canonicalItemKey.localeCompare(right.canonicalItemKey)
      );
    });
}

function normalizeSourcePolicyOverride(value: unknown): AcquisitionSourcePolicyOverride {
  return value === 'force_included' || value === 'force_excluded' || value === 'default' ? value : 'default';
}

function normalizeSourcePolicyOverrides(value: unknown): Record<AcquisitionSourceKey, AcquisitionSourcePolicyOverride> {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const normalized = createDefaultSourceOverrides();

  for (const source of ACQUISITION_SOURCE_CATALOG.sources) {
    normalized[source.key] = normalizeSourcePolicyOverride(record[source.key]);
  }

  return normalized;
}

function normalizePlanningHorizon(value: unknown): AcquisitionPlanningHorizon {
  return value === 'immediate_only' || value === 'include_future' ? value : 'include_future';
}

function normalizeConsumableAvailabilityState(value: unknown): AcquisitionConsumableAvailabilityState {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    ownedCount: clampNonNegativeNumber(record.ownedCount),
    craftableNowCount: clampNonNegativeNumber(record.craftableNowCount),
    futureCraftableCount: clampNonNegativeNumber(record.futureCraftableCount),
  };
}

export function createDefaultAcquisitionPlannerInputState(): AcquisitionPlannerInputState {
  return structuredClone(DEFAULT_ACQUISITION_PLANNER_INPUT_STATE);
}

export function normalizeAcquisitionPlannerInputState(value: unknown): AcquisitionPlannerInputState {
  if (!value || typeof value !== 'object') {
    return createDefaultAcquisitionPlannerInputState();
  }

  const record = value as Partial<AcquisitionPlannerInputState>;
  const sourcePolicy: PartialAcquisitionSourcePolicyState =
    record.sourcePolicy && typeof record.sourcePolicy === 'object' ? record.sourcePolicy : {};
  const explore: PartialAcquisitionExplorePlannerState =
    record.explore && typeof record.explore === 'object' ? record.explore : {};
  const consumables: PartialAcquisitionConsumablePlannerState =
    record.consumables && typeof record.consumables === 'object' ? record.consumables : {};
  const ownedNow: PartialAcquisitionOwnedNowPlannerState =
    record.ownedNow && typeof record.ownedNow === 'object' ? record.ownedNow : {};
  const pets: PartialAcquisitionPetPlannerState =
    record.pets && typeof record.pets === 'object' ? record.pets : {};
  const futureProduction: PartialFuturePetProductionState =
    pets.futureProduction && typeof pets.futureProduction === 'object' ? pets.futureProduction : {};

  const normalizedLemonade = normalizeConsumableAvailabilityState(consumables.lemonade);
  const normalizedArnoldPalmer = normalizeConsumableAvailabilityState(consumables.arnoldPalmer);

  return {
    schemaVersion: 1,
    sourcePolicy: {
      planningHorizon: normalizePlanningHorizon(sourcePolicy.planningHorizon),
      sourceOverrides: normalizeSourcePolicyOverrides(sourcePolicy.sourceOverrides),
    },
    explore: {
      runeCubeActive: toBoolean(explore.runeCubeActive),
      availableStamina: clampNonNegativeNumber(explore.availableStamina),
      wandererPercent: clampNonNegativeNumber(explore.wandererPercent),
      exploringEffectivenessPercent: clampNonNegativeNumber(explore.exploringEffectivenessPercent),
      cinnamonSticksActive: toBoolean(explore.cinnamonSticksActive),
      neighActive: toBoolean(explore.neighActive),
    },
    consumables: {
      appleCider: normalizeConsumableAvailabilityState(consumables.appleCider),
      lemonade: {
        ...normalizedLemonade,
        lemonSqueezerActive: toBoolean(consumables.lemonade?.lemonSqueezerActive),
        quandaryChowderActive: toBoolean(consumables.lemonade?.quandaryChowderActive),
      },
      arnoldPalmer: {
        ...normalizedArnoldPalmer,
        lemonSqueezerActive: toBoolean(consumables.arnoldPalmer?.lemonSqueezerActive),
        quandaryChowderActive: toBoolean(consumables.arnoldPalmer?.quandaryChowderActive),
        lemonSeltzerUsesRemaining: clampNonNegativeNumber(
          consumables.arnoldPalmer?.lemonSeltzerUsesRemaining,
        ),
        lemonCreamPieActive: toBoolean(consumables.arnoldPalmer?.lemonCreamPieActive),
      },
      orangeJuice: normalizeConsumableAvailabilityState(consumables.orangeJuice),
    },
    ownedNow: {
      entries: normalizeOwnedNowEntries(
        ownedNow.entries ?? {
          stockpileItemCountsByCanonicalKey: (ownedNow as LegacyOwnedNowCountsState).stockpileItemCountsByCanonicalKey,
          containerItemCountsByCanonicalKey: (ownedNow as LegacyOwnedNowCountsState).containerItemCountsByCanonicalKey,
        },
      ),
    },
    pets: {
      storedInventoryEntries: normalizeStoredPetInventoryEntries(
        pets.storedInventoryEntries ?? {
          storedInventoryByCanonicalKey: (pets as LegacyStoredPetInventoryCountsState).storedInventoryByCanonicalKey,
        },
      ),
      futureProduction: {
        enabled: toBoolean(futureProduction.enabled),
        horizonDays: clampNonNegativeNumber(futureProduction.horizonDays, 7),
        entries: normalizeFuturePetProductionEntries(
          futureProduction.entries ?? {
            petLevelsByCanonicalKey: (futureProduction as LegacyFuturePetLevelsState).petLevelsByCanonicalKey,
          },
        ),
        respectSeasonality: futureProduction.respectSeasonality !== false,
        offlineHoursCap: clampNonNegativeNumber(futureProduction.offlineHoursCap, 48),
        crunchyOmeletteActive: toBoolean(futureProduction.crunchyOmeletteActive),
      },
    },
  };
}

function getLocalStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

export function loadAcquisitionPlannerInputState(storage?: Storage): AcquisitionPlannerInputState {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultAcquisitionPlannerInputState();
  }

  try {
    return normalizeAcquisitionPlannerInputState(JSON.parse(rawValue));
  } catch {
    return createDefaultAcquisitionPlannerInputState();
  }
}

export function saveAcquisitionPlannerInputState(
  state: AcquisitionPlannerInputState,
  storage?: Storage,
): AcquisitionPlannerInputState {
  const normalizedState = normalizeAcquisitionPlannerInputState(state);
  const activeStorage = getLocalStorage(storage);

  activeStorage.setItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearAcquisitionPlannerInputState(storage?: Storage): void {
  const activeStorage = getLocalStorage(storage);
  activeStorage.removeItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY);
}

export type UpdateOwnedNowItemInput = {
  itemName: string;
  ownedCount: number;
  sourceCategory: AcquisitionOwnedNowSourceCategory;
};

export function upsertOwnedNowItemInput(
  state: AcquisitionPlannerInputState,
  input: UpdateOwnedNowItemInput,
): AcquisitionPlannerInputState {
  const trimmedItemName = input.itemName.trim();
  const canonicalItemKey = toCanonicalItemKey(trimmedItemName);
  const ownedCount = clampNonNegativeNumber(input.ownedCount, -1);

  if (canonicalItemKey.length === 0 || ownedCount < 0) {
    return state;
  }

  const nextEntries = state.ownedNow.entries.filter((entry) => {
    return !(
      entry.sourceCategory === input.sourceCategory &&
      entry.canonicalItemKey === canonicalItemKey
    );
  });

  if (ownedCount > 0) {
    nextEntries.push({
      canonicalItemKey,
      itemName: trimmedItemName.length > 0 ? trimmedItemName : canonicalItemKey,
      ownedCount,
      sourceCategory: input.sourceCategory,
    });
  }

  return normalizeAcquisitionPlannerInputState({
    ...state,
    ownedNow: {
      entries: nextEntries,
    },
  });
}

export function removeOwnedNowItemInput(
  state: AcquisitionPlannerInputState,
  canonicalItemKey: string,
  sourceCategory: AcquisitionOwnedNowSourceCategory,
): AcquisitionPlannerInputState {
  return normalizeAcquisitionPlannerInputState({
    ...state,
    ownedNow: {
      entries: state.ownedNow.entries.filter((entry) => {
        return !(
          entry.sourceCategory === sourceCategory &&
          entry.canonicalItemKey === toCanonicalItemKey(canonicalItemKey)
        );
      }),
    },
  });
}

export function getOwnedNowItemInputs(
  state: AcquisitionPlannerInputState,
  sourceCategory?: AcquisitionOwnedNowSourceCategory,
): AcquisitionOwnedNowItemInput[] {
  return state.ownedNow.entries.filter((entry) => {
    return sourceCategory ? entry.sourceCategory === sourceCategory : true;
  });
}

export type UpdateStoredPetInventoryItemInput = {
  itemName: string;
  storedCount: number;
};

export function upsertStoredPetInventoryItemInput(
  state: AcquisitionPlannerInputState,
  input: UpdateStoredPetInventoryItemInput,
): AcquisitionPlannerInputState {
  const trimmedItemName = input.itemName.trim();
  const canonicalItemKey = toCanonicalItemKey(trimmedItemName);
  const storedCount = clampNonNegativeNumber(input.storedCount, -1);

  if (canonicalItemKey.length === 0 || storedCount < 0) {
    return state;
  }

  const nextEntries = state.pets.storedInventoryEntries.filter((entry) => {
    return entry.canonicalItemKey !== canonicalItemKey;
  });

  if (storedCount > 0) {
    nextEntries.push({
      canonicalItemKey,
      itemName: trimmedItemName.length > 0 ? trimmedItemName : canonicalItemKey,
      storedCount,
    });
  }

  return normalizeAcquisitionPlannerInputState({
    ...state,
    pets: {
      ...state.pets,
      storedInventoryEntries: nextEntries,
    },
  });
}

export function replaceStoredPetInventoryEntries(
  state: AcquisitionPlannerInputState,
  entries: AcquisitionStoredPetInventoryItemInput[],
): AcquisitionPlannerInputState {
  return normalizeAcquisitionPlannerInputState({
    ...state,
    pets: {
      ...state.pets,
      storedInventoryEntries: entries,
    },
  });
}

export function removeStoredPetInventoryItemInput(
  state: AcquisitionPlannerInputState,
  canonicalItemKey: string,
): AcquisitionPlannerInputState {
  return normalizeAcquisitionPlannerInputState({
    ...state,
    pets: {
      ...state.pets,
      storedInventoryEntries: state.pets.storedInventoryEntries.filter((entry) => {
        return entry.canonicalItemKey !== toCanonicalItemKey(canonicalItemKey);
      }),
    },
  });
}

export function getStoredPetInventoryItemInputs(
  state: AcquisitionPlannerInputState,
): AcquisitionStoredPetInventoryItemInput[] {
  return state.pets.storedInventoryEntries;
}

export type UpdateFuturePetProductionEntryInput = {
  itemName: string;
  petName: string;
  petLevel: number;
  seasonalActive: boolean;
};

export function upsertFuturePetProductionEntryInput(
  state: AcquisitionPlannerInputState,
  input: UpdateFuturePetProductionEntryInput,
): AcquisitionPlannerInputState {
  const trimmedItemName = input.itemName.trim();
  const trimmedPetName = input.petName.trim();
  const canonicalItemKey = toCanonicalItemKey(trimmedItemName);
  const petLevel = clampNonNegativeNumber(input.petLevel, -1);

  if (canonicalItemKey.length === 0 || trimmedItemName.length === 0 || trimmedPetName.length === 0 || petLevel < 0) {
    return state;
  }

  const nextEntries = state.pets.futureProduction.entries.filter((entry) => {
    return !(
      entry.canonicalItemKey === canonicalItemKey &&
      entry.petName.toLocaleLowerCase() === trimmedPetName.toLocaleLowerCase()
    );
  });

  if (petLevel > 0) {
    nextEntries.push({
      canonicalItemKey,
      itemName: trimmedItemName,
      petName: trimmedPetName,
      petLevel,
      seasonalActive: input.seasonalActive,
    });
  }

  return normalizeAcquisitionPlannerInputState({
    ...state,
    pets: {
      ...state.pets,
      futureProduction: {
        ...state.pets.futureProduction,
        entries: nextEntries,
      },
    },
  });
}

export function removeFuturePetProductionEntryInput(
  state: AcquisitionPlannerInputState,
  canonicalItemKey: string,
  petName: string,
): AcquisitionPlannerInputState {
  return normalizeAcquisitionPlannerInputState({
    ...state,
    pets: {
      ...state.pets,
      futureProduction: {
        ...state.pets.futureProduction,
        entries: state.pets.futureProduction.entries.filter((entry) => {
          return !(
            entry.canonicalItemKey === toCanonicalItemKey(canonicalItemKey) &&
            entry.petName.toLocaleLowerCase() === petName.trim().toLocaleLowerCase()
          );
        }),
      },
    },
  });
}

export function getFuturePetProductionEntries(
  state: AcquisitionPlannerInputState,
): AcquisitionFuturePetProductionEntryInput[] {
  return state.pets.futureProduction.entries;
}

export function resolveAcquisitionSourceInclusion(
  sourceKey: AcquisitionSourceKey,
  state: AcquisitionPlannerInputState,
): boolean {
  const source = ACQUISITION_SOURCE_CATALOG.sources.find((entry) => entry.key === sourceKey);

  if (!source) {
    return false;
  }

  const override = state.sourcePolicy.sourceOverrides[sourceKey];

  if (override === 'force_included') {
    return true;
  }

  if (override === 'force_excluded') {
    return false;
  }

  return source.defaultPolicy === 'included_by_default';
}

export function resolveAcquisitionSourceInclusionMap(
  state: AcquisitionPlannerInputState,
): Record<AcquisitionSourceKey, boolean> {
  return ACQUISITION_SOURCE_CATALOG.sources.reduce(
    (result, source) => {
      result[source.key] = resolveAcquisitionSourceInclusion(source.key, state);
      return result;
    },
    {} as Record<AcquisitionSourceKey, boolean>,
  );
}

export function getResolvedAcquisitionSharedAssumptions(
  state: AcquisitionPlannerInputState,
  craftingModifierState?: Pick<UserCraftingModifierState, 'planning'> | null,
): ResolvedAcquisitionSharedAssumptions {
  return {
    runeCubeActive: state.explore.runeCubeActive,
    ironDepotActive: craftingModifierState?.planning.ironDepotActive ?? false,
  };
}
