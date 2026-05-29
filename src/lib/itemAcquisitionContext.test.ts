import { describe, expect, it } from 'vitest';

import {
  createDefaultAcquisitionPlannerInputState,
  normalizeAcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import { deriveItemAcquisitionContext } from './itemAcquisitionContext';
import type { DropRateReferenceData } from './loadDropRateReference';
import type { RecursiveIngredientBurdenResult } from './recursiveIngredientBurden';

function createBurdenResult(): RecursiveIngredientBurdenResult {
  return {
    modifierTotals: {
      activeModifiers: [],
      resourceSaverModifiers: [],
      masteryBonusModifiers: [],
      totalResourceSaverPercent: 0,
      totalMasteryBonusPercent: 0,
    },
    masteryGainPerEffectiveOutput: 1,
    scopeResults: {
      M: {
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {},
      },
      GM: {
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {},
      },
      MM: {
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {},
      },
      Tower: {
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {},
      },
    },
    ingredientBurdenByCanonicalKey: {
      'glass orb': {
        canonicalKey: 'glass orb',
        itemName: 'Glass Orb',
        isCraftable: true,
        totalRequiredEffectiveOutput: 42.2,
        totalRequiredCraftOperations: 42.2,
        byScope: {},
      },
    },
  };
}

function createDropRateReference(): DropRateReferenceData {
  return {
    entries: [],
    byTargetCanonicalKey: {
      'glass orb': [
        {
          targetItemName: 'Glass Orb',
          targetCanonicalKey: 'glass orb',
          sourceName: 'Ember Lagoon',
          sourceCanonicalKey: 'ember lagoon',
          sourceType: 'explore',
          sourceKind: 'location',
          rowKind: 'item_source',
          rawRate: 20,
          baseDropRate: 0.33,
          sourcePageType: 'item',
          sourcePageName: 'Glass Orb',
          sourcePageUrl: 'https://buddy.farm/i/glass-orb/',
          pageDataUrl: 'https://buddy.farm/page-data/i/glass-orb/page-data.json',
          targetItemId: null,
          targetItemImage: null,
          sourceImage: null,
          ironDepot: null,
          manualFishing: null,
          runecube: null,
          flags: [],
          notes: [],
        },
      ],
    },
  };
}

describe('deriveItemAcquisitionContext', () => {
  it('summarizes burden, saved sources, future pets, and imported source coverage', () => {
    const acquisitionState = normalizeAcquisitionPlannerInputState({
      ...createDefaultAcquisitionPlannerInputState(),
      sourcePolicy: {
        ...createDefaultAcquisitionPlannerInputState().sourcePolicy,
        sourceOverrides: {
          ...createDefaultAcquisitionPlannerInputState().sourcePolicy.sourceOverrides,
          future_pet_production: 'force_included',
        },
      },
      ownedNow: {
        entries: [
          {
            canonicalItemKey: 'glass orb',
            itemName: 'Glass Orb',
            ownedCount: 5,
            sourceCategory: 'stockpile',
          },
        ],
      },
      inventory: {
        entries: [
          {
            canonicalItemKey: 'glass orb',
            itemName: 'Glass Orb',
            inventoryCount: 3,
          },
        ],
      },
      pets: {
        storedInventoryEntries: [
          {
            canonicalItemKey: 'glass orb',
            itemName: 'Glass Orb',
            storedCount: 7,
          },
        ],
        futureProduction: {
          enabled: true,
          horizonDays: 1,
          entries: [
            {
              canonicalItemKey: 'glass orb',
              itemName: 'Glass Orb',
              petName: 'Otter',
              petLevel: 2,
              seasonalActive: true,
            },
          ],
          respectSeasonality: true,
          offlineHoursCap: 24,
          crunchyOmeletteActive: false,
        },
      },
    });

    expect(
      deriveItemAcquisitionContext({
        canonicalKey: 'glass orb',
        acquisitionState,
        burdenResult: createBurdenResult(),
        dropRateReference: createDropRateReference(),
      }),
    ).toMatchObject({
      requiredQuantity: 43,
      hasBreakdownTarget: true,
      immediateSavedQuantity: 15,
      futurePetQuantity: 12,
      totalSavedQuantity: 27,
      dropRateSourceCount: 1,
    });
  });

  it('keeps acquisition breakdown unavailable when the item is not in the current burden result', () => {
    const acquisitionState = createDefaultAcquisitionPlannerInputState();

    expect(
      deriveItemAcquisitionContext({
        canonicalKey: 'steel',
        acquisitionState,
        burdenResult: createBurdenResult(),
        dropRateReference: createDropRateReference(),
      }),
    ).toMatchObject({
      requiredQuantity: null,
      hasBreakdownTarget: false,
      totalSavedQuantity: 0,
      dropRateSourceCount: 0,
    });
  });
});
