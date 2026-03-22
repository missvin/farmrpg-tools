import { type AcquisitionFuturePetProductionEntryInput, type AcquisitionPlannerInputState } from './acquisitionPlannerState';
import { toCanonicalItemKey } from './normalizeItemKey';

export const FUTURE_PET_HOURLY_OUTPUT_PER_LEVEL = 1;
export const CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER = 1.5;
export const OWL_HONEY_DOUBLE_LEVEL_THRESHOLD = 6;

export type FuturePetProductionForecastPetDetail = {
  canonicalItemKey: string;
  itemName: string;
  petName: string;
  petLevel: number;
  seasonalActive: boolean;
  forecastHours: number;
  baseQuantity: number;
  specialRuleMultiplier: number;
  collectionMultiplier: number;
  forecastQuantity: number;
  appliedRuleNotes: string[];
};

export type FuturePetProductionForecastItem = {
  canonicalItemKey: string;
  itemName: string;
  forecastQuantity: number;
  sourcePetCount: number;
  petDetails: FuturePetProductionForecastPetDetail[];
};

export type FuturePetProductionForecastResult = {
  enabled: boolean;
  forecastHours: number;
  crunchyOmeletteActive: boolean;
  entries: FuturePetProductionForecastItem[];
  warnings: string[];
};

function getForecastHours(state: AcquisitionPlannerInputState): number {
  const requestedHours = state.pets.futureProduction.horizonDays * 24;
  return Math.min(requestedHours, state.pets.futureProduction.offlineHoursCap);
}

function getSpecialRuleMultiplier(entry: AcquisitionFuturePetProductionEntryInput): {
  multiplier: number;
  notes: string[];
} {
  const canonicalPetKey = toCanonicalItemKey(entry.petName);
  const notes: string[] = [];

  if (
    canonicalPetKey === 'owl' &&
    entry.canonicalItemKey === 'honey' &&
    entry.petLevel >= OWL_HONEY_DOUBLE_LEVEL_THRESHOLD
  ) {
    notes.push('Owl level 6+ honey double-output rule applied.');
    return {
      multiplier: 2,
      notes,
    };
  }

  return {
    multiplier: 1,
    notes,
  };
}

export function deriveFuturePetProductionForecast(
  state: AcquisitionPlannerInputState,
): FuturePetProductionForecastResult {
  const warnings: string[] = [];

  if (!state.pets.futureProduction.enabled) {
    return {
      enabled: false,
      forecastHours: 0,
      crunchyOmeletteActive: state.pets.futureProduction.crunchyOmeletteActive,
      entries: [],
      warnings,
    };
  }

  const forecastHours = getForecastHours(state);
  const collectionMultiplier = state.pets.futureProduction.crunchyOmeletteActive
    ? CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER
    : 1;
  const entriesByCanonicalKey = new Map<string, FuturePetProductionForecastItem>();

  for (const entry of state.pets.futureProduction.entries) {
    const seasonallyAllowed =
      !state.pets.futureProduction.respectSeasonality || entry.seasonalActive;
    const { multiplier: specialRuleMultiplier, notes } = getSpecialRuleMultiplier(entry);
    const baseQuantity = seasonallyAllowed
      ? entry.petLevel * forecastHours * FUTURE_PET_HOURLY_OUTPUT_PER_LEVEL
      : 0;
    const forecastQuantity = baseQuantity * specialRuleMultiplier * collectionMultiplier;

    const petDetail: FuturePetProductionForecastPetDetail = {
      canonicalItemKey: entry.canonicalItemKey,
      itemName: entry.itemName,
      petName: entry.petName,
      petLevel: entry.petLevel,
      seasonalActive: entry.seasonalActive,
      forecastHours: seasonallyAllowed ? forecastHours : 0,
      baseQuantity,
      specialRuleMultiplier,
      collectionMultiplier,
      forecastQuantity,
      appliedRuleNotes: seasonallyAllowed
        ? notes
        : ['Seasonality respected, so this pet contributes 0 in the current forecast.'],
    };

    const existingEntry = entriesByCanonicalKey.get(entry.canonicalItemKey);

    if (existingEntry) {
      existingEntry.forecastQuantity += forecastQuantity;
      existingEntry.sourcePetCount += 1;
      existingEntry.petDetails.push(petDetail);
      continue;
    }

    entriesByCanonicalKey.set(entry.canonicalItemKey, {
      canonicalItemKey: entry.canonicalItemKey,
      itemName: entry.itemName,
      forecastQuantity,
      sourcePetCount: 1,
      petDetails: [petDetail],
    });
  }

  return {
    enabled: true,
    forecastHours,
    crunchyOmeletteActive: state.pets.futureProduction.crunchyOmeletteActive,
    entries: Array.from(entriesByCanonicalKey.values()).sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalItemKey.localeCompare(right.canonicalItemKey);
    }),
    warnings,
  };
}
