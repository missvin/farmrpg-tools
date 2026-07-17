import { describe, expect, it } from 'vitest';

import {
  deriveSnapshotHistoryAnalytics,
  filterSnapshotHistoryAnalyticsItems,
} from './deriveSnapshotHistoryAnalytics';
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

    const bestInterval = analytics.milestoneCallouts.find(
      (callout) => callout.id === 'best_interval',
    );
    expect(bestInterval?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Mastery gained', value: '25,950' }),
        expect.objectContaining({ label: 'Elapsed time', value: '2.00 days' }),
      ]),
    );
    const thresholds = analytics.milestoneCallouts.find(
      (callout) => callout.id === 'recent_thresholds',
    );
    expect(thresholds?.evidence).toContainEqual(
      expect.objectContaining({ canonicalKey: 'carrot', label: 'Mastered reached' }),
    );
  });

  it('includes elapsed time in active-streak evidence', () => {
    const analytics = deriveSnapshotHistoryAnalytics([
      createSnapshot('snapshot-a', '2026-03-17T12:00:00.000Z', { apple: 100 }),
      createSnapshot('snapshot-b', '2026-03-18T12:00:00.000Z', { apple: 200 }),
      createSnapshot('snapshot-c', '2026-03-19T12:00:00.000Z', { apple: 300 }),
    ]);
    const streak = analytics.milestoneCallouts.find(
      (callout) => callout.id === 'longest_active_streak',
    );

    expect(streak?.evidence).toContainEqual(
      expect.objectContaining({ label: 'Elapsed time', value: '2.00 days' }),
    );
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

  it('filters Mega Mastered items from item-level analytics when requested', () => {
    const analytics = deriveSnapshotHistoryAnalytics([
      createSnapshot('snapshot-old', '2026-03-17T12:00:00.000Z', {
        apple: 100,
        'mega item': 1_000_000,
      }),
      createSnapshot('snapshot-new', '2026-03-19T12:00:00.000Z', {
        apple: 450,
        'mega item': 1_000_500,
      }),
    ]);

    const filteredAnalytics = filterSnapshotHistoryAnalyticsItems(analytics, {
      showMegaMasteredItems: false,
    });

    expect(filteredAnalytics.itemRows.map((row) => row.canonicalKey)).toEqual(['apple']);
    expect(filteredAnalytics.defaultSelectedCanonicalKeys).not.toContain('mega item');
    expect(
      filteredAnalytics.suggestionBuckets.flatMap((bucket) => bucket.itemKeys),
    ).not.toContain('mega item');
    expect(filteredAnalytics.milestoneCallouts.map((callout) => callout.value)).not.toContain('Mega Item');
  });
});
