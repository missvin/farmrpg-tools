import { toCanonicalItemKey } from './normalizeItemKey';

export const BUILDING_PRODUCTION_STATE_STORAGE_KEY = 'farmrpg-tools.buildingProductionState.v1';

export type BuildingProductionPerkSettings = {
  sugarBoostI: boolean;
  sugarBoostII: boolean;
  pineBoost: boolean;
};

export type BuildingProductionState = {
  schemaVersion: 1;
  perkSettings: BuildingProductionPerkSettings;
  queuedOutputByCanonicalKey: Record<string, number>;
};

const DEFAULT_BUILDING_PRODUCTION_STATE: BuildingProductionState = {
  schemaVersion: 1,
  perkSettings: {
    sugarBoostI: false,
    sugarBoostII: false,
    pineBoost: false,
  },
  queuedOutputByCanonicalKey: {},
};

function getLocalStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return value === true ? true : value === false ? false : fallback;
}

function clampNonNegativeNumber(value: unknown, fallback = 0): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return numericValue;
}

function normalizeQueuedOutputs(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((result, [key, entry]) => {
    const normalizedKey = toCanonicalItemKey(key);
    const quantity = clampNonNegativeNumber(entry, -1);

    if (normalizedKey.length > 0 && quantity > 0) {
      result[normalizedKey] = quantity;
    }

    return result;
  }, {});
}

export function createDefaultBuildingProductionState(): BuildingProductionState {
  return structuredClone(DEFAULT_BUILDING_PRODUCTION_STATE);
}

export function normalizeBuildingProductionState(value: unknown): BuildingProductionState {
  if (!value || typeof value !== 'object') {
    return createDefaultBuildingProductionState();
  }

  const record = value as Partial<BuildingProductionState>;
  const perkSettings =
    record.perkSettings && typeof record.perkSettings === 'object' ? record.perkSettings : {};

  return {
    schemaVersion: 1,
    perkSettings: {
      sugarBoostI: normalizeBoolean((perkSettings as Partial<BuildingProductionPerkSettings>).sugarBoostI),
      sugarBoostII: normalizeBoolean((perkSettings as Partial<BuildingProductionPerkSettings>).sugarBoostII),
      pineBoost: normalizeBoolean((perkSettings as Partial<BuildingProductionPerkSettings>).pineBoost),
    },
    queuedOutputByCanonicalKey: normalizeQueuedOutputs(record.queuedOutputByCanonicalKey),
  };
}

export function isValidBuildingProductionState(value: unknown): value is BuildingProductionState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as BuildingProductionState;

  if (record.schemaVersion !== 1 || !record.perkSettings || typeof record.perkSettings !== 'object') {
    return false;
  }

  const queuedOutputByCanonicalKey = record.queuedOutputByCanonicalKey;

  return (
    typeof record.perkSettings.sugarBoostI === 'boolean' &&
    typeof record.perkSettings.sugarBoostII === 'boolean' &&
    typeof record.perkSettings.pineBoost === 'boolean' &&
    queuedOutputByCanonicalKey !== null &&
    typeof queuedOutputByCanonicalKey === 'object' &&
    Object.entries(queuedOutputByCanonicalKey).every(([key, quantity]) => {
      return key.length > 0 && typeof quantity === 'number' && Number.isFinite(quantity) && quantity >= 0;
    })
  );
}

export function loadBuildingProductionState(storage?: Storage): BuildingProductionState {
  const rawValue = getLocalStorage(storage).getItem(BUILDING_PRODUCTION_STATE_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultBuildingProductionState();
  }

  try {
    return normalizeBuildingProductionState(JSON.parse(rawValue));
  } catch {
    return createDefaultBuildingProductionState();
  }
}

export function saveBuildingProductionState(
  state: BuildingProductionState,
  storage?: Storage,
): BuildingProductionState {
  const normalizedState = normalizeBuildingProductionState(state);

  getLocalStorage(storage).setItem(BUILDING_PRODUCTION_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearBuildingProductionState(storage?: Storage): void {
  getLocalStorage(storage).removeItem(BUILDING_PRODUCTION_STATE_STORAGE_KEY);
}

export function setBuildingProductionPerk(
  state: BuildingProductionState,
  perkKey: keyof BuildingProductionPerkSettings,
  active: boolean,
): BuildingProductionState {
  return normalizeBuildingProductionState({
    ...state,
    perkSettings: {
      ...state.perkSettings,
      [perkKey]: active,
    },
  });
}

export function setQueuedBuildingOutput(
  state: BuildingProductionState,
  canonicalKey: string,
  quantity: number,
): BuildingProductionState {
  const normalizedKey = toCanonicalItemKey(canonicalKey);
  const normalizedQuantity = clampNonNegativeNumber(quantity, -1);

  if (normalizedKey.length === 0 || normalizedQuantity < 0) {
    return normalizeBuildingProductionState(state);
  }

  const nextQueuedOutputs = {
    ...state.queuedOutputByCanonicalKey,
  };

  if (normalizedQuantity > 0) {
    nextQueuedOutputs[normalizedKey] = normalizedQuantity;
  } else {
    delete nextQueuedOutputs[normalizedKey];
  }

  return normalizeBuildingProductionState({
    ...state,
    queuedOutputByCanonicalKey: nextQueuedOutputs,
  });
}
