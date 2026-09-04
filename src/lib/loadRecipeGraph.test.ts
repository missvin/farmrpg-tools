import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  buildRecipeGraph,
  parseRecipeInputsCsv,
  parseRecipesCsv,
  loadRecipeGraph,
} from './loadRecipeGraph';

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.
Quandary Chowder,quandary chowder,cooking,Jill's Quandary Chowder,jill's quandary chowder,25,4h,https://buddy.farm/i/quandary-chowder/,https://buddy.farm/page-data/i/quandary-chowder/page-data.json,quandary-chowder__quandary-chowder.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
fancy pipe,Fancy Pipe,1,Wood,wood,10,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.
fancy pipe,Fancy Pipe,2,Coal,coal,2,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.
quandary chowder,Quandary Chowder,1,Coal,coal,240,https://buddy.farm/i/quandary-chowder/,https://buddy.farm/page-data/i/quandary-chowder/page-data.json,quandary-chowder__quandary-chowder.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.
quandary chowder,Quandary Chowder,2,Salt,salt,1,https://buddy.farm/i/quandary-chowder/,https://buddy.farm/page-data/i/quandary-chowder/page-data.json,quandary-chowder__quandary-chowder.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.`;

describe('loadRecipeGraph', () => {
  it('parses canonical recipe CSVs and builds useful lookup maps', () => {
    const graph = buildRecipeGraph(parseRecipesCsv(RECIPES_CSV), parseRecipeInputsCsv(RECIPE_INPUTS_CSV));

    expect(graph.recipes).toHaveLength(2);
    expect(graph.byOutputCanonicalKey['fancy pipe']).toMatchObject({
      outputItemName: 'Fancy Pipe',
      recipeType: 'craft',
    });
    expect(graph.byOutputCanonicalKey['fancy pipe'].inputs).toEqual([
      { inputOrder: 1, itemName: 'Wood', canonicalKey: 'wood', quantity: 10 },
      { inputOrder: 2, itemName: 'Coal', canonicalKey: 'coal', quantity: 2 },
    ]);
    expect(graph.byInputCanonicalKey.coal.map((recipe) => recipe.outputCanonicalKey).sort()).toEqual([
      'fancy pipe',
      'quandary chowder',
    ]);
    expect(graph.craftRecipes).toHaveLength(1);
    expect(graph.cookingRecipes).toHaveLength(1);
  });

  it('fails on malformed canonical recipe rows and broken references', () => {
    expect(() =>
      parseRecipesCsv(`output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
Fancy Pipe,wrong key,craft,,,,,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.`),
    ).toThrow(/Canonical key mismatch/);

    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(RECIPES_CSV),
        parseRecipeInputsCsv(`output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
missing recipe,Missing Recipe,1,Wood,wood,1,https://buddy.farm/i/missing-recipe/,https://buddy.farm/page-data/i/missing-recipe/page-data.json,missing-recipe__missing-recipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.`),
      ),
    ).toThrow(/Broken recipe input reference/);
  });

  it('allows a recipe sourced outside Buddy to omit a Buddy URL', () => {
    const rows = parseRecipesCsv(`output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
Workshop Item,workshop item,craft,,,,,,,,farmrpg-workshop-paste-v1,User-supplied Workshop paste.`);

    expect(rows).toEqual([
      expect.objectContaining({ outputCanonicalKey: 'workshop item', sourceBuddyUrl: '' }),
    ]);
  });

  it('fails on duplicate outputs, duplicate input orders, duplicate input pairs, and empty recipes', () => {
    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(`${RECIPES_CSV}
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.`),
        parseRecipeInputsCsv(RECIPE_INPUTS_CSV),
      ),
    ).toThrow(/Duplicate recipe output/);

    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(RECIPES_CSV),
        parseRecipeInputsCsv(`output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
fancy pipe,Fancy Pipe,1,Wood,wood,10,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.
fancy pipe,Fancy Pipe,1,Coal,coal,2,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.
quandary chowder,Quandary Chowder,1,Coal,coal,240,https://buddy.farm/i/quandary-chowder/,https://buddy.farm/page-data/i/quandary-chowder/page-data.json,quandary-chowder__quandary-chowder.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.`),
      ),
    ).toThrow(/Duplicate input_order/);

    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(RECIPES_CSV),
        parseRecipeInputsCsv(`output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
fancy pipe,Fancy Pipe,1,Wood,wood,10,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.
fancy pipe,Fancy Pipe,2,Wood,wood,2,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.
quandary chowder,Quandary Chowder,1,Coal,coal,240,https://buddy.farm/i/quandary-chowder/,https://buddy.farm/page-data/i/quandary-chowder/page-data.json,quandary-chowder__quandary-chowder.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.`),
      ),
    ).toThrow(/Duplicate input "wood"/);

    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(RECIPES_CSV),
        parseRecipeInputsCsv(`output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes
fancy pipe,Fancy Pipe,1,Wood,wood,10,https://buddy.farm/i/fancy-pipe/,https://buddy.farm/page-data/i/fancy-pipe/page-data.json,fancy-pipe__fancy-pipe.json,buddy-item-multi-source-v1,Promoted from cached Buddy evidence.`),
      ),
    ).toThrow(/has no recipe inputs/);
  });

  it('loads recipe graph from canonical local recipe CSV files', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(RECIPES_CSV, { status: 200 }))
      .mockResolvedValueOnce(new Response(RECIPE_INPUTS_CSV, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const graph = await loadRecipeGraph();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(graph.recipes).toHaveLength(2);
    expect(graph.byOutputCanonicalKey['quandary chowder'].recipeBookItemCanonicalKey).toBeUndefined();
  });

  it('parses the checked-in current-universe recipe data', () => {
    const recipesCsv = readFileSync(join(process.cwd(), 'data', 'recipes.csv'), 'utf8');
    const recipeInputsCsv = readFileSync(join(process.cwd(), 'data', 'recipe_inputs.csv'), 'utf8');
    const graph = buildRecipeGraph(parseRecipesCsv(recipesCsv), parseRecipeInputsCsv(recipeInputsCsv));

    expect(graph.recipes).toHaveLength(316);
    expect(graph.recipes.every((recipe) => recipe.inputs.length > 0)).toBe(true);
    expect(graph.byOutputCanonicalKey.valve.inputs.map((input) => input.itemName).sort()).toEqual([
      'Broken Pipe',
      'Cogwheel',
      'Hammer',
      'Red Dye',
      'Steel',
    ]);
    expect(graph.byOutputCanonicalKey['monarch butterfly']).toMatchObject({
      outputItemName: 'Monarch Butterfly',
      recipeType: 'craft',
    });
    expect(graph.byOutputCanonicalKey['monarch butterfly'].inputs).toEqual([
      expect.objectContaining({ itemName: 'Caterpillar', quantity: 1 }),
      expect.objectContaining({ itemName: 'Silk', quantity: 1 }),
      expect.objectContaining({ itemName: 'Black Dye', quantity: 1 }),
      expect.objectContaining({ itemName: 'Orange Butterfly', quantity: 1 }),
    ]);
    expect(graph.byOutputCanonicalKey['acorn pie']).toMatchObject({
      recipeType: 'cooking',
      cookingLevel: '50',
      baseTime: '24h',
    });
    expect(graph.byOutputCanonicalKey['wood planer']).toMatchObject({
      outputItemName: 'Wood Planer',
      recipeType: 'craft',
    });
    expect(graph.byOutputCanonicalKey['wood planer'].inputs.map((input) => input.itemName)).toEqual([
      'Iron',
      'Wood',
      'Steel',
      'Moonstone',
      'Small Bolt',
    ]);
    expect(graph.byOutputCanonicalKey['christmas tree'].inputs.map((input) => [input.itemName, input.quantity])).toEqual([
      ['Orange Ornament', 3],
      ['Green Ornament', 3],
      ['Red Ornament', 3],
      ['Yellow Ornament', 3],
      ['Blue Ornament', 3],
      ['Purple Ornament', 3],
      ['Pine Tree', 1],
      ['Star', 1],
    ]);
    expect(graph.byOutputCanonicalKey['holiday wreath'].inputs.map((input) => [input.itemName, input.quantity])).toEqual([
      ['Pine Cone', 6],
      ['Red Berries', 6],
      ['Orange Ornament', 3],
      ['Green Ornament', 3],
      ['Red Ornament', 3],
      ['Yellow Ornament', 3],
      ['Blue Ornament', 3],
      ['Purple Ornament', 3],
      ['Steel Wire', 1],
      ['Pine Tree', 1],
    ]);
    expect(graph.byOutputCanonicalKey['pine shavings']).toMatchObject({
      outputItemName: 'Pine Shavings',
      recipeType: 'craft',
    });
    expect(graph.byOutputCanonicalKey['pine shavings'].inputs.map((input) => input.itemName)).toEqual([
      'Emberstone',
      'Pine Board',
      'Wood Planer',
    ]);
    expect(graph.byInputCanonicalKey['wood planer'].map((recipe) => recipe.outputItemName)).toEqual(['Pine Shavings']);
    expect(graph.byOutputCanonicalKey['green top hat']).toBeUndefined();
    expect(graph.byOutputCanonicalKey['shamrock milk']).toBeUndefined();
  });
});
