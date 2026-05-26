import { type AcquisitionFuturePetProductionEntryInput, type AcquisitionPlannerInputState } from './acquisitionPlannerState';
import { findPetSourceReference, type PetSourceReferenceData } from './loadPetSourceReference';
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
  availableItemPoolSize: number;
  baseQuantity: number;
  specialRuleMultiplier: number;
  collectionMultiplier: number;
  forecastQuantity: number;
  petSourceUnlockLevel: number | null;
  petSourceUrl: string | null;
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

export type FuturePetProductionForecastOptions = {
  petSourceReference?: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
};

function getForecastHours(state: AcquisitionPlannerInputState): number {
  const requestedHours = state.pets.futureProduction.horizonDays * 24;
  return Math.min(requestedHours, state.pets.futureProduction.offlineHoursCap);
}

export function getAvailablePetItemPoolSize(petLevel: number): number {
  if (petLevel >= 6) {
    return 12;
  }

  if (petLevel >= 3) {
    return 8;
  }

  return 4;
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
  options: FuturePetProductionForecastOptions = {},
): FuturePetProductionForecastResult {
  const warnings: string[] = [];
  const warningKeys = new Set<string>();

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
    const availableItemPoolSize = getAvailablePetItemPoolSize(entry.petLevel);
    const petSourceReferenceLoaded = Boolean(options.petSourceReference);
    const petSourceReference = petSourceReferenceLoaded
      ? findPetSourceReference(
        options.petSourceReference,
        entry.petName,
        entry.canonicalItemKey,
      )
      : null;
    const unlockAllowed = !petSourceReference || entry.petLevel >= petSourceReference.unlockLevel;
    const baseQuantity = seasonallyAllowed && unlockAllowed
      ? (entry.petLevel * forecastHours * FUTURE_PET_HOURLY_OUTPUT_PER_LEVEL) / availableItemPoolSize
      : 0;
    const forecastQuantity = baseQuantity * specialRuleMultiplier * collectionMultiplier;
    const appliedRuleNotes = [...notes];

    if (petSourceReferenceLoaded && !petSourceReference) {
      const warningKey = `${entry.petName}:${entry.canonicalItemKey}`;

      if (!warningKeys.has(warningKey)) {
        warnings.push(
          `Pet source coverage is missing for ${entry.petName} -> ${entry.itemName}; using the level-based item pool and assuming the item is available.`,
        );
        warningKeys.add(warningKey);
      }

      appliedRuleNotes.push('Pet-source unlock level is not in local reference data.');
    } else if (petSourceReference) {
      appliedRuleNotes.push(`Buddy pet-source unlock level ${petSourceReference.unlockLevel}.`);
    } else {
      appliedRuleNotes.push('Pet-source coverage was not loaded for this forecast.');
    }

    appliedRuleNotes.push(`Pet level ${entry.petLevel} uses a ${availableItemPoolSize}-item output pool.`);

    const petDetail: FuturePetProductionForecastPetDetail = {
      canonicalItemKey: entry.canonicalItemKey,
      itemName: entry.itemName,
      petName: entry.petName,
      petLevel: entry.petLevel,
      seasonalActive: entry.seasonalActive,
      forecastHours: seasonallyAllowed ? forecastHours : 0,
      availableItemPoolSize,
      baseQuantity,
      specialRuleMultiplier,
      collectionMultiplier,
      forecastQuantity,
      petSourceUnlockLevel: petSourceReference?.unlockLevel ?? null,
      petSourceUrl: petSourceReference?.sourceUrl ?? null,
      appliedRuleNotes: seasonallyAllowed
        ? unlockAllowed
          ? appliedRuleNotes
          : [
            ...appliedRuleNotes,
            `Pet level ${entry.petLevel} is below the local unlock level, so this pet contributes 0 in the current forecast.`,
          ]
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
