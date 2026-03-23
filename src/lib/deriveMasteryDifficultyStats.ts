import { parseMasteryPaste } from './parseMasteryPaste';
import type { MasteryDifficultyData, MasteryDifficultyEntry } from './loadMasteryDifficulty';
import type { MasterySnapshot } from './storage/masterySnapshots';

type DifficultyBucket = number | null;

export type AchievedStatusSummary = {
  masteredCount: number;
  grandMasteredCount: number;
  megaMasteredCount: number;
};

export type DifficultySummaryRow = {
  difficulty: DifficultyBucket;
  label: string;
  totalItems: number;
  masteredCount: number;
  grandMasteredCount: number;
  megaMasteredCount: number;
  masteredPercent: number;
  grandMasteredPercent: number;
  megaMasteredPercent: number;
};

export type ProgressListItem = {
  itemName: string;
  canonicalKey: string;
  currentMastery: number;
  remainingToTarget: number;
  difficulty: DifficultyBucket;
  difficultyLabel: string;
  method: string | null;
  notes: string | null;
  matched: boolean;
};

export type ProgressListGroup = {
  difficulty: DifficultyBucket;
  label: string;
  items: ProgressListItem[];
};

export type UnmatchedItem = {
  itemName: string;
  canonicalKey: string;
  currentMastery: number;
};

export type DerivedMasteryDifficultyStats = {
  achievedStatusSummary: AchievedStatusSummary;
  difficultySummary: DifficultySummaryRow[];
  mLeftGroups: ProgressListGroup[];
  gmLeftGroups: ProgressListGroup[];
  mmLeftGroups: ProgressListGroup[];
  unmatchedItemCount: number;
  unmatchedItems: UnmatchedItem[];
};

type BucketAccumulator = {
  difficulty: DifficultyBucket;
  label: string;
  totalItems: number;
  masteredCount: number;
  grandMasteredCount: number;
  megaMasteredCount: number;
};

const MASTERY_TARGET = 10_000;
const GRAND_MASTERY_TARGET = 100_000;
const MEGA_MASTERY_TARGET = 1_000_000;

function getDifficultyLabel(difficulty: DifficultyBucket): string {
  return difficulty === null ? 'Unrated' : `Difficulty ${difficulty}`;
}

function buildRawItemNameLookup(snapshot: MasterySnapshot): Record<string, string> {
  const parsedRows = snapshot.parsedRows ?? parseMasteryPaste(snapshot.rawText).parsedRows;

  return parsedRows.reduce<Record<string, string>>((lookup, row) => {
    if (!(row.canonicalKey in lookup)) {
      lookup[row.canonicalKey] = row.rawItemName;
    }

    return lookup;
  }, {});
}

function getDisplayName(
  rawItemNameLookup: Record<string, string>,
  canonicalKey: string,
  entry?: MasteryDifficultyEntry,
): string {
  if (entry) {
    return entry.itemName;
  }

  return rawItemNameLookup[canonicalKey] ?? canonicalKey;
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

function toPercent(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return (count / total) * 100;
}

function sortProgressItems(left: ProgressListItem, right: ProgressListItem): number {
  if (left.remainingToTarget !== right.remainingToTarget) {
    return left.remainingToTarget - right.remainingToTarget;
  }

  return left.itemName.localeCompare(right.itemName);
}

function sortGroups(groups: ProgressListGroup[]): ProgressListGroup[] {
  return [...groups]
    .sort((left, right) => compareDifficulty(left.difficulty, right.difficulty))
    .map((group) => ({
      ...group,
      items: [...group.items].sort(sortProgressItems),
    }));
}

function sortUnmatchedItems(items: UnmatchedItem[]): UnmatchedItem[] {
  return [...items].sort((left, right) => left.itemName.localeCompare(right.itemName));
}

export function deriveMasteryDifficultyStats(
  snapshot: MasterySnapshot,
  masteryDifficultyData: MasteryDifficultyData,
): DerivedMasteryDifficultyStats {
  const rawItemNameLookup = buildRawItemNameLookup(snapshot);
  const achievedStatusSummary: AchievedStatusSummary = {
    masteredCount: 0,
    grandMasteredCount: 0,
    megaMasteredCount: 0,
  };
  const difficultyBuckets = new Map<string, BucketAccumulator>();
  const mLeftGroups = new Map<string, ProgressListGroup>();
  const gmLeftGroups = new Map<string, ProgressListGroup>();
  const mmLeftGroups = new Map<string, ProgressListGroup>();
  const unmatchedItems: UnmatchedItem[] = [];

  for (const [canonicalKey, currentMastery] of Object.entries(snapshot.masteryByItem)) {
    const matchedEntry = masteryDifficultyData.byCanonicalKey[canonicalKey];
    const difficulty = matchedEntry?.difficulty ?? null;
    const difficultyLabel = getDifficultyLabel(difficulty);
    const bucketKey = difficultyLabel;
    const itemName = getDisplayName(rawItemNameLookup, canonicalKey, matchedEntry);

    const bucket = difficultyBuckets.get(bucketKey) ?? {
      difficulty,
      label: difficultyLabel,
      totalItems: 0,
      masteredCount: 0,
      grandMasteredCount: 0,
      megaMasteredCount: 0,
    };

    bucket.totalItems += 1;

    if (currentMastery >= MASTERY_TARGET) {
      achievedStatusSummary.masteredCount += 1;
      bucket.masteredCount += 1;
    }

    if (currentMastery >= GRAND_MASTERY_TARGET) {
      achievedStatusSummary.grandMasteredCount += 1;
      bucket.grandMasteredCount += 1;
    }

    if (currentMastery >= MEGA_MASTERY_TARGET) {
      achievedStatusSummary.megaMasteredCount += 1;
      bucket.megaMasteredCount += 1;
    }

    difficultyBuckets.set(bucketKey, bucket);

    const baseItem = {
      itemName,
      canonicalKey,
      currentMastery,
      difficulty,
      difficultyLabel,
      method: matchedEntry?.method ?? null,
      notes: matchedEntry?.notes ?? null,
      matched: Boolean(matchedEntry),
    };

    if (currentMastery < MASTERY_TARGET) {
      const group = mLeftGroups.get(bucketKey) ?? {
        difficulty,
        label: difficultyLabel,
        items: [],
      };

      group.items.push({
        ...baseItem,
        remainingToTarget: MASTERY_TARGET - currentMastery,
      });
      mLeftGroups.set(bucketKey, group);
    }

    if (currentMastery < GRAND_MASTERY_TARGET) {
      const group = gmLeftGroups.get(bucketKey) ?? {
        difficulty,
        label: difficultyLabel,
        items: [],
      };

      group.items.push({
        ...baseItem,
        remainingToTarget: GRAND_MASTERY_TARGET - currentMastery,
      });
      gmLeftGroups.set(bucketKey, group);
    }

    if (currentMastery < MEGA_MASTERY_TARGET) {
      const group = mmLeftGroups.get(bucketKey) ?? {
        difficulty,
        label: difficultyLabel,
        items: [],
      };

      group.items.push({
        ...baseItem,
        remainingToTarget: MEGA_MASTERY_TARGET - currentMastery,
      });
      mmLeftGroups.set(bucketKey, group);
    }

    if (!matchedEntry) {
      unmatchedItems.push({
        itemName,
        canonicalKey,
        currentMastery,
      });
    }
  }

  const difficultySummary = [...difficultyBuckets.values()]
    .sort((left, right) => compareDifficulty(left.difficulty, right.difficulty))
    .map((bucket) => ({
      difficulty: bucket.difficulty,
      label: bucket.label,
      totalItems: bucket.totalItems,
      masteredCount: bucket.masteredCount,
      grandMasteredCount: bucket.grandMasteredCount,
      megaMasteredCount: bucket.megaMasteredCount,
      masteredPercent: toPercent(bucket.masteredCount, bucket.totalItems),
      grandMasteredPercent: toPercent(bucket.grandMasteredCount, bucket.totalItems),
      megaMasteredPercent: toPercent(bucket.megaMasteredCount, bucket.totalItems),
    }));

  return {
    achievedStatusSummary,
    difficultySummary,
    mLeftGroups: sortGroups([...mLeftGroups.values()]),
    gmLeftGroups: sortGroups([...gmLeftGroups.values()]),
    mmLeftGroups: sortGroups([...mmLeftGroups.values()]),
    unmatchedItemCount: unmatchedItems.length,
    unmatchedItems: sortUnmatchedItems(unmatchedItems),
  };
}
