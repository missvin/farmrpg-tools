import { describe, expect, it } from 'vitest';

import { createDefaultCraftingModifierState } from './craftingModifierState';
import { buildRecipeGraph, parseRecipeInputsCsv, parseRecipesCsv } from './loadRecipeGraph';
import { buildTargetOutputPlanningProblem } from './targetOutputPlanningModel';

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/
Quandary Chowder,quandary chowder,cooking,Jill's Quandary Chowder,jill's quandary chowder,25,4h,https://buddy.farm/i/quandary-chowder/`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
fancy pipe,Fancy Pipe,1,Wood,wood,10
quandary chowder,Quandary Chowder,1,Coal,coal,240`;

function createRecipeGraph() {
  return buildRecipeGraph(
    parseRecipesCsv(RECIPES_CSV),
    parseRecipeInputsCsv(RECIPE_INPUTS_CSV),
  );
}

describe('buildTargetOutputPlanningProblem', () => {
  it('creates stable target goals keyed by canonical item and target id', () => {
    const problem = buildTargetOutputPlanningProblem({
      goals: [
        {
          targetId: 'goal-fancy-pipe',
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          desiredQuantity: 25,
        },
        {
          itemName: 'Coal',
          canonicalKey: 'coal',
          desiredQuantity: 100,
        },
      ],
      recipeGraph: createRecipeGraph(),
      modifierState: createDefaultCraftingModifierState(),
    });

    expect(problem.goals).toHaveLength(2);
    expect(problem.goalById['goal-fancy-pipe']).toMatchObject({
      canonicalKey: 'fancy pipe',
      targetKind: 'craft_recipe_output',
    });
    expect(problem.goalById['target:2:coal']).toMatchObject({
      canonicalKey: 'coal',
      targetKind: 'leaf_item',
    });
    expect(problem.goalIdsByCanonicalKey).toMatchObject({
      'fancy pipe': ['goal-fancy-pipe'],
      coal: ['target:2:coal'],
    });
  });

  it('applies output-affecting resource saver math to craft target quantities', () => {
    const problem = buildTargetOutputPlanningProblem({
      goals: [
        {
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          desiredQuantity: 100,
        },
      ],
      recipeGraph: createRecipeGraph(),
      modifierState: {
        ...createDefaultCraftingModifierState(),
        persistent: {
          resourceSaver1Unlocked: true,
          resourceSaver2Unlocked: false,
          resourceSaver3Unlocked: false,
        },
      },
    });

    expect(problem.modifierTotals.totalResourceSaverPercent).toBeCloseTo(0.1);
    expect(problem.goals[0]).toMatchObject({
      targetKind: 'craft_recipe_output',
      outputPerCraftAssumption: 1,
      requiredCraftOperations: 91,
    });
    expect(problem.goals[0].projectedOutputQuantity).toBeCloseTo(100.1);
    expect(problem.goals[0].projectedExcessQuantity).toBeCloseTo(0.1);
  });

  it('does not treat mastery-only bonuses as extra target output', () => {
    const problem = buildTargetOutputPlanningProblem({
      goals: [
        {
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          desiredQuantity: 100,
        },
      ],
      recipeGraph: createRecipeGraph(),
      modifierState: {
        ...createDefaultCraftingModifierState(),
        temporary: {
          mushroomStewActive: true,
          eventMasteryBonusPercent: 0.25,
          eventResourceSaverBonusPercent: 0,
        },
      },
    });

    expect(problem.modifierTotals.totalMasteryBonusPercent).toBeCloseTo(0.35);
    expect(problem.goals[0]).toMatchObject({
      requiredCraftOperations: 100,
      projectedOutputQuantity: 100,
      projectedExcessQuantity: 0,
    });
  });

  it('classifies cooking recipes and leaf items without inventing craft operations', () => {
    const problem = buildTargetOutputPlanningProblem({
      goals: [
        {
          itemName: 'Quandary Chowder',
          canonicalKey: 'quandary chowder',
          desiredQuantity: 3,
        },
        {
          itemName: 'Coal',
          canonicalKey: 'coal',
          desiredQuantity: 240,
        },
      ],
      recipeGraph: createRecipeGraph(),
      modifierState: createDefaultCraftingModifierState(),
    });

    expect(problem.goals[0]).toMatchObject({
      targetKind: 'cooking_recipe_output',
      recipeType: 'cooking',
      requiredCraftOperations: null,
      projectedOutputQuantity: null,
    });
    expect(problem.goals[1]).toMatchObject({
      targetKind: 'leaf_item',
      recipeType: null,
      requiredCraftOperations: null,
      projectedOutputQuantity: null,
    });
  });

  it('rejects invalid quantities and duplicate target ids', () => {
    expect(() =>
      buildTargetOutputPlanningProblem({
        goals: [
          {
            itemName: 'Fancy Pipe',
            canonicalKey: 'fancy pipe',
            desiredQuantity: -1,
          },
        ],
        recipeGraph: createRecipeGraph(),
        modifierState: createDefaultCraftingModifierState(),
      }),
    ).toThrow(/desiredQuantity/i);

    expect(() =>
      buildTargetOutputPlanningProblem({
        goals: [
          {
            targetId: 'same',
            itemName: 'Fancy Pipe',
            canonicalKey: 'fancy pipe',
            desiredQuantity: 1,
          },
          {
            targetId: 'same',
            itemName: 'Coal',
            canonicalKey: 'coal',
            desiredQuantity: 1,
          },
        ],
        recipeGraph: createRecipeGraph(),
        modifierState: createDefaultCraftingModifierState(),
      }),
    ).toThrow(/duplicate/i);
  });
});
