import { toCanonicalItemKey } from './normalizeItemKey';

export type OpenableContentsQuantityKind = 'fixed' | 'expected';

export type OpenableContentsReferenceEntry = {
  openableItemName: string;
  openableCanonicalKey: string;
  contentItemName: string;
  contentCanonicalKey: string;
  quantityPerOpen: number;
  quantityKind: OpenableContentsQuantityKind;
  evidence: string;
  notes: string[];
};

export type OpenableContentsReferenceData = {
  entries: OpenableContentsReferenceEntry[];
  byOpenableCanonicalKey: Record<string, OpenableContentsReferenceEntry[]>;
  byContentCanonicalKey: Record<string, OpenableContentsReferenceEntry[]>;
};

export const OPENABLE_CONTENTS_REFERENCE_COLUMNS = [
  'openable_item_name',
  'openable_canonical_key',
  'content_item_name',
  'content_canonical_key',
  'quantity_per_open',
  'quantity_kind',
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
  const missingColumns = OPENABLE_CONTENTS_REFERENCE_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !OPENABLE_CONTENTS_REFERENCE_COLUMNS.includes(
      header as (typeof OPENABLE_CONTENTS_REFERENCE_COLUMNS)[number],
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

  throw new Error(`Invalid openable contents reference schema (${details.join('; ')}).`);
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

function parseQuantityKind(value: string, rowLabel: string): OpenableContentsQuantityKind {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'fixed' || normalizedValue === 'expected') {
    return normalizedValue;
  }

  throw new Error(`Invalid quantity_kind "${value}" in ${rowLabel}.`);
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

export function parseOpenableContentsReferenceCsv(csvText: string): OpenableContentsReferenceData {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
      byOpenableCanonicalKey: {},
      byContentCanonicalKey: {},
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: OpenableContentsReferenceEntry[] = [];
  const byOpenableCanonicalKey: Record<string, OpenableContentsReferenceEntry[]> = {};
  const byContentCanonicalKey: Record<string, OpenableContentsReferenceEntry[]> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const openableItemName = parseRequiredText(readField(values, headerIndex, 'openable_item_name'), 'openable_item_name', 'openable row');
    const openableCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'openable_canonical_key'),
      'openable_canonical_key',
      `openable row "${openableItemName}"`,
    );
    const contentItemName = parseRequiredText(
      readField(values, headerIndex, 'content_item_name'),
      'content_item_name',
      `openable row "${openableItemName}"`,
    );
    const contentCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'content_canonical_key'),
      'content_canonical_key',
      `openable row "${openableItemName}" -> "${contentItemName}"`,
    );

    validateCanonicalNameMatch(openableItemName, openableCanonicalKey, `openable "${openableItemName}"`);
    validateCanonicalNameMatch(contentItemName, contentCanonicalKey, `openable content "${contentItemName}"`);

    const entry: OpenableContentsReferenceEntry = {
      openableItemName,
      openableCanonicalKey,
      contentItemName,
      contentCanonicalKey,
      quantityPerOpen: parsePositiveNumber(
        readField(values, headerIndex, 'quantity_per_open'),
        'quantity_per_open',
        `openable row "${openableItemName}" -> "${contentItemName}"`,
      ),
      quantityKind: parseQuantityKind(
        readField(values, headerIndex, 'quantity_kind'),
        `openable row "${openableItemName}" -> "${contentItemName}"`,
      ),
      evidence: parseRequiredText(
        readField(values, headerIndex, 'evidence'),
        'evidence',
        `openable row "${openableItemName}" -> "${contentItemName}"`,
      ),
      notes: parseList(readField(values, headerIndex, 'notes')),
    };

    entries.push(entry);
    byOpenableCanonicalKey[entry.openableCanonicalKey] = [
      ...(byOpenableCanonicalKey[entry.openableCanonicalKey] ?? []),
      entry,
    ];
    byContentCanonicalKey[entry.contentCanonicalKey] = [
      ...(byContentCanonicalKey[entry.contentCanonicalKey] ?? []),
      entry,
    ];
  }

  return {
    entries,
    byOpenableCanonicalKey,
    byContentCanonicalKey,
  };
}

export async function loadOpenableContentsReference(): Promise<OpenableContentsReferenceData> {
  const response = await fetch('/data/openable_contents.csv');

  if (!response.ok) {
    throw new Error('Unable to load local openable contents reference data.');
  }

  const csvText = await response.text();
  return parseOpenableContentsReferenceCsv(csvText);
}
