import { describe, expect, it } from 'vitest';

import { createDefaultCraftingModifierState } from './craftingModifierState';
import { buildRecipeGraph, parseRecipeInputsCsv, parseRecipesCsv } from './loadRecipeGraph';
import { parseTowerRequirementsCsv } from './loadTowerRequirements';
import { calculateRecursiveIngredientBurden } from './recursiveIngredientBurden';
import type { MasterySnapshot } from './storage/masterySnapshots';

const RECURSIVE_RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url
Twine,twine,craft,,,,,https://buddy.farm/i/twine/
Rope,rope,craft,,,,,https://buddy.farm/i/rope/
Fishing Net,fishing net,craft,,,,,https://buddy.farm/i/fishing-net/
Large Net,large net,craft,,,,,https://buddy.farm/i/large-net/`;

const RECURSIVE_RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
twine,Twine,1,Fiber,fiber,3
rope,Rope,1,Twine,twine,2
fishing net,Fishing Net,1,Rope,rope,2
fishing net,Fishing Net,2,Twine,twine,1
large net,Large Net,1,Fishing Net,fishing net,2
large net,Large Net,2,Rope,rope,1`;

function createSnapshot(masteryByItem: Record<string, number>): MasterySnapshot {
  return {
    snapshotId: 'snapshot-1',
    createdAt: '2026-03-19T12:00:00.000Z',
    savedAt: '2026-03-19T12:00:00.000Z',
    importedAt: '2026-03-19T12:00:00.000Z',
    rawText: '',
    masteryByItem,
    parseSummary: {
      itemsParsed: Object.keys(masteryByItem).length,
      parsedRowsCount: Object.keys(masteryByItem).length,
      tiersDetected: [],
      duplicateRowsCount: 0,
      skippedNonItemLinesCount: 0,
      skippedNonItemLineSamples: [],
      unknownItemsCount: 0,
      warnings: [],
    },
  };
}

describe('calculateRecursiveIngredientBurden', () => {
  it('aggregates direct and indirect recursive burden through shared crafted chains', () => {
    const recipeGraph = buildRecipeGraph(
      parseRecipesCsv(RECURSIVE_RECIPES_CSV),
      parseRecipeInputsCsv(RECURSIVE_RECIPE_INPUTS_CSV),
    );
    const snapshot = createSnapshot({
      twine: 9_999,
      rope: 9_998,
      'fishing net': 9_999,
      'large net': 9_999,
    });

    const result = calculateRecursiveIngredientBurden({
      recipeGraph,
      snapshot,
      modifierState: createDefaultCraftingModifierState(),
    });

    const mScope = result.scopeResults.M;

    expect(mScope.rootGoals.map((goal) => goal.outputCanonicalKey)).toEqual([
      'fishing net',
      'large net',
      'rope',
      'twine',
    ]);
    expect(mScope.ingredientBurdenByCanonicalKey['large net']).toMatchObject({
      totalRequiredEffectiveOutput: 1,
      totalRequiredCraftOperations: 1,
    });
    expect(mScope.ingredientBurdenByCanonicalKey['fishing net']).toMatchObject({
      totalRequiredEffectiveOutput: 3,
      totalRequiredCraftOperations: 3,
    });
    expect(mScope.ingredientBurdenByCanonicalKey.rope).toMatchObject({
      totalRequiredEffectiveOutput: 9,
      totalRequiredCraftOperations: 9,
    });
    expect(mScope.ingredientBurdenByCanonicalKey.twine).toMatchObject({
      totalRequiredEffectiveOutput: 22,
      totalRequiredCraftOperations: 22,
    });
    expect(mScope.ingredientBurdenByCanonicalKey.fiber).toMatchObject({
      totalRequiredEffectiveOutput: 66,
      totalRequiredCraftOperations: 0,
      isCraftable: false,
    });
  });

  it('flows resource saver math through BL-033 when converting root demand into recursive ingredient burden', () => {
    const recipeGraph = buildRecipeGraph(
      parseRecipesCsv(RECURSIVE_RECIPES_CSV),
      parseRecipeInputsCsv(RECURSIVE_RECIPE_INPUTS_CSV),
    );
    const snapshot = createSnapshot({
      twine: 9_989,
    });

    const result = calculateRecursiveIngredientBurden({
      recipeGraph,
      snapshot,
      modifierState: {
        schemaVersion: 1,
        persistent: {
          resourceSaver1Unlocked: true,
          resourceSaver2Unlocked: false,
          resourceSaver3Unlocked: false,
        },
        temporary: {
          mushroomStewActive: false,
          eventMasteryBonusPercent: 0,
          eventResourceSaverBonusPercent: 0,
        },
      },
    });

    expect(result.modifierTotals.totalResourceSaverPercent).toBeCloseTo(0.1);
    expect(result.scopeResults.M.ingredientBurdenByCanonicalKey.twine.totalRequiredEffectiveOutput).toBe(11);
    expect(result.scopeResults.M.ingredientBurdenByCanonicalKey.twine.totalRequiredCraftOperations).toBe(10);
    expect(result.scopeResults.M.ingredientBurdenByCanonicalKey.fiber.totalRequiredEffectiveOutput).toBe(30);
  });

  it('keeps M, GM, MM, and Tower burdens distinguishable', () => {
    const recipeGraph = buildRecipeGraph(
      parseRecipesCsv(RECURSIVE_RECIPES_CSV),
      parseRecipeInputsCsv(RECURSIVE_RECIPE_INPUTS_CSV),
    );
    const snapshot = createSnapshot({
      twine: 9_999,
      rope: 99_999,
      'large net': 999_999,
    });

    const result = calculateRecursiveIngredientBurden({
      recipeGraph,
      snapshot,
      modifierState: createDefaultCraftingModifierState(),
    });

    expect(result.scopeResults.M.rootGoals.map((goal) => goal.outputCanonicalKey)).toEqual(['twine']);
    expect(result.scopeResults.GM.rootGoals.map((goal) => goal.outputCanonicalKey)).toEqual(['rope', 'twine']);
    expect(result.scopeResults.MM.rootGoals.map((goal) => goal.outputCanonicalKey)).toEqual([
      'large net',
      'rope',
      'twine',
    ]);
    expect(result.ingredientBurdenByCanonicalKey.twine.byScope.M?.requiredEffectiveOutput).toBe(1);
    expect(result.ingredientBurdenByCanonicalKey.twine.byScope.GM?.requiredEffectiveOutput).toBe(90_003);
    expect(
      (result.ingredientBurdenByCanonicalKey.twine.byScope.MM?.requiredEffectiveOutput ?? 0) >
        (result.ingredientBurdenByCanonicalKey.twine.byScope.GM?.requiredEffectiveOutput ?? 0),
    ).toBe(true);
  });

  it('supports Tower cutoff analysis and dedupes repeated tower rows to the highest target per item', () => {
    const recipeGraph = buildRecipeGraph(
      parseRecipesCsv(RECURSIVE_RECIPES_CSV),
      parseRecipeInputsCsv(RECURSIVE_RECIPE_INPUTS_CSV),
    );
    const towerRequirementsData = parseTowerRequirementsCsv(`tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
201,201-210,1,Twine,,M,,,,1
250,241-250,2,Rope,,M,,,,2
320,311-320,1,Twine,,GM,,,,3`);
    const snapshot = createSnapshot({
      twine: 9_500,
      rope: 9_000,
    });

    const cutoff250 = calculateRecursiveIngredientBurden({
      recipeGraph,
      snapshot,
      modifierState: createDefaultCraftingModifierState(),
      towerRequirementsData,
      towerTarget: {
        maxTowerLevel: 250,
      },
    });

    expect(cutoff250.scopeResults.Tower.rootGoals.map((goal) => ({
      key: goal.outputCanonicalKey,
      targetMastery: goal.targetMastery,
      rowCount: goal.towerRequirementRows.length,
    }))).toEqual([
      { key: 'rope', targetMastery: 10_000, rowCount: 1 },
      { key: 'twine', targetMastery: 10_000, rowCount: 1 },
    ]);

    const cutoff320 = calculateRecursiveIngredientBurden({
      recipeGraph,
      snapshot,
      modifierState: createDefaultCraftingModifierState(),
      towerRequirementsData,
      towerTarget: {
        maxTowerLevel: 320,
      },
    });

    expect(cutoff320.scopeResults.Tower.rootGoals.map((goal) => ({
      key: goal.outputCanonicalKey,
      targetMastery: goal.targetMastery,
      rowCount: goal.towerRequirementRows.length,
    }))).toEqual([
      { key: 'rope', targetMastery: 10_000, rowCount: 1 },
      { key: 'twine', targetMastery: 100_000, rowCount: 2 },
    ]);
    expect(cutoff320.scopeResults.Tower.rootGoals.find((goal) => goal.outputCanonicalKey === 'twine')?.remainingMastery).toBe(
      90_500,
    );
  });
});
