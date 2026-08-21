import { describe, expect, it } from 'vitest';

import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import {
  classifyItemGameAreas,
  deriveQuestGameAreaNeeds,
  deriveQuestMealNeeds,
  deriveTowerGameAreaNeeds,
} from './gameAreaNeedsPlanning';
import type { DropRateReferenceData } from './loadDropRateReference';
import type { MasteryDifficultyData } from './loadMasteryDifficulty';
import type { PetSourceReferenceData } from './loadPetSourceReference';
import type { RecipeGraph, RecipeNode } from './loadRecipeGraph';
import type { QuestFutureDemandRow } from './questHistoryPlanning';
import type { TowerProgressItem } from './deriveTowerProgress';

function createRecipeGraph(recipes: RecipeNode[]): RecipeGraph {
  return {
    recipes,
    byOutputCanonicalKey: Object.fromEntries(recipes.map((recipe) => [recipe.outputCanonicalKey, recipe])),
    byInputCanonicalKey: {},
    craftRecipes: recipes.filter((recipe) => recipe.recipeType === 'craft'),
    cookingRecipes: recipes.filter((recipe) => recipe.recipeType === 'cooking'),
  };
}

function createDemandRow(
  canonicalKey: string,
  itemName: string,
  totalQuantity: number,
  questNames: string[],
): QuestFutureDemandRow {
  return {
    canonicalKey,
    itemName,
    totalQuantity,
    questCount: questNames.length,
    requirements: questNames.map((questName, index) => ({
      questKey: `quest-${index + 1}`,
      questName,
      questlineKey: 'test-line',
      questlineName: 'Test Line',
      quantity: totalQuantity / questNames.length,
      scope: 'all_known_unfinished',
    })),
    scopes: [{ scope: 'all_known_unfinished', quantity: totalQuantity }],
    sourceHints: [],
  };
}

const recipeGraph = createRecipeGraph([
  {
    outputItemName: 'Feast',
    outputCanonicalKey: 'feast',
    recipeType: 'cooking',
    recipeBookItemName: "Cook's Feast",
    recipeBookCanonicalKey: "cook's feast",
    cookingLevel: '10',
    baseTime: '1h',
    sourceBuddyUrl: '',
    inputs: [
      { inputOrder: 1, itemName: 'Sauce', canonicalKey: 'sauce', quantity: 2 },
      { inputOrder: 2, itemName: 'Fish', canonicalKey: 'fish', quantity: 1 },
    ],
  },
  {
    outputItemName: 'Soup',
    outputCanonicalKey: 'soup',
    recipeType: 'cooking',
    recipeBookItemName: "Cook's Soup",
    recipeBookCanonicalKey: "cook's soup",
    cookingLevel: '5',
    baseTime: '30m',
    sourceBuddyUrl: '',
    inputs: [{ inputOrder: 1, itemName: 'Sauce', canonicalKey: 'sauce', quantity: 1 }],
  },
  {
    outputItemName: 'Sauce',
    outputCanonicalKey: 'sauce',
    recipeType: 'craft',
    recipeBookItemName: null,
    recipeBookCanonicalKey: null,
    cookingLevel: null,
    baseTime: null,
    sourceBuddyUrl: '',
    inputs: [{ inputOrder: 1, itemName: 'Tomato', canonicalKey: 'tomato', quantity: 3 }],
  },
]);

describe('game-area needs planning', () => {
  it('uses meal inventory before recursively planning shared ingredients', () => {
    const acquisitionState = createDefaultAcquisitionPlannerInputState();
    acquisitionState.inventory.entries = [
      { canonicalItemKey: 'feast', itemName: 'Feast', inventoryCount: 4 },
      { canonicalItemKey: 'soup', itemName: 'Soup', inventoryCount: 0 },
      { canonicalItemKey: 'sauce', itemName: 'Sauce', inventoryCount: 2 },
      { canonicalItemKey: 'fish', itemName: 'Fish', inventoryCount: 1 },
      { canonicalItemKey: 'tomato', itemName: 'Tomato', inventoryCount: 5 },
    ];

    const result = deriveQuestMealNeeds({
      demandRows: [
        createDemandRow('feast', 'Feast', 10, ['Quest A', 'Quest B']),
        createDemandRow('soup', 'Soup', 2, ['Quest C']),
      ],
      acquisitionState,
      recipeGraph,
      modifierState: createDefaultCraftingModifierState(),
      isQuestHistoryPersonalized: true,
    });

    expect(result.totalRequiredQuantity).toBe(12);
    expect(result.totalInventoryUsedQuantity).toBe(4);
    expect(result.totalMissingQuantity).toBe(8);
    expect(result.rows.find((row) => row.canonicalKey === 'feast')).toMatchObject({
      currentInventoryQuantity: 4,
      inventoryUsedQuantity: 4,
      missingQuantity: 6,
      questNames: ['Quest A', 'Quest B'],
    });
    expect(result.ingredientRows.find((row) => row.canonicalKey === 'sauce')).toMatchObject({
      grossRequiredQuantity: 14,
      inventoryUsedQuantity: 2,
      missingQuantity: 12,
      requiredCraftOperations: 12,
      isDirectMealInput: true,
      mealNames: ['Feast', 'Soup'],
    });
    expect(result.ingredientRows.find((row) => row.canonicalKey === 'tomato')).toMatchObject({
      grossRequiredQuantity: 36,
      inventoryUsedQuantity: 5,
      missingQuantity: 31,
      isDirectMealInput: false,
    });
    expect(result.ingredientRows.find((row) => row.canonicalKey === 'fish')).toMatchObject({
      grossRequiredQuantity: 6,
      inventoryUsedQuantity: 1,
      missingQuantity: 5,
    });
  });

  it('keeps inventory-dependent answers unknown when current inventory is missing', () => {
    const result = deriveQuestMealNeeds({
      demandRows: [createDemandRow('feast', 'Feast', 10, ['Quest A'])],
      acquisitionState: createDefaultAcquisitionPlannerInputState(),
      recipeGraph,
      modifierState: createDefaultCraftingModifierState(),
      isQuestHistoryPersonalized: false,
    });

    expect(result.rows[0]).toMatchObject({
      currentInventoryQuantity: null,
      inventoryUsedQuantity: null,
      missingQuantity: null,
    });
    expect(result.ingredientRows).toEqual([]);
    expect(result.warnings).toEqual([
      'Quest history is not imported; these totals are an unpersonalized upper bound over known quests.',
      'Import current inventory to calculate meal and ingredient shortfalls.',
    ]);
  });

  it('classifies items from reviewed recipe, method, source, and conservative pet evidence', () => {
    const dropRateReference = {
      entries: [],
      byTargetCanonicalKey: {
        corn: [{ sourceType: 'farming' }],
        ore: [{ sourceType: 'explore' }],
      },
    } as unknown as DropRateReferenceData;
    const masteryDifficulty = {
      entries: [],
      byCanonicalKey: {
        trout: { method: 'Fishing' },
        ore: { method: 'Crafting' },
      },
    } as unknown as MasteryDifficultyData;
    const petSourceReference = {
      entries: [],
      byItemCanonicalKey: {
        'gold crab': [{ petName: 'Squirrel' }],
        'mystery shell': [{ petName: 'Seal' }],
      },
      byPetCanonicalKey: {},
      byPetAndItemKey: {},
    } as unknown as PetSourceReferenceData;
    const sources = {
      recipeGraph,
      dropRateReference,
      masteryDifficulty,
      petSourceReference,
      sourceHintsByCanonicalKey: {
        'mystery shell': [
          {
            itemName: 'Mystery Shell',
            canonicalKey: 'mystery shell',
            sourceName: 'Grab Bag',
            sourceCanonicalKey: 'grab bag',
            sourceType: 'openable',
            preferredUnit: 'openable',
            sourceUrl: '',
            notes: [],
          },
        ],
      },
    };

    expect(classifyItemGameAreas('feast', sources).areas).toEqual(['meals']);
    expect(classifyItemGameAreas('corn', sources).areas).toEqual(['crops']);
    expect(classifyItemGameAreas('trout', sources).areas).toEqual(['fish']);
    expect(classifyItemGameAreas('ore', sources).areas).toEqual(['crafting', 'exploring']);
    expect(classifyItemGameAreas('gold crab', sources).areas).toEqual(['pet_reliant']);
    expect(classifyItemGameAreas('mystery shell', sources).areas).toEqual(['unclassified']);
  });

  it('requires both current and stored pet imports for an exact pet-reliant shortfall', () => {
    const acquisitionState = createDefaultAcquisitionPlannerInputState();
    acquisitionState.inventory.entries = [
      { canonicalItemKey: 'gold crab', itemName: 'Gold Crab', inventoryCount: 20 },
    ];
    const petSourceReference = {
      entries: [],
      byItemCanonicalKey: { 'gold crab': [{ petName: 'Squirrel' }] },
      byPetCanonicalKey: {},
      byPetAndItemKey: {},
    } as unknown as PetSourceReferenceData;

    const withoutPetImport = deriveQuestGameAreaNeeds({
      demandRows: [createDemandRow('gold crab', 'Gold Crab', 100, ['Quest A'])],
      acquisitionState,
      classificationSources: { petSourceReference },
    });
    const petRow = withoutPetImport.groups.find((group) => group.area === 'pet_reliant')?.rows[0];

    expect(petRow?.missingQuantity).toBeNull();
    expect(withoutPetImport.warnings).toContain(
      'Import stored pet inventory to calculate pet-reliant shortfalls.',
    );

    acquisitionState.pets.storedInventoryEntries = [
      { canonicalItemKey: 'gold crab', itemName: 'Gold Crab', storedCount: 30 },
    ];
    const withPetImport = deriveQuestGameAreaNeeds({
      demandRows: [createDemandRow('gold crab', 'Gold Crab', 100, ['Quest A'])],
      acquisitionState,
      classificationSources: { petSourceReference },
    });

    expect(withPetImport.groups.find((group) => group.area === 'pet_reliant')?.rows[0]).toMatchObject({
      currentInventoryQuantity: 20,
      storedPetQuantity: 30,
      immediatelyAvailableQuantity: 50,
      missingQuantity: 50,
    });
  });

  it('groups remaining Tower items by evidence-backed game area', () => {
    const towerItems = [
      {
        canonicalKey: 'corn',
        itemName: 'Corn',
        towerLevel: 301,
        method: 'Farming',
        remainingToTarget: 40_000,
      },
      {
        canonicalKey: 'trout',
        itemName: 'Trout',
        towerLevel: 302,
        method: 'Fishing',
        remainingToTarget: 25_000,
      },
    ] as TowerProgressItem[];

    const groups = deriveTowerGameAreaNeeds(towerItems, {});

    expect(groups.find((group) => group.area === 'crops')).toMatchObject({
      totalMasteryRemaining: 40_000,
    });
    expect(groups.find((group) => group.area === 'fish')).toMatchObject({
      totalMasteryRemaining: 25_000,
    });
  });
});
