import { describe, expect, it } from 'vitest';

import { buildTowerReferenceReviewCsv, deriveTowerReferenceReviewRows } from './exportTowerReferenceReviewCsv';
import type { TowerRequirementStatusRow } from './deriveTowerRequirements';

function createRow(overrides: Partial<TowerRequirementStatusRow>): TowerRequirementStatusRow {
  return {
    towerLevel: 311,
    towerLevelRange: '311-320',
    slotIndex: 1,
    itemName: 'Board',
    canonicalKey: 'board',
    masteryLevelNeeded: 'GM',
    requiredThreshold: 100_000,
    currentMastery: 0,
    achieved: false,
    remainingToRequirement: 100_000,
    matchedSnapshotRow: true,
    farmrpgItemId: null,
    buddySlug: null,
    notes: null,
    sourceSheet: null,
    sourceRow: null,
    ...overrides,
  };
}

describe('deriveTowerReferenceReviewRows', () => {
  it('surfaces unmatched rows and TBD placeholders as review cases', () => {
    const reviewRows = deriveTowerReferenceReviewRows([
      createRow({ towerLevel: 311, slotIndex: 1, itemName: 'Board', canonicalKey: 'board', matchedSnapshotRow: false }),
      createRow({ towerLevel: 312, slotIndex: 2, itemName: 'TBD', canonicalKey: 'tbd', matchedSnapshotRow: false }),
      createRow({ towerLevel: 313, slotIndex: 1, itemName: 'Twine', canonicalKey: 'twine', matchedSnapshotRow: true }),
    ]);

    expect(reviewRows).toEqual([
      expect.objectContaining({
        towerLevel: 311,
        slotIndex: 1,
        itemName: 'Board',
        reviewReasons: ['unmatched_snapshot'],
      }),
      expect.objectContaining({
        towerLevel: 312,
        slotIndex: 2,
        itemName: 'TBD',
        reviewReasons: ['tbd_placeholder', 'unmatched_snapshot'],
      }),
    ]);
  });
});

describe('buildTowerReferenceReviewCsv', () => {
  it('exports review rows with reasons and provenance fields', () => {
    const csvText = buildTowerReferenceReviewCsv([
      createRow({
        towerLevel: 319,
        slotIndex: 1,
        itemName: 'Strong Paste',
        canonicalKey: 'strong paste',
        matchedSnapshotRow: false,
        sourceSheet: 'Community discovery 311-320',
        sourceRow: '319-1',
      }),
      createRow({
        towerLevel: 314,
        slotIndex: 2,
        itemName: 'TBD',
        canonicalKey: 'tbd',
        matchedSnapshotRow: false,
        notes: 'TBD placeholder - requirement not yet confirmed',
        sourceSheet: 'Community discovery 311-320',
        sourceRow: '314-2',
      }),
    ]);

    expect(csvText).toBe(
      [
        'review_reasons,tower_level,tower_level_range,slot_index,item_name,canonical_key,mastery_level_needed,required_threshold,current_mastery,remaining_to_requirement,matched_snapshot_row,notes,source_sheet,source_row',
        'tbd_placeholder|unmatched_snapshot,314,311-320,2,TBD,tbd,GM,100000,0,100000,no,TBD placeholder - requirement not yet confirmed,Community discovery 311-320,314-2',
        'unmatched_snapshot,319,311-320,1,Strong Paste,strong paste,GM,100000,0,100000,no,,Community discovery 311-320,319-1',
      ].join('\n'),
    );
  });
});
