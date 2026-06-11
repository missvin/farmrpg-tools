export const SOURCE_RATE_ASSUMPTIONS_STORAGE_KEY = 'farmrpg-tools.sourceRateAssumptions.v1';

export type StandardSourceRateKey =
  | 'arnold_palmers'
  | 'large_nets'
  | 'apple_ciders'
  | 'explores'
  | 'pet_days'
  | 'wishing_well_throws';

export type SourceRateAssumption = {
  sourceKey: StandardSourceRateKey | string;
  label: string;
  unitLabel: string;
  dailyQuantity: number;
  custom: boolean;
};

export type SourceRateAssumptionsState = {
  schemaVersion: 1;
  rates: SourceRateAssumption[];
};

export const STANDARD_SOURCE_RATE_ASSUMPTIONS: SourceRateAssumption[] = [
  {
    sourceKey: 'arnold_palmers',
    label: 'Arnold Palmers',
    unitLabel: 'Arnold Palmers/day',
    dailyQuantity: 0,
    custom: false,
  },
  {
    sourceKey: 'large_nets',
    label: 'Large Nets',
    unitLabel: 'Large Nets/day',
    dailyQuantity: 0,
    custom: false,
  },
  {
    sourceKey: 'apple_ciders',
    label: 'Apple Ciders',
    unitLabel: 'Apple Ciders/day',
    dailyQuantity: 0,
    custom: false,
  },
  {
    sourceKey: 'explores',
    label: 'Explores',
    unitLabel: 'Explores/day',
    dailyQuantity: 0,
    custom: false,
  },
  {
    sourceKey: 'pet_days',
    label: 'Pet Days',
    unitLabel: 'Pet days/day',
    dailyQuantity: 0,
    custom: false,
  },
  {
    sourceKey: 'wishing_well_throws',
    label: 'Wishing Well Throws',
    unitLabel: 'Throws/day',
    dailyQuantity: 0,
    custom: false,
  },
];

const STANDARD_RATE_KEYS = new Set(STANDARD_SOURCE_RATE_ASSUMPTIONS.map((entry) => entry.sourceKey));

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
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
}

function normalizeSourceKey(value: unknown): string {
  return normalizeText(value).toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '_').replace(/^_+|_+$/gu, '');
}

function clampNonNegativeNumber(value: unknown, fallback = 0): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return numericValue;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return value === true ? true : value === false ? false : fallback;
}

function normalizeSourceRateAssumption(value: unknown): SourceRateAssumption | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<SourceRateAssumption>;
  const label = normalizeText(record.label);
  const sourceKey = normalizeSourceKey(record.sourceKey ?? label);
  const unitLabel = normalizeText(record.unitLabel);
  const dailyQuantity = clampNonNegativeNumber(record.dailyQuantity, -1);

  if (sourceKey.length === 0 || label.length === 0 || dailyQuantity < 0) {
    return null;
  }

  return {
    sourceKey,
    label,
    unitLabel: unitLabel.length > 0 ? unitLabel : `${label}/day`,
    dailyQuantity,
    custom: normalizeBoolean(record.custom, !STANDARD_RATE_KEYS.has(sourceKey)),
  };
}

export function createDefaultSourceRateAssumptionsState(): SourceRateAssumptionsState {
  return {
    schemaVersion: 1,
    rates: structuredClone(STANDARD_SOURCE_RATE_ASSUMPTIONS),
  };
}

export function normalizeSourceRateAssumptionsState(value: unknown): SourceRateAssumptionsState {
  const defaults = createDefaultSourceRateAssumptionsState();

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const record = value as Partial<SourceRateAssumptionsState>;
  const incomingRates = Array.isArray(record.rates)
    ? record.rates
      .map((entry) => normalizeSourceRateAssumption(entry))
      .filter((entry): entry is SourceRateAssumption => Boolean(entry))
    : [];
  const ratesByKey = new Map<string, SourceRateAssumption>();

  for (const defaultRate of defaults.rates) {
    ratesByKey.set(defaultRate.sourceKey, defaultRate);
  }

  for (const rate of incomingRates) {
    const defaultRate = ratesByKey.get(rate.sourceKey);

    ratesByKey.set(rate.sourceKey, {
      ...rate,
      label: defaultRate?.label ?? rate.label,
      unitLabel: defaultRate?.unitLabel ?? rate.unitLabel,
      custom: defaultRate ? false : rate.custom,
    });
  }

  return {
    schemaVersion: 1,
    rates: Array.from(ratesByKey.values()).sort((left, right) => {
      const leftStandardIndex = STANDARD_SOURCE_RATE_ASSUMPTIONS.findIndex((entry) => {
        return entry.sourceKey === left.sourceKey;
      });
      const rightStandardIndex = STANDARD_SOURCE_RATE_ASSUMPTIONS.findIndex((entry) => {
        return entry.sourceKey === right.sourceKey;
      });

      if (leftStandardIndex >= 0 || rightStandardIndex >= 0) {
        return (leftStandardIndex >= 0 ? leftStandardIndex : 999) -
          (rightStandardIndex >= 0 ? rightStandardIndex : 999);
      }

      return left.label.localeCompare(right.label) || left.sourceKey.localeCompare(right.sourceKey);
    }),
  };
}

export function isValidSourceRateAssumptionsState(
  value: unknown,
): value is SourceRateAssumptionsState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as SourceRateAssumptionsState;

  return (
    record.schemaVersion === 1 &&
    Array.isArray(record.rates) &&
    record.rates.every((entry) => {
      return (
        entry &&
        typeof entry === 'object' &&
        typeof entry.sourceKey === 'string' &&
        entry.sourceKey.length > 0 &&
        typeof entry.label === 'string' &&
        entry.label.length > 0 &&
        typeof entry.unitLabel === 'string' &&
        entry.unitLabel.length > 0 &&
        typeof entry.dailyQuantity === 'number' &&
        Number.isFinite(entry.dailyQuantity) &&
        entry.dailyQuantity >= 0 &&
        (entry.custom === true || entry.custom === false)
      );
    })
  );
}

export function loadSourceRateAssumptionsState(storage?: Storage): SourceRateAssumptionsState {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(SOURCE_RATE_ASSUMPTIONS_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultSourceRateAssumptionsState();
  }

  try {
    return normalizeSourceRateAssumptionsState(JSON.parse(rawValue));
  } catch {
    return createDefaultSourceRateAssumptionsState();
  }
}

export function saveSourceRateAssumptionsState(
  state: SourceRateAssumptionsState,
  storage?: Storage,
): SourceRateAssumptionsState {
  const normalizedState = normalizeSourceRateAssumptionsState(state);

  getLocalStorage(storage).setItem(SOURCE_RATE_ASSUMPTIONS_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearSourceRateAssumptionsState(storage?: Storage): void {
  getLocalStorage(storage).removeItem(SOURCE_RATE_ASSUMPTIONS_STORAGE_KEY);
}

export function getSourceRateAssumption(
  state: SourceRateAssumptionsState,
  sourceKey: string,
): SourceRateAssumption | null {
  const normalizedKey = normalizeSourceKey(sourceKey);
  return state.rates.find((entry) => entry.sourceKey === normalizedKey) ?? null;
}

export function getSourceRatePerDay(
  state: SourceRateAssumptionsState,
  sourceKey: string,
): number | null {
  return getSourceRateAssumption(state, sourceKey)?.dailyQuantity ?? null;
}

export function upsertSourceRateAssumption(
  state: SourceRateAssumptionsState,
  input: {
    sourceKey?: string;
    label: string;
    unitLabel?: string;
    dailyQuantity: number;
    custom?: boolean;
  },
): SourceRateAssumptionsState {
  const label = normalizeText(input.label);
  const sourceKey = normalizeSourceKey(input.sourceKey ?? label);
  const dailyQuantity = clampNonNegativeNumber(input.dailyQuantity, -1);

  if (sourceKey.length === 0 || label.length === 0 || dailyQuantity < 0) {
    return normalizeSourceRateAssumptionsState(state);
  }

  const existingRate = getSourceRateAssumption(state, sourceKey);
  const nextRates = state.rates.filter((entry) => entry.sourceKey !== sourceKey);

  nextRates.push({
    sourceKey,
    label: existingRate && !existingRate.custom ? existingRate.label : label,
    unitLabel: existingRate && !existingRate.custom
      ? existingRate.unitLabel
      : normalizeText(input.unitLabel) || `${label}/day`,
    dailyQuantity,
    custom: existingRate ? existingRate.custom : input.custom ?? !STANDARD_RATE_KEYS.has(sourceKey),
  });

  return normalizeSourceRateAssumptionsState({
    schemaVersion: 1,
    rates: nextRates,
  });
}

export function removeCustomSourceRateAssumption(
  state: SourceRateAssumptionsState,
  sourceKey: string,
): SourceRateAssumptionsState {
  const normalizedKey = normalizeSourceKey(sourceKey);

  if (STANDARD_RATE_KEYS.has(normalizedKey)) {
    return normalizeSourceRateAssumptionsState(state);
  }

  return normalizeSourceRateAssumptionsState({
    schemaVersion: 1,
    rates: state.rates.filter((entry) => entry.sourceKey !== normalizedKey),
  });
}
