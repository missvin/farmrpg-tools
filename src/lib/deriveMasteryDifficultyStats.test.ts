import { describe, expect, it } from 'vitest';

import { deriveMasteryDifficultyStats } from './deriveMasteryDifficultyStats';
import type { MasteryDifficultyData } from './loadMasteryDifficulty';
import type { MasterySnapshot } from './storage/masterySnapshots';

function createSnapshot(): MasterySnapshot {
  return {
    snapshotId: 'snapshot-1',
    createdAt: '2026-03-14T12:00:00.000Z',
    rawText: '',
    masteryByItem: {
      board: 250000,
      'gold cucumber': 50000,
      'mystery item': 9000,
      'red diamond fish': 1500000,
    },
    parseSummary: {
      itemsParsed: 4,
      tiersDetected: [10000, 100000, 1000000],
      unknownItemsCount: 0,
      warnings: [],
    },
    parsedRows: [
      {
        rawItemName: 'Board',
        canonicalKey: 'board',
        count: 250000,
        targetTier: 'INF',
        sourceLineIndex: 0,
      },
      {
        rawItemName: 'Gold Cucumber',
        canonicalKey: 'gold cucumber',
        count: 50000,
        targetTier: 100000,
        sourceLineIndex: 3,
      },
      {
        rawItemName: 'Mystery Item',
        canonicalKey: 'mystery item',
        count: 9000,
        targetTier: 10000,
        sourceLineIndex: 6,
      },
      {
        rawItemName: 'Red Diamond Fish',
        canonicalKey: 'red diamond fish',
        count: 1500000,
        targetTier: 'INF',
        sourceLineIndex: 9,
      },
    ],
  };
}

function createDifficultyData(): MasteryDifficultyData {
  return {
    entries: [
      {
        itemName: 'Board',
        canonicalKey: 'board',
        difficulty: 1,
        method: 'Crafting',
        notes: 'Passive',
        tags: null,
        passiveCraftworksInfo: null,
        farmrpgItemId: null,
        buddyItemId: null,
        buddySlug: null,
        sourceSheet: null,
        sourceRow: null,
      },
      {
        itemName: 'Gold Cucumber',
        canonicalKey: 'gold cucumber',
        difficulty: 7,
        method: 'Farming',
        notes: null,
        tags: null,
        passiveCraftworksInfo: null,
        farmrpgItemId: null,
        buddyItemId: null,
        buddySlug: null,
        sourceSheet: null,
        sourceRow: null,
      },
      {
        itemName: 'Red Diamond Fish',
        canonicalKey: 'red diamond fish',
        difficulty: null,
        method: 'Fishing',
        notes: null,
        tags: null,
        passiveCraftworksInfo: null,
        farmrpgItemId: null,
        buddyItemId: null,
        buddySlug: null,
        sourceSheet: null,
        sourceRow: null,
      },
    ],
    byCanonicalKey: {},
  };
}

describe('deriveMasteryDifficultyStats', () => {
  it('computes achieved counts, unrated buckets, and unmatched items', () => {
    const difficultyData = createDifficultyData();
    difficultyData.byCanonicalKey = Object.fromEntries(
      difficultyData.entries.map((entry) => [entry.canonicalKey, entry]),
    );

    const result = deriveMasteryDifficultyStats(createSnapshot(), difficultyData);

    expect(result.achievedStatusSummary).toEqual({
      masteredCount: 3,
      grandMasteredCount: 2,
      megaMasteredCount: 1,
    });
    expect(result.unmatchedItemCount).toBe(1);
    expect(result.unmatchedItems).toEqual([
      {
        itemName: 'Mystery Item',
        canonicalKey: 'mystery item',
        currentMastery: 9000,
      },
    ]);
    expect(result.difficultySummary.map((bucket) => bucket.label)).toEqual([
      'Difficulty 1',
      'Difficulty 7',
      'Unrated',
    ]);
  });

  it('groups and sorts GM-left and MM-left items by difficulty and remaining amount', () => {
    const difficultyData = createDifficultyData();
    difficultyData.byCanonicalKey = Object.fromEntries(
      difficultyData.entries.map((entry) => [entry.canonicalKey, entry]),
    );

    const result = deriveMasteryDifficultyStats(createSnapshot(), difficultyData);

    expect(result.gmLeftGroups).toEqual([
      {
        difficulty: 7,
        label: 'Difficulty 7',
        items: [
          expect.objectContaining({
            itemName: 'Gold Cucumber',
            remainingToTarget: 50000,
          }),
        ],
      },
      {
        difficulty: null,
        label: 'Unrated',
        items: [
          expect.objectContaining({
            itemName: 'Mystery Item',
            remainingToTarget: 91000,
          }),
        ],
      },
    ]);

    expect(result.mmLeftGroups[0]?.items[0]).toEqual(
      expect.objectContaining({
        itemName: 'Board',
        remainingToTarget: 750000,
      }),
    );
    expect(result.mmLeftGroups[1]?.items[0]).toEqual(
      expect.objectContaining({
        itemName: 'Gold Cucumber',
        remainingToTarget: 950000,
      }),
    );
  });
});
