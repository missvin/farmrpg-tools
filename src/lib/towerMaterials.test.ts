import { describe, expect, it } from 'vitest';
import { matchesTowerMaterials, towerMaterialChoices, towerMaterialKeys } from './towerMaterials';
import type { RecipeGraph, RecipeNode } from './loadRecipeGraph';
import type { DropRateReferenceData, DropRateReferenceEntry } from './loadDropRateReference';

export function materialTestGraph(): RecipeGraph {
  const recipes = Object.entries({ 'propeller hat': ['Steel Wire', 'Leather', 'Red Dye'], 'steel wire': ['Steel'], steel: ['Iron'], board: ['Twine'], twine: ['Board'] })
    .map(([key, inputs]): RecipeNode => ({ outputCanonicalKey: key, outputItemName: key,
      recipeType: 'craft', recipeBookItemName: null, recipeBookCanonicalKey: null, cookingLevel: null, baseTime: null, sourceBuddyUrl: '',
      inputs: inputs.map((itemName, inputOrder) => ({ canonicalKey: itemName.toLowerCase(), itemName, inputOrder, quantity: 1 })) }));
  return { recipes, byOutputCanonicalKey: Object.fromEntries(recipes.map((recipe) => [recipe.outputCanonicalKey, recipe])), byInputCanonicalKey: {}, craftRecipes: recipes, cookingRecipes: [] };
}

describe('Tower material relationships', () => {
  it('finds nested and intermediate materials, deduplicates paths, and terminates cycles', () => {
    const graph = materialTestGraph();
    expect([...towerMaterialKeys('propeller hat', graph, null)].sort()).toEqual(['iron', 'leather', 'red dye', 'steel', 'steel wire']);
    expect([...towerMaterialKeys('board', graph, null)]).toEqual(['twine']);
    expect(towerMaterialKeys('unknown', null, null).size).toBe(0);
    const keys = towerMaterialKeys('propeller hat', graph, null);
    expect(matchesTowerMaterials(keys, [], 'all')).toBe(true);
    expect(matchesTowerMaterials(keys, ['steel', 'twine'], 'any')).toBe(true);
    expect(matchesTowerMaterials(keys, ['steel', 'twine'], 'all')).toBe(false);
    expect(matchesTowerMaterials(keys, ['steel', 'leather'], 'all')).toBe(true);
    expect(towerMaterialChoices(graph).some((item) => item.itemName === 'Fishing Net')).toBe(true);
  });
  it('requires explicit non-manual fishing evidence, including fish within recipe chains', () => {
    function source(manualFishing: boolean | null): DropRateReferenceData {
      const entry = { sourceType: 'fishing', manualFishing, rawRate: 5 } as DropRateReferenceEntry;
      return { entries: [entry], byTargetCanonicalKey: { iron: [entry] } };
    }
    expect(towerMaterialKeys('propeller hat', materialTestGraph(), source(false)).has('large net')).toBe(true);
    expect(towerMaterialKeys('iron', null, source(false)).has('fishing net')).toBe(true);
    for (const flag of [true, null]) expect(towerMaterialKeys('iron', null, source(flag)).has('large net')).toBe(false);
  });
});
