import type { TowerRequirementStatusRow } from './deriveTowerRequirements';

const DEFAULT_FILENAME = 'tower-reference-review.csv';

export type TowerReferenceReviewRow = {
  reviewReasons: string[];
  towerLevel: number;
  towerLevelRange: string;
  slotIndex: number;
  itemName: string;
  canonicalKey: string;
  masteryLevelNeeded: TowerRequirementStatusRow['masteryLevelNeeded'];
  requiredThreshold: number;
  currentMastery: number;
  remainingToRequirement: number;
  matchedSnapshotRow: boolean;
  notes: string | null;
  sourceSheet: string | null;
  sourceRow: string | null;
};

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function isTbdPlaceholder(row: TowerRequirementStatusRow): boolean {
  return row.itemName.trim().toUpperCase() === 'TBD';
}

function compareTowerReviewRows(left: TowerReferenceReviewRow, right: TowerReferenceReviewRow): number {
  if (left.towerLevel !== right.towerLevel) {
    return left.towerLevel - right.towerLevel;
  }

  if (left.slotIndex !== right.slotIndex) {
    return left.slotIndex - right.slotIndex;
  }

  return left.itemName.localeCompare(right.itemName);
}

export function deriveTowerReferenceReviewRows(rows: TowerRequirementStatusRow[]): TowerReferenceReviewRow[] {
  return rows
    .map<TowerReferenceReviewRow | null>((row) => {
      const reviewReasons = [
        ...(isTbdPlaceholder(row) ? ['tbd_placeholder'] : []),
        ...(!row.matchedSnapshotRow ? ['unmatched_snapshot'] : []),
      ];

      if (reviewReasons.length === 0) {
        return null;
      }

      return {
        reviewReasons,
        towerLevel: row.towerLevel,
        towerLevelRange: row.towerLevelRange,
        slotIndex: row.slotIndex,
        itemName: row.itemName,
        canonicalKey: row.canonicalKey,
        masteryLevelNeeded: row.masteryLevelNeeded,
        requiredThreshold: row.requiredThreshold,
        currentMastery: row.currentMastery,
        remainingToRequirement: row.remainingToRequirement,
        matchedSnapshotRow: row.matchedSnapshotRow,
        notes: row.notes,
        sourceSheet: row.sourceSheet,
        sourceRow: row.sourceRow,
      };
    })
    .filter((row): row is TowerReferenceReviewRow => row !== null)
    .sort(compareTowerReviewRows);
}

export function buildTowerReferenceReviewCsv(rows: TowerRequirementStatusRow[]): string {
  const reviewRows = deriveTowerReferenceReviewRows(rows);
  const csvRows = [
    [
      'review_reasons',
      'tower_level',
      'tower_level_range',
      'slot_index',
      'item_name',
      'canonical_key',
      'mastery_level_needed',
      'required_threshold',
      'current_mastery',
      'remaining_to_requirement',
      'matched_snapshot_row',
      'notes',
      'source_sheet',
      'source_row',
    ],
    ...reviewRows.map((row) => [
      row.reviewReasons.join('|'),
      row.towerLevel.toString(),
      row.towerLevelRange,
      row.slotIndex.toString(),
      row.itemName,
      row.canonicalKey,
      row.masteryLevelNeeded,
      row.requiredThreshold.toString(),
      row.currentMastery.toString(),
      row.remainingToRequirement.toString(),
      row.matchedSnapshotRow ? 'yes' : 'no',
      row.notes ?? '',
      row.sourceSheet ?? '',
      row.sourceRow ?? '',
    ]),
  ];

  return csvRows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')).join('\n');
}

export function downloadTowerReferenceReviewCsv(
  rows: TowerRequirementStatusRow[],
  filename = DEFAULT_FILENAME,
): void {
  const csvText = buildTowerReferenceReviewCsv(rows);
  const csvBlob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}
