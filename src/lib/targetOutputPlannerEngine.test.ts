import { describe, expect, it } from 'vitest';

import type { AvailableSupplyPool } from './availableSupply';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { buildRecipeGraph, parseRecipeInputsCsv, parseRecipesCsv } from './loadRecipeGraph';
import { buildTargetOutputPlannerResult } from './targetOutputPlannerEngine';

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url
Board,board,craft,,,,,https://buddy.farm/i/board/
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/
Wooden Shield,wooden shield,craft,,,,,https://buddy.farm/i/wooden-shield/
Quandary Chowder,quandary chowder,cooking,Jill's Quandary Chowder,jill's quandary chowder,25,4h,https://buddy.farm/i/quandary-chowder/`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
board,Board,1,Wood,wood,5
fancy pipe,Fancy Pipe,1,Board,board,2
fancy pipe,Fancy Pipe,2,Iron,iron,1
wooden shield,Wooden Shield,1,Board,board,3
quandary chowder,Quandary Chowder,1,Coal,coal,240`;

function createRecipeGraph() {
  return buildRecipeGraph(
    parseRecipesCsv(RECIPES_CSV),
    parseRecipeInputsCsv(RECIPE_INPUTS_CSV),
  );
}

function createSupplyPool(supply: Record<string, { itemName: string; quantity: number }>): AvailableSupplyPool {
  const items = Object.entries(supply).map(([canonicalKey, entry]) => ({
    canonicalKey,
    itemName: entry.itemName,
    derivedQuantity: entry.quantity,
    effectiveQuantity: entry.quantity,
    overrideQuantity: null,
    breakdowns: [
      {
        sourceKey: 'owned_stockpiles' as const,
        label: 'Owned Stockpiles',
        timing: 'immediate' as const,
        quantity: entry.quantity,
        notes: [],
      },
    ],
    warnings: [],
  }));

  return {
    items,
    byCanonicalKey: Object.fromEntries(items.map((item) => [item.canonicalKey, item])),
    warnings: [],
  };
}

describe('buildTargetOutputPlannerResult', () => {
  it('spends shared supply once across multiple targets before expanding remaining craft demand', () => {
    const result = buildTargetOutputPlannerResult({
      goals: [
        {
          targetId: 'pipe',
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          desiredQuantity: 2,
        },
        {
          targetId: 'shield',
          itemName: 'Wooden Shield',
          canonicalKey: 'wooden shield',
          desiredQuantity: 1,
        },
      ],
      recipeGraph: createRecipeGraph(),
      modifierState: createDefaultCraftingModifierState(),
      supplyPool: createSupplyPool({
        board: { itemName: 'Board', quantity: 2 },
        wood: { itemName: 'Wood', quantity: 10 },
      }),
    });

    expect(result.rowsByCanonicalKey.board).toMatchObject({
      grossRequiredQuantity: 7,
      availableUsedQuantity: 2,
      remainingQuantity: 5,
      requiredCraftOperations: 5,
    });
    expect(result.rowsByCanonicalKey.wood).toMatchObject({
      grossRequiredQuantity: 25,
      availableUsedQuantity: 10,
      remainingQuantity: 15,
    });
  });

  it('uses available target output supply before expanding the target recipe', () => {
    const result = buildTargetOutputPlannerResult({
      goals: [
        {
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          desiredQuantity: 3,
        },
      ],
      recipeGraph: createRecipeGraph(),
      modifierState: createDefaultCraftingModifierState(),
      supplyPool: createSupplyPool({
        'fancy pipe': { itemName: 'Fancy Pipe', quantity: 3 },
      }),
    });

    expect(result.rowsByCanonicalKey['fancy pipe']).toMatchObject({
      grossRequiredQuantity: 3,
      availableUsedQuantity: 3,
      remainingQuantity: 0,
      requiredCraftOperations: 0,
      unresolvedReason: 'no_remaining_quantity',
    });
    expect(result.rowsByCanonicalKey.board).toBeUndefined();
  });

  it('keeps cooking recipes as unresolved planner demand instead of inventing craft operations', () => {
    const result = buildTargetOutputPlannerResult({
      goals: [
        {
          itemName: 'Quandary Chowder',
          canonicalKey: 'quandary chowder',
          desiredQuantity: 2,
        },
      ],
      recipeGraph: createRecipeGraph(),
      modifierState: createDefaultCraftingModifierState(),
      supplyPool: createSupplyPool({}),
    });

    expect(result.rowsByCanonicalKey['quandary chowder']).toMatchObject({
      grossRequiredQuantity: 2,
      remainingQuantity: 2,
      recipeType: 'cooking',
      unresolvedReason: 'cooking_recipe_not_expanded',
    });
    expect(result.rowsByCanonicalKey.coal).toBeUndefined();
  });
});
