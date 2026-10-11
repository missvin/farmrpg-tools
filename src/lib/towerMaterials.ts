import type { RecipeGraph } from './loadRecipeGraph';
import type { DropRateReferenceData } from './loadDropRateReference';
import { normalizeDropRateSourceType } from './dropRateUnitConversions';
import { toCanonicalItemKey } from './normalizeItemKey';
import { getCraftingPlanningPolicy, type CraftingPlanningPolicy } from './craftingPlanningPolicy';
import { createDefaultCraftingModifierState } from './craftingModifierState';
import type { BuildingProductionReferenceData } from './loadBuildingProductionReference';

export type TowerMaterial = { canonicalKey: string; itemName: string };
export const COMMON_TOWER_MATERIALS = ['Steel', 'Steel Wire', 'Corn', 'Bamboo', 'Large Net', 'Twine', 'Oak', 'Cloth', 'Small Bolt', 'Emberstone', 'Leather'];
export const TOWER_DYES = ['Black', 'Blue', 'Brown', 'Green', 'Orange', 'Purple', 'Red', 'White', 'Yellow'].map((color) => `${color} Dye`);
// Reviewed crop preset includes gold crops; excludes mushrooms and other rare harvest drops.
export const TOWER_CROPS = ['Beet', 'Broccoli', 'Cabbage', 'Carrot', 'Corn', 'Cotton', 'Cucumber', 'Eggplant', 'Gold Carrot', 'Gold Cucumber', 'Gold Eggplant', 'Gold Peas', 'Gold Peppers', 'Gold Potato', 'Hops', 'Leek', 'Onion', 'Peas', 'Peppers', 'Pine Tree', 'Potato', 'Pumpkin', 'Radish', 'Rice', 'Sunflower', 'Tomato', 'Watermelon', 'Wheat'];
export const DEFAULT_TOWER_MATERIAL_KEYS = [...COMMON_TOWER_MATERIALS, ...TOWER_DYES].map(toCanonicalItemKey);

export function towerMaterialChoices(graph: RecipeGraph | null, buildings: BuildingProductionReferenceData | null = null): TowerMaterial[] {
  const names = new Map<string, string>();
  for (const name of [...COMMON_TOWER_MATERIALS, ...TOWER_DYES, ...TOWER_CROPS, 'Fishing Net']) names.set(toCanonicalItemKey(name), name);
  for (const recipe of graph?.recipes ?? []) {
    for (const input of recipe.inputs) names.set(input.canonicalKey, input.itemName);
  }
  for (const process of buildings?.productions ?? []) {
    for (const input of process.inputs) names.set(input.canonicalKey, input.itemName);
  }
  for (const conversion of buildings?.conversions ?? []) {
    names.set(conversion.buildingOutputCanonicalKey, conversion.buildingOutputItemName);
    for (const input of conversion.secondaryInputs) names.set(input.canonicalKey, input.itemName);
  }
  return [...names].map(([canonicalKey, itemName]) => ({ canonicalKey, itemName }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
}

export function towerDirectMaterialKeys(key: string, graph: RecipeGraph | null, buildings: BuildingProductionReferenceData | null = null,
  policy: CraftingPlanningPolicy = getCraftingPlanningPolicy(createDefaultCraftingModifierState())): Set<string> {
  const keys = new Set((policy.excludedCraftRecipeOutputKeys.has(key) ? [] : graph?.byOutputCanonicalKey[key]?.inputs ?? [])
    .map((input) => input.canonicalKey));
  for (const process of buildings?.byOutputCanonicalKey[key] ?? []) {
    for (const input of process.inputs) keys.add(input.canonicalKey);
  }
  for (const conversion of buildings?.conversionsByFinalCanonicalKey[key] ?? []) {
    keys.add(conversion.buildingOutputCanonicalKey);
    for (const input of conversion.secondaryInputs) keys.add(input.canonicalKey);
  }
  return keys;
}

// Relationship adapter only; towerMaterialEstimates resolves supported quantities separately.
export function towerMaterialKeys(root: string, graph: RecipeGraph | null, sources: DropRateReferenceData | null,
  policy: CraftingPlanningPolicy = getCraftingPlanningPolicy(createDefaultCraftingModifierState()),
  buildings: BuildingProductionReferenceData | null = null): Set<string> {
  const result = new Set<string>();
  const visited = new Set<string>();
  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    // Keep the required intermediate, but do not expand a deliberately excluded recipe.
    for (const inputKey of towerDirectMaterialKeys(key, graph, buildings, policy)) {
      result.add(inputKey);
      visit(inputKey);
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
