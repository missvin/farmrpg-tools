import { describe, expect, it } from 'vitest';

import { deriveConsumableAcquisitionEstimates } from './acquisitionEstimates';
import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { derivePersonalMasteryGoalPlanning } from './derivePersonalMasteryGoalPlanning';
import type { MasterySnapshot } from './storage/masterySnapshots';

const snapshot: MasterySnapshot = {
  snapshotId: 'snapshot-1',
  createdAt: '2026-05-08T00:00:00.000Z',
  rawText: '',
  masteryByItem: {
    board: 50_000,
  },
  parseSummary: {
    itemsParsed: 1,
    parsedRowsCount: 1,
    tiersDetected: [100_000],
    duplicateRowsCount: 0,
    skippedNonItemLinesCount: 0,
    skippedNonItemLineSamples: [],
    unknownItemsCount: 0,
    warnings: [],
  },
};

describe('derivePersonalMasteryGoalPlanning', () => {
  it('joins saved goals to the latest snapshot and PJ estimate', () => {
    const rows = derivePersonalMasteryGoalPlanning(
      [
        {
          goalId: 'goal-1',
          itemName: 'Board',
          canonicalKey: 'board',
          targetTier: 'GM',
          createdAt: '2026-05-08T00:00:00.000Z',
          updatedAt: '2026-05-08T00:00:00.000Z',
        },
      ],
      snapshot,
    );

    expect(rows[0]).toMatchObject({
      currentMastery: 50_000,
      targetMastery: 100_000,
      remainingMastery: 50_000,
      matchedSnapshotRow: true,
      pumpkinJuiceEstimate: {
        status: 'calculable',
        nextPumpkinJuiceGain: 5_000,
      },
    });
  });

  it('treats missing snapshot rows as baseline blockers', () => {
    const rows = derivePersonalMasteryGoalPlanning(
      [
        {
          goalId: 'goal-2',
          itemName: 'Rare Thing',
          canonicalKey: 'rare thing',
          targetTier: 'MM',
          createdAt: '2026-05-08T00:00:00.000Z',
          updatedAt: '2026-05-08T00:00:00.000Z',
        },
      ],
      snapshot,
    );

    expect(rows[0]).toMatchObject({
      currentMastery: 0,
      matchedSnapshotRow: false,
      pumpkinJuiceEstimate: {
        status: 'needs_baseline',
      },
    });
  });

  it('attaches optional race-count context for the target tier', () => {
    const rows = derivePersonalMasteryGoalPlanning(
      [
        {
          goalId: 'goal-3',
          itemName: 'Board',
          canonicalKey: 'board',
          targetTier: 'GM',
          createdAt: '2026-05-08T00:00:00.000Z',
          updatedAt: '2026-05-08T00:00:00.000Z',
        },
      ],
      snapshot,
      {
        board: {
          canonicalKey: 'board',
          itemName: 'Board',
          masteredCount: 1000,
          grandMasteredCount: 150,
          megaMasteredCount: 12,
          updatedAt: '2026-05-08T00:00:00.000Z',
        },
      },
    );

    expect(rows[0]).toMatchObject({
      targetTierPublicCount: 150,
      raceCountEntry: {
        megaMasteredCount: 12,
      },
    });
  });

  it('attaches Pumpkin Juice value estimates and threshold reasons', () => {
    const rows = derivePersonalMasteryGoalPlanning(
      [
        {
          goalId: 'goal-4',
          itemName: 'Board',
          canonicalKey: 'board',
          targetTier: 'GM',
          createdAt: '2026-05-08T00:00:00.000Z',
          updatedAt: '2026-05-08T00:00:00.000Z',
        },
      ],
      snapshot,
      {},
      {
        consumableEstimates: deriveConsumableAcquisitionEstimates(createDefaultAcquisitionPlannerInputState()),
        pumpkinJuiceValueThresholds: {
          enabled: true,
          minNextApSaved: 20,
          minTotalApSaved: 0,
          minNextStaminaSaved: 0,
          minTotalStaminaSaved: 0,
        },
      },
    );

    expect(rows[0]).toMatchObject({
      pumpkinJuiceValueEstimate: {
        nextArnoldPalmersSaved: 25,
        nextStaminaSaved: 12_500,
      },
      pumpkinJuiceValueThreshold: {
        isHighlighted: true,
        reasons: ['Next PJ saves about 25 Arnold Palmers.'],
      },
    });
  });
});
