import { describe, expect, it } from 'vitest';

import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { buildRecipeGraph, parseRecipeInputsCsv, parseRecipesCsv } from './loadRecipeGraph';
import type { QuestReferenceData } from './loadQuestReference';
import { buildQuestAvailableSupply, buildQuestPlanningViewModel } from './questPlanning';
import { DEFAULT_QUEST_PLANNER_STATE } from './questPlannerState';

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

function createQuestReferenceData(): QuestReferenceData {
  const quests = [
    {
      questKey: 'pipe quest',
      questName: 'Pipe Quest',
      questlineKey: 'test line',
      questlineName: 'Test Line',
      questlineAliases: [],
      stageLabel: null,
      npc: 'Buddy',
      farmingLevel: null,
      fishingLevel: null,
      craftingLevel: null,
      exploringLevel: null,
      towerLevel: null,
      previousQuestKey: null,
      nextQuestKeys: [],
      sourceUrl: 'https://buddy.farm/q/pipe-quest/',
      coverageStatus: 'reviewed' as const,
      notes: [],
    },
    {
      questKey: 'shield quest',
      questName: 'Shield Quest',
      questlineKey: 'test line',
      questlineName: 'Test Line',
      questlineAliases: [],
      stageLabel: null,
      npc: 'Buddy',
      farmingLevel: null,
      fishingLevel: null,
      craftingLevel: null,
      exploringLevel: null,
      towerLevel: null,
      previousQuestKey: null,
      nextQuestKeys: [],
      sourceUrl: 'https://buddy.farm/q/shield-quest/',
      coverageStatus: 'reviewed' as const,
      notes: [],
    },
  ];

  return {
    quests,
    questsByKey: Object.fromEntries(quests.map((quest) => [quest.questKey, quest])),
    requirementsByQuestKey: {
      'pipe quest': [
        {
          questKey: 'pipe quest',
          requirementType: 'item',
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          quantity: 2,
          sourceUrl: 'https://buddy.farm/i/fancy-pipe/',
          notes: [],
        },
      ],
      'shield quest': [
        {
          questKey: 'shield quest',
          requirementType: 'item',
          itemName: 'Wooden Shield',
          canonicalKey: 'wooden shield',
          quantity: 1,
          sourceUrl: 'https://buddy.farm/i/wooden-shield/',
          notes: [],
        },
      ],
    },
    rewardsByQuestKey: {},
    sourceHintsByCanonicalKey: {},
  };
}

describe('buildQuestAvailableSupply', () => {
  it('counts current inventory as immediate quest-planning supply alongside saved stockpiles and pet storage', () => {
    const availableSupply = buildQuestAvailableSupply({
      ...createDefaultAcquisitionPlannerInputState(),
      ownedNow: {
        entries: [
          {
            canonicalItemKey: 'strange ring',
            itemName: 'Strange Ring',
            ownedCount: 400,
            sourceCategory: 'stockpile',
          },
        ],
      },
      inventory: {
        entries: [
          {
            canonicalItemKey: 'strange ring',
            itemName: 'Strange Ring',
            inventoryCount: 1000,
          },
        ],
      },
      pets: {
        ...createDefaultAcquisitionPlannerInputState().pets,
        storedInventoryEntries: [
          {
            canonicalItemKey: 'honey',
            itemName: 'Honey',
            storedCount: 12,
          },
        ],
      },
    });

    expect(availableSupply).toEqual([
      {
        canonicalKey: 'honey',
        itemName: 'Honey',
        quantity: 12,
        sources: [
          {
            label: 'Stored pet inventory',
            quantity: 12,
          },
        ],
      },
      {
        canonicalKey: 'strange ring',
        itemName: 'Strange Ring',
        quantity: 1400,
        sources: [
          {
            label: 'Owned stockpile',
            quantity: 400,
          },
          {
            label: 'Current inventory',
            quantity: 1000,
          },
        ],
      },
    ]);
  });

  it('uses the shared target-output planner for combined active and watched quest demand', () => {
    const viewModel = buildQuestPlanningViewModel({
      referenceData: createQuestReferenceData(),
      questPlannerState: {
        ...DEFAULT_QUEST_PLANNER_STATE,
        questStates: [
          {
            questKey: 'pipe quest',
            status: 'active',
            hidden: false,
            observedNpc: null,
            observedCompletionPercent: null,
            lastObservedAt: null,
          },
          {
            questKey: 'shield quest',
            status: 'watched',
            hidden: false,
            observedNpc: null,
            observedCompletionPercent: null,
            lastObservedAt: null,
          },
        ],
      },
      acquisitionState: {
        ...createDefaultAcquisitionPlannerInputState(),
        ownedNow: {
          entries: [
            {
              canonicalItemKey: 'board',
              itemName: 'Board',
              ownedCount: 2,
              sourceCategory: 'stockpile',
            },
            {
              canonicalItemKey: 'wood',
              itemName: 'Wood',
              ownedCount: 10,
              sourceCategory: 'stockpile',
            },
          ],
        },
      },
      recipeGraph: createRecipeGraph(),
      modifierState: createDefaultCraftingModifierState(),
    });

    expect(viewModel.resourcePlan?.goals).toHaveLength(2);
    expect(viewModel.resourcePlan?.plannerResult?.rowsByCanonicalKey.board).toMatchObject({
      grossRequiredQuantity: 7,
      availableUsedQuantity: 2,
      remainingQuantity: 5,
      requiredCraftOperations: 5,
      contributions: [
        {
          targetLabel: 'Pipe Quest',
          quantity: 4,
        },
        {
          targetLabel: 'Shield Quest',
          quantity: 3,
        },
      ],
    });
    expect(viewModel.resourcePlan?.plannerResult?.rowsByCanonicalKey.wood).toMatchObject({
      grossRequiredQuantity: 25,
      availableUsedQuantity: 10,
      remainingQuantity: 15,
    });
    expect(viewModel.resourcePlan?.missingRows.map((row) => row.canonicalKey)).toContain('wood');
  });
});
