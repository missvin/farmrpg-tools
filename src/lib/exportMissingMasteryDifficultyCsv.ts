import type { UnmatchedItem } from './deriveMasteryDifficultyStats';
import { MASTERY_DIFFICULTY_COLUMNS } from './loadMasteryDifficulty';

const DEFAULT_FILENAME = 'missing-mastery-difficulty-items.csv';
const SOURCE_SHEET_VALUE = 'Missing from mastery_difficulty';

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function sortAndDeduplicateUnmatchedItems(items: UnmatchedItem[]): UnmatchedItem[] {
  const deduplicatedItems = new Map<string, UnmatchedItem>();

  for (const item of items) {
    if (!deduplicatedItems.has(item.canonicalKey)) {
      deduplicatedItems.set(item.canonicalKey, item);
    }
  }

  return [...deduplicatedItems.values()].sort((left, right) => left.itemName.localeCompare(right.itemName));
}

export function buildMissingMasteryDifficultyCsv(items: UnmatchedItem[]): string {
  const rows = [
    [...MASTERY_DIFFICULTY_COLUMNS],
    ...sortAndDeduplicateUnmatchedItems(items).map((item) => [
      item.itemName,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      SOURCE_SHEET_VALUE,
      '',
    ]),
  ];

  return rows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')).join('\n');
}

export function downloadMissingMasteryDifficultyCsv(
  items: UnmatchedItem[],
  filename = DEFAULT_FILENAME,
): void {
  const csvText = buildMissingMasteryDifficultyCsv(items);
  const csvBlob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}
