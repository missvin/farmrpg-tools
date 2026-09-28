import { describe, expect, it } from 'vitest';
import { matchesTowerMaterials, towerMaterialChoices, towerMaterialKeys } from './towerMaterials';
import type { RecipeGraph, RecipeNode } from './loadRecipeGraph';
import type { DropRateReferenceData, DropRateReferenceEntry } from './loadDropRateReference';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { getCraftingPlanningPolicy } from './craftingPlanningPolicy';

export function materialTestGraph(): RecipeGraph {
  const recipes = Object.entries({ 'propeller hat': ['Steel Wire', 'Leather', 'Red Dye'], 'steel wire': ['Steel'], steel: ['Iron'], board: ['Twine'], twine: ['Board'] })
    .map(([key, inputs]): RecipeNode => ({ outputCanonicalKey: key, outputItemName: key,
      recipeType: 'craft', recipeBookItemName: null, recipeBookCanonicalKey: null, cookingLevel: null, baseTime: null, sourceBuddyUrl: '',
      inputs: inputs.map((itemName, inputOrder) => ({ canonicalKey: itemName.toLowerCase(), itemName, inputOrder, quantity: 1 })) }));
  return { recipes, byOutputCanonicalKey: Object.fromEntries(recipes.map((recipe) => [recipe.outputCanonicalKey, recipe])), byInputCanonicalKey: {}, craftRecipes: recipes, cookingRecipes: [] };
}

describe('Tower material relationships', () => {
  it('stops excluded recipe expansion but keeps the intermediate and honors opt-in and alternate paths', () => {
    const graph = materialTestGraph();
    const excluded = { ...graph.recipes[0], outputCanonicalKey: 'unpolished shimmer stone', outputItemName: 'Unpolished Shimmer Stone',
      inputs: [{ itemName: 'Emberstone', canonicalKey: 'emberstone', inputOrder: 1, quantity: 1 }] };
    graph.byOutputCanonicalKey['unpolished shimmer stone'] = excluded;
    graph.byOutputCanonicalKey['propeller hat'].inputs.push({ itemName: 'Unpolished Shimmer Stone', canonicalKey: 'unpolished shimmer stone', inputOrder: 4, quantity: 1 });
    const state = createDefaultCraftingModifierState();
    const keys = towerMaterialKeys('propeller hat', graph, null, getCraftingPlanningPolicy(state));
    expect(keys.has('unpolished shimmer stone')).toBe(true);
    expect(keys.has('emberstone')).toBe(false);
    expect(matchesTowerMaterials(keys, ['emberstone'], 'any')).toBe(false);
    expect(matchesTowerMaterials(keys, ['steel', 'emberstone'], 'all')).toBe(false);
    state.planning.includeExcludedRecipes = true;
    expect(towerMaterialKeys('propeller hat', graph, null, getCraftingPlanningPolicy(state)).has('emberstone')).toBe(true);
    state.planning.includeExcludedRecipes = false;
    graph.byOutputCanonicalKey['propeller hat'].inputs.push({ itemName: 'Emberstone', canonicalKey: 'emberstone', inputOrder: 5, quantity: 1 });
    expect(towerMaterialKeys('propeller hat', graph, null, getCraftingPlanningPolicy(state)).has('emberstone')).toBe(true);
  });
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
