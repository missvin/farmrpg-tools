import { getCraftingPlanningPolicy } from './craftingPlanningPolicy';
import { estimateTowerMaterial, type TowerEstimateSources } from './towerMaterialEstimates';
import { towerMaterialKeys, type TowerMaterial } from './towerMaterials';
import type { TowerRemainingRow } from './towerRemainingRows';

export type TowerMaterialTotal = TowerMaterial & {
  quantity: number | null;
  unavailableItems: string[];
};

// Rows remain independent on screen; totals use only the highest visible target per item.
export function totalTowerMaterials(rows: TowerRemainingRow[], materials: TowerMaterial[], sources: TowerEstimateSources): TowerMaterialTotal[] {
  const targets = new Map<string, TowerRemainingRow>();
  for (const row of rows) {
    const existing = targets.get(row.canonicalKey);
    if (!existing || row.requiredThreshold > existing.requiredThreshold) targets.set(row.canonicalKey, row);
  }
  const policy = getCraftingPlanningPolicy(sources.modifierState);
  const relationships = new Map([...targets].map(([key]) =>
    [key, towerMaterialKeys(key, sources.recipeGraph, sources.dropRateReference, policy)]));
  return materials.map((material) => {
    let quantity = 0;
    let known = 0;
    const unavailableItems: string[] = [];
    for (const row of targets.values()) {
      if (!relationships.get(row.canonicalKey)?.has(material.canonicalKey)) {
        // Without recipes, absence of a relationship cannot establish zero demand.
        if (!sources.recipeGraph) unavailableItems.push(row.itemName);
        continue;
      }
      const estimate = estimateTowerMaterial(row, material.canonicalKey, sources);
      if (estimate.quantity === null) unavailableItems.push(row.itemName);
      else { quantity += estimate.quantity; known++; }
    }
    return { ...material, quantity: unavailableItems.length && !known ? null : quantity, unavailableItems };
  });
}
