import type { AcquisitionPlannerInputState } from './acquisitionPlannerState';
import {
  CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER,
  deriveFuturePetProductionForecast,
} from './deriveFuturePetProductionForecast';
import type { DropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import { convertDropRateUnit } from './dropRateUnitConversions';
import type { DropRateReferenceData, DropRateReferenceEntry } from './loadDropRateReference';
import type { PetSourceReferenceData } from './loadPetSourceReference';
import { toCanonicalItemKey } from './normalizeItemKey';

export const DEFAULT_LARGE_NET_CRAFT_OUTPUT_MULTIPLIER = 1.45;
export const DEFAULT_LARGE_NET_CATCH_MULTIPLIER = 1.1;
export const FISHING_NETS_PER_LARGE_NET = 25;

export type LargeNetPlannerTargetInput = {
  itemName: string;
  canonicalKey?: string;
  targetQuantity: number;
  regularInventoryOverride?: number;
  storedPetInventoryOverride?: number;
  petForecastOverride?: {
    petName: string;
    petLevel: number;
    seasonalActive?: boolean;
  };
  manualLargeNetsPerDrop?: number;
};

export type LargeNetPlannerTargetResult = {
  itemName: string;
  canonicalKey: string;
  targetQuantity: number;
  regularInventoryQuantity: number;
  regularInventoryQuantitySource: 'imported' | 'override';
  storedPetInventoryQuantity: number;
  storedPetInventoryQuantitySource: 'imported' | 'override';
  effectiveStoredPetInventoryQuantity: number;
  immediateQuantity: number;
  dailyPetQuantity: number;
  dailyPetQuantitySource: 'saved_forecast' | 'override';
  remainingAfterImmediateQuantity: number;
  largeNetsPerDrop: number;
  largeNetsPerDropSource: 'manual' | 'drop_rate_reference' | 'missing';
  largeNetsPerDropSourceLabel: string | null;
  largeNetsPerDropSourceUrl: string | null;
  fishingItemsPerDay: number;
  totalItemsPerDay: number;
  soloDays: number | null;
  largeNetsNeededNow: number | null;
  warnings: string[];
};

export type LargeNetPlannerResult = {
  dailyLargeNetsFromAntlers: number;
  dailyLargeNets: number;
  dailyLargeNetSource: 'direct_override' | 'antlers';
  craftOutputMultiplier: number;
  catchMultiplier: number;
  petCollectionMultiplier: number;
  targets: LargeNetPlannerTargetResult[];
  competingDays: number | null;
  incidentalDays: number | null;
  warnings: string[];
};

export type BuildLargeNetPlannerInput = {
  acquisitionState: AcquisitionPlannerInputState;
  dropRateReference?: DropRateReferenceData | null;
  dropRateSettings: DropRateAcquisitionSettings;
  petSourceReference?: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
  targets: LargeNetPlannerTargetInput[];
  dailyAntlers: number;
  directLargeNetsPerDay?: number;
  craftOutputMultiplier?: number;
  catchMultiplier?: number;
  petCollectionMultiplier?: number;
  crunchyOmeletteActive?: boolean;
};

function clampNonNegative(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}

function clampPositive(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function calculateDailyLargeNetsFromAntlers(input: {
  dailyAntlers: number;
  craftOutputMultiplier?: number;
}): number {
  const dailyAntlers = clampNonNegative(input.dailyAntlers);
  const craftOutputMultiplier = clampPositive(
    input.craftOutputMultiplier,
    DEFAULT_LARGE_NET_CRAFT_OUTPUT_MULTIPLIER,
  );

  return (dailyAntlers * craftOutputMultiplier * craftOutputMultiplier) / FISHING_NETS_PER_LARGE_NET;
}

function dropRateRowMatchesSettings(
  row: DropRateReferenceEntry,
  settings: DropRateAcquisitionSettings,
): boolean {
  if (row.ironDepot !== null && row.ironDepot !== settings.perks.ironDepotActive) {
    return false;
  }

  if (row.runecube !== null && row.runecube !== settings.perks.eagleEyeRunecubeActive) {
    return false;
  }

  return true;
}

function getLargeNetsPerDropFromReference(input: {
  canonicalKey: string;
  dropRateReference?: DropRateReferenceData | null;
  dropRateSettings: DropRateAcquisitionSettings;
}): {
  largeNetsPerDrop: number;
  sourceLabel: string | null;
  sourceUrl: string | null;
} {
  const matchingRows = input.dropRateReference?.byTargetCanonicalKey[input.canonicalKey]
    ?.filter((row) => row.sourceType === 'fishing' && dropRateRowMatchesSettings(row, input.dropRateSettings)) ?? [];
  let bestMatch: {
    largeNetsPerDrop: number;
    sourceLabel: string | null;
    sourceUrl: string | null;
  } | null = null;

  for (const row of matchingRows) {
    const conversion = convertDropRateUnit({
      rate: row.rawRate,
      sourceType: row.sourceType,
      fromUnit: 'fish',
      toUnit: 'large_nets',
      direction: 'units_per_item',
      settings: input.dropRateSettings,
      baseDropRate: row.baseDropRate,
    });

    if (conversion.calculable && conversion.rate > 0) {
      if (!bestMatch || conversion.rate < bestMatch.largeNetsPerDrop) {
        bestMatch = {
          largeNetsPerDrop: conversion.rate,
          sourceLabel: row.sourceName,
          sourceUrl: row.sourcePageUrl,
        };
      }
    }
  }

  return bestMatch ?? {
    largeNetsPerDrop: 0,
    sourceLabel: null,
    sourceUrl: null,
  };
}

function sumCurrentInventory(acquisitionState: AcquisitionPlannerInputState, canonicalKey: string): number {
  return acquisitionState.inventory.entries
    .filter((entry) => entry.canonicalItemKey === canonicalKey)
    .reduce((total, entry) => total + entry.inventoryCount, 0);
}

function sumStoredPetInventory(acquisitionState: AcquisitionPlannerInputState, canonicalKey: string): number {
  return acquisitionState.pets.storedInventoryEntries
    .filter((entry) => entry.canonicalItemKey === canonicalKey)
    .reduce((total, entry) => total + entry.storedCount, 0);
}

function getDailyPetQuantityByCanonicalKey(input: {
  acquisitionState: AcquisitionPlannerInputState;
  crunchyOmeletteActive: boolean;
  petSourceReference?: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
}): {
  dailyQuantityByCanonicalKey: Record<string, number>;
  warnings: string[];
} {
  const dailyState: AcquisitionPlannerInputState = {
    ...input.acquisitionState,
    pets: {
      ...input.acquisitionState.pets,
      futureProduction: {
        ...input.acquisitionState.pets.futureProduction,
        enabled: input.acquisitionState.pets.futureProduction.entries.length > 0,
        horizonDays: 1,
        offlineHoursCap: 24,
        crunchyOmeletteActive: input.crunchyOmeletteActive,
      },
    },
  };
  const forecast = deriveFuturePetProductionForecast(dailyState, {
    petSourceReference: input.petSourceReference,
  });

  return {
    dailyQuantityByCanonicalKey: Object.fromEntries(
      forecast.entries.map((entry) => [entry.canonicalItemKey, entry.forecastQuantity]),
    ),
    warnings: forecast.warnings,
  };
}

function getDailyPetQuantityFromOverride(input: {
  acquisitionState: AcquisitionPlannerInputState;
  itemName: string;
  canonicalKey: string;
  crunchyOmeletteActive: boolean;
  petSourceReference?: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
  petForecastOverride: NonNullable<LargeNetPlannerTargetInput['petForecastOverride']>;
}): {
  dailyQuantity: number;
  warnings: string[];
} {
  const petName = input.petForecastOverride.petName.trim();

  if (!petName) {
    return {
      dailyQuantity: 0,
      warnings: ['Enter a pet name to use a quick pet-level override.'],
    };
  }

  const forecastState: AcquisitionPlannerInputState = {
    ...input.acquisitionState,
    pets: {
      ...input.acquisitionState.pets,
      futureProduction: {
        ...input.acquisitionState.pets.futureProduction,
        enabled: true,
        horizonDays: 1,
        entries: [
          {
            canonicalItemKey: input.canonicalKey,
            itemName: input.itemName,
            petName,
            petLevel: input.petForecastOverride.petLevel,
            seasonalActive: input.petForecastOverride.seasonalActive ?? true,
          },
        ],
        respectSeasonality: false,
        offlineHoursCap: 24,
        crunchyOmeletteActive: input.crunchyOmeletteActive,
      },
    },
  };
  const forecast = deriveFuturePetProductionForecast(forecastState, {
    petSourceReference: input.petSourceReference,
  });

  return {
    dailyQuantity: forecast.entries.find((entry) => entry.canonicalItemKey === input.canonicalKey)?.forecastQuantity ?? 0,
    warnings: forecast.warnings,
  };
}

function calculateSoloDays(remainingQuantity: number, itemsPerDay: number): number | null {
  if (remainingQuantity <= 0) {
    return 0;
  }

  if (itemsPerDay <= 0) {
    return null;
  }

  return remainingQuantity / itemsPerDay;
}

function largeNetsNeededAfterPetDays(target: LargeNetPlannerTargetResult, days: number, catchMultiplier: number): number {
  if (target.largeNetsPerDrop <= 0) {
    return 0;
  }

  const remainingAfterPets = Math.max(0, target.remainingAfterImmediateQuantity - target.dailyPetQuantity * days);
  return (remainingAfterPets * target.largeNetsPerDrop) / catchMultiplier;
}

function canFinishCompetingTargetsInDays(
  targets: LargeNetPlannerTargetResult[],
  days: number,
  dailyLargeNets: number,
  catchMultiplier: number,
): boolean {
  const requiredLargeNets = targets.reduce((total, target) => {
    return total + largeNetsNeededAfterPetDays(target, days, catchMultiplier);
  }, 0);

  return requiredLargeNets <= dailyLargeNets * days;
}

function calculateCompetingDays(
  targets: LargeNetPlannerTargetResult[],
  dailyLargeNets: number,
  catchMultiplier: number,
): number | null {
  if (
    targets.some((target) => (
      target.remainingAfterImmediateQuantity > 0 &&
      target.largeNetsPerDrop <= 0 &&
      target.dailyPetQuantity <= 0
    ))
  ) {
    return null;
  }

  const calculableTargets = targets.filter((target) => {
    return target.remainingAfterImmediateQuantity > 0 && (target.largeNetsPerDrop > 0 || target.dailyPetQuantity > 0);
  });

  if (calculableTargets.length === 0) {
    return targets.every((target) => target.remainingAfterImmediateQuantity <= 0) ? 0 : null;
  }

  if (dailyLargeNets <= 0 && calculableTargets.some((target) => target.dailyPetQuantity <= 0)) {
    return null;
  }

  let high = 1;
  const maxIterations = 80;

  for (let index = 0; index < maxIterations; index += 1) {
    if (canFinishCompetingTargetsInDays(calculableTargets, high, dailyLargeNets, catchMultiplier)) {
      break;
    }

    high *= 2;
  }

  if (!canFinishCompetingTargetsInDays(calculableTargets, high, dailyLargeNets, catchMultiplier)) {
    return null;
  }

  let low = 0;

  for (let index = 0; index < maxIterations; index += 1) {
    const mid = (low + high) / 2;

    if (canFinishCompetingTargetsInDays(calculableTargets, mid, dailyLargeNets, catchMultiplier)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return high;
}

export function buildLargeNetPlanner(input: BuildLargeNetPlannerInput): LargeNetPlannerResult {
  const craftOutputMultiplier = clampPositive(
    input.craftOutputMultiplier,
    DEFAULT_LARGE_NET_CRAFT_OUTPUT_MULTIPLIER,
  );
  const catchMultiplier = clampPositive(input.catchMultiplier, DEFAULT_LARGE_NET_CATCH_MULTIPLIER);
  const crunchyOmeletteActive = input.crunchyOmeletteActive ?? input.acquisitionState.pets.futureProduction.crunchyOmeletteActive;
  const petCollectionMultiplier = clampPositive(
    input.petCollectionMultiplier,
    crunchyOmeletteActive ? CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER : 1,
  );
  const dailyLargeNetsFromAntlers = calculateDailyLargeNetsFromAntlers({
    dailyAntlers: input.dailyAntlers,
    craftOutputMultiplier,
  });
  const directLargeNetsPerDay = clampNonNegative(input.directLargeNetsPerDay);
  const dailyLargeNets = directLargeNetsPerDay > 0 ? directLargeNetsPerDay : dailyLargeNetsFromAntlers;
  const dailyLargeNetSource = directLargeNetsPerDay > 0 ? 'direct_override' : 'antlers';
  const dailyPetForecast = getDailyPetQuantityByCanonicalKey({
    acquisitionState: input.acquisitionState,
    crunchyOmeletteActive,
    petSourceReference: input.petSourceReference,
  });
  const warnings = [...dailyPetForecast.warnings];
  const targets = input.targets
    .map<LargeNetPlannerTargetResult | null>((target) => {
      const itemName = target.itemName.trim();
      const canonicalKey = toCanonicalItemKey(target.canonicalKey || itemName);
      const targetQuantity = clampNonNegative(target.targetQuantity);

      if (!canonicalKey || !itemName) {
        return null;
      }

      const manualLargeNetsPerDrop = clampNonNegative(target.manualLargeNetsPerDrop);
      const referencedLargeNetsPerDrop = getLargeNetsPerDropFromReference({
        canonicalKey,
        dropRateReference: input.dropRateReference,
        dropRateSettings: input.dropRateSettings,
      });
      const largeNetsPerDrop =
        manualLargeNetsPerDrop > 0 ? manualLargeNetsPerDrop : referencedLargeNetsPerDrop.largeNetsPerDrop;
      const largeNetsPerDropSource =
        manualLargeNetsPerDrop > 0
          ? 'manual'
          : referencedLargeNetsPerDrop.largeNetsPerDrop > 0
            ? 'drop_rate_reference'
            : 'missing';
      const targetWarnings: string[] = [];

      if (largeNetsPerDropSource === 'missing') {
        targetWarnings.push('Enter Large Nets per drop or add reviewed fishing drop-rate coverage.');
      }

      const regularInventoryOverride = clampNonNegative(target.regularInventoryOverride);
      const storedPetInventoryOverride = clampNonNegative(target.storedPetInventoryOverride);
      const hasRegularInventoryOverride = Number.isFinite(target.regularInventoryOverride) &&
        Number(target.regularInventoryOverride) >= 0;
      const hasStoredPetInventoryOverride = Number.isFinite(target.storedPetInventoryOverride) &&
        Number(target.storedPetInventoryOverride) >= 0;
      const regularInventoryQuantity = hasRegularInventoryOverride
        ? regularInventoryOverride
        : sumCurrentInventory(input.acquisitionState, canonicalKey);
      const storedPetInventoryQuantity = hasStoredPetInventoryOverride
        ? storedPetInventoryOverride
        : sumStoredPetInventory(input.acquisitionState, canonicalKey);
      const effectiveStoredPetInventoryQuantity = storedPetInventoryQuantity * petCollectionMultiplier;
      const immediateQuantity = regularInventoryQuantity + effectiveStoredPetInventoryQuantity;
      const remainingAfterImmediateQuantity = Math.max(0, targetQuantity - immediateQuantity);
      const petOverrideForecast = target.petForecastOverride && target.petForecastOverride.petLevel > 0
        ? getDailyPetQuantityFromOverride({
          acquisitionState: input.acquisitionState,
          itemName,
          canonicalKey,
          crunchyOmeletteActive,
          petSourceReference: input.petSourceReference,
          petForecastOverride: target.petForecastOverride,
        })
        : null;
      const dailyPetQuantity = petOverrideForecast?.dailyQuantity ??
        dailyPetForecast.dailyQuantityByCanonicalKey[canonicalKey] ??
        0;

      if (petOverrideForecast) {
        targetWarnings.push(...petOverrideForecast.warnings);
      }

      const fishingItemsPerDay = largeNetsPerDrop > 0
        ? (dailyLargeNets * catchMultiplier) / largeNetsPerDrop
        : 0;
      const totalItemsPerDay = fishingItemsPerDay + dailyPetQuantity;

      return {
        itemName,
        canonicalKey,
        targetQuantity,
        regularInventoryQuantity,
        regularInventoryQuantitySource: hasRegularInventoryOverride ? 'override' : 'imported',
        storedPetInventoryQuantity,
        storedPetInventoryQuantitySource: hasStoredPetInventoryOverride ? 'override' : 'imported',
        effectiveStoredPetInventoryQuantity,
        immediateQuantity,
        dailyPetQuantity,
        dailyPetQuantitySource: petOverrideForecast ? 'override' : 'saved_forecast',
        remainingAfterImmediateQuantity,
        largeNetsPerDrop,
        largeNetsPerDropSource,
        largeNetsPerDropSourceLabel: referencedLargeNetsPerDrop.sourceLabel,
        largeNetsPerDropSourceUrl: referencedLargeNetsPerDrop.sourceUrl,
        fishingItemsPerDay,
        totalItemsPerDay,
        soloDays: calculateSoloDays(remainingAfterImmediateQuantity, totalItemsPerDay),
        largeNetsNeededNow: largeNetsPerDrop > 0
          ? (remainingAfterImmediateQuantity * largeNetsPerDrop) / catchMultiplier
          : null,
        warnings: targetWarnings,
      };
    })
    .filter((target): target is LargeNetPlannerTargetResult => Boolean(target));
  const soloDays = targets
    .map((target) => target.soloDays)
    .filter((days): days is number => days !== null);
  const incidentalDays =
    soloDays.length === targets.length ? Math.max(...soloDays, 0) : null;
  const competingDays = calculateCompetingDays(targets, dailyLargeNets, catchMultiplier);

  if (dailyLargeNets <= 0) {
    warnings.push('Enter daily Antlers or direct Large Nets per day to estimate fishing progress.');
  }

  return {
    dailyLargeNetsFromAntlers,
    dailyLargeNets,
    dailyLargeNetSource,
    craftOutputMultiplier,
    catchMultiplier,
    petCollectionMultiplier,
    targets,
    competingDays,
    incidentalDays,
    warnings,
  };
}
