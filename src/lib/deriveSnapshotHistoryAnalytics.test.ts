import { describe, expect, it } from 'vitest';

import { deriveSnapshotHistoryAnalytics } from './deriveSnapshotHistoryAnalytics';
import type { MasterySnapshot } from './storage/masterySnapshots';

function createSnapshot(
  snapshotId: string,
  savedAt: string,
  masteryByItem: Record<string, number>,
): MasterySnapshot {
  return {
    snapshotId,
    createdAt: savedAt,
    savedAt,
    importedAt: savedAt,
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
    parsedRows: Object.entries(masteryByItem).map(([canonicalKey, count], index) => ({
      rawItemName: canonicalKey
        .split(' ')
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(' '),
      canonicalKey,
      count,
      targetTier: 10_000,
      sourceLineIndex: index,
    })),
  };
}

describe('deriveSnapshotHistoryAnalytics', () => {
  it('derives timeline totals, item rates, defaults, and suggestion reasons', () => {
    const analytics = deriveSnapshotHistoryAnalytics(
      [
        createSnapshot('snapshot-new', '2026-03-19T12:00:00.000Z', {
          apple: 450,
          carrot: 10_500,
          'tower item': 75_000,
        }),
        createSnapshot('snapshot-old', '2026-03-17T12:00:00.000Z', {
          apple: 100,
          carrot: 9_900,
          'tower item': 50_000,
        }),
      ],
      { towerNeededCanonicalKeys: ['tower item'] },
    );

    expect(analytics.snapshotPoints).toHaveLength(2);
    expect(analytics.snapshotPoints[1]).toMatchObject({
      snapshotId: 'snapshot-new',
      totalDelta: 25_950,
      masteryPerDay: 12_975,
    });
    expect(analytics.defaultSelectedCanonicalKeys[0]).toBe('tower item');

    const carrot = analytics.itemRows.find((row) => row.canonicalKey === 'carrot');
    expect(carrot?.latestThresholdCrossings.map((crossing) => crossing.label)).toEqual(['Mastered']);
    expect(carrot?.suggestionReasons).toContain('New threshold');

    const towerItem = analytics.itemRows.find((row) => row.canonicalKey === 'tower item');
    expect(towerItem?.suggestionReasons).toContain('Tower');
    expect(towerItem?.recentGainPerDay).toBe(12_500);
  });

  it('keeps zero-baseline and same-timestamp rates as not applicable', () => {
    const analytics = deriveSnapshotHistoryAnalytics([
      createSnapshot('snapshot-a', '2026-03-17T12:00:00.000Z', { apple: 0 }),
      createSnapshot('snapshot-b', '2026-03-17T12:00:00.000Z', { apple: 10 }),
    ]);

    expect(analytics.snapshotPoints[1]?.elapsedDays).toBeNull();
    expect(analytics.snapshotPoints[1]?.masteryPerDay).toBeNull();
    expect(analytics.snapshotPoints[1]?.percentGainPerDay).toBeNull();
    expect(analytics.itemRows[0]?.percentGain).toBeNull();
  });
});
