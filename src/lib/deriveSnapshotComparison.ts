import type { MasterySnapshot } from './storage/masterySnapshots';

export type SnapshotComparisonRow = {
  canonicalKey: string;
  itemName: string;
  fromValue: number;
  toValue: number;
  delta: number;
  changeType: 'increased' | 'decreased' | 'added' | 'removed';
};

export type SnapshotComparison = {
  fromSnapshotId: string;
  toSnapshotId: string;
  totalChangedItems: number;
  increasedItems: number;
  decreasedItems: number;
  addedItems: number;
  removedItems: number;
  totalMasteryDelta: number;
  changedRows: SnapshotComparisonRow[];
};

function getChangeType(fromValue: number, toValue: number): SnapshotComparisonRow['changeType'] {
  if (fromValue === 0 && toValue > 0) {
    return 'added';
  }

  if (fromValue > 0 && toValue === 0) {
    return 'removed';
  }

  return toValue > fromValue ? 'increased' : 'decreased';
}

const LEGACY_MOJIBAKE_REPLACEMENTS: Record<string, string> = {
  'Ã±': 'ñ',
};

function normalizeLegacyComparisonKey(canonicalKey: string): string {
  return Object.entries(LEGACY_MOJIBAKE_REPLACEMENTS).reduce(
    (normalizedKey, [legacyText, correctedText]) => normalizedKey.split(legacyText).join(correctedText),
    canonicalKey,
  );
}

function formatFallbackItemName(canonicalKey: string): string {
  return canonicalKey
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function buildDisplayNameByComparisonKey(snapshot: MasterySnapshot): Map<string, string> {
  const displayNames = new Map<string, string>();

  for (const row of snapshot.parsedRows ?? []) {
    const comparisonKey = normalizeLegacyComparisonKey(row.canonicalKey);
    const displayName = normalizeLegacyComparisonKey(row.rawItemName);

    if (!displayNames.has(comparisonKey)) {
      displayNames.set(comparisonKey, displayName);
    }
  }

  for (const canonicalKey of Object.keys(snapshot.masteryByItem)) {
    const comparisonKey = normalizeLegacyComparisonKey(canonicalKey);

    if (!displayNames.has(comparisonKey)) {
      displayNames.set(comparisonKey, formatFallbackItemName(comparisonKey));
    }
  }

  return displayNames;
}

function buildMasteryByComparisonKey(snapshot: MasterySnapshot): Record<string, number> {
  const masteryByComparisonKey: Record<string, number> = {};

  for (const [canonicalKey, mastery] of Object.entries(snapshot.masteryByItem)) {
    const comparisonKey = normalizeLegacyComparisonKey(canonicalKey);
    masteryByComparisonKey[comparisonKey] = Math.max(masteryByComparisonKey[comparisonKey] ?? 0, mastery);
  }

  return masteryByComparisonKey;
}

export function deriveSnapshotComparison(
  fromSnapshot: MasterySnapshot,
  toSnapshot: MasterySnapshot,
): SnapshotComparison {
  const fromMasteryByComparisonKey = buildMasteryByComparisonKey(fromSnapshot);
  const toMasteryByComparisonKey = buildMasteryByComparisonKey(toSnapshot);
  const displayNames = new Map([
    ...buildDisplayNameByComparisonKey(fromSnapshot),
    ...buildDisplayNameByComparisonKey(toSnapshot),
  ]);
  const allKeys = new Set([
    ...Object.keys(fromMasteryByComparisonKey),
    ...Object.keys(toMasteryByComparisonKey),
  ]);
  const changedRows = [...allKeys]
    .map((canonicalKey) => {
      const fromValue = fromMasteryByComparisonKey[canonicalKey] ?? 0;
      const toValue = toMasteryByComparisonKey[canonicalKey] ?? 0;
      const delta = toValue - fromValue;

      if (delta === 0) {
        return null;
      }

      return {
        canonicalKey,
        itemName: displayNames.get(canonicalKey) ?? formatFallbackItemName(canonicalKey),
        fromValue,
        toValue,
        delta,
        changeType: getChangeType(fromValue, toValue),
      } satisfies SnapshotComparisonRow;
    })
    .filter((row): row is SnapshotComparisonRow => row !== null)
    .sort((left, right) => {
      const magnitudeDifference = Math.abs(right.delta) - Math.abs(left.delta);

      if (magnitudeDifference !== 0) {
        return magnitudeDifference;
      }

      return left.itemName.localeCompare(right.itemName);
    });

  return {
    fromSnapshotId: fromSnapshot.snapshotId,
    toSnapshotId: toSnapshot.snapshotId,
    totalChangedItems: changedRows.length,
    increasedItems: changedRows.filter((row) => row.changeType === 'increased').length,
    decreasedItems: changedRows.filter((row) => row.changeType === 'decreased').length,
    addedItems: changedRows.filter((row) => row.changeType === 'added').length,
    removedItems: changedRows.filter((row) => row.changeType === 'removed').length,
    totalMasteryDelta: changedRows.reduce((total, row) => total + row.delta, 0),
    changedRows,
  };
}
