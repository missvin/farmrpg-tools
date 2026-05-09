import { describe, expect, it } from 'vitest';

import { deriveTowerProgress } from './deriveTowerProgress';
import type { MasteryDifficultyData } from './loadMasteryDifficulty';
import type { TowerRequirementsData } from './loadTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';

function createSnapshot(masteryByItem: Record<string, number>): MasterySnapshot {
  return {
    snapshotId: 'snapshot-1',
    createdAt: '2026-03-16T00:00:00.000Z',
    rawText: '',
    masteryByItem,
    parseSummary: {
      itemsParsed: Object.keys(masteryByItem).length,
      parsedRowsCount: 0,
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

const towerRequirementsData: TowerRequirementsData = {
  entries: [
    {
      towerLevel: 201,
      towerLevelRange: '201-220',
      slotIndex: 1,
      itemName: 'Board',
      canonicalKey: 'board',
      masteryLevelNeeded: 'GM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 205,
      towerLevelRange: '201-220',
      slotIndex: 1,
      itemName: 'Board',
      canonicalKey: 'board',
      masteryLevelNeeded: 'MM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 301,
      towerLevelRange: '301-320',
      slotIndex: 1,
      itemName: 'Gold Cucumber',
      canonicalKey: 'gold cucumber',
      masteryLevelNeeded: 'GM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 302,
      towerLevelRange: '301-320',
      slotIndex: 1,
      itemName: 'Red Diamond Fish',
      canonicalKey: 'red diamond fish',
      masteryLevelNeeded: 'M',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
  ],
  byCanonicalKey: {
    board: [],
    'gold cucumber': [],
    'red diamond fish': [],
  },
};

const masteryDifficultyData: MasteryDifficultyData = {
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
      difficulty: 9,
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
  ],
  byCanonicalKey: {
    board: {
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
    'gold cucumber': {
      itemName: 'Gold Cucumber',
      canonicalKey: 'gold cucumber',
      difficulty: 9,
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
  },
};

describe('deriveTowerProgress', () => {
  it('aggregates repeated tower rows by unique item using the highest required target', () => {
    const derived = deriveTowerProgress(
      createSnapshot({
        board: 150_000,
        'gold cucumber': 50_000,
        'red diamond fish': 5_000,
      }),
      towerRequirementsData,
      masteryDifficultyData,
    );

    const board = derived.items.find((item) => item.canonicalKey === 'board');

    expect(board).toMatchObject({
      requiredThreshold: 1_000_000,
      remainingToTarget: 850_000,
      masteryLevelLabel: 'MM',
      pumpkinJuiceEstimate: {
        status: 'calculable',
        totalPumpkinJuices: 20,
        nextPumpkinJuiceGain: 15_000,
      },
    });
    expect(derived.gmItemsLeftCount).toBe(1);
    expect(derived.mmItemsLeftCount).toBe(1);
    expect(derived.totalPumpkinJuicesNeeded).toBe(36);
  });

  it('builds difficulty summaries with item and mastery remaining percentages', () => {
    const derived = deriveTowerProgress(
      createSnapshot({
        board: 1_500_000,
        'gold cucumber': 50_000,
        'red diamond fish': 5_000,
      }),
      towerRequirementsData,
      masteryDifficultyData,
    );

    const difficultyNine = derived.difficultySummary.find((row) => row.label === 'Difficulty 9');
    const unrated = derived.difficultySummary.find((row) => row.label === 'Unrated');

    expect(difficultyNine).toMatchObject({
      totalItems: 1,
      remainingItems: 1,
      remainingItemsPercent: 100,
      totalTargetMastery: 100_000,
      remainingTargetMastery: 100_000,
      remainingMastery: 50_000,
      remainingMasteryPercent: 50,
    });
    expect(unrated).toMatchObject({
      totalItems: 1,
      remainingItems: 1,
      totalTargetMastery: 10_000,
      remainingTargetMastery: 10_000,
      remainingMastery: 5_000,
      remainingMasteryPercent: 50,
    });
    expect(derived.totalMasteryRemaining).toBe(55_000);
  });

  it('does not count completed items toward remaining target mastery totals', () => {
    const derived = deriveTowerProgress(
      createSnapshot({
        board: 1_500_000,
        'gold cucumber': 75_000,
      }),
      towerRequirementsData,
      masteryDifficultyData,
    );

    const difficultyOne = derived.difficultySummary.find((row) => row.label === 'Difficulty 1');
    const difficultyNine = derived.difficultySummary.find((row) => row.label === 'Difficulty 9');

    expect(difficultyOne).toMatchObject({
      totalItems: 1,
      remainingItems: 0,
      totalTargetMastery: 1_000_000,
      remainingTargetMastery: 0,
      remainingMastery: 0,
      remainingMasteryPercent: 0,
    });
    expect(difficultyNine).toMatchObject({
      totalItems: 1,
      remainingItems: 1,
      totalTargetMastery: 100_000,
      remainingTargetMastery: 100_000,
      remainingMastery: 25_000,
      remainingMasteryPercent: 25,
    });
  });

  it('keeps unmatched snapshot items and missing mastery difficulty rows non-fatal', () => {
    const derived = deriveTowerProgress(
      createSnapshot({
        board: 1_500_000,
      }),
      towerRequirementsData,
      masteryDifficultyData,
    );

    const goldCucumber = derived.remainingItems.find((item) => item.canonicalKey === 'gold cucumber');
    const redDiamondFish = derived.remainingItems.find((item) => item.canonicalKey === 'red diamond fish');

    expect(goldCucumber).toMatchObject({
      currentMastery: 0,
      matchedSnapshotRow: false,
      matchedDifficultyRow: true,
    });
    expect(redDiamondFish).toMatchObject({
      difficultyLabel: 'Unrated',
      matchedDifficultyRow: false,
    });
    expect(derived.unmatchedSnapshotItemCount).toBe(2);
    expect(derived.unratedItemCount).toBe(1);
    expect(derived.pumpkinJuiceBlockedItemCount).toBe(2);
  });

  it('sorts remaining items by percent complete before remaining amount', () => {
    const derived = deriveTowerProgress(
      createSnapshot({
        board: 600_000,
        'gold cucumber': 90_000,
        'red diamond fish': 2_000,
      }),
      towerRequirementsData,
      masteryDifficultyData,
    );

    expect(derived.remainingItems.map((item) => item.canonicalKey)).toEqual([
      'gold cucumber',
      'board',
      'red diamond fish',
    ]);
  });
});
