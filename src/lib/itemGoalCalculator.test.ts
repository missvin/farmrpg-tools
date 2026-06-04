import { describe, expect, it } from 'vitest';

import {
  createDefaultAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { buildItemGoalCalculatorResult } from './itemGoalCalculator';
import type { OpenableContentsReferenceData } from './loadOpenableContentsReference';
import type { RecipeGraph, RecipeNode } from './loadRecipeGraph';
import type { WishingWellReferenceData } from './loadWishingWellReference';

const EMPTY_RECIPE_GRAPH: RecipeGraph = {
  recipes: [],
  byOutputCanonicalKey: {},
  byInputCanonicalKey: {},
  craftRecipes: [],
  cookingRecipes: [],
};

function createBaseAcquisitionState(): AcquisitionPlannerInputState {
  return {
    ...createDefaultAcquisitionPlannerInputState(),
    sourcePolicy: {
      ...createDefaultAcquisitionPlannerInputState().sourcePolicy,
      planningHorizon: 'include_future',
      sourceOverrides: {
        ...createDefaultAcquisitionPlannerInputState().sourcePolicy.sourceOverrides,
        future_pet_production: 'force_included',
      },
    },
  };
}

describe('buildItemGoalCalculatorResult', () => {
  it('counts reviewed openable contents as optional immediate supply', () => {
    const acquisitionState: AcquisitionPlannerInputState = {
      ...createBaseAcquisitionState(),
      ownedNow: {
        entries: [
          {
            canonicalItemKey: 'large chest 03',
            itemName: 'Large Chest 03',
            ownedCount: 2,
            sourceCategory: 'container',
          },
        ],
      },
    };
    const openableContentsReference: OpenableContentsReferenceData = {
      entries: [],
      byOpenableCanonicalKey: {
        'large chest 03': [
          {
            openableItemName: 'Large Chest 03',
            openableCanonicalKey: 'large chest 03',
            contentItemName: 'Salt',
            contentCanonicalKey: 'salt',
            quantityPerOpen: 10,
            quantityKind: 'fixed',
            evidence: 'user_confirmed',
            notes: [],
          },
        ],
      },
      byContentCanonicalKey: {},
    };

    const result = buildItemGoalCalculatorResult({
      itemName: 'Salt',
      canonicalKey: 'salt',
      currentMastery: 0,
      acquisitionState,
      modifierState: createDefaultCraftingModifierState(),
      recipeGraph: EMPTY_RECIPE_GRAPH,
      openableContentsReference,
      wishingWellReference: { entries: [], byThrownCanonicalKey: {}, byRewardCanonicalKey: {} },
      settings: {
        goalMode: 'mastery',
        targetMastery: 100,
      },
    });

    expect(result.openableQuantity).toBe(20);
    expect(result.totalAvailableQuantity).toBe(20);
    expect(result.remainingQuantity).toBe(80);
  });

  it('lets reviewed openable contents satisfy recursive ingredient demand', () => {
    const acquisitionState: AcquisitionPlannerInputState = {
      ...createBaseAcquisitionState(),
      ownedNow: {
        entries: [
          {
            canonicalItemKey: 'large chest 03',
            itemName: 'Large Chest 03',
            ownedCount: 2,
            sourceCategory: 'container',
          },
        ],
      },
    };
    const openableContentsReference: OpenableContentsReferenceData = {
      entries: [],
      byOpenableCanonicalKey: {
        'large chest 03': [
          {
            openableItemName: 'Large Chest 03',
            openableCanonicalKey: 'large chest 03',
            contentItemName: 'Salt',
            contentCanonicalKey: 'salt',
            quantityPerOpen: 10,
            quantityKind: 'fixed',
            evidence: 'user_confirmed',
            notes: [],
          },
        ],
      },
      byContentCanonicalKey: {},
    };
    const saltedNetRecipe: RecipeNode = {
      outputItemName: 'Salted Net',
      outputCanonicalKey: 'salted net',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: 'https://buddy.farm/i/salted-net/',
      inputs: [
        {
          inputOrder: 1,
          itemName: 'Salt',
          canonicalKey: 'salt',
          quantity: 30,
        },
      ],
    };
    const recipeGraph: RecipeGraph = {
      recipes: [saltedNetRecipe],
      byOutputCanonicalKey: {
        'salted net': saltedNetRecipe,
      },
      byInputCanonicalKey: {
        salt: [saltedNetRecipe],
      },
      craftRecipes: [saltedNetRecipe],
      cookingRecipes: [],
    };

    const result = buildItemGoalCalculatorResult({
      itemName: 'Salted Net',
      canonicalKey: 'salted net',
      currentMastery: 0,
      acquisitionState,
      modifierState: createDefaultCraftingModifierState(),
      recipeGraph,
      openableContentsReference,
      wishingWellReference: { entries: [], byThrownCanonicalKey: {}, byRewardCanonicalKey: {} },
      settings: {
        goalMode: 'quantity',
        targetQuantity: 1,
      },
    });

    expect(result.plannerResult.rowsByCanonicalKey.salt.availableQuantity).toBe(20);
    expect(result.plannerResult.rowsByCanonicalKey.salt.remainingQuantity).toBe(10);
  });

  it('applies Crunchy Omelette as a pet collection bonus on stored pet inventory', () => {
    const acquisitionState: AcquisitionPlannerInputState = {
      ...createBaseAcquisitionState(),
      pets: {
        ...createBaseAcquisitionState().pets,
        storedInventoryEntries: [
          {
            canonicalItemKey: 'salt',
            itemName: 'Salt',
            storedCount: 10,
          },
        ],
      },
    };

    const result = buildItemGoalCalculatorResult({
      itemName: 'Salt',
      canonicalKey: 'salt',
      currentMastery: 0,
      acquisitionState,
      modifierState: createDefaultCraftingModifierState(),
      recipeGraph: EMPTY_RECIPE_GRAPH,
      openableContentsReference: { entries: [], byOpenableCanonicalKey: {}, byContentCanonicalKey: {} },
      wishingWellReference: { entries: [], byThrownCanonicalKey: {}, byRewardCanonicalKey: {} },
      settings: {
        goalMode: 'quantity',
        targetQuantity: 20,
        crunchyOmeletteActive: true,
      },
    });

    expect(result.crunchyStoredPetBonusQuantity).toBe(5);
    expect(result.totalAvailableQuantity).toBe(15);
    expect(result.remainingQuantity).toBe(5);
  });

  it('models Wishing Well expected rewards without adding them to immediate supply', () => {
    const acquisitionState: AcquisitionPlannerInputState = {
      ...createBaseAcquisitionState(),
      inventory: {
        entries: [
          {
            canonicalItemKey: 'salt',
            itemName: 'Salt',
            inventoryCount: 60,
          },
        ],
      },
    };
    const wishingWellReference: WishingWellReferenceData = {
      entries: [],
      byThrownCanonicalKey: {},
      byRewardCanonicalKey: {
        'spiked shell': [
          {
            thrownItemName: 'Salt',
            thrownCanonicalKey: 'salt',
            rewardItemName: 'Spiked Shell',
            rewardCanonicalKey: 'spiked shell',
            rewardChance: 0.5,
            rewardQuantity: 1,
            evidence: 'user_confirmed',
            notes: [],
          },
        ],
      },
    };

    const result = buildItemGoalCalculatorResult({
      itemName: 'Spiked Shell',
      canonicalKey: 'spiked shell',
      currentMastery: 0,
      acquisitionState,
      modifierState: createDefaultCraftingModifierState(),
      recipeGraph: EMPTY_RECIPE_GRAPH,
      openableContentsReference: { entries: [], byOpenableCanonicalKey: {}, byContentCanonicalKey: {} },
      wishingWellReference,
      settings: {
        goalMode: 'quantity',
        targetQuantity: 100,
        wishingWellThrowsPerDay: 30,
        wishingWellRewardMultiplier: 2,
      },
    });

    expect(result.expectedWishingWellQuantityPerDay).toBe(30);
    expect(result.totalAvailableQuantity).toBe(0);
    expect(result.wishingWellSources[0]).toMatchObject({
      expectedDailyQuantity: 30,
      thrownItemAvailableQuantity: 60,
    });
  });

  it('surfaces future pet production for recursive recipe ingredients', () => {
    const acquisitionState: AcquisitionPlannerInputState = {
      ...createBaseAcquisitionState(),
      pets: {
        ...createBaseAcquisitionState().pets,
        futureProduction: {
          ...createBaseAcquisitionState().pets.futureProduction,
          enabled: true,
          horizonDays: 1,
          entries: [
            {
              canonicalItemKey: 'antler',
              itemName: 'Antler',
              petName: 'Dog',
              petLevel: 6,
              seasonalActive: true,
            },
          ],
        },
      },
    };
    const largeNetRecipe: RecipeNode = {
      outputItemName: 'Large Net',
      outputCanonicalKey: 'large net',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: 'https://buddy.farm/i/large-net/',
      inputs: [
        {
          inputOrder: 1,
          itemName: 'Antler',
          canonicalKey: 'antler',
          quantity: 25,
        },
      ],
    };
    const recipeGraph: RecipeGraph = {
      recipes: [largeNetRecipe],
      byOutputCanonicalKey: {
        'large net': largeNetRecipe,
      },
      byInputCanonicalKey: {
        antler: [largeNetRecipe],
      },
      craftRecipes: [largeNetRecipe],
      cookingRecipes: [],
    };

    const result = buildItemGoalCalculatorResult({
      itemName: 'Large Net',
      canonicalKey: 'large net',
      currentMastery: 0,
      acquisitionState,
      modifierState: createDefaultCraftingModifierState(),
      recipeGraph,
      petSourceReference: null,
      openableContentsReference: { entries: [], byOpenableCanonicalKey: {}, byContentCanonicalKey: {} },
      wishingWellReference: { entries: [], byThrownCanonicalKey: {}, byRewardCanonicalKey: {} },
      settings: {
        goalMode: 'quantity',
        targetQuantity: 10,
      },
    });

    expect(result.petSources[0]).toMatchObject({
      itemName: 'Antler',
      role: 'ingredient',
      sourcePetCount: 1,
    });
  });

  it('counts Tower artifact Antlers as a recurring recursive ingredient source', () => {
    const largeNetRecipe: RecipeNode = {
      outputItemName: 'Large Net',
      outputCanonicalKey: 'large net',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: 'https://buddy.farm/i/large-net/',
      inputs: [
        {
          inputOrder: 1,
          itemName: 'Antler',
          canonicalKey: 'antler',
          quantity: 25,
        },
      ],
    };
    const recipeGraph: RecipeGraph = {
      recipes: [largeNetRecipe],
      byOutputCanonicalKey: {
        'large net': largeNetRecipe,
      },
      byInputCanonicalKey: {
        antler: [largeNetRecipe],
      },
      craftRecipes: [largeNetRecipe],
      cookingRecipes: [],
    };

    const result = buildItemGoalCalculatorResult({
      itemName: 'Large Net',
      canonicalKey: 'large net',
      currentMastery: 0,
      acquisitionState: createBaseAcquisitionState(),
      modifierState: createDefaultCraftingModifierState(),
      recipeGraph,
      openableContentsReference: { entries: [], byOpenableCanonicalKey: {}, byContentCanonicalKey: {} },
      wishingWellReference: { entries: [], byThrownCanonicalKey: {}, byRewardCanonicalKey: {} },
      settings: {
        goalMode: 'quantity',
        targetQuantity: 1,
        towerAntlersPerDay: 10,
      },
    });

    expect(result.plannerResult.rowsByCanonicalKey.antler.availableQuantity).toBe(10);
    expect(result.plannerResult.rowsByCanonicalKey.antler.remainingQuantity).toBe(15);
  });
});
