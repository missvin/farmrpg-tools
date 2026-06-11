import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { deriveTowerRequirements, getTowerRequirementThreshold } from './deriveTowerRequirements';
import { parseTowerRequirementsCsv } from './loadTowerRequirements';
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

  it('keeps future 311-340 levels visible in derived outputs with known rows', () => {
    const csvText = readFileSync(resolve(process.cwd(), 'data/tower_requirements.csv'), 'utf8');
    const towerRequirementsData = parseTowerRequirementsCsv(csvText);
    const emptySnapshot = {
      ...createSnapshot(),
      masteryByItem: {},
      parseSummary: {
        ...createSnapshot().parseSummary,
        itemsParsed: 0,
      },
    };

    const result = deriveTowerRequirements(emptySnapshot, towerRequirementsData);
    const range311to320 = result.groups.find((group) => group.towerLevelRange === '311-320');
    const level311 = range311to320?.levels.find((level) => level.towerLevel === 311);
    const level314 = range311to320?.levels.find((level) => level.towerLevel === 314);
    const level315 = range311to320?.levels.find((level) => level.towerLevel === 315);
    const level316 = range311to320?.levels.find((level) => level.towerLevel === 316);
    const level317 = range311to320?.levels.find((level) => level.towerLevel === 317);
    const level318 = range311to320?.levels.find((level) => level.towerLevel === 318);
    const level319 = range311to320?.levels.find((level) => level.towerLevel === 319);
    const level320 = range311to320?.levels.find((level) => level.towerLevel === 320);
    const range321to330 = result.groups.find((group) => group.towerLevelRange === '321-330');
    const level321 = range321to330?.levels.find((level) => level.towerLevel === 321);
    const level324 = range321to330?.levels.find((level) => level.towerLevel === 324);
    const level325 = range321to330?.levels.find((level) => level.towerLevel === 325);
    const level330 = range321to330?.levels.find((level) => level.towerLevel === 330);
    const range331to340 = result.groups.find((group) => group.towerLevelRange === '331-340');
    const level331 = range331to340?.levels.find((level) => level.towerLevel === 331);
    const level332 = range331to340?.levels.find((level) => level.towerLevel === 332);
    const level335 = range331to340?.levels.find((level) => level.towerLevel === 335);
    const level336 = range331to340?.levels.find((level) => level.towerLevel === 336);
    const level338 = range331to340?.levels.find((level) => level.towerLevel === 338);
    const level340 = range331to340?.levels.find((level) => level.towerLevel === 340);

    expect(range311to320?.levels.map((level) => level.towerLevel)).toEqual([
      311, 312, 313, 314, 315, 316, 317, 318, 319, 320,
    ]);
    expect(range321to330?.levels.map((level) => level.towerLevel)).toEqual([
      321, 322, 323, 324, 325, 326, 327, 328, 329, 330,
    ]);
    expect(range331to340?.levels.map((level) => level.towerLevel)).toEqual([
      331, 332, 333, 334, 335, 336, 337, 338, 339, 340,
    ]);
    expect(level311?.rows.map((row) => row.itemName)).toEqual(['Bamboo Chair', 'Barbed Wire']);
    expect(level314?.rows.map((row) => row.itemName)).toEqual(['Energy Coil', 'Black Dye']);
    expect(level315?.rows.map((row) => row.itemName)).toEqual([
      'Reinforced Helmet',
      'Gold Lemon Quartz Ring',
      'Steel Vise',
    ]);
    expect(level316?.rows.map((row) => row.itemName)).toEqual(['Yellow Bag', 'Leather Helmet']);
    expect(level317?.rows.map((row) => row.itemName)).toEqual(['Gold Aquamarine Ring', 'Handsaw']);
    expect(level318?.rows.map((row) => row.itemName)).toEqual(['Yellow Butterfly', 'Acorn Butter']);
    expect(level319?.rows.map((row) => row.itemName)).toEqual(['Strong Paste', 'Spoon']);
    expect(level320?.rows.map((row) => row.itemName)).toEqual(['Corn Husk Doll', 'Blubberfish', 'Reaver Claw']);
    expect(level321?.rows.map((row) => row.itemName)).toEqual(['Green Diary', 'Sturdy Bow']);
    expect(level324?.rows.map((row) => row.itemName)).toEqual(['Spool of Copper', 'Red Twine']);
    expect(level325?.rows.map((row) => row.itemName)).toEqual(['Cloth', 'Gold Ring', 'Tin Scraps']);
    expect(level330?.rows.map((row) => row.itemName)).toEqual(['Red Diary', 'White Twine', 'Magus Hat']);
    expect(level331?.rows.map((row) => row.itemName)).toEqual(['Runestone 04', 'Orange Twine']);
    expect(level332?.rows.map((row) => row.itemName)).toEqual(['Kill Switch', 'Linked Lantern']);
    expect(level335?.rows.map((row) => row.itemName)).toEqual(['Red Brick', 'Iced Tea', 'Leather Belt']);
    expect(level336?.rows.map((row) => row.itemName)).toEqual(['Yellow Twine', 'Black Bag', 'Seaweed']);
    expect(level338?.rows.map((row) => row.itemName)).toEqual(['Frost Shield', 'Mayonnaise', 'Orange Scarf']);
    expect(level340?.rows.map((row) => row.itemName)).toEqual(['White Purse', 'Yellow Dye', 'Purple Diary']);
  });
});
