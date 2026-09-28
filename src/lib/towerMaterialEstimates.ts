import { calculateEffectiveMasteryGain } from './craftingMasteryEngine';
import type { UserCraftingModifierState } from './craftingModifierState';
import { getCraftingPlanningPolicy } from './craftingPlanningPolicy';
import type { DropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import { convertDropRateUnit, normalizeDropRateSourceType } from './dropRateUnitConversions';
import type { DropRateReferenceData } from './loadDropRateReference';
import type { RecipeGraph } from './loadRecipeGraph';
import { calculateCraftIngredientDemand } from './recursiveIngredientBurden';
import type { TowerRemainingRow } from './towerRemainingRows';
import { towerMaterialKeys } from './towerMaterials';

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
  try {
    const gain = calculateEffectiveMasteryGain({ baseMasteryGain: 1, modifierState }).effectiveMasteryGain;
    if (recipeGraph?.byOutputCanonicalKey[row.canonicalKey]?.recipeType === 'craft') {
      const demand = calculateCraftIngredientDemand({ recipeGraph, modifierState, goals: [{
        canonicalKey: row.canonicalKey, itemName: row.itemName, desiredEffectiveOutput: row.remainingToRequirement / gain,
      }] });
      const incompletePath = Object.keys(demand.ingredientBurdenByCanonicalKey).some((key) => {
        const recipe = recipeGraph.byOutputCanonicalKey[key];
        return (recipe?.recipeType !== 'craft' || policy.excludedCraftRecipeOutputKeys.has(key))
          && towerMaterialKeys(key, recipeGraph, dropRateReference).has(material);
      });
      if (incompletePath) return unavailable('A contributing acquisition or recipe path is unsupported; a partial quantity would undercount.');
      const entry = demand.ingredientBurdenByCanonicalKey[material];
      if (entry) return { quantity: entry.totalRequiredEffectiveOutput, note: 'Crafting total with saved modifiers and recipe policy.' };
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
    if (!best) return unavailable('No supported fishing conversion for the saved assumptions.');
    const nets = Math.ceil(row.remainingToRequirement / gain * best.conversion.rate);
    const note = `Expected fishing use at ${best.source.sourceName}; ${netKey === 'large net' ? 'Large Net' : 'Fishing Net'} route. Routes are alternatives, not additive.`;
    if (material === netKey) return { quantity: nets, note };
    if (!recipeGraph) return unavailable('Net crafting reference is unavailable.');
    const demand = calculateCraftIngredientDemand({ recipeGraph, modifierState, goals: [{ canonicalKey: netKey, itemName: 'Large Net', desiredEffectiveOutput: nets }] });
    const entry = demand.ingredientBurdenByCanonicalKey[material];
    return entry ? { quantity: entry.totalRequiredEffectiveOutput, note } : unavailable('No complete supported net recipe path.');
  } catch {
    return unavailable('Recipe expansion is unavailable: missing, cyclic, or excluded reference path.');
  }
}
