import { calculateEffectiveMasteryGain } from './craftingMasteryEngine';
import type { UserCraftingModifierState } from './craftingModifierState';
import { getCraftingPlanningPolicy } from './craftingPlanningPolicy';
import type { DropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import { convertDropRateUnit, normalizeDropRateSourceType } from './dropRateUnitConversions';
import type { DropRateReferenceData } from './loadDropRateReference';
import type { RecipeGraph } from './loadRecipeGraph';
import { calculateCraftIngredientDemand } from './recursiveIngredientBurden';
import type { TowerRemainingRow } from './towerRemainingRows';
import { TOWER_CROPS, towerMaterialKeys } from './towerMaterials';
import { toCanonicalItemKey } from './normalizeItemKey';

export type TowerMaterialEstimate = { quantity: number | null; note: string };
export type TowerEstimateSources = {
  recipeGraph: RecipeGraph | null;
  dropRateReference: DropRateReferenceData | null;
  modifierState: UserCraftingModifierState;
  fishingSettings: DropRateAcquisitionSettings;
};

export function estimateTowerMaterial(row: TowerRemainingRow, material: string, sources: TowerEstimateSources): TowerMaterialEstimate {
  const unavailable = (note: string): TowerMaterialEstimate => ({ quantity: null, note });
  if (!row.matchedSnapshotRow) return unavailable('Item is missing from the latest mastery import.');
  if (row.remainingToRequirement === 0) return { quantity: 0, note: 'This requirement is complete.' };
  const { recipeGraph, modifierState, dropRateReference, fishingSettings } = sources;
  const policy = getCraftingPlanningPolicy(modifierState);
  if (policy.autoSuppliedIngredientKeys.has(material)) return unavailable('Iron Depot supplies this material automatically; the shared planner does not report its gross consumption.');
  const excludedRecipeNote = (key: string) => `Crafting ${recipeGraph?.byOutputCanonicalKey[key]?.outputItemName ?? key} is intentionally excluded by your saved recipe policy; its recipe is not missing.`;
  if (policy.excludedCraftRecipeOutputKeys.has(row.canonicalKey)) return unavailable(excludedRecipeNote(row.canonicalKey));
  try {
    const gain = calculateEffectiveMasteryGain({ baseMasteryGain: 1, modifierState }).effectiveMasteryGain;
    if (material === row.canonicalKey && TOWER_CROPS.some((name) => toCanonicalItemKey(name) === material)) {
      return { quantity: Math.ceil(row.remainingToRequirement / gain), note: 'Crop units needed for mastery with saved mastery bonuses; Resource Saver does not multiply harvested crops. No inventory subtraction or growing-time estimate.' };
    }
    if (recipeGraph?.byOutputCanonicalKey[row.canonicalKey]?.recipeType === 'craft') {
      const demand = calculateCraftIngredientDemand({ recipeGraph, modifierState, goals: [{
        canonicalKey: row.canonicalKey, itemName: row.itemName, desiredEffectiveOutput: row.remainingToRequirement / gain,
      }] });
      const incompletePath = Object.keys(demand.ingredientBurdenByCanonicalKey).some((key) => {
        const recipe = recipeGraph.byOutputCanonicalKey[key];
        return key !== material && (recipe?.recipeType !== 'craft' || policy.excludedCraftRecipeOutputKeys.has(key))
          && towerMaterialKeys(key, recipeGraph, dropRateReference, policy).has(material);
      });
      if (incompletePath) return unavailable('A contributing acquisition or recipe path is unsupported; a partial quantity would undercount.');
      const entry = demand.ingredientBurdenByCanonicalKey[material];
      if (entry) return { quantity: entry.totalRequiredEffectiveOutput, note: 'Crafting total with saved modifiers and recipe policy.' };
      const excludedPath = Object.keys(demand.ingredientBurdenByCanonicalKey).find((key) =>
        policy.excludedCraftRecipeOutputKeys.has(key) && towerMaterialKeys(key, recipeGraph, null,
          { ...policy, excludedCraftRecipeOutputKeys: new Set() }).has(material));
      if (excludedPath) return unavailable(excludedRecipeNote(excludedPath));
      return unavailable('No complete supported recipe/acquisition path under the saved planning policy.');
    }
    if (recipeGraph?.byOutputCanonicalKey[row.canonicalKey]?.recipeType === 'cooking') return unavailable('Cooking mastery conversion is not supported.');
    const netKey = material === 'fishing net' ? 'fishing net' : 'large net';
    const candidates = (dropRateReference?.byTargetCanonicalKey[row.canonicalKey] ?? []).filter((source) =>
      normalizeDropRateSourceType(source.sourceType) === 'fishing' && source.manualFishing === false && source.rawRate > 0
      && (source.ironDepot === null || source.ironDepot === fishingSettings.perks.ironDepotActive)
      && (source.runecube === null || source.runecube === fishingSettings.perks.eagleEyeRunecubeActive));
    const converted = candidates.map((source) => ({ source, conversion: convertDropRateUnit({ rate: source.rawRate,
      sourceType: source.sourceType, fromUnit: 'fish', toUnit: netKey === 'large net' ? 'large_nets' : 'fishing_nets',
      direction: 'units_per_item', settings: fishingSettings, baseDropRate: source.baseDropRate, sourceCanonicalKey: source.sourceCanonicalKey }) }))
      .filter(({ conversion }) => conversion.calculable && conversion.rate > 0)
      .sort((a, b) => a.conversion.rate - b.conversion.rate);
    const best = converted[0];
    if (!best) return unavailable('No reviewed craft recipe or supported fishing conversion for the saved assumptions.');
    const nets = Math.ceil(row.remainingToRequirement / gain * best.conversion.rate);
    const note = `Expected fishing use at ${best.source.sourceName}; ${netKey === 'large net' ? 'Large Net' : 'Fishing Net'} route. Routes are alternatives, not additive.`;
    if (material === netKey) return { quantity: nets, note };
    if (!recipeGraph) return unavailable('Net crafting reference is unavailable.');
    const demand = calculateCraftIngredientDemand({ recipeGraph, modifierState, goals: [{ canonicalKey: netKey, itemName: 'Large Net', desiredEffectiveOutput: nets }] });
    const entry = demand.ingredientBurdenByCanonicalKey[material];
    return entry ? { quantity: entry.totalRequiredEffectiveOutput, note } : unavailable('No complete supported net recipe path.');
  } catch {
    return unavailable('Recipe expansion is unavailable because reference data is missing, invalid, or cyclic.');
  }
}
