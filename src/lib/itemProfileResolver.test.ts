import { describe, expect, it } from 'vitest';

import type { ItemCatalogData } from './loadItemCatalog';
import type { RecipeGraph } from './loadRecipeGraph';
import type { TowerRequirementsData } from './loadTowerRequirements';
import { resolveItemProfile } from './itemProfileResolver';
import type { MasterySnapshot } from './storage/masterySnapshots';

const snapshot: MasterySnapshot = {
  snapshotId: 'snapshot-1',
  createdAt: '2026-05-08T00:00:00.000Z',
  rawText: '',
  masteryByItem: {
    board: 50_000,
    'red dye': 0,
  },
  parseSummary: {
    itemsParsed: 2,
    parsedRowsCount: 2,
    tiersDetected: [100_000],
    duplicateRowsCount: 0,
    skippedNonItemLinesCount: 0,
    skippedNonItemLineSamples: [],
    unknownItemsCount: 0,
    warnings: [],
  },
  parsedRows: [
    {
      rawItemName: 'Board',
      canonicalKey: 'board',
      count: 50_000,
      targetTier: 100_000,
      sourceLineIndex: 0,
    },
    {
      rawItemName: 'Red Dye',
      canonicalKey: 'red dye',
      count: 0,
      targetTier: 10_000,
      sourceLineIndex: 1,
    },
  ],
};

const itemCatalog: ItemCatalogData = {
  entries: [
    {
      itemName: 'Board',
      canonicalKey: 'board',
      masteryPossible: 'yes',
      farmrpgItemId: null,
      buddySlug: null,
      sourceDatasets: ['test'],
      notes: null,
    },
  ],
  byCanonicalKey: {
    board: {
      itemName: 'Board',
      canonicalKey: 'board',
      masteryPossible: 'yes',
      farmrpgItemId: null,
      buddySlug: null,
      sourceDatasets: ['test'],
      notes: null,
    },
  },
};

const towerRequirementsData: TowerRequirementsData = {
  entries: [
    {
      towerLevel: 201,
      towerLevelRange: '201-210',
      slotIndex: 1,
      itemName: 'Board',
      canonicalKey: 'board',
      masteryLevelNeeded: 'MM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 202,
      towerLevelRange: '201-210',
      slotIndex: 1,
      itemName: 'Board',
      canonicalKey: 'board',
      masteryLevelNeeded: 'GM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
  ],
  byCanonicalKey: {
    board: [
      {
        towerLevel: 201,
        towerLevelRange: '201-210',
        slotIndex: 1,
        itemName: 'Board',
        canonicalKey: 'board',
        masteryLevelNeeded: 'MM',
        farmrpgItemId: null,
        buddySlug: null,
        notes: null,
        sourceSheet: null,
        sourceRow: null,
      },
      {
        towerLevel: 202,
        towerLevelRange: '201-210',
        slotIndex: 1,
        itemName: 'Board',
        canonicalKey: 'board',
        masteryLevelNeeded: 'GM',
        farmrpgItemId: null,
        buddySlug: null,
        notes: null,
        sourceSheet: null,
        sourceRow: null,
      },
    ],
  },
};

const recipeGraph: RecipeGraph = {
  recipes: [
    {
      outputItemName: 'Red Dye',
      outputCanonicalKey: 'red dye',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: 'https://buddy.farm/i/red-dye/',
      inputs: [
        {
          inputOrder: 1,
          itemName: 'Board',
          canonicalKey: 'board',
          quantity: 2,
        },
      ],
    },
  ],
  byOutputCanonicalKey: {
    'red dye': {
      outputItemName: 'Red Dye',
      outputCanonicalKey: 'red dye',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: 'https://buddy.farm/i/red-dye/',
      inputs: [
        {
          inputOrder: 1,
          itemName: 'Board',
          canonicalKey: 'board',
          quantity: 2,
        },
      ],
    },
  },
  byInputCanonicalKey: {
    board: [
      {
        outputItemName: 'Red Dye',
        outputCanonicalKey: 'red dye',
        recipeType: 'craft',
        recipeBookItemName: null,
        recipeBookCanonicalKey: null,
        cookingLevel: null,
        baseTime: null,
        sourceBuddyUrl: 'https://buddy.farm/i/red-dye/',
        inputs: [
          {
            inputOrder: 1,
            itemName: 'Board',
            canonicalKey: 'board',
            quantity: 2,
          },
        ],
      },
    ],
  },
  craftRecipes: [],
  cookingRecipes: [],
};

describe('resolveItemProfile', () => {
  it('combines catalog, snapshot, tower, and recipe-input context for a known item', () => {
    const profile = resolveItemProfile({
      canonicalKey: 'board',
      snapshot,
      itemCatalog,
      towerRequirementsData,
      recipeGraph,
    });

    expect(profile.itemName).toBe('Board');
    expect(profile.known).toBe(true);
    expect(profile.sources).toEqual(['catalog', 'snapshot', 'tower', 'recipe_input']);
    expect(profile.currentMastery).toBe(50_000);
    expect(profile.towerTarget?.masteryLevelLabel).toBe('MM');
    expect(profile.towerTarget?.levels).toEqual([201]);
    expect(profile.usedInRecipes).toHaveLength(1);
    expect(profile.masteryTargets.find((target) => target.tier === 'GM')?.estimate.totalPumpkinJuices).toBe(8);
  });

  it('returns a direct recipe and baseline blocker for a zero-mastery output item', () => {
    const profile = resolveItemProfile({
      canonicalKey: 'red dye',
      snapshot,
      recipeGraph,
    });

    expect(profile.itemName).toBe('Red Dye');
    expect(profile.sources).toEqual(['snapshot', 'recipe_output']);
    expect(profile.directRecipe?.inputs).toEqual([
      {
        inputOrder: 1,
        itemName: 'Board',
        canonicalKey: 'board',
        quantity: 2,
      },
    ]);
    expect(profile.masteryTargets.find((target) => target.tier === 'M')?.estimate.status).toBe('needs_baseline');
  });

  it('falls back safely for unknown items', () => {
    const profile = resolveItemProfile({
      canonicalKey: 'mystery item',
      snapshot,
      itemCatalog,
      towerRequirementsData,
      recipeGraph,
    });

    expect(profile.known).toBe(false);
    expect(profile.itemName).toBe('Mystery Item');
    expect(profile.towerTarget).toBeNull();
    expect(profile.directRecipe).toBeNull();
  });
});
