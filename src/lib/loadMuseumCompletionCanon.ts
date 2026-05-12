import { normalizeMuseumCategoryKey } from './museumCompletion';
import { toCanonicalItemKey } from './normalizeItemKey';

export type MuseumCompletionCanonReviewStatus = 'source_parsed' | 'reviewed' | 'ambiguous' | 'stale';

export type MuseumCompletionCanonEntry = {
  museumCategory: string;
  categoryKey: string;
  slotIndex: number;
  itemName: string;
  canonicalKey: string;
  obtainable: boolean;
  reviewStatus: MuseumCompletionCanonReviewStatus;
  source: string;
  notes: string | null;
};

export type MuseumCompletionCanonData = {
  entries: MuseumCompletionCanonEntry[];
  byCategoryKey: Record<string, MuseumCompletionCanonEntry[]>;
};

export const MUSEUM_COMPLETION_CANON_COLUMNS = [
  'museum_category',
  'category_key',
  'slot_index',
  'item_name',
  'canonical_key',
  'obtainable',
  'review_status',
  'source',
  'notes',
] as const;

const REVIEW_STATUSES = new Set<MuseumCompletionCanonReviewStatus>([
  'source_parsed',
  'reviewed',
  'ambiguous',
  'stale',
]);

function validateHeaders(headers: string[]): void {
  const missingColumns = MUSEUM_COMPLETION_CANON_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !MUSEUM_COMPLETION_CANON_COLUMNS.includes(header as (typeof MUSEUM_COMPLETION_CANON_COLUMNS)[number]),
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

  throw new Error(`Invalid museum completion canon schema (${details.join('; ')}).`);
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
    throw new Error(`Missing required ${fieldName} in museum completion canon.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseSlotIndex(value: string, itemName: string): number {
  const parsedValue = Number(value.trim());

  if (Number.isInteger(parsedValue) && parsedValue >= 1) {
    return parsedValue;
  }

  throw new Error(`Invalid slot_index "${value}" for museum completion canon row "${itemName || 'unknown item'}".`);
}

function parseBooleanFlag(value: string, itemName: string): boolean {
  const normalizedValue = value.trim().toUpperCase();

  if (normalizedValue === 'Y') {
    return true;
  }

  if (normalizedValue === 'N') {
    return false;
  }

  throw new Error(`Invalid obtainable "${value}" for museum completion canon row "${itemName || 'unknown item'}".`);
}

function parseReviewStatus(value: string, itemName: string): MuseumCompletionCanonReviewStatus {
  const normalizedValue = value.trim() as MuseumCompletionCanonReviewStatus;

  if (REVIEW_STATUSES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(
    `Invalid review_status "${value}" for museum completion canon row "${itemName || 'unknown item'}".`,
  );
}

export function parseMuseumCompletionCanonCsv(csvText: string): MuseumCompletionCanonData {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
      byCategoryKey: {},
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);

  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: MuseumCompletionCanonEntry[] = [];
  const byCategoryKey: Record<string, MuseumCompletionCanonEntry[]> = {};
  const seenCategorySlots = new Set<string>();

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const itemName = parseRequiredText(readField(values, headerIndex, 'item_name'), 'item_name');
    const canonicalKey = parseRequiredText(readField(values, headerIndex, 'canonical_key'), 'canonical_key');
    const expectedCanonicalKey = toCanonicalItemKey(itemName);

    if (canonicalKey !== expectedCanonicalKey) {
      throw new Error(
        `Canonical key mismatch for museum completion canon row "${itemName}": expected "${expectedCanonicalKey}" but found "${canonicalKey}".`,
      );
    }

    const museumCategory = parseRequiredText(readField(values, headerIndex, 'museum_category'), 'museum_category');
    const categoryKey = parseRequiredText(readField(values, headerIndex, 'category_key'), 'category_key');
    const expectedCategoryKey = normalizeMuseumCategoryKey(museumCategory);

    if (categoryKey !== expectedCategoryKey) {
      throw new Error(
        `Category key mismatch for museum completion canon row "${itemName}": expected "${expectedCategoryKey}" but found "${categoryKey}".`,
      );
    }

    const slotIndex = parseSlotIndex(readField(values, headerIndex, 'slot_index'), itemName);
    const categorySlotKey = `${categoryKey}:${slotIndex}`;

    if (seenCategorySlots.has(categorySlotKey)) {
      throw new Error(`Duplicate museum completion canon row for ${museumCategory} slot ${slotIndex}.`);
    }

    seenCategorySlots.add(categorySlotKey);

    const entry: MuseumCompletionCanonEntry = {
      museumCategory,
      categoryKey,
      slotIndex,
      itemName,
      canonicalKey,
      obtainable: parseBooleanFlag(readField(values, headerIndex, 'obtainable'), itemName),
      reviewStatus: parseReviewStatus(readField(values, headerIndex, 'review_status'), itemName),
      source: parseRequiredText(readField(values, headerIndex, 'source'), 'source'),
      notes: parseOptionalText(readField(values, headerIndex, 'notes')),
    };

    entries.push(entry);
    byCategoryKey[entry.categoryKey] = [...(byCategoryKey[entry.categoryKey] ?? []), entry];
  }

  for (const categoryEntries of Object.values(byCategoryKey)) {
    categoryEntries.sort((left, right) => left.slotIndex - right.slotIndex);
  }

  return {
    entries,
    byCategoryKey,
  };
}

export async function loadMuseumCompletionCanon(): Promise<MuseumCompletionCanonData> {
  const response = await fetch('/data/museum_completion_canon.csv');

  if (!response.ok) {
    throw new Error('Unable to load local museum completion canon data.');
  }

  const csvText = await response.text();
  return parseMuseumCompletionCanonCsv(csvText);
}
