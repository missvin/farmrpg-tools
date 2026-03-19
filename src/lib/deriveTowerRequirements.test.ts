import { describe, expect, it } from 'vitest';

import { deriveTowerRequirements, getTowerRequirementThreshold } from './deriveTowerRequirements';
import type { TowerRequirementsData } from './loadTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';

function createSnapshot(): MasterySnapshot {
  return {
    snapshotId: 'snapshot-1',
    createdAt: '2026-03-16T12:00:00.000Z',
    rawText: '',
    masteryByItem: {
      board: 1_500_000,
      twine: 500_000,
      'iron ring': 15_000,
    },
    parseSummary: {
      itemsParsed: 3,
      parsedRowsCount: 0,
      tiersDetected: [10000, 100000, 1000000],
      duplicateRowsCount: 0,
      skippedNonItemLinesCount: 0,
      skippedNonItemLineSamples: [],
      unknownItemsCount: 0,
      warnings: [],
    },
  };
}

function createTowerRequirementsData(): TowerRequirementsData {
  const entries = [
    {
      towerLevel: 201,
      towerLevelRange: '201-210',
      slotIndex: 1,
      itemName: 'Board',
      canonicalKey: 'board',
      masteryLevelNeeded: 'MM' as const,
      farmrpgItemId: null,
      buddySlug: null,
      notes: 'Auto-craft',
      sourceSheet: 'Tower MMs',
      sourceRow: '15',
    },
    {
      towerLevel: 202,
      towerLevelRange: '201-210',
      slotIndex: 1,
      itemName: 'Twine',
      canonicalKey: 'twine',
      masteryLevelNeeded: 'MM' as const,
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: 'Tower MMs',
      sourceRow: '16',
    },
    {
      towerLevel: 301,
      towerLevelRange: '301-310',
      slotIndex: 2,
      itemName: 'Iron Ring',
      canonicalKey: 'iron ring',
      masteryLevelNeeded: 'M' as const,
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: 'Tower GMs',
      sourceRow: '50',
    },
    {
      towerLevel: 301,
      towerLevelRange: '301-310',
      slotIndex: 1,
      itemName: 'Crab',
      canonicalKey: 'crab',
      masteryLevelNeeded: 'GM' as const,
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: 'Tower GMs',
      sourceRow: '49',
    },
  ];

  return {
    entries,
    byCanonicalKey: {
      board: [entries[0]],
      twine: [entries[1]],
      'iron ring': [entries[2]],
      crab: [entries[3]],
    },
  };
}

describe('getTowerRequirementThreshold', () => {
  it('maps M, GM, and MM to the correct mastery thresholds', () => {
    expect(getTowerRequirementThreshold('M')).toBe(10_000);
    expect(getTowerRequirementThreshold('GM')).toBe(100_000);
    expect(getTowerRequirementThreshold('MM')).toBe(1_000_000);
  });
});

describe('deriveTowerRequirements', () => {
  it('computes achieved, unachieved, and remaining values from the latest snapshot', () => {
    const result = deriveTowerRequirements(createSnapshot(), createTowerRequirementsData());

    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemName: 'Board',
          requiredThreshold: 1_000_000,
          currentMastery: 1_500_000,
          achieved: true,
          remainingToRequirement: 0,
          matchedSnapshotRow: true,
        }),
        expect.objectContaining({
          itemName: 'Twine',
          requiredThreshold: 1_000_000,
          currentMastery: 500_000,
          achieved: false,
          remainingToRequirement: 500_000,
          matchedSnapshotRow: true,
        }),
      ]),
    );
  });

  it('keeps unmatched tower requirement rows visible with zero current mastery', () => {
    const result = deriveTowerRequirements(createSnapshot(), createTowerRequirementsData());
    const crabRow = result.rows.find((row) => row.canonicalKey === 'crab');

    expect(crabRow).toEqual(
      expect.objectContaining({
        itemName: 'Crab',
        currentMastery: 0,
        matchedSnapshotRow: false,
        achieved: false,
        remainingToRequirement: 100_000,
      }),
    );
  });

  it('groups by tower level range and then tower level', () => {
    const result = deriveTowerRequirements(createSnapshot(), createTowerRequirementsData());

    expect(result.groups).toEqual([
      {
        towerLevelRange: '201-210',
        levels: [
          expect.objectContaining({ towerLevel: 201 }),
          expect.objectContaining({ towerLevel: 202 }),
        ],
      },
      {
        towerLevelRange: '301-310',
        levels: [expect.objectContaining({ towerLevel: 301 })],
      },
    ]);
  });

  it('sorts rows with unmet first, then remaining ascending, then slot index ascending', () => {
    const result = deriveTowerRequirements(createSnapshot(), createTowerRequirementsData());
    const level301Rows = result.groups.find((group) => group.towerLevelRange === '301-310')?.levels[0]?.rows;

    expect(level301Rows?.map((row) => row.itemName)).toEqual(['Crab', 'Iron Ring']);
    expect(level301Rows?.map((row) => row.slotIndex)).toEqual([1, 2]);
  });
});
