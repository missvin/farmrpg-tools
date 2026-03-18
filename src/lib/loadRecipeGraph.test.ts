import { describe, expect, it, vi } from 'vitest';

import {
  buildRecipeGraph,
  parseRecipeInputsCsv,
  parseRecipesCsv,
  loadRecipeGraph,
} from './loadRecipeGraph';

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/
Quandary Chowder,quandary chowder,cooking,Jill's Quandary Chowder,jill's quandary chowder,25,4h,https://buddy.farm/i/quandary-chowder/`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
fancy pipe,Fancy Pipe,1,Wood,wood,10
fancy pipe,Fancy Pipe,2,Coal,coal,2
quandary chowder,Quandary Chowder,1,Coal,coal,240
quandary chowder,Quandary Chowder,2,Salt,salt,1`;

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
      parseRecipesCsv(`output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url
Fancy Pipe,wrong key,craft,,,,,https://buddy.farm/i/fancy-pipe/`),
    ).toThrow(/Canonical key mismatch/);

    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(RECIPES_CSV),
        parseRecipeInputsCsv(`output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
missing recipe,Missing Recipe,1,Wood,wood,1`),
      ),
    ).toThrow(/Broken recipe input reference/);
  });

  it('fails on duplicate outputs, duplicate input orders, duplicate input pairs, and empty recipes', () => {
    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(`${RECIPES_CSV}
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/`),
        parseRecipeInputsCsv(RECIPE_INPUTS_CSV),
      ),
    ).toThrow(/Duplicate recipe output/);

    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(RECIPES_CSV),
        parseRecipeInputsCsv(`output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
fancy pipe,Fancy Pipe,1,Wood,wood,10
fancy pipe,Fancy Pipe,1,Coal,coal,2
quandary chowder,Quandary Chowder,1,Coal,coal,240`),
      ),
    ).toThrow(/Duplicate input_order/);

    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(RECIPES_CSV),
        parseRecipeInputsCsv(`output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
fancy pipe,Fancy Pipe,1,Wood,wood,10
fancy pipe,Fancy Pipe,2,Wood,wood,2
quandary chowder,Quandary Chowder,1,Coal,coal,240`),
      ),
    ).toThrow(/Duplicate input "wood"/);

    expect(() =>
      buildRecipeGraph(
        parseRecipesCsv(RECIPES_CSV),
        parseRecipeInputsCsv(`output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
fancy pipe,Fancy Pipe,1,Wood,wood,10`),
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
});
