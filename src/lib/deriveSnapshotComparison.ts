import type { MasterySnapshot } from './storage/masterySnapshots';

export type SnapshotComparisonRow = {
  canonicalKey: string;
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

export function deriveSnapshotComparison(
  fromSnapshot: MasterySnapshot,
  toSnapshot: MasterySnapshot,
): SnapshotComparison {
  const allKeys = new Set([
    ...Object.keys(fromSnapshot.masteryByItem),
    ...Object.keys(toSnapshot.masteryByItem),
  ]);
  const changedRows = [...allKeys]
    .map((canonicalKey) => {
      const fromValue = fromSnapshot.masteryByItem[canonicalKey] ?? 0;
      const toValue = toSnapshot.masteryByItem[canonicalKey] ?? 0;
      const delta = toValue - fromValue;

      if (delta === 0) {
        return null;
      }

      return {
        canonicalKey,
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

      return left.canonicalKey.localeCompare(right.canonicalKey);
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
