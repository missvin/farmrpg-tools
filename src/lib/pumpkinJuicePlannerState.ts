export const PUMPKIN_JUICE_PLANNER_STATE_STORAGE_KEY = 'farmrpg-tools.pumpkinJuicePlannerState';

export type PumpkinJuiceValueThresholdState = {
  enabled: boolean;
  minNextApSaved: number;
  minTotalApSaved: number;
  minNextStaminaSaved: number;
  minTotalStaminaSaved: number;
};

export type PumpkinJuicePlannerState = {
  schemaVersion: 1;
  ownedPumpkinJuiceCount: number;
  valueThresholds: PumpkinJuiceValueThresholdState;
};

const DEFAULT_PUMPKIN_JUICE_PLANNER_STATE: PumpkinJuicePlannerState = {
  schemaVersion: 1,
  ownedPumpkinJuiceCount: 0,
  valueThresholds: {
    enabled: false,
    minNextApSaved: 0,
    minTotalApSaved: 0,
    minNextStaminaSaved: 0,
    minTotalStaminaSaved: 0,
  },
};

function clampNonNegativeNumber(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.floor(numericValue);
}

function toBoolean(value: unknown): boolean {
  return value === true;
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

export function createDefaultPumpkinJuicePlannerState(): PumpkinJuicePlannerState {
  return structuredClone(DEFAULT_PUMPKIN_JUICE_PLANNER_STATE);
}

export function normalizePumpkinJuicePlannerState(value: unknown): PumpkinJuicePlannerState {
  if (!value || typeof value !== 'object') {
    return createDefaultPumpkinJuicePlannerState();
  }

  const record = value as Partial<PumpkinJuicePlannerState>;
  const thresholds =
    record.valueThresholds && typeof record.valueThresholds === 'object'
      ? record.valueThresholds
      : {};

  return {
    schemaVersion: 1,
    ownedPumpkinJuiceCount: clampNonNegativeNumber(record.ownedPumpkinJuiceCount),
    valueThresholds: {
      enabled: toBoolean((thresholds as Partial<PumpkinJuiceValueThresholdState>).enabled),
      minNextApSaved: clampNonNegativeNumber(
        (thresholds as Partial<PumpkinJuiceValueThresholdState>).minNextApSaved,
      ),
      minTotalApSaved: clampNonNegativeNumber(
        (thresholds as Partial<PumpkinJuiceValueThresholdState>).minTotalApSaved,
      ),
      minNextStaminaSaved: clampNonNegativeNumber(
        (thresholds as Partial<PumpkinJuiceValueThresholdState>).minNextStaminaSaved,
      ),
      minTotalStaminaSaved: clampNonNegativeNumber(
        (thresholds as Partial<PumpkinJuiceValueThresholdState>).minTotalStaminaSaved,
      ),
    },
  };
}

export function loadPumpkinJuicePlannerState(storage?: Storage): PumpkinJuicePlannerState {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(PUMPKIN_JUICE_PLANNER_STATE_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultPumpkinJuicePlannerState();
  }

  try {
    return normalizePumpkinJuicePlannerState(JSON.parse(rawValue));
  } catch {
    return createDefaultPumpkinJuicePlannerState();
  }
}

export function savePumpkinJuicePlannerState(
  state: PumpkinJuicePlannerState,
  storage?: Storage,
): PumpkinJuicePlannerState {
  const normalizedState = normalizePumpkinJuicePlannerState(state);
  const activeStorage = getLocalStorage(storage);

  activeStorage.setItem(PUMPKIN_JUICE_PLANNER_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearPumpkinJuicePlannerState(storage?: Storage): void {
  const activeStorage = getLocalStorage(storage);
  activeStorage.removeItem(PUMPKIN_JUICE_PLANNER_STATE_STORAGE_KEY);
}
