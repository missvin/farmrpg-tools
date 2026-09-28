import { deriveTowerRequirements, type TowerRequirementStatusRow } from './deriveTowerRequirements';
import type { TowerRequirementsData } from './loadTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';
import { estimatePumpkinJuiceForTarget } from './pumpkinJuiceEstimator';

export type TowerRemainingRow = TowerRequirementStatusRow & {
  progressPercent: number;
  pumpkinJuices: number | null;
  materialNames?: string[];
  laterRequirement?: { towerLevel: number; tier: string; beyondCutoff: boolean };
};
export type TowerRemainingSort = 'level' | 'item' | 'tier' | 'remaining' | 'pj' | 'materials';

export function deriveTowerRemainingRows(
  snapshot: MasterySnapshot,
  requirements: TowerRequirementsData,
  through: number | null,
): TowerRemainingRow[] {
  return deriveTowerRequirements(snapshot, requirements).rows
    .filter((row) => through === null || row.towerLevel <= through)
    .map((row) => ({
      ...row,
      laterRequirement: (() => {
        const later = requirements.entries.filter((entry) => entry.canonicalKey === row.canonicalKey
          && entry.towerLevel > row.towerLevel && entry.masteryLevelNeeded === 'MM' && row.masteryLevelNeeded === 'GM')
          .sort((a, b) => a.towerLevel - b.towerLevel)[0];
        return later ? { towerLevel: later.towerLevel, tier: later.masteryLevelNeeded, beyondCutoff: through !== null && later.towerLevel > through } : undefined;
      })(),
      progressPercent: Math.max(0, Math.min(100, row.currentMastery / row.requiredThreshold * 100)),
      pumpkinJuices: estimatePumpkinJuiceForTarget({
        itemName: row.itemName,
        canonicalKey: row.canonicalKey,
        currentMastery: row.currentMastery,
        targetTier: row.masteryLevelNeeded,
        targetMastery: row.requiredThreshold,
        sourceScope: 'tower',
      }).totalPumpkinJuices,
    }));
}

export function sortTowerRemainingRows(
  rows: TowerRemainingRow[], key: TowerRemainingSort, descending: boolean,
): TowerRemainingRow[] {
  return [...rows].sort((a, b) => {
    let comparison = 0;
    if (key === 'pj' && (a.pumpkinJuices === null || b.pumpkinJuices === null)) {
      if (a.pumpkinJuices !== b.pumpkinJuices) return a.pumpkinJuices === null ? 1 : -1;
    } else {
      switch (key) {
        case 'level': comparison = a.towerLevel - b.towerLevel; break;
        case 'item': comparison = a.itemName.localeCompare(b.itemName); break;
        case 'tier': comparison = a.requiredThreshold - b.requiredThreshold; break;
        case 'remaining': comparison = a.remainingToRequirement - b.remainingToRequirement; break;
        case 'pj': comparison = (a.pumpkinJuices ?? 0) - (b.pumpkinJuices ?? 0); break;
        case 'materials': comparison = (a.materialNames ?? []).join('\u0000').localeCompare((b.materialNames ?? []).join('\u0000')); break;
      }
    }
    return comparison * (descending ? -1 : 1)
      || a.towerLevel - b.towerLevel || a.itemName.localeCompare(b.itemName) || a.slotIndex - b.slotIndex;
  });
}
