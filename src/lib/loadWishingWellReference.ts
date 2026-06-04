import { toCanonicalItemKey } from './normalizeItemKey';

export type WishingWellReferenceEntry = {
  thrownItemName: string;
  thrownCanonicalKey: string;
  rewardItemName: string;
  rewardCanonicalKey: string;
  rewardChance: number;
  rewardQuantity: number;
  evidence: string;
  notes: string[];
};

export type WishingWellReferenceData = {
  entries: WishingWellReferenceEntry[];
  byThrownCanonicalKey: Record<string, WishingWellReferenceEntry[]>;
  byRewardCanonicalKey: Record<string, WishingWellReferenceEntry[]>;
};

export const WISHING_WELL_REFERENCE_COLUMNS = [
  'thrown_item_name',
  'thrown_canonical_key',
  'reward_item_name',
  'reward_canonical_key',
  'reward_chance',
  'reward_quantity',
  'evidence',
  'notes',
] as const;

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

function validateHeaders(headers: string[]): void {
  const missingColumns = WISHING_WELL_REFERENCE_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !WISHING_WELL_REFERENCE_COLUMNS.includes(header as (typeof WISHING_WELL_REFERENCE_COLUMNS)[number]),
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

  throw new Error(`Invalid Wishing Well reference schema (${details.join('; ')}).`);
}

function readField(values: string[], headerIndex: Record<string, number>, fieldName: string): string {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function parseRequiredText(value: string, fieldName: string, rowLabel: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} in ${rowLabel}.`);
  }

  return trimmedValue;
}

function parsePositiveNumber(value: string, fieldName: string, rowLabel: string): number {
  const parsedValue = Number(value.trim());

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  throw new Error(`Invalid ${fieldName} "${value}" in ${rowLabel}.`);
}

function parseRewardChance(value: string, fieldName: string, rowLabel: string): number {
  const parsedValue = parsePositiveNumber(value, fieldName, rowLabel);

  if (parsedValue <= 1) {
    return parsedValue;
  }

  throw new Error(`Invalid ${fieldName} "${value}" in ${rowLabel}; chance must be between 0 and 1.`);
}

function parseList(value: string): string[] {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateCanonicalNameMatch(itemName: string, canonicalKey: string, label: string): void {
  const expectedCanonicalKey = toCanonicalItemKey(itemName);

  if (expectedCanonicalKey !== canonicalKey) {
    throw new Error(
      `Canonical key mismatch for ${label}: expected "${expectedCanonicalKey}" from "${itemName}" but found "${canonicalKey}".`,
    );
  }
}

export function parseWishingWellReferenceCsv(csvText: string): WishingWellReferenceData {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
      byThrownCanonicalKey: {},
      byRewardCanonicalKey: {},
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: WishingWellReferenceEntry[] = [];
  const byThrownCanonicalKey: Record<string, WishingWellReferenceEntry[]> = {};
  const byRewardCanonicalKey: Record<string, WishingWellReferenceEntry[]> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const thrownItemName = parseRequiredText(readField(values, headerIndex, 'thrown_item_name'), 'thrown_item_name', 'Wishing Well row');
    const thrownCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'thrown_canonical_key'),
      'thrown_canonical_key',
      `Wishing Well row "${thrownItemName}"`,
    );
    const rewardItemName = parseRequiredText(
      readField(values, headerIndex, 'reward_item_name'),
      'reward_item_name',
      `Wishing Well row "${thrownItemName}"`,
    );
    const rewardCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'reward_canonical_key'),
      'reward_canonical_key',
      `Wishing Well row "${thrownItemName}" -> "${rewardItemName}"`,
    );

    validateCanonicalNameMatch(thrownItemName, thrownCanonicalKey, `Wishing Well thrown item "${thrownItemName}"`);
    validateCanonicalNameMatch(rewardItemName, rewardCanonicalKey, `Wishing Well reward "${rewardItemName}"`);

    const entry: WishingWellReferenceEntry = {
      thrownItemName,
      thrownCanonicalKey,
      rewardItemName,
      rewardCanonicalKey,
      rewardChance: parseRewardChance(
        readField(values, headerIndex, 'reward_chance'),
        'reward_chance',
        `Wishing Well row "${thrownItemName}" -> "${rewardItemName}"`,
      ),
      rewardQuantity: parsePositiveNumber(
        readField(values, headerIndex, 'reward_quantity'),
        'reward_quantity',
        `Wishing Well row "${thrownItemName}" -> "${rewardItemName}"`,
      ),
      evidence: parseRequiredText(
        readField(values, headerIndex, 'evidence'),
        'evidence',
        `Wishing Well row "${thrownItemName}" -> "${rewardItemName}"`,
      ),
      notes: parseList(readField(values, headerIndex, 'notes')),
    };

    entries.push(entry);
    byThrownCanonicalKey[entry.thrownCanonicalKey] = [
      ...(byThrownCanonicalKey[entry.thrownCanonicalKey] ?? []),
      entry,
    ];
    byRewardCanonicalKey[entry.rewardCanonicalKey] = [
      ...(byRewardCanonicalKey[entry.rewardCanonicalKey] ?? []),
      entry,
    ];
  }

  return {
    entries,
    byThrownCanonicalKey,
    byRewardCanonicalKey,
  };
}

export async function loadWishingWellReference(): Promise<WishingWellReferenceData> {
  const response = await fetch('/data/wishing_well_reference.csv');

  if (!response.ok) {
    throw new Error('Unable to load local Wishing Well reference data.');
  }

  const csvText = await response.text();
  return parseWishingWellReferenceCsv(csvText);
}
