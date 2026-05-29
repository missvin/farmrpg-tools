import {
  type AcquisitionPlannerInputState,
  resolveAcquisitionSourceInclusionMap,
} from './acquisitionPlannerState';
import { deriveFuturePetProductionForecast } from './deriveFuturePetProductionForecast';
import type { DropRateReferenceData } from './loadDropRateReference';
import type { PetSourceReferenceData } from './loadPetSourceReference';
import type { RecursiveIngredientBurdenResult } from './recursiveIngredientBurden';

export type ItemAcquisitionContext = {
  canonicalKey: string;
  requiredQuantity: number | null;
  hasBreakdownTarget: boolean;
  immediateSavedQuantity: number;
  futurePetQuantity: number;
  totalSavedQuantity: number;
  dropRateSourceCount: number;
};

export type DeriveItemAcquisitionContextInput = {
  canonicalKey: string;
  acquisitionState: AcquisitionPlannerInputState;
  burdenResult?: RecursiveIngredientBurdenResult | null;
  dropRateReference?: DropRateReferenceData | null;
  petSourceReference?: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
};

function sumOwnedNowEntries(
  acquisitionState: AcquisitionPlannerInputState,
  canonicalKey: string,
  sourceCategory: 'stockpile' | 'container',
): number {
  return acquisitionState.ownedNow.entries
    .filter((entry) => entry.canonicalItemKey === canonicalKey && entry.sourceCategory === sourceCategory)
    .reduce((total, entry) => total + entry.ownedCount, 0);
}

function sumCurrentInventoryEntries(
  acquisitionState: AcquisitionPlannerInputState,
  canonicalKey: string,
): number {
  return acquisitionState.inventory.entries
    .filter((entry) => entry.canonicalItemKey === canonicalKey)
    .reduce((total, entry) => total + entry.inventoryCount, 0);
}

export function deriveItemAcquisitionContext({
  canonicalKey,
  acquisitionState,
  burdenResult,
  dropRateReference,
  petSourceReference,
}: DeriveItemAcquisitionContextInput): ItemAcquisitionContext {
  const inclusionMap = resolveAcquisitionSourceInclusionMap(acquisitionState);
  const burdenEntry = burdenResult?.ingredientBurdenByCanonicalKey[canonicalKey] ?? null;
  const futurePetForecast = deriveFuturePetProductionForecast(acquisitionState, { petSourceReference });
  const futurePetEntry = futurePetForecast.entries.find((entry) => entry.canonicalItemKey === canonicalKey);
  const stockpileQuantity = inclusionMap.owned_stockpiles
    ? sumOwnedNowEntries(acquisitionState, canonicalKey, 'stockpile')
    : 0;
  const containerQuantity = inclusionMap.owned_containers
    ? sumOwnedNowEntries(acquisitionState, canonicalKey, 'container')
    : 0;
  const currentInventoryQuantity = inclusionMap.current_inventory
    ? sumCurrentInventoryEntries(acquisitionState, canonicalKey)
    : 0;
  const storedPetQuantity = inclusionMap.stored_pet_inventory
    ? acquisitionState.pets.storedInventoryEntries
      .filter((entry) => entry.canonicalItemKey === canonicalKey)
      .reduce((total, entry) => total + entry.storedCount, 0)
    : 0;
  const futurePetQuantity =
    inclusionMap.future_pet_production && futurePetForecast.enabled
      ? futurePetEntry?.forecastQuantity ?? 0
      : 0;
  const immediateSavedQuantity = stockpileQuantity + containerQuantity + currentInventoryQuantity + storedPetQuantity;

  return {
    canonicalKey,
    requiredQuantity: burdenEntry ? Math.ceil(burdenEntry.totalRequiredEffectiveOutput) : null,
    hasBreakdownTarget: Boolean(burdenEntry),
    immediateSavedQuantity,
    futurePetQuantity,
    totalSavedQuantity: immediateSavedQuantity + futurePetQuantity,
    dropRateSourceCount: dropRateReference?.byTargetCanonicalKey[canonicalKey]?.length ?? 0,
  };
}
