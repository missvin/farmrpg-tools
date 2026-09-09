import { describe, expect, it } from 'vitest';

import { deriveTowerProgress } from './deriveTowerProgress';
import { deriveTowerPumpkinJuiceHistory } from './deriveTowerPumpkinJuiceHistory';
import type { TowerRequirementsData } from './loadTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';

function createSnapshot(snapshotId: string, savedAt: string, masteryByItem: Record<string, number>): MasterySnapshot {
  return {
    snapshotId,
    createdAt: savedAt,
    savedAt,
    importedAt: savedAt,
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
  };
}

const towerRequirements: TowerRequirementsData = {
  entries: [
    {
      towerLevel: 250,
      towerLevelRange: '241-260',
      slotIndex: 1,
      itemName: 'Apple',
      canonicalKey: 'apple',
      masteryLevelNeeded: 'GM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 340,
      towerLevelRange: '321-340',
      slotIndex: 1,
      itemName: 'Gold Pea',
      canonicalKey: 'gold pea',
      masteryLevelNeeded: 'GM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 350,
      towerLevelRange: '341-360',
      slotIndex: 1,
      itemName: 'Steel Plate',
      canonicalKey: 'steel plate',
      masteryLevelNeeded: 'MM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
  ],
  byCanonicalKey: {},
};

describe('deriveTowerPumpkinJuiceHistory', () => {
  it('applies current Tower cutoffs to snapshots in chronological order', () => {
    const older = createSnapshot('older', '2026-07-01T00:00:00.000Z', {
      apple: 10_000,
      'gold pea': 20_000,
      'steel plate': 100_000,
    });
    const newer = createSnapshot('newer', '2026-08-01T00:00:00.000Z', {
      apple: 30_000,
      'gold pea': 40_000,
      'steel plate': 300_000,
    });

    const history = deriveTowerPumpkinJuiceHistory([newer, older], towerRequirements, [350, 340, 340, -1]);
    const t340 = history.series.find((series) => series.targetLevel === 340);
    const t350 = history.series.find((series) => series.targetLevel === 350);
    const emptyDifficulty = { entries: [], byCanonicalKey: {} };

    expect(history.targetLevels).toEqual([340, 350]);
    expect(history.snapshotCount).toBe(2);
    expect(t340?.points.map((point) => point.snapshotId)).toEqual(['older', 'newer']);
    expect(t340?.points[0].totalPumpkinJuicesNeeded).toBe(
      deriveTowerProgress(older, towerRequirements, emptyDifficulty, { maxTowerLevel: 340 }).totalPumpkinJuicesNeeded,
    );
    expect(t350?.points[1].totalPumpkinJuicesNeeded).toBe(
      deriveTowerProgress(newer, towerRequirements, emptyDifficulty, { maxTowerLevel: 350 }).totalPumpkinJuicesNeeded,
    );
    expect(t350?.points[1].changeFromPrevious).toBe(
      (t350?.points[1].totalPumpkinJuicesNeeded ?? 0) - (t350?.points[0].totalPumpkinJuicesNeeded ?? 0),
    );
  });

  it('marks totals as lower bounds when a required item has no snapshot baseline', () => {
    const history = deriveTowerPumpkinJuiceHistory(
      [createSnapshot('partial', '2026-07-01T00:00:00.000Z', { apple: 10_000 })],
      towerRequirements,
      [340],
    );

    expect(history.series[0].points[0]).toMatchObject({
      blockedItemCount: 1,
      isLowerBound: true,
    });
    expect(history.series[0].points[0].totalPumpkinJuicesNeeded).toBeGreaterThan(0);
  });
});
