import type { ItemProfile } from './itemProfileResolver';
import type { ItemGoalMode } from './itemGoalCalculator';
import type { RecipeGraph } from './loadRecipeGraph';
import type { TargetOutputPlannerItemRow, TargetOutputPlannerResult } from './targetOutputPlannerEngine';
import { deriveItemGoalBuildingSources } from './buildingProductionCalculator';
import type { ItemGoalCalculatorResult } from './itemGoalCalculator';
import type { BuildingProductionState } from './buildingProductionState';
import type { BuildingProductionReferenceData } from './loadBuildingProductionReference';

export function withItemPageIngredientBuildingSources(result: ItemGoalCalculatorResult, reference: BuildingProductionReferenceData | null, state: BuildingProductionState): ItemGoalCalculatorResult {
  const sources = new Map(result.buildingSources.map(source => [source.sourceKey, source]));
  result.plannerResult.rows.forEach(row => {
    deriveItemGoalBuildingSources({ targetCanonicalKey: row.canonicalKey, targetItemName: row.itemName,
      targetRemainingQuantity: row.remainingQuantity, buildingProductionReference: reference, buildingProductionState: state,
      supplyPool: result.supplyPool }).forEach(source => sources.set(source.sourceKey, source));
  });
  return { ...result, buildingSources: [...sources.values()] };
}

export type ItemPageTarget = { id: string; label: string; mode: ItemGoalMode; amount: number };

export function getItemPageTargets(profile: ItemProfile, masterable: boolean): ItemPageTarget[] {
  const targets: ItemPageTarget[] = [];
  if (masterable) {
    [...profile.towerTargets].sort((a, b) => Math.min(...a.levels) - Math.min(...b.levels)).forEach(target => {
      if (target.requiredThreshold > profile.currentMastery) targets.push({
        id: `tower-${target.requiredThreshold}`, label: `Tower ${Math.min(...target.levels)} · ${target.masteryLevelLabel}`,
        mode: 'mastery', amount: target.requiredThreshold,
      });
    });
    ([['M', 10_000], ['GM', 100_000], ['MM', 1_000_000]] as const).forEach(([label, amount]) => {
      if (amount > profile.currentMastery) targets.push({ id: `mastery-${amount}`, label: `${label} · ${amount.toLocaleString()}`, mode: 'mastery', amount });
    });
    targets.push({ id: 'custom-mastery', label: 'Custom mastery', mode: 'mastery', amount: 1_000_000 });
  }
  const quantity: ItemPageTarget = { id: 'custom-quantity', label: 'Custom total quantity', mode: 'quantity', amount: 10_000 };
  if (targets.length === 1 && targets[0].id === 'custom-mastery') targets.unshift(quantity);
  else targets.push(quantity);
  return targets;
}

export type ItemPageMaterialRow = {
  row: TargetOutputPlannerItemRow;
  direct: boolean;
  parentKeys: string[];
  descendantKeys: string[];
};

export function buildItemPageMaterialRows(result: TargetOutputPlannerResult, graph: RecipeGraph, targetKey: string): ItemPageMaterialRow[] {
  const directKeys = new Set(graph.byOutputCanonicalKey[targetKey]?.inputs.map(input => input.canonicalKey) ?? []);
  const children = new Map<string, Set<string>>();
  const parents = new Map<string, Set<string>>();
  result.expansionEdges.forEach(edge => {
    if (!children.has(edge.fromCanonicalKey)) children.set(edge.fromCanonicalKey, new Set());
    children.get(edge.fromCanonicalKey)!.add(edge.toCanonicalKey);
    if (!parents.has(edge.toCanonicalKey)) parents.set(edge.toCanonicalKey, new Set());
    parents.get(edge.toCanonicalKey)!.add(edge.fromCanonicalKey);
  });
  function descendants(key: string): string[] {
    const seen = new Set([key, targetKey]);
    const found: string[] = [];
    function visit(parent: string) {
      children.get(parent)?.forEach(child => {
        if (seen.has(child)) return;
        seen.add(child); found.push(child); visit(child);
      });
    }
    visit(key); return found;
  }
  return result.rows.filter(row => row.canonicalKey !== targetKey && row.grossRequiredQuantity > 0)
    .map(row => ({ row, direct: directKeys.has(row.canonicalKey), parentKeys: [...parents.get(row.canonicalKey) ?? []], descendantKeys: descendants(row.canonicalKey) }))
    .sort((a, b) => Number(b.direct) - Number(a.direct) || a.row.itemName.localeCompare(b.row.itemName));
}

export function getVisibleItemPageMaterials(rows: ItemPageMaterialRow[], expandedKeys: Set<string>, expandAll: boolean): ItemPageMaterialRow[] {
  const visible = new Set(rows.filter(entry => entry.direct).map(entry => entry.row.canonicalKey));
  rows.forEach(entry => {
    if (expandedKeys.has(entry.row.canonicalKey)) entry.descendantKeys.forEach(key => visible.add(key));
  });
  return rows.filter(entry => expandAll || visible.has(entry.row.canonicalKey));
}
