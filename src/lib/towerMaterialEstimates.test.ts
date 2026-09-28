import { describe, expect, it } from 'vitest';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import { createDefaultDropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import { estimateTowerMaterial, type TowerEstimateSources } from './towerMaterialEstimates';
import type { RecipeGraph, RecipeNode } from './loadRecipeGraph';
import type { TowerRemainingRow } from './towerRemainingRows';
import type { DropRateReferenceEntry } from './loadDropRateReference';

function graphFrom(inputs: Record<string, Array<[string, number]>>): RecipeGraph {
  const recipes = Object.entries(inputs).map(([key, items]): RecipeNode => ({ outputItemName: key, outputCanonicalKey: key,
    recipeType: 'craft', recipeBookItemName: null, recipeBookCanonicalKey: null, cookingLevel: null, baseTime: null, sourceBuddyUrl: '',
    inputs: items.map(([canonicalKey, quantity], inputOrder) => ({ itemName: canonicalKey, canonicalKey, quantity, inputOrder })) }));
  return { recipes, byOutputCanonicalKey: Object.fromEntries(recipes.map((recipe) => [recipe.outputCanonicalKey, recipe])), craftRecipes: recipes, cookingRecipes: [], byInputCanonicalKey: {} };
}
const graph = graphFrom({ hat: [['steel', 1], ['wire', 1]], wire: [['steel', 2]], steel: [['iron', 3]], 'large net': [['fishing net', 25]], 'fishing net': [['twine', 2]] });
function row(key = 'hat', remaining = 100): TowerRemainingRow {
  return { canonicalKey: key, itemName: key, towerLevel: 301, towerLevelRange: '', slotIndex: 1, masteryLevelNeeded: 'GM',
    currentMastery: 100000 - remaining, requiredThreshold: 100000, remainingToRequirement: remaining, achieved: remaining === 0,
    matchedSnapshotRow: true, farmrpgItemId: null, buddySlug: null, notes: null, sourceSheet: null, sourceRow: null, pumpkinJuices: 1, progressPercent: 99.9 };
}
function sources(): TowerEstimateSources {
  return { recipeGraph: graph, modifierState: createDefaultCraftingModifierState(), fishingSettings: createDefaultDropRateAcquisitionSettings(), dropRateReference: null };
}

describe('Tower target material estimates', () => {
  it('combines repeated paths before expanding intermediates, without inventory or cross-row allocation', () => {
    const input = sources();
    expect(estimateTowerMaterial(row(), 'wire', input).quantity).toBe(100);
    expect(estimateTowerMaterial(row(), 'steel', input).quantity).toBe(300);
    expect(estimateTowerMaterial(row(), 'iron', input).quantity).toBe(900);
    const mm = { ...row('hat', 900100), masteryLevelNeeded: 'MM' as const, requiredThreshold: 1000000 };
    expect(estimateTowerMaterial(mm, 'steel', input).quantity).toBe(2700300);
    expect(estimateTowerMaterial(row(), 'steel', input).quantity).toBe(300);
  });
  it('uses saved saver and mastery modifiers at every craft stage', () => {
    const input = sources();
    input.modifierState.temporary.eventMasteryBonusPercent = 1;
    input.modifierState.temporary.eventResourceSaverBonusPercent = 1;
    // 100 mastery / 2 = 50 outputs; 25 hat crafts, 13 wire crafts, 51 steel -> 26 steel crafts.
    expect(estimateTowerMaterial(row(), 'steel', input).quantity).toBe(51);
    expect(estimateTowerMaterial(row(), 'iron', input).quantity).toBe(78);
    expect(row().remainingToRequirement).toBe(100);
  });
  it('keeps unknown mastery, cooking, cyclic, excluded, and incomplete paths explicit', () => {
    expect(estimateTowerMaterial({ ...row(), matchedSnapshotRow: false }, 'steel', sources()).quantity).toBeNull();
    expect(estimateTowerMaterial(row('hat', 0), 'steel', sources()).quantity).toBe(0);
    expect(estimateTowerMaterial(row('unknown'), 'steel', sources()).quantity).toBeNull();
    const input = sources();
    input.recipeGraph = graphFrom({ hat: [['steel', 1]], steel: [['hat', 1]] });
    expect(estimateTowerMaterial(row(), 'steel', input).quantity).toBeNull();
    input.recipeGraph = graphFrom({ hat: [['steel', 1], ['magna core', 1]], 'magna core': [['steel', 2]] });
    expect(estimateTowerMaterial(row(), 'steel', input).quantity).toBeNull();
    input.modifierState.planning.includeExcludedRecipes = true;
    expect(estimateTowerMaterial(row(), 'steel', input).quantity).toBe(300);
    input.recipeGraph.byOutputCanonicalKey.hat.recipeType = 'cooking';
    expect(estimateTowerMaterial(row(), 'steel', input).note).toContain('Cooking');
    input.modifierState.planning.ironDepotActive = true;
    expect(estimateTowerMaterial(row(), 'iron', input).note).toContain('Iron Depot');
  });
  it('converts supported net routes and their crafting inputs, with saved fishing and mastery assumptions', () => {
    const input = sources();
    const entry = { targetCanonicalKey: 'fish', sourceType: 'fishing', manualFishing: false, rawRate: 50, baseDropRate: null,
      sourceName: 'Pond', sourceCanonicalKey: 'pond', ironDepot: null, runecube: null } as DropRateReferenceEntry;
    input.dropRateReference = { entries: [entry], byTargetCanonicalKey: { fish: [entry] } };
    input.fishingSettings.meals.seaPincherSpecialActive = false;
    input.fishingSettings.perks.fishingTrawlActive = true;
    expect(estimateTowerMaterial(row('fish'), 'large net', input).quantity).toBe(10);
    expect(estimateTowerMaterial(row('fish'), 'fishing net', input).quantity).toBe(500);
    expect(estimateTowerMaterial(row('fish'), 'twine', input).quantity).toBe(500);
    input.modifierState.temporary.eventMasteryBonusPercent = 1;
    expect(estimateTowerMaterial(row('fish'), 'large net', input).quantity).toBe(5);
    entry.manualFishing = true;
    expect(estimateTowerMaterial(row('fish'), 'large net', input).quantity).toBeNull();
    entry.manualFishing = false; entry.runecube = !input.fishingSettings.perks.eagleEyeRunecubeActive;
    expect(estimateTowerMaterial(row('fish'), 'large net', input).quantity).toBeNull();
  });
});
