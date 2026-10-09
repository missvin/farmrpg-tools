import type { RecipeGraph } from './loadRecipeGraph';
import type { DropRateReferenceData } from './loadDropRateReference';
import { normalizeDropRateSourceType } from './dropRateUnitConversions';
import { toCanonicalItemKey } from './normalizeItemKey';
import { getCraftingPlanningPolicy, type CraftingPlanningPolicy } from './craftingPlanningPolicy';
import { createDefaultCraftingModifierState } from './craftingModifierState';

export type TowerMaterial = { canonicalKey: string; itemName: string };
export const COMMON_TOWER_MATERIALS = ['Steel', 'Steel Wire', 'Corn', 'Bamboo', 'Large Net', 'Twine', 'Oak', 'Cloth', 'Small Bolt', 'Emberstone', 'Leather'];
export const TOWER_DYES = ['Black', 'Blue', 'Brown', 'Green', 'Orange', 'Purple', 'Red', 'White', 'Yellow'].map((color) => `${color} Dye`);
// Growable outputs in the reviewed farming sources; rare harvest drops are not crops.
export const TOWER_CROPS = ['Beet', 'Broccoli', 'Cabbage', 'Carrot', 'Corn', 'Cotton', 'Cucumber', 'Eggplant', 'Hops', 'Leek', 'Mushroom', 'Onion', 'Peas', 'Peppers', 'Pine Tree', 'Potato', 'Pumpkin', 'Radish', 'Rice', 'Sunflower', 'Tomato', 'Watermelon', 'Wheat'];
export const DEFAULT_TOWER_MATERIAL_KEYS = [...COMMON_TOWER_MATERIALS, ...TOWER_DYES].map(toCanonicalItemKey);

export function towerMaterialChoices(graph: RecipeGraph | null): TowerMaterial[] {
  const names = new Map<string, string>();
  for (const name of [...COMMON_TOWER_MATERIALS, ...TOWER_DYES, ...TOWER_CROPS, 'Fishing Net']) names.set(toCanonicalItemKey(name), name);
  for (const recipe of graph?.recipes ?? []) {
    for (const input of recipe.inputs) names.set(input.canonicalKey, input.itemName);
  }
  return [...names].map(([canonicalKey, itemName]) => ({ canonicalKey, itemName }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
}

// Relationship adapter only; towerMaterialEstimates resolves supported quantities separately.
export function towerMaterialKeys(root: string, graph: RecipeGraph | null, sources: DropRateReferenceData | null,
  policy: CraftingPlanningPolicy = getCraftingPlanningPolicy(createDefaultCraftingModifierState())): Set<string> {
  const result = new Set<string>();
  const visited = new Set<string>();
  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    // Keep the required intermediate, but do not expand a deliberately excluded recipe.
    for (const input of policy.excludedCraftRecipeOutputKeys.has(key) ? [] : graph?.byOutputCanonicalKey[key]?.inputs ?? []) {
      result.add(input.canonicalKey);
      visit(input.canonicalKey);
    }
    // Require an explicit non-manual fishing source; unknown coverage is not net evidence.
    if (sources?.byTargetCanonicalKey[key]?.some((source) =>
      normalizeDropRateSourceType(source.sourceType) === 'fishing' && source.manualFishing === false && source.rawRate > 0)) {
      for (const net of ['large net', 'fishing net']) {
        result.add(net);
        visit(net);
      }
    }
  }
  visit(root);
  result.delete(root);
  if (TOWER_CROPS.some((name) => toCanonicalItemKey(name) === root)) result.add(root);
  return result;
}

export function matchesTowerMaterials(keys: Set<string>, selected: string[], mode: 'any' | 'all'): boolean {
  return selected.length === 0 || (mode === 'all' ? selected.every((key) => keys.has(key)) : selected.some((key) => keys.has(key)));
}
