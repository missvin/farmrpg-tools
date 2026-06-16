import { describe, expect, it } from 'vitest';

import { deriveCraftMaterialMatrix } from './craftMaterialMatrix';
import { buildRecipeGraph, parseRecipeInputsCsv, parseRecipesCsv } from './loadRecipeGraph';
import type { TowerRequirementsData } from './loadTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
Red Dye,red dye,craft,,,,,https://buddy.farm/i/red-dye/,https://buddy.farm/page-data/i/red-dye/page-data.json,red-dye.json,test,
Red Shirt,red shirt,craft,,,,,https://buddy.farm/i/red-shirt/,https://buddy.farm/page-data/i/red-shirt/page-data.json,red-shirt.json,test,
Fancy Stew,fancy stew,cooking,Jill's Fancy Stew,jill's fancy stew,10,01:00:00,https://buddy.farm/i/fancy-stew/,https://buddy.farm/page-data/i/fancy-stew/page-data.json,fancy-stew.json,test,`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
red dye,Red Dye,1,Red Berries,red berries,4,https://buddy.farm/i/red-dye/,https://buddy.farm/page-data/i/red-dye/page-data.json,red-dye.json,test,
red shirt,Red Shirt,1,Red Dye,red dye,2,https://buddy.farm/i/red-shirt/,https://buddy.farm/page-data/i/red-shirt/page-data.json,red-shirt.json,test,
red shirt,Red Shirt,2,Cloth,cloth,1,https://buddy.farm/i/red-shirt/,https://buddy.farm/page-data/i/red-shirt/page-data.json,red-shirt.json,test,
fancy stew,Fancy Stew,1,Red Dye,red dye,3,https://buddy.farm/i/fancy-stew/,https://buddy.farm/page-data/i/fancy-stew/page-data.json,fancy-stew.json,test,`;

const recipeGraph = buildRecipeGraph(parseRecipesCsv(RECIPES_CSV), parseRecipeInputsCsv(RECIPE_INPUTS_CSV));

const snapshot: MasterySnapshot = {
  snapshotId: 'snapshot-1',
  createdAt: '2026-06-15T00:00:00.000Z',
  rawText: '',
  masteryByItem: {
    'red dye': 50_000,
    'red shirt': 1_000_000,
  },
  parseSummary: {
    itemsParsed: 2,
    parsedRowsCount: 2,
    tiersDetected: [100_000, 1_000_000],
    duplicateRowsCount: 0,
    skippedNonItemLinesCount: 0,
    skippedNonItemLineSamples: [],
    unknownItemsCount: 0,
    warnings: [],
  },
  parsedRows: [],
};

const towerRequirementsData: TowerRequirementsData = {
  entries: [
    {
      towerLevel: 331,
      towerLevelRange: '331-340',
      slotIndex: 1,
      itemName: 'Red Dye',
      canonicalKey: 'red dye',
      masteryLevelNeeded: 'GM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 334,
      towerLevelRange: '331-340',
      slotIndex: 1,
      itemName: 'Red Shirt',
      canonicalKey: 'red shirt',
      masteryLevelNeeded: 'MM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 335,
      towerLevelRange: '331-340',
      slotIndex: 1,
      itemName: 'Red Shirt',
      canonicalKey: 'red shirt',
      masteryLevelNeeded: 'GM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
  ],
  byCanonicalKey: {},
};

towerRequirementsData.byCanonicalKey = towerRequirementsData.entries.reduce<TowerRequirementsData['byCanonicalKey']>(
  (byCanonicalKey, entry) => {
    byCanonicalKey[entry.canonicalKey] = [...(byCanonicalKey[entry.canonicalKey] ?? []), entry];
    return byCanonicalKey;
  },
  {},
);

describe('deriveCraftMaterialMatrix', () => {
  it('derives direct and one-step downstream recipe uses for a selected material', () => {
    const result = deriveCraftMaterialMatrix({
      seedCanonicalKeys: ['red berries'],
      recipeGraph,
      towerRequirementsData,
      snapshot,
    });

    expect(result.seedCanonicalKeys).toEqual(['red berries']);
    expect(result.rows.map((row) => `${row.pathType}:${row.outputItemName}`)).toEqual([
      'direct:Red Dye',
      'one_step_downstream:Fancy Stew',
      'one_step_downstream:Red Shirt',
    ]);

    const directDyeRow = result.rows.find((row) => row.outputCanonicalKey === 'red dye');
    expect(directDyeRow).toMatchObject({
      seedItemName: 'Red Berries',
      seedCanonicalKey: 'red berries',
      consumedSeedQuantity: 4,
      currentMastery: 50_000,
      matchedSnapshotRow: true,
      towerRelevant: true,
      outputProfilePath: '/items/red%20dye',
    });
    expect(directDyeRow?.towerTargets).toEqual([
      expect.objectContaining({
        masteryLevelNeeded: 'GM',
        requiredThreshold: 100_000,
        remainingToRequirement: 50_000,
        achieved: false,
        levels: [331],
      }),
    ]);

    const shirtRow = result.rows.find((row) => row.outputCanonicalKey === 'red shirt');
    expect(shirtRow).toMatchObject({
      pathType: 'one_step_downstream',
      consumedSeedQuantity: 8,
      currentMastery: 1_000_000,
      towerRelevant: true,
      intermediateOutput: {
        itemName: 'Red Dye',
        canonicalKey: 'red dye',
      },
    });
    expect(shirtRow?.path).toEqual([
      expect.objectContaining({ inputItemName: 'Red Berries', outputItemName: 'Red Dye', quantity: 4 }),
      expect.objectContaining({ inputItemName: 'Red Dye', outputItemName: 'Red Shirt', quantity: 2 }),
    ]);
    expect(shirtRow?.towerTargets.map((target) => target.masteryLevelNeeded)).toEqual(['MM', 'GM']);
    expect(shirtRow?.towerTargets.every((target) => target.achieved)).toBe(true);
  });

  it('can limit derivation to direct uses only', () => {
    const result = deriveCraftMaterialMatrix({
      seedCanonicalKeys: ['red berries'],
      recipeGraph,
      towerRequirementsData,
      snapshot,
      maxDepth: 0,
    });

    expect(result.rows.map((row) => row.outputItemName)).toEqual(['Red Dye']);
  });

  it('dedupes blank seed keys and preserves rows for non-Tower recipe outputs', () => {
    const result = deriveCraftMaterialMatrix({
      seedCanonicalKeys: ['red dye', 'red dye', ''],
      recipeGraph,
      towerRequirementsData,
      snapshot,
    });

    expect(result.seedCanonicalKeys).toEqual(['red dye']);
    expect(result.rows.map((row) => row.outputItemName)).toEqual(['Fancy Stew', 'Red Shirt']);
    expect(result.rows.find((row) => row.outputItemName === 'Fancy Stew')).toMatchObject({
      recipeType: 'cooking',
      towerRelevant: false,
      matchedSnapshotRow: false,
      consumedSeedQuantity: 3,
    });
  });
});
