import type { TowerMasteryLevelNeeded, TowerRequirementsData } from './loadTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';

export type TowerRequirementStatusRow = {
  towerLevel: number;
  towerLevelRange: string;
  slotIndex: number;
  itemName: string;
  canonicalKey: string;
  masteryLevelNeeded: TowerMasteryLevelNeeded;
  requiredThreshold: number;
  currentMastery: number;
  achieved: boolean;
  remainingToRequirement: number;
  matchedSnapshotRow: boolean;
  farmrpgItemId: string | null;
  buddySlug: string | null;
  notes: string | null;
  sourceSheet: string | null;
  sourceRow: string | null;
};

export type TowerRequirementLevelGroup = {
  towerLevel: number;
  rows: TowerRequirementStatusRow[];
};

export type TowerRequirementRangeGroup = {
  towerLevelRange: string;
  levels: TowerRequirementLevelGroup[];
};

export type DerivedTowerRequirements = {
  rows: TowerRequirementStatusRow[];
  groups: TowerRequirementRangeGroup[];
};

export function getTowerRequirementThreshold(masteryLevelNeeded: TowerMasteryLevelNeeded): number {
  if (masteryLevelNeeded === 'M') {
    return 10_000;
  }

  if (masteryLevelNeeded === 'GM') {
    return 100_000;
  }

  return 1_000_000;
}

function compareRows(left: TowerRequirementStatusRow, right: TowerRequirementStatusRow): number {
  if (left.achieved !== right.achieved) {
    return left.achieved ? 1 : -1;
  }

  if (left.remainingToRequirement !== right.remainingToRequirement) {
    return left.remainingToRequirement - right.remainingToRequirement;
  }

  return left.slotIndex - right.slotIndex;
}

function sortLevelGroups(levelGroups: TowerRequirementLevelGroup[]): TowerRequirementLevelGroup[] {
  return [...levelGroups]
    .sort((left, right) => left.towerLevel - right.towerLevel)
    .map((levelGroup) => ({
      ...levelGroup,
      rows: [...levelGroup.rows].sort(compareRows),
    }));
}

export function deriveTowerRequirements(
  snapshot: MasterySnapshot,
  towerRequirementsData: TowerRequirementsData,
): DerivedTowerRequirements {
  const rows = towerRequirementsData.entries.map<TowerRequirementStatusRow>((entry) => {
    const currentMastery = snapshot.masteryByItem[entry.canonicalKey] ?? 0;
    const requiredThreshold = getTowerRequirementThreshold(entry.masteryLevelNeeded);
    const achieved = currentMastery >= requiredThreshold;

    return {
      towerLevel: entry.towerLevel,
      towerLevelRange: entry.towerLevelRange,
      slotIndex: entry.slotIndex,
      itemName: entry.itemName,
      canonicalKey: entry.canonicalKey,
      masteryLevelNeeded: entry.masteryLevelNeeded,
      requiredThreshold,
      currentMastery,
      achieved,
      remainingToRequirement: achieved ? 0 : requiredThreshold - currentMastery,
      matchedSnapshotRow: entry.canonicalKey in snapshot.masteryByItem,
      farmrpgItemId: entry.farmrpgItemId,
      buddySlug: entry.buddySlug,
      notes: entry.notes,
      sourceSheet: entry.sourceSheet,
      sourceRow: entry.sourceRow,
    };
  });

  const rangeGroups = new Map<string, Map<number, TowerRequirementStatusRow[]>>();

  for (const row of rows) {
    const levelGroups = rangeGroups.get(row.towerLevelRange) ?? new Map<number, TowerRequirementStatusRow[]>();
    const levelRows = levelGroups.get(row.towerLevel) ?? [];

    levelRows.push(row);
    levelGroups.set(row.towerLevel, levelRows);
    rangeGroups.set(row.towerLevelRange, levelGroups);
  }

  return {
    rows,
    groups: [...rangeGroups.entries()]
      .sort(([leftRange], [rightRange]) => leftRange.localeCompare(rightRange))
      .map(([towerLevelRange, levelGroups]) => ({
        towerLevelRange,
        levels: sortLevelGroups(
          [...levelGroups.entries()].map(([towerLevel, levelRows]) => ({
            towerLevel,
            rows: levelRows,
          })),
        ),
      })),
  };
}
