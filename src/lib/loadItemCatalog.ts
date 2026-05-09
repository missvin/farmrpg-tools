import { toCanonicalItemKey } from './normalizeItemKey';

export type ItemCatalogMasteryPossible = 'yes' | 'no' | 'unknown';

export type ItemCatalogEntry = {
  itemName: string;
  canonicalKey: string;
  masteryPossible: ItemCatalogMasteryPossible;
  farmrpgItemId: string | null;
  buddySlug: string | null;
  sourceDatasets: string[];
  notes: string | null;
};

export type ItemCatalogData = {
  entries: ItemCatalogEntry[];
  byCanonicalKey: Record<string, ItemCatalogEntry>;
};

export const ITEM_CATALOG_COLUMNS = [
  'item_name',
  'canonical_key',
  'mastery_possible',
  'farmrpg_item_id',
  'buddy_slug',
  'source_datasets',
  'notes',
] as const;

function validateHeaders(headers: string[]): void {
  const missingColumns = ITEM_CATALOG_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !ITEM_CATALOG_COLUMNS.includes(header as (typeof ITEM_CATALOG_COLUMNS)[number]),
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

  throw new Error(`Invalid item catalog schema (${details.join('; ')}).`);
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
    throw new Error(`Missing required ${fieldName} in item catalog.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseMasteryPossible(value: string, itemName: string): ItemCatalogMasteryPossible {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'yes' || normalizedValue === 'no' || normalizedValue === 'unknown') {
    return normalizedValue;
  }

  throw new Error(`Invalid mastery_possible "${value}" for item catalog row "${itemName || 'unknown item'}".`);
}

function parseSourceDatasets(value: string, itemName: string): string[] {
  const sourceDatasets = value
    .split(';')
    .map((sourceDataset) => sourceDataset.trim())
    .filter(Boolean);

  if (sourceDatasets.length === 0) {
    throw new Error(`Missing required source_datasets for item catalog row "${itemName || 'unknown item'}".`);
  }

  return [...new Set(sourceDatasets)].sort((left, right) => left.localeCompare(right));
}

export function parseItemCatalogCsv(csvText: string): ItemCatalogData {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
      byCanonicalKey: {},
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: ItemCatalogEntry[] = [];
  const byCanonicalKey: Record<string, ItemCatalogEntry> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const itemName = parseRequiredText(readField(values, headerIndex, 'item_name'), 'item_name');
    const canonicalKey = parseRequiredText(readField(values, headerIndex, 'canonical_key'), 'canonical_key');
    const expectedCanonicalKey = toCanonicalItemKey(itemName);

    if (canonicalKey !== expectedCanonicalKey) {
      throw new Error(
        `Canonical key mismatch for item catalog row "${itemName}": expected "${expectedCanonicalKey}" but found "${canonicalKey}".`,
      );
    }

    if (byCanonicalKey[canonicalKey]) {
      throw new Error(`Duplicate item catalog row for canonical key "${canonicalKey}".`);
    }

    const entry: ItemCatalogEntry = {
      itemName,
      canonicalKey,
      masteryPossible: parseMasteryPossible(readField(values, headerIndex, 'mastery_possible'), itemName),
      farmrpgItemId: parseOptionalText(readField(values, headerIndex, 'farmrpg_item_id')),
      buddySlug: parseOptionalText(readField(values, headerIndex, 'buddy_slug')),
      sourceDatasets: parseSourceDatasets(readField(values, headerIndex, 'source_datasets'), itemName),
      notes: parseOptionalText(readField(values, headerIndex, 'notes')),
    };

    entries.push(entry);
    byCanonicalKey[entry.canonicalKey] = entry;
  }

  return {
    entries,
    byCanonicalKey,
  };
}

export async function loadItemCatalog(): Promise<ItemCatalogData> {
  const response = await fetch('/data/item_catalog.csv');

  if (!response.ok) {
    throw new Error('Unable to load local item catalog data.');
  }

  const csvText = await response.text();
  return parseItemCatalogCsv(csvText);
}
