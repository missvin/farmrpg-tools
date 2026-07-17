import { describe, expect, it } from 'vitest';

import {
  deriveSnapshotComparison,
  deriveSnapshotComparisonNarrative,
} from './deriveSnapshotComparison';
import type { MasterySnapshot } from './storage/masterySnapshots';

function createSnapshot(
  snapshotId: string,
  masteryByItem: Record<string, number>,
  createdAt = '2026-03-18T12:00:00.000Z',
): MasterySnapshot {
  return {
    snapshotId,
    createdAt,
    savedAt: createdAt,
    importedAt: createdAt,
    rawText: 'raw export',
    masteryByItem,
    parseSummary: {
      itemsParsed: Object.keys(masteryByItem).length,
      parsedRowsCount: Object.keys(masteryByItem).length,
      tiersDetected: [],
      duplicateRowsCount: 0,
      skippedNonItemLinesCount: 0,
      skippedNonItemLineSamples: [],
      unknownItemsCount: 0,
      warnings: [],
    },
    parsedRows: [],
  };
}

describe('deriveSnapshotComparison', () => {
  it('summarizes changed, added, and removed items between two snapshots', () => {
    const comparison = deriveSnapshotComparison(
      createSnapshot('snapshot-a', {
        apple: 10,
        banana: 25,
        carrot: 40,
      }),
      createSnapshot('snapshot-b', {
        apple: 15,
        banana: 10,
        durian: 50,
      }),
    );

    expect(comparison.totalChangedItems).toBe(4);
    expect(comparison.increasedItems).toBe(1);
    expect(comparison.decreasedItems).toBe(1);
    expect(comparison.addedItems).toBe(1);
    expect(comparison.removedItems).toBe(1);
    expect(comparison.totalMasteryDelta).toBe(0);
    expect(comparison.changedRows).toEqual([
      {
        canonicalKey: 'durian',
        itemName: 'Durian',
        fromValue: 0,
        toValue: 50,
        delta: 50,
        changeType: 'added',
      },
      {
        canonicalKey: 'carrot',
        itemName: 'Carrot',
        fromValue: 40,
        toValue: 0,
        delta: -40,
        changeType: 'removed',
      },
      {
        canonicalKey: 'banana',
        itemName: 'Banana',
        fromValue: 25,
        toValue: 10,
        delta: -15,
        changeType: 'decreased',
      },
      {
        canonicalKey: 'apple',
        itemName: 'Apple',
        fromValue: 10,
        toValue: 15,
        delta: 5,
        changeType: 'increased',
      },
    ]);
  });

  it('ignores items whose mastery values did not change', () => {
    const comparison = deriveSnapshotComparison(
      createSnapshot('snapshot-a', {
        apple: 10,
      }),
      createSnapshot('snapshot-b', {
        apple: 10,
      }),
    );

    expect(comparison.totalChangedItems).toBe(0);
    expect(comparison.changedRows).toEqual([]);
    expect(comparison.totalMasteryDelta).toBe(0);
  });

  it('summarizes the biggest gain, threshold crossings, and rows worth rechecking', () => {
    const comparison = deriveSnapshotComparison(
      createSnapshot('snapshot-a', {
        salt: 9_000,
        wrench: 90_000,
        'wizard hat': 900_000,
        banana: 300,
      }),
      createSnapshot('snapshot-b', {
        salt: 11_000,
        wrench: 110_000,
        'wizard hat': 1_100_000,
        banana: 100,
      }),
    );

    const narrative = deriveSnapshotComparisonNarrative(comparison);

    expect(narrative.biggestGain).toMatchObject({
      canonicalKey: 'wizard hat',
      delta: 200_000,
    });
    expect(narrative.thresholdCrossings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalKey: 'salt', label: 'Mastered' }),
        expect.objectContaining({ canonicalKey: 'wrench', label: 'GM' }),
        expect.objectContaining({ canonicalKey: 'wizard hat', label: 'MM' }),
      ]),
    );
    expect(narrative.recheckRows).toEqual([
      expect.objectContaining({ canonicalKey: 'banana', delta: -200 }),
    ]);
  });
});
