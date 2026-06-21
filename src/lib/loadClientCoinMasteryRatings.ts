import { resolveItemAlias, type ItemAliasData } from './itemAliases';
import { toCanonicalItemKey } from './normalizeItemKey';

export type ClientCoinCategoryFlag = boolean | null;

export type ClientCoinMasteryRatingEntry = {
  itemName: string;
  canonicalKey: string;
  farmrpgItemId: string | null;
  clientcoinRating: number | null;
  clientcoinRatingRaw: string | null;
  towerCount: number | null;
  gmCount: number | null;
  mmCount: number | null;
  fish: ClientCoinCategoryFlag;
  craft: ClientCoinCategoryFlag;
  explore: ClientCoinCategoryFlag;
  farm: ClientCoinCategoryFlag;
  cook: ClientCoinCategoryFlag;
  event: ClientCoinCategoryFlag;
  sourceSheet: string | null;
  sourceRow: string | null;
  notes: string | null;
};

export type ClientCoinMasteryRatingData = {
  entries: ClientCoinMasteryRatingEntry[];
  byCanonicalKey: Record<string, ClientCoinMasteryRatingEntry>;
};

export const CLIENTCOIN_MASTERY_RATING_COLUMNS = [
  'item_name',
  'canonical_key',
  'farmrpg_item_id',
  'clientcoin_rating',
  'clientcoin_rating_raw',
  'tower_count',
  'gm_count',
  'mm_count',
  'fish',
  'craft',
  'explore',
  'farm',
  'cook',
  'event',
  'source_sheet',
  'source_row',
  'notes',
] as const;

function validateHeaders(headers: string[]): void {
  const missingColumns = CLIENTCOIN_MASTERY_RATING_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) =>
      !CLIENTCOIN_MASTERY_RATING_COLUMNS.includes(header as (typeof CLIENTCOIN_MASTERY_RATING_COLUMNS)[number]),
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

  throw new Error(`Invalid ClientCoin mastery rating data schema (${details.join('; ')}).`);
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
  const normalizedHeader = header.trim().toLowerCase().replace(/\s+/gu, '_');

  if (normalizedHeader === 'clientcoin_rating_2024') {
    return 'clientcoin_rating';
  }

  return normalizedHeader;
}

function readField(values: string[], headerIndex: Record<string, number>, fieldName: string): string {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function parseRequiredText(value: string, fieldName: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} in ClientCoin mastery rating data.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseClientCoinRating(value: string, itemName: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue === '#NUM!') {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 13) {
    throw new Error(`Invalid ClientCoin rating "${value}" for "${itemName}".`);
  }

  return parsedValue;
}

function parseOptionalCount(value: string, fieldName: string, itemName: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`Invalid ${fieldName} "${value}" for "${itemName}".`);
  }

  return parsedValue;
}

function parseCategoryFlag(value: string, fieldName: string, itemName: string): ClientCoinCategoryFlag {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (['1', 'true', 'yes', 'y', 'x'].includes(normalizedValue)) {
    return true;
  }

  if (['0', 'false', 'no', 'n'].includes(normalizedValue)) {
    return false;
  }

  throw new Error(`Invalid ${fieldName} flag "${value}" for "${itemName}".`);
}

export function parseClientCoinMasteryRatingsCsv(csvText: string): ClientCoinMasteryRatingData {
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
  const entries: ClientCoinMasteryRatingEntry[] = [];
  const byCanonicalKey: Record<string, ClientCoinMasteryRatingEntry> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const itemName = parseRequiredText(readField(values, headerIndex, 'item_name'), 'item_name');
    const expectedCanonicalKey = toCanonicalItemKey(itemName);
    const explicitCanonicalKey = readField(values, headerIndex, 'canonical_key').trim();

    if (explicitCanonicalKey && explicitCanonicalKey !== expectedCanonicalKey) {
      throw new Error(
        `Canonical key mismatch for ClientCoin rating row "${itemName}": expected "${expectedCanonicalKey}" but found "${explicitCanonicalKey}".`,
      );
    }

    const ratingRaw = readField(values, headerIndex, 'clientcoin_rating_raw');

    const entry: ClientCoinMasteryRatingEntry = {
      itemName,
      canonicalKey: explicitCanonicalKey || expectedCanonicalKey,
      farmrpgItemId: parseOptionalText(readField(values, headerIndex, 'farmrpg_item_id')),
      clientcoinRating: parseClientCoinRating(readField(values, headerIndex, 'clientcoin_rating'), itemName),
      clientcoinRatingRaw: parseOptionalText(ratingRaw),
      towerCount: parseOptionalCount(readField(values, headerIndex, 'tower_count'), 'tower_count', itemName),
      gmCount: parseOptionalCount(readField(values, headerIndex, 'gm_count'), 'gm_count', itemName),
      mmCount: parseOptionalCount(readField(values, headerIndex, 'mm_count'), 'mm_count', itemName),
      fish: parseCategoryFlag(readField(values, headerIndex, 'fish'), 'fish', itemName),
      craft: parseCategoryFlag(readField(values, headerIndex, 'craft'), 'craft', itemName),
      explore: parseCategoryFlag(readField(values, headerIndex, 'explore'), 'explore', itemName),
      farm: parseCategoryFlag(readField(values, headerIndex, 'farm'), 'farm', itemName),
      cook: parseCategoryFlag(readField(values, headerIndex, 'cook'), 'cook', itemName),
      event: parseCategoryFlag(readField(values, headerIndex, 'event'), 'event', itemName),
      sourceSheet: parseOptionalText(readField(values, headerIndex, 'source_sheet')),
      sourceRow: parseOptionalText(readField(values, headerIndex, 'source_row')),
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

export function applyClientCoinRatingAliases(
  ratings: ClientCoinMasteryRatingData,
  aliases: ItemAliasData,
): ClientCoinMasteryRatingData {
  const entries = ratings.entries.map((entry) => {
    const resolution = resolveItemAlias(entry.itemName, aliases);

    if (resolution.status === 'direct') {
      return entry;
    }

    return {
      ...entry,
      canonicalKey: resolution.canonicalKey,
    };
  });
  const byCanonicalKey = entries.reduce<Record<string, ClientCoinMasteryRatingEntry>>((indexByKey, entry) => {
    indexByKey[entry.canonicalKey] = entry;
    return indexByKey;
  }, {});

  return {
    entries,
    byCanonicalKey,
  };
}

export async function loadClientCoinMasteryRatings(): Promise<ClientCoinMasteryRatingData> {
  const response = await fetch('/data/clientcoin_mastery_ratings.csv');

  if (!response.ok) {
    throw new Error('Unable to load local ClientCoin mastery rating data.');
  }

  const csvText = await response.text();
  return parseClientCoinMasteryRatingsCsv(csvText);
}
