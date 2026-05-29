import { toCanonicalItemKey } from './normalizeItemKey';

export type MemoryGameAllowedTier = '1' | '2' | '3' | '4';

export type MemoryGameAllowedItemEntry = {
  itemName: string;
  canonicalKey: string;
  observedTiers: MemoryGameAllowedTier[];
  observedSources: string[];
  notes: string | null;
};

export type MemoryGameAllowedItemsData = {
  entries: MemoryGameAllowedItemEntry[];
  byCanonicalKey: Record<string, MemoryGameAllowedItemEntry>;
};

export const MEMORY_GAME_ALLOWED_ITEM_COLUMNS = [
  'item_name',
  'canonical_key',
  'observed_tiers',
  'observed_sources',
  'notes',
] as const;

const MEMORY_GAME_ALLOWED_TIERS = new Set<MemoryGameAllowedTier>(['1', '2', '3', '4']);

function validateHeaders(headers: string[]): void {
  const missingColumns = MEMORY_GAME_ALLOWED_ITEM_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !MEMORY_GAME_ALLOWED_ITEM_COLUMNS.includes(header as (typeof MEMORY_GAME_ALLOWED_ITEM_COLUMNS)[number]),
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

  throw new Error(`Invalid memory game allowed item schema (${details.join('; ')}).`);
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
    throw new Error(`Missing required ${fieldName} in memory game allowed items.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseList(value: string): string[] {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseObservedTiers(value: string, itemName: string): MemoryGameAllowedTier[] {
  return parseList(value).map((tier) => {
    if (MEMORY_GAME_ALLOWED_TIERS.has(tier as MemoryGameAllowedTier)) {
      return tier as MemoryGameAllowedTier;
    }

    throw new Error(`Invalid observed_tiers value "${tier}" for memory game allowed item "${itemName}".`);
  });
}

export function parseMemoryGameAllowedItemsCsv(csvText: string): MemoryGameAllowedItemsData {
  const lines = csvText
    .split(/\r?\n/u)
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
  const entries: MemoryGameAllowedItemEntry[] = [];
  const byCanonicalKey: Record<string, MemoryGameAllowedItemEntry> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const itemName = parseRequiredText(readField(values, headerIndex, 'item_name'), 'item_name');
    const canonicalKey = parseRequiredText(readField(values, headerIndex, 'canonical_key'), 'canonical_key');
    const expectedCanonicalKey = toCanonicalItemKey(itemName);

    if (canonicalKey !== expectedCanonicalKey) {
      throw new Error(
        `Canonical key mismatch for memory game allowed item "${itemName}": expected "${expectedCanonicalKey}" but found "${canonicalKey}".`,
      );
    }

    if (byCanonicalKey[canonicalKey]) {
      throw new Error(`Duplicate memory game allowed item row for canonical key "${canonicalKey}".`);
    }

    const entry: MemoryGameAllowedItemEntry = {
      itemName,
      canonicalKey,
      observedTiers: parseObservedTiers(readField(values, headerIndex, 'observed_tiers'), itemName),
      observedSources: parseList(readField(values, headerIndex, 'observed_sources')),
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

export async function loadMemoryGameAllowedItems(): Promise<MemoryGameAllowedItemsData> {
  const response = await fetch('/data/memory_game_allowed_items.csv');

  if (!response.ok) {
    throw new Error('Unable to load local memory game allowed item data.');
  }

  const csvText = await response.text();
  return parseMemoryGameAllowedItemsCsv(csvText);
}
