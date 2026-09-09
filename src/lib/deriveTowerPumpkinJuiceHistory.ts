import { deriveTowerProgress } from './deriveTowerProgress';
import type { MasteryDifficultyData } from './loadMasteryDifficulty';
import type { TowerRequirementsData } from './loadTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';

const EMPTY_MASTERY_DIFFICULTY: MasteryDifficultyData = {
  entries: [],
  byCanonicalKey: {},
};

export type TowerPumpkinJuiceHistoryPoint = {
  snapshotId: string;
  savedAt: string;
  targetLevel: number;
  totalPumpkinJuicesNeeded: number;
  blockedItemCount: number;
  isLowerBound: boolean;
  changeFromPrevious: number | null;
};

export type TowerPumpkinJuiceHistorySeries = {
  targetLevel: number;
  points: TowerPumpkinJuiceHistoryPoint[];
};

export type TowerPumpkinJuiceHistory = {
  targetLevels: number[];
  series: TowerPumpkinJuiceHistorySeries[];
  snapshotCount: number;
};

function getSnapshotSavedAt(snapshot: MasterySnapshot): string {
  return snapshot.savedAt ?? snapshot.createdAt;
}

function normalizeTargetLevels(targetLevels: number[]): number[] {
  return [...new Set(targetLevels)]
    .filter((level) => Number.isInteger(level) && level > 0)
    .sort((left, right) => left - right);
}

function sortSnapshotsOldestFirst(snapshots: MasterySnapshot[]): MasterySnapshot[] {
  return [...snapshots].sort((left, right) => {
    const dateComparison = getSnapshotSavedAt(left).localeCompare(getSnapshotSavedAt(right));

    return dateComparison || left.snapshotId.localeCompare(right.snapshotId);
  });
}

export function deriveTowerPumpkinJuiceHistory(
  snapshots: MasterySnapshot[],
  towerRequirementsData: TowerRequirementsData,
  targetLevels: number[],
): TowerPumpkinJuiceHistory {
  const normalizedTargetLevels = normalizeTargetLevels(targetLevels);
  const orderedSnapshots = sortSnapshotsOldestFirst(snapshots);

  return {
    targetLevels: normalizedTargetLevels,
    snapshotCount: orderedSnapshots.length,
    series: normalizedTargetLevels.map((targetLevel) => {
      let previousTotal: number | null = null;
      const points = orderedSnapshots.map((snapshot): TowerPumpkinJuiceHistoryPoint => {
        const progress = deriveTowerProgress(
          snapshot,
          towerRequirementsData,
          EMPTY_MASTERY_DIFFICULTY,
          { maxTowerLevel: targetLevel },
        );
        const total = progress.totalPumpkinJuicesNeeded;
        const point: TowerPumpkinJuiceHistoryPoint = {
          snapshotId: snapshot.snapshotId,
          savedAt: getSnapshotSavedAt(snapshot),
          targetLevel,
          totalPumpkinJuicesNeeded: total,
          blockedItemCount: progress.pumpkinJuiceBlockedItemCount,
          isLowerBound: progress.pumpkinJuiceBlockedItemCount > 0,
          changeFromPrevious: previousTotal === null ? null : total - previousTotal,
        };

        previousTotal = total;
        return point;
      });

      return {
        targetLevel,
        points,
      };
    }),
  };
}
