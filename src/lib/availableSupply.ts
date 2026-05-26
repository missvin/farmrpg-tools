import {
  resolveAcquisitionSourceInclusionMap,
  type AcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import { getAcquisitionSourceDefinition } from './acquisitionSourceCatalog';
import { deriveFuturePetProductionForecast } from './deriveFuturePetProductionForecast';
import type { PetSourceReferenceData } from './loadPetSourceReference';
import { toCanonicalItemKey } from './normalizeItemKey';

export type AvailableSupplySourceKey =
  | 'owned_stockpiles'
  | 'owned_containers'
  | 'stored_pet_inventory'
  | 'future_pet_production'
  | 'manual_override';

export type AvailableSupplyTiming = 'immediate' | 'future' | 'override';

export type AvailableSupplyBreakdownEntry = {
  sourceKey: AvailableSupplySourceKey;
  label: string;
  timing: AvailableSupplyTiming;
  quantity: number;
  notes: string[];
};

export type AvailableSupplyOverrideInput = {
  canonicalKey: string;
  itemName: string;
  quantity: number;
};

export type AvailableSupplyItem = {
  canonicalKey: string;
  itemName: string;
  derivedQuantity: number;
  effectiveQuantity: number;
  overrideQuantity: number | null;
  breakdowns: AvailableSupplyBreakdownEntry[];
  warnings: string[];
};

export type AvailableSupplyPool = {
  items: AvailableSupplyItem[];
  byCanonicalKey: Record<string, AvailableSupplyItem>;
  warnings: string[];
};

export type DeriveAvailableSupplyPoolInput = {
  acquisitionState: AcquisitionPlannerInputState;
  petSourceReference?: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
  overrides?: AvailableSupplyOverrideInput[];
};

function clampQuantity(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getSourceLabel(sourceKey: AvailableSupplySourceKey): string {
  if (sourceKey === 'manual_override') {
    return 'Manual Override';
  }

  return getAcquisitionSourceDefinition(sourceKey)?.label ?? sourceKey;
}

function getOrCreateItem(
  itemsByCanonicalKey: Map<string, AvailableSupplyItem>,
  canonicalKey: string,
  itemName: string,
): AvailableSupplyItem {
  const normalizedKey = toCanonicalItemKey(canonicalKey);
  const existingItem = itemsByCanonicalKey.get(normalizedKey);

  if (existingItem) {
    if (existingItem.itemName === normalizedKey && itemName.trim().length > 0) {
      existingItem.itemName = itemName.trim();
    }

    return existingItem;
  }

  const item: AvailableSupplyItem = {
    canonicalKey: normalizedKey,
    itemName: itemName.trim() || normalizedKey,
    derivedQuantity: 0,
    effectiveQuantity: 0,
    overrideQuantity: null,
    breakdowns: [],
    warnings: [],
  };

  itemsByCanonicalKey.set(normalizedKey, item);
  return item;
}

function addBreakdown(
  itemsByCanonicalKey: Map<string, AvailableSupplyItem>,
  input: {
    canonicalKey: string;
    itemName: string;
    sourceKey: AvailableSupplySourceKey;
    timing: AvailableSupplyTiming;
    quantity: number;
    notes?: string[];
  },
): void {
  const quantity = clampQuantity(input.quantity);

  if (quantity <= 0) {
    return;
  }

  const item = getOrCreateItem(itemsByCanonicalKey, input.canonicalKey, input.itemName);

  item.derivedQuantity += quantity;
  item.breakdowns.push({
    sourceKey: input.sourceKey,
    label: getSourceLabel(input.sourceKey),
    timing: input.timing,
    quantity,
    notes: input.notes ?? [],
  });
}

function applyOverrides(
  itemsByCanonicalKey: Map<string, AvailableSupplyItem>,
  overrides: AvailableSupplyOverrideInput[],
): void {
  for (const override of overrides) {
    const canonicalKey = toCanonicalItemKey(override.canonicalKey || override.itemName);
    const quantity = clampQuantity(override.quantity);

    if (canonicalKey.length === 0) {
      continue;
    }

    const item = getOrCreateItem(itemsByCanonicalKey, canonicalKey, override.itemName);
    item.overrideQuantity = quantity;
    item.effectiveQuantity = quantity;
    item.breakdowns.push({
      sourceKey: 'manual_override',
      label: getSourceLabel('manual_override'),
      timing: 'override',
      quantity,
      notes: ['Manual override replaces derived supply for planning while preserving source detail.'],
    });
  }
}

export function deriveAvailableSupplyPool(input: DeriveAvailableSupplyPoolInput): AvailableSupplyPool {
  const inclusionMap = resolveAcquisitionSourceInclusionMap(input.acquisitionState);
  const itemsByCanonicalKey = new Map<string, AvailableSupplyItem>();
  const warnings: string[] = [];

  if (inclusionMap.owned_stockpiles) {
    for (const entry of input.acquisitionState.ownedNow.entries) {
      if (entry.sourceCategory !== 'stockpile') {
        continue;
      }

      addBreakdown(itemsByCanonicalKey, {
        canonicalKey: entry.canonicalItemKey,
        itemName: entry.itemName,
        sourceKey: 'owned_stockpiles',
        timing: 'immediate',
        quantity: entry.ownedCount,
      });
    }
  }

  if (inclusionMap.owned_containers) {
    for (const entry of input.acquisitionState.ownedNow.entries) {
      if (entry.sourceCategory !== 'container') {
        continue;
      }

      addBreakdown(itemsByCanonicalKey, {
        canonicalKey: entry.canonicalItemKey,
        itemName: entry.itemName,
        sourceKey: 'owned_containers',
        timing: 'immediate',
        quantity: entry.ownedCount,
      });
    }
  }

  if (inclusionMap.stored_pet_inventory) {
    for (const entry of input.acquisitionState.pets.storedInventoryEntries) {
      addBreakdown(itemsByCanonicalKey, {
        canonicalKey: entry.canonicalItemKey,
        itemName: entry.itemName,
        sourceKey: 'stored_pet_inventory',
        timing: 'immediate',
        quantity: entry.storedCount,
      });
    }
  }

  if (inclusionMap.future_pet_production) {
    const futurePetForecast = deriveFuturePetProductionForecast(input.acquisitionState, {
      petSourceReference: input.petSourceReference,
    });

    warnings.push(...futurePetForecast.warnings);

    if (futurePetForecast.enabled) {
      for (const entry of futurePetForecast.entries) {
        addBreakdown(itemsByCanonicalKey, {
          canonicalKey: entry.canonicalItemKey,
          itemName: entry.itemName,
          sourceKey: 'future_pet_production',
          timing: 'future',
          quantity: entry.forecastQuantity,
          notes: [
            `${entry.sourcePetCount.toLocaleString()} pet${entry.sourcePetCount === 1 ? '' : 's'} over ${futurePetForecast.forecastHours.toLocaleString()} forecast hours.`,
          ],
        });
      }
    }
  }

  for (const item of itemsByCanonicalKey.values()) {
    item.effectiveQuantity = item.derivedQuantity;
  }

  applyOverrides(itemsByCanonicalKey, input.overrides ?? []);

  const items = Array.from(itemsByCanonicalKey.values()).sort((left, right) => {
    return left.itemName.localeCompare(right.itemName) || left.canonicalKey.localeCompare(right.canonicalKey);
  });

  return {
    items,
    byCanonicalKey: Object.fromEntries(items.map((item) => [item.canonicalKey, item])),
    warnings,
  };
}
