import {
  DEFAULT_LARGE_NET_CATCH_MULTIPLIER,
  DEFAULT_LARGE_NET_CRAFT_OUTPUT_MULTIPLIER,
} from './largeNetPlanner';

export const LARGE_NET_PLANNER_STATE_STORAGE_KEY = 'farmrpg-tools.largeNetPlannerState.v1';

export type LargeNetPlannerTargetState = {
  id: string;
  itemName: string;
  targetQuantity: string;
  regularInventoryOverride: string;
  storedPetInventoryOverride: string;
  petNameOverride: string;
  petLevelOverride: string;
  manualLargeNetsPerDrop: string;
};

export type LargeNetPlannerState = {
  schemaVersion: 1;
  dailyAntlers: string;
  directLargeNetsPerDay: string;
  waitDays: string;
  craftOutputMultiplier: string;
  catchMultiplier: string;
  crunchyOmeletteActive: boolean;
  targets: LargeNetPlannerTargetState[];
};

export const DEFAULT_LARGE_NET_PLANNER_TARGETS: LargeNetPlannerTargetState[] = [
  {
    id: 'frost-snapper-shell',
    itemName: 'Frost Snapper Shell',
    targetQuantity: '15000',
    regularInventoryOverride: '',
    storedPetInventoryOverride: '',
    petNameOverride: 'Seal',
    petLevelOverride: '',
    manualLargeNetsPerDrop: '',
  },
  {
    id: 'spiked-shell',
    itemName: 'Spiked Shell',
    targetQuantity: '10000',
    regularInventoryOverride: '',
    storedPetInventoryOverride: '',
    petNameOverride: '',
    petLevelOverride: '',
    manualLargeNetsPerDrop: '6.1',
  },
];

type CreateDefaultLargeNetPlannerStateOptions = {
  crunchyOmeletteActive?: boolean;
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

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeTarget(value: unknown, index: number): LargeNetPlannerTargetState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<LargeNetPlannerTargetState>;
  const itemName = normalizeText(record.itemName);

  if (!itemName.trim()) {
    return null;
  }

  return {
    id: normalizeText(record.id) || `target-${index + 1}`,
    itemName,
    targetQuantity: normalizeText(record.targetQuantity),
    regularInventoryOverride: normalizeText(record.regularInventoryOverride),
    storedPetInventoryOverride: normalizeText(record.storedPetInventoryOverride),
    petNameOverride: normalizeText(record.petNameOverride),
    petLevelOverride: normalizeText(record.petLevelOverride),
    manualLargeNetsPerDrop: normalizeText(record.manualLargeNetsPerDrop),
  };
}

export function createDefaultLargeNetPlannerState(
  options: CreateDefaultLargeNetPlannerStateOptions = {},
): LargeNetPlannerState {
  return {
    schemaVersion: 1,
    dailyAntlers: '',
    directLargeNetsPerDay: '2000',
    waitDays: '7',
    craftOutputMultiplier: DEFAULT_LARGE_NET_CRAFT_OUTPUT_MULTIPLIER.toString(),
    catchMultiplier: DEFAULT_LARGE_NET_CATCH_MULTIPLIER.toString(),
    crunchyOmeletteActive: Boolean(options.crunchyOmeletteActive),
    targets: structuredClone(DEFAULT_LARGE_NET_PLANNER_TARGETS),
  };
}

export function normalizeLargeNetPlannerState(
  value: unknown,
  fallback: LargeNetPlannerState = createDefaultLargeNetPlannerState(),
): LargeNetPlannerState {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const record = value as Partial<LargeNetPlannerState>;
  const targets = Array.isArray(record.targets)
    ? record.targets
      .map((target, index) => normalizeTarget(target, index))
      .filter((target): target is LargeNetPlannerTargetState => Boolean(target))
    : [];

  return {
    schemaVersion: 1,
    dailyAntlers: normalizeText(record.dailyAntlers),
    directLargeNetsPerDay: normalizeText(record.directLargeNetsPerDay),
    waitDays: normalizeText(record.waitDays) || fallback.waitDays,
    craftOutputMultiplier: normalizeText(record.craftOutputMultiplier) ||
      DEFAULT_LARGE_NET_CRAFT_OUTPUT_MULTIPLIER.toString(),
    catchMultiplier: normalizeText(record.catchMultiplier) || DEFAULT_LARGE_NET_CATCH_MULTIPLIER.toString(),
    crunchyOmeletteActive: record.crunchyOmeletteActive === true,
    targets: targets.length > 0 ? targets : structuredClone(DEFAULT_LARGE_NET_PLANNER_TARGETS),
  };
}

export function loadLargeNetPlannerState(storage?: Storage): LargeNetPlannerState | null {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(LARGE_NET_PLANNER_STATE_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return normalizeLargeNetPlannerState(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function saveLargeNetPlannerState(
  state: LargeNetPlannerState,
  storage?: Storage,
): LargeNetPlannerState {
  const normalizedState = normalizeLargeNetPlannerState(state);

  getLocalStorage(storage).setItem(LARGE_NET_PLANNER_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}
