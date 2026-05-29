import { describe, expect, it } from 'vitest';

import type { AvailableSupplyPool } from './availableSupply';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { buildRecipeGraph, parseRecipeInputsCsv, parseRecipesCsv } from './loadRecipeGraph';
import { buildTargetOutputPlannerResult } from './targetOutputPlannerEngine';
import { buildTargetOutputPlanningGraph } from './targetOutputPlanningGraph';

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url
Board,board,craft,,,,,https://buddy.farm/i/board/
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/
Wooden Shield,wooden shield,craft,,,,,https://buddy.farm/i/wooden-shield/`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
board,Board,1,Wood,wood,5
fancy pipe,Fancy Pipe,1,Board,board,2
fancy pipe,Fancy Pipe,2,Iron,iron,1
wooden shield,Wooden Shield,1,Board,board,3`;

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

describe('buildTargetOutputPlanningGraph', () => {
  it('turns target-output results into target, item, supply, and recipe-input edges', () => {
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

    const graph = buildTargetOutputPlanningGraph(result);

    expect(graph.nodesById['target:pipe']).toMatchObject({
      kind: 'target',
      itemName: 'Fancy Pipe',
    });
    expect(graph.nodesById['item:board']).toMatchObject({
      kind: 'item',
      itemName: 'Board',
    });
    expect(graph.nodesById['supply:board']).toMatchObject({
      kind: 'supply',
      itemName: 'Board supply',
    });
    expect(graph.treeRoots).toEqual([
      {
        targetId: 'pipe',
        targetLabel: 'Fancy Pipe',
        targetNodeId: 'target:pipe',
        itemNodeId: 'item:fancy pipe',
        desiredQuantity: 2,
      },
      {
        targetId: 'shield',
        targetLabel: 'Wooden Shield',
        targetNodeId: 'target:shield',
        itemNodeId: 'item:wooden shield',
        desiredQuantity: 1,
      },
    ]);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'target_demand',
          fromNodeId: 'target:pipe',
          toNodeId: 'item:fancy pipe',
          quantity: 2,
        }),
        expect.objectContaining({
          kind: 'supply_offset',
          fromNodeId: 'supply:board',
          toNodeId: 'item:board',
          quantity: 2,
        }),
        expect.objectContaining({
          kind: 'recipe_input',
          fromNodeId: 'item:fancy pipe',
          toNodeId: 'item:board',
          quantity: 4,
          targetContributions: [
            {
              targetId: 'pipe',
              targetLabel: 'Fancy Pipe',
              quantity: 4,
            },
          ],
        }),
        expect.objectContaining({
          kind: 'recipe_input',
          fromNodeId: 'item:board',
          toNodeId: 'item:wood',
          quantity: 25,
        }),
      ]),
    );
  });
});
