import { describe, expect, it } from 'vitest';
import { totalTowerMaterials } from './towerMaterialTotals';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { createDefaultDropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import { estimateTowerProductionHours } from './towerProductionRates';
import type { RecipeGraph, RecipeNode } from './loadRecipeGraph';
import type { TowerRemainingRow } from './towerRemainingRows';

const recipes: RecipeNode[] = ['hat', 'boots', 'unknown'].map((key) => ({
  outputCanonicalKey: key, outputItemName: key, recipeType: 'craft', recipeBookItemName: null,
  recipeBookCanonicalKey: null, cookingLevel: null, baseTime: null, sourceBuddyUrl: '',
  inputs: [{ canonicalKey: 'steel', itemName: 'Steel', quantity: 1, inputOrder: 0 },
    { canonicalKey: 'steel wire', itemName: 'Steel Wire', quantity: 2, inputOrder: 1 }],
}));
const graph: RecipeGraph = { recipes, craftRecipes: recipes, cookingRecipes: [], byInputCanonicalKey: {},
  byOutputCanonicalKey: Object.fromEntries(recipes.map((recipe) => [recipe.outputCanonicalKey, recipe])) };
const sources = { recipeGraph: graph, dropRateReference: null, modifierState: createDefaultCraftingModifierState(), fishingSettings: createDefaultDropRateAcquisitionSettings() };
const materials = [{ canonicalKey: 'steel', itemName: 'Steel' }, { canonicalKey: 'steel wire', itemName: 'Steel Wire' }];
function row(key: string, threshold = 100000, current = 99999, matched = true): TowerRemainingRow {
  return { canonicalKey: key, itemName: key, towerLevel: 301, towerLevelRange: '', slotIndex: 1, masteryLevelNeeded: threshold === 100000 ? 'GM' : 'MM',
    currentMastery: current, requiredThreshold: threshold, remainingToRequirement: Math.max(0, threshold - current), achieved: current >= threshold,
    matchedSnapshotRow: matched, farmrpgItemId: null, buddySlug: null, notes: null, sourceSheet: null, sourceRow: null, pumpkinJuices: 1, progressPercent: 99.9 };
}
describe('selected Tower material totals', () => {
  it('uses highest visible targets once, adds distinct items, and is independent of sort order', () => {
    const rows = [row('hat'), row('hat', 1000000), row('boots')];
    const total = totalTowerMaterials(rows, materials, sources);
    expect(total.map((value) => value.quantity)).toEqual([900002, 1800004]);
    expect(totalTowerMaterials([...rows].reverse(), materials, sources)).toEqual(total);
    expect(totalTowerMaterials([rows[0], rows[2]], materials, sources).map((value) => value.quantity)).toEqual([2, 4]);
  });
  it('rounds production time after combining quantities, with independent rates', () => {
    const total = totalTowerMaterials([row('hat'), row('boots')], materials, sources);
    expect(estimateTowerProductionHours(total[0].quantity, 3)).toBe(1);
    expect(estimateTowerProductionHours(total[1].quantity, 1)).toBe(4);
    expect(estimateTowerProductionHours(total[0].quantity, null)).toBeNull();
  });
  it('distinguishes partial, wholly unavailable, complete and unrelated material demand', () => {
    expect(totalTowerMaterials([row('hat'), row('unknown', 100000, 0, false)], materials, sources)[0])
      .toMatchObject({ quantity: 1, unavailableItems: ['unknown'] });
    expect(totalTowerMaterials([row('unknown', 100000, 0, false)], materials, sources)[0])
      .toMatchObject({ quantity: null, unavailableItems: ['unknown'] });
    expect(totalTowerMaterials([row('hat', 100000, 100000)], materials, sources)[0].quantity).toBe(0);
    expect(totalTowerMaterials([row('hat')], [{ canonicalKey: 'tomato', itemName: 'Tomato' }], sources)[0].quantity).toBe(0);
    expect(totalTowerMaterials([row('hat')], materials, { ...sources, recipeGraph: null })[0].quantity).toBeNull();
  });
});
