import type { MasteryDifficultyData, MasteryDifficultyEntry } from './loadMasteryDifficulty';
import type { TowerRequirementsData } from './loadTowerRequirements';
import { getTowerRequirementThreshold } from './deriveTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';

type DifficultyBucket = number | null;

export type TowerProgressItem = {
  itemName: string;
  canonicalKey: string;
  currentMastery: number;
  requiredThreshold: number;
  remainingToTarget: number;
  progressPercent: number;
  masteryLevelLabel: 'M' | 'GM' | 'MM';
  difficulty: DifficultyBucket;
  difficultyLabel: string;
  matchedSnapshotRow: boolean;
  matchedDifficultyRow: boolean;
  method: string | null;
  notes: string | null;
};

export type TowerProgressDifficultySummaryRow = {
  difficulty: DifficultyBucket;
  label: string;
  totalItems: number;
  remainingItems: number;
  remainingItemsPercent: number;
  totalTargetMastery: number;
  remainingTargetMastery: number;
  remainingMastery: number;
  remainingMasteryPercent: number;
};

export type DerivedTowerProgress = {
  items: TowerProgressItem[];
  remainingItems: TowerProgressItem[];
  difficultySummary: TowerProgressDifficultySummaryRow[];
  gmItemsLeftCount: number;
  mmItemsLeftCount: number;
  totalMasteryRemaining: number;
  unmatchedSnapshotItemCount: number;
  unratedItemCount: number;
};

type TowerProgressAccumulator = {
  itemName: string;
  canonicalKey: string;
  requiredThreshold: number;
};

type DifficultySummaryAccumulator = {
  difficulty: DifficultyBucket;
  label: string;
  totalItems: number;
  remainingItems: number;
  totalTargetMastery: number;
  remainingTargetMastery: number;
  remainingMastery: number;
};

function getMasteryLevelLabel(requiredThreshold: number): 'M' | 'GM' | 'MM' {
  if (requiredThreshold === 10_000) {
    return 'M';
  }

  if (requiredThreshold === 100_000) {
    return 'GM';
  }

  return 'MM';
}

function getDifficultyLabel(difficulty: DifficultyBucket): string {
  return difficulty === null ? 'Unrated' : `Difficulty ${difficulty}`;
}

function compareDifficulty(left: DifficultyBucket, right: DifficultyBucket): number {
  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function toPercent(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return (value / total) * 100;
}

function toProgressPercent(currentMastery: number, requiredThreshold: number): number {
  if (requiredThreshold <= 0) {
    return 0;
  }

  return Math.min(100, (currentMastery / requiredThreshold) * 100);
}

function buildAggregatedTowerItems(towerRequirementsData: TowerRequirementsData): TowerProgressAccumulator[] {
  const byCanonicalKey = new Map<string, TowerProgressAccumulator>();

  for (const entry of towerRequirementsData.entries) {
    const requiredThreshold = getTowerRequirementThreshold(entry.masteryLevelNeeded);
    const existing = byCanonicalKey.get(entry.canonicalKey);

    if (!existing || requiredThreshold > existing.requiredThreshold) {
      byCanonicalKey.set(entry.canonicalKey, {
        itemName: entry.itemName,
        canonicalKey: entry.canonicalKey,
        requiredThreshold,
      });
    }
  }

  return [...byCanonicalKey.values()];
}

function compareItems(left: TowerProgressItem, right: TowerProgressItem): number {
  if (left.remainingToTarget !== right.remainingToTarget) {
    return left.remainingToTarget - right.remainingToTarget;
  }

  return left.itemName.localeCompare(right.itemName);
}

function compareAllItems(left: TowerProgressItem, right: TowerProgressItem): number {
  if (left.requiredThreshold !== right.requiredThreshold) {
    return left.requiredThreshold - right.requiredThreshold;
  }

  if (left.remainingToTarget !== right.remainingToTarget) {
    return left.remainingToTarget - right.remainingToTarget;
  }

  return left.itemName.localeCompare(right.itemName);
}

export function deriveTowerProgress(
  snapshot: MasterySnapshot,
  towerRequirementsData: TowerRequirementsData,
  masteryDifficultyData: MasteryDifficultyData,
): DerivedTowerProgress {
  const aggregatedItems = buildAggregatedTowerItems(towerRequirementsData);
  const difficultySummaryByLabel = new Map<string, DifficultySummaryAccumulator>();
  const items: TowerProgressItem[] = [];
  let gmItemsLeftCount = 0;
  let mmItemsLeftCount = 0;
  let totalMasteryRemaining = 0;
  let unmatchedSnapshotItemCount = 0;
  let unratedItemCount = 0;

  for (const aggregatedItem of aggregatedItems) {
    const matchedDifficultyEntry: MasteryDifficultyEntry | undefined =
      masteryDifficultyData.byCanonicalKey[aggregatedItem.canonicalKey];
    const currentMastery = snapshot.masteryByItem[aggregatedItem.canonicalKey] ?? 0;
    const remainingToTarget =
      currentMastery >= aggregatedItem.requiredThreshold ? 0 : aggregatedItem.requiredThreshold - currentMastery;
    const difficulty = matchedDifficultyEntry?.difficulty ?? null;
    const difficultyLabel = getDifficultyLabel(difficulty);

    const item: TowerProgressItem = {
      itemName: matchedDifficultyEntry?.itemName ?? aggregatedItem.itemName,
      canonicalKey: aggregatedItem.canonicalKey,
      currentMastery,
      requiredThreshold: aggregatedItem.requiredThreshold,
      remainingToTarget,
      progressPercent: toProgressPercent(currentMastery, aggregatedItem.requiredThreshold),
      masteryLevelLabel: getMasteryLevelLabel(aggregatedItem.requiredThreshold),
      difficulty,
      difficultyLabel,
      matchedSnapshotRow: aggregatedItem.canonicalKey in snapshot.masteryByItem,
      matchedDifficultyRow: Boolean(matchedDifficultyEntry),
      method: matchedDifficultyEntry?.method ?? null,
      notes: matchedDifficultyEntry?.notes ?? null,
    };

    items.push(item);

    if (item.requiredThreshold === 100_000 && item.remainingToTarget > 0) {
      gmItemsLeftCount += 1;
    }

    if (item.requiredThreshold === 1_000_000 && item.remainingToTarget > 0) {
      mmItemsLeftCount += 1;
    }

    if (!item.matchedSnapshotRow) {
      unmatchedSnapshotItemCount += 1;
    }

    if (!item.matchedDifficultyRow) {
      unratedItemCount += 1;
    }

    totalMasteryRemaining += item.remainingToTarget;

    const bucket = difficultySummaryByLabel.get(difficultyLabel) ?? {
      difficulty,
      label: difficultyLabel,
      totalItems: 0,
      remainingItems: 0,
      totalTargetMastery: 0,
      remainingTargetMastery: 0,
      remainingMastery: 0,
    };

    bucket.totalItems += 1;
    bucket.totalTargetMastery += item.requiredThreshold;

    if (item.remainingToTarget > 0) {
      bucket.remainingItems += 1;
      bucket.remainingTargetMastery += item.requiredThreshold;
      bucket.remainingMastery += item.remainingToTarget;
    }

    difficultySummaryByLabel.set(difficultyLabel, bucket);
  }

  return {
    items: [...items].sort(compareAllItems),
    remainingItems: items.filter((item) => item.remainingToTarget > 0).sort(compareItems),
    difficultySummary: [...difficultySummaryByLabel.values()]
      .sort((left, right) => compareDifficulty(left.difficulty, right.difficulty))
      .map((bucket) => ({
        difficulty: bucket.difficulty,
        label: bucket.label,
        totalItems: bucket.totalItems,
        remainingItems: bucket.remainingItems,
        remainingItemsPercent: toPercent(bucket.remainingItems, bucket.totalItems),
        totalTargetMastery: bucket.totalTargetMastery,
        remainingTargetMastery: bucket.remainingTargetMastery,
        remainingMastery: bucket.remainingMastery,
        remainingMasteryPercent: toPercent(bucket.remainingMastery, bucket.remainingTargetMastery),
      })),
    gmItemsLeftCount,
    mmItemsLeftCount,
    totalMasteryRemaining,
    unmatchedSnapshotItemCount,
    unratedItemCount,
  };
}
