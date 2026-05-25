import { normalizeMuseumCategoryKey } from './museumCompletion';
import type { MuseumCompletionManualMissingEntry } from './museumCompletionState';
import { toCanonicalItemKey } from './normalizeItemKey';

export type MuseumReviewedMissingStatus = 'reviewed' | 'reviewed_group';

export type MuseumReviewedMissingItem = MuseumCompletionManualMissingEntry & {
  reviewStatus: MuseumReviewedMissingStatus;
  source: string;
};

export type MuseumReviewedMissingItemsData = {
  entries: MuseumReviewedMissingItem[];
};

export const MUSEUM_REVIEWED_MISSING_ITEMS_COLUMNS = [
  'category_name',
  'category_key',
  'item_name',
  'canonical_key',
  'slot_count',
  'review_status',
  'source',
  'notes',
] as const;

const REVIEW_STATUSES = new Set<MuseumReviewedMissingStatus>(['reviewed', 'reviewed_group']);

function validateHeaders(headers: string[]): void {
  const missingColumns = MUSEUM_REVIEWED_MISSING_ITEMS_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) =>
      !MUSEUM_REVIEWED_MISSING_ITEMS_COLUMNS.includes(
        header as (typeof MUSEUM_REVIEWED_MISSING_ITEMS_COLUMNS)[number],
      ),
  );

  if (missingColumns.length === 0 && unexpectedColumns.length === 0) {
    return;
  }

  const details: string[] = [];

  if (missingColumns.length > 0) {
    details.push(`missing columns: ${missingColumns.join(', ')}`);
  }

  if (unexpectedColumns.length > 0) {
    details.push(`unexpected columns: ${unexpectedColumns.join(', ')}`);
  }

  throw new Error(`Invalid reviewed museum missing items schema (${details.join('; ')}).`);
}

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function readField(values: string[], headerIndex: Record<string, number>, fieldName: string): string {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function parseRequiredText(value: string, fieldName: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} in reviewed museum missing items.`);
  }

  return trimmedValue;
}

function parseSlotCount(value: string, itemName: string): number {
  const parsedValue = Number(value.trim());

  if (Number.isInteger(parsedValue) && parsedValue >= 1) {
    return parsedValue;
  }

  throw new Error(`Invalid slot_count "${value}" for reviewed museum missing item "${itemName || 'unknown item'}".`);
}

function parseReviewStatus(value: string, itemName: string): MuseumReviewedMissingStatus {
  const normalizedValue = value.trim() as MuseumReviewedMissingStatus;

  if (REVIEW_STATUSES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(
    `Invalid review_status "${value}" for reviewed museum missing item "${itemName || 'unknown item'}".`,
  );
}

export function parseMuseumReviewedMissingItemsCsv(csvText: string): MuseumReviewedMissingItemsData {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);

  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: MuseumReviewedMissingItem[] = [];
  const seenKeys = new Set<string>();

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const itemName = parseRequiredText(readField(values, headerIndex, 'item_name'), 'item_name');
    const canonicalKey = parseRequiredText(readField(values, headerIndex, 'canonical_key'), 'canonical_key');
    const expectedCanonicalKey = toCanonicalItemKey(itemName);

    if (canonicalKey !== expectedCanonicalKey) {
      throw new Error(
        `Canonical key mismatch for reviewed museum missing item "${itemName}": expected "${expectedCanonicalKey}" but found "${canonicalKey}".`,
      );
    }

    const categoryName = parseRequiredText(readField(values, headerIndex, 'category_name'), 'category_name');
    const categoryKey = parseRequiredText(readField(values, headerIndex, 'category_key'), 'category_key');
    const expectedCategoryKey = normalizeMuseumCategoryKey(categoryName);

    if (categoryKey !== expectedCategoryKey) {
      throw new Error(
        `Category key mismatch for reviewed museum missing item "${itemName}": expected "${expectedCategoryKey}" but found "${categoryKey}".`,
      );
    }

    const source = parseRequiredText(readField(values, headerIndex, 'source'), 'source');
    const duplicateKey = `${categoryKey}:${canonicalKey}`;

    if (seenKeys.has(duplicateKey)) {
      throw new Error(`Duplicate reviewed museum missing item "${itemName}" in ${categoryName}.`);
    }

    seenKeys.add(duplicateKey);

    entries.push({
      id: `reviewed-${categoryKey}-${canonicalKey}`,
      categoryKey,
      categoryName,
      itemName,
      canonicalKey,
      slotCount: parseSlotCount(readField(values, headerIndex, 'slot_count'), itemName),
      note: readField(values, headerIndex, 'notes').trim(),
      reviewStatus: parseReviewStatus(readField(values, headerIndex, 'review_status'), itemName),
      source,
    });
  }

  return {
    entries,
  };
}

export async function loadMuseumReviewedMissingItems(): Promise<MuseumReviewedMissingItemsData> {
  const response = await fetch('/data/museum_reviewed_missing_items.csv');

  if (!response.ok) {
    throw new Error('Unable to load reviewed museum missing items.');
  }

  const csvText = await response.text();
  return parseMuseumReviewedMissingItemsCsv(csvText);
}
