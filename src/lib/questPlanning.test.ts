import { describe, expect, it } from 'vitest';

import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { createDefaultDropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import type { DropRateReferenceData, DropRateReferenceEntry } from './loadDropRateReference';
import { buildRecipeGraph, parseRecipeInputsCsv, parseRecipesCsv } from './loadRecipeGraph';
import type { TowerRequirementsData } from './loadTowerRequirements';
import type { QuestReferenceData } from './loadQuestReference';
import { buildQuestAvailableSupply, buildQuestPlanningViewModel } from './questPlanning';
import { DEFAULT_QUEST_PLANNER_STATE } from './questPlannerState';

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
Board,board,craft,,,,,https://buddy.farm/i/board/
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/
Wooden Shield,wooden shield,craft,,,,,https://buddy.farm/i/wooden-shield/
Salt,salt,craft,,,,,https://buddy.farm/i/salt/`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
board,Board,1,Wood,wood,5
fancy pipe,Fancy Pipe,1,Board,board,2
fancy pipe,Fancy Pipe,2,Iron,iron,1
wooden shield,Wooden Shield,1,Board,board,3
salt,Salt,1,Salt Rock,salt rock,50`;

function createRecipeGraph() {
  return buildRecipeGraph(
    parseRecipesCsv(RECIPES_CSV),
    parseRecipeInputsCsv(RECIPE_INPUTS_CSV),
  );
}

function createDropRateRow(
  input: Pick<DropRateReferenceEntry, 'targetItemName' | 'targetCanonicalKey' | 'sourceName' | 'sourceCanonicalKey' | 'rawRate'>,
): DropRateReferenceEntry {
  return {
    ...input,
    sourceType: 'explore',
    sourceKind: 'location',
    rowKind: 'location_item',
    baseDropRate: 1,
    sourcePageType: 'location',
    sourcePageName: input.sourceName,
    sourcePageUrl: `https://buddy.farm/area/${input.sourceCanonicalKey}/`,
    pageDataUrl: `https://buddy.farm/page-data/area/${input.sourceCanonicalKey}/page-data.json`,
    targetItemId: null,
    targetItemImage: null,
    sourceImage: null,
    ironDepot: null,
    manualFishing: null,
    runecube: null,
    flags: [],
    notes: [],
  };
}

function createDropRateReferenceData(entries: DropRateReferenceEntry[]): DropRateReferenceData {
  return {
    entries,
    byTargetCanonicalKey: entries.reduce<Record<string, DropRateReferenceEntry[]>>((lookup, entry) => {
      lookup[entry.targetCanonicalKey] = [...(lookup[entry.targetCanonicalKey] ?? []), entry];
      return lookup;
    }, {}),
  };
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
    sourceHintsByCanonicalKey: {
      board: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          sourceName: 'Forest',
          sourceCanonicalKey: 'forest',
          sourceType: 'explore',
          preferredUnit: 'arnold_palmers',
          sourceUrl: 'https://buddy.farm/area/forest/',
          notes: [],
        },
      ],
    },
  };
}

const SALT_TOWER_REQUIREMENTS: TowerRequirementsData = {
  entries: [
    {
      towerLevel: 294,
      towerLevelRange: '291-300',
      slotIndex: 2,
      itemName: 'Salt',
      canonicalKey: 'salt',
      masteryLevelNeeded: 'MM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
  ],
  byCanonicalKey: {
    salt: [
      {
        towerLevel: 294,
        towerLevelRange: '291-300',
        slotIndex: 2,
        itemName: 'Salt',
        canonicalKey: 'salt',
        masteryLevelNeeded: 'MM',
        farmrpgItemId: null,
        buddySlug: null,
        notes: null,
        sourceSheet: null,
        sourceRow: null,
      },
    ],
  },
};

function createScaryQuestReferenceData(): QuestReferenceData {
  const quest = {
    questKey: 'pirates start arriving xvi',
    questName: 'Pirates Start Arriving XVI',
    questlineKey: 'pirates start arriving',
    questlineName: 'Pirates Start Arriving',
    questlineAliases: ['PSA'],
    stageLabel: 'XVI',
    npc: 'Vincent',
    farmingLevel: null,
    fishingLevel: null,
    craftingLevel: null,
    exploringLevel: null,
    towerLevel: null,
    previousQuestKey: null,
    nextQuestKeys: [],
    sourceUrl: 'https://buddy.farm/q/pirates-start-arriving-xvi/',
    coverageStatus: 'reviewed' as const,
    notes: [],
  };

  return {
    quests: [quest],
    questsByKey: { [quest.questKey]: quest },
    requirementsByQuestKey: {
      [quest.questKey]: [
        {
          questKey: quest.questKey,
          requirementType: 'item',
          itemName: 'Orange Gecko',
          canonicalKey: 'orange gecko',
          quantity: 8000,
          sourceUrl: quest.sourceUrl,
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

  it('groups shared quest gaps by reviewed drop-rate source pressure using preferred units', () => {
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
      acquisitionState: createDefaultAcquisitionPlannerInputState(),
      recipeGraph: createRecipeGraph(),
      modifierState: createDefaultCraftingModifierState(),
      dropRateReference: createDropRateReferenceData([
        createDropRateRow({
          targetItemName: 'Board',
          targetCanonicalKey: 'board',
          sourceName: 'Forest',
          sourceCanonicalKey: 'forest',
          rawRate: 500,
        }),
        createDropRateRow({
          targetItemName: 'Wood',
          targetCanonicalKey: 'wood',
          sourceName: 'Forest',
          sourceCanonicalKey: 'forest',
          rawRate: 100,
        }),
      ]),
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
    });

    expect(viewModel.sourcePressure).toHaveLength(1);
    expect(viewModel.sourcePressure[0]).toMatchObject({
      sourceName: 'Forest',
      sourceType: 'explore',
      preferredUnit: 'arnold_palmers',
      unitLabel: 'Arnold Palmer',
      coverage: 'drop_rate',
    });
    expect(viewModel.sourcePressure[0].itemNames).toEqual(expect.arrayContaining(['Board', 'Wood']));
    expect(viewModel.sourcePressure[0].questNames).toEqual(expect.arrayContaining(['Pipe Quest', 'Shield Quest']));
    expect(viewModel.sourcePressure[0].estimatedUnitQuantity).toBeCloseTo(14);
  });

  it('surfaces scary future blockers and same-source tower synergies from drop-rate rows', () => {
    const viewModel = buildQuestPlanningViewModel({
      referenceData: createScaryQuestReferenceData(),
      questPlannerState: {
        ...DEFAULT_QUEST_PLANNER_STATE,
        questStates: [
          {
            questKey: 'pirates start arriving xvi',
            status: 'watched',
            hidden: false,
            observedNpc: null,
            observedCompletionPercent: null,
            lastObservedAt: null,
          },
        ],
      },
      acquisitionState: createDefaultAcquisitionPlannerInputState(),
      recipeGraph: createRecipeGraph(),
      modifierState: createDefaultCraftingModifierState(),
      dropRateReference: createDropRateReferenceData([
        createDropRateRow({
          targetItemName: 'Orange Gecko',
          targetCanonicalKey: 'orange gecko',
          sourceName: 'Black Rock Canyon',
          sourceCanonicalKey: 'black rock canyon',
          rawRate: 7500,
        }),
        createDropRateRow({
          targetItemName: 'Salt Rock',
          targetCanonicalKey: 'salt rock',
          sourceName: 'Black Rock Canyon',
          sourceCanonicalKey: 'black rock canyon',
          rawRate: 20,
        }),
      ]),
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
      towerRequirementsData: SALT_TOWER_REQUIREMENTS,
    });

    expect(viewModel.scaryWatchItems[0]).toMatchObject({
      itemName: 'Orange Gecko',
      missingQuantity: 8000,
    });
    expect(viewModel.scaryWatchItems[0].sourcePressure[0].sourceName).toBe('Black Rock Canyon');
    expect(viewModel.synergyHints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        questItemName: 'Orange Gecko',
        relatedItemName: 'Salt Rock',
        targetItemName: 'Salt',
        targetLabel: 'Tower 294',
      }),
    ]));
  });
});
