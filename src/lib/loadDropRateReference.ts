import type { LocalItemReferenceLookup } from './localItemReferenceLookup';
import { resolveLocalItemReference } from './localItemReferenceLookup';
import { toCanonicalItemKey } from './normalizeItemKey';

export type DropRateReferenceRowKind = 'item_source' | 'location_item' | 'seed_output';
export type DropRateReferenceSourcePageType = 'item' | 'location';
export type DropRateReferenceSourceKind = 'location' | 'seed';

export type DropRateReferenceEntry = {
  targetItemName: string;
  targetCanonicalKey: string;
  sourceName: string;
  sourceCanonicalKey: string;
  sourceType: string;
  sourceKind: DropRateReferenceSourceKind;
  rowKind: DropRateReferenceRowKind;
  rawRate: number;
  baseDropRate: number | null;
  sourcePageType: DropRateReferenceSourcePageType;
  sourcePageName: string;
  sourcePageUrl: string;
  pageDataUrl: string;
  targetItemId: string | null;
  targetItemImage: string | null;
  sourceImage: string | null;
  ironDepot: boolean | null;
  manualFishing: boolean | null;
  runecube: boolean | null;
  flags: string[];
  notes: string[];
};

export type DropRateReferenceData = {
  entries: DropRateReferenceEntry[];
  byTargetCanonicalKey: Record<string, DropRateReferenceEntry[]>;
};

export type DropRateReferenceLookupIssue = {
  rowIndex: number;
  targetItemName: string;
  targetCanonicalKey: string;
  code: 'target_item_unrecognized' | 'seed_source_unrecognized';
  message: string;
};

export const DROP_RATE_REFERENCE_COLUMNS = [
  'target_item_name',
  'target_canonical_key',
  'source_name',
  'source_canonical_key',
  'source_type',
  'source_kind',
  'row_kind',
  'raw_rate',
  'base_drop_rate',
  'source_page_type',
  'source_page_name',
  'source_page_url',
  'page_data_url',
  'target_item_id',
  'target_item_image',
  'source_image',
  'iron_depot',
  'manual_fishing',
  'runecube',
  'flags',
  'notes',
] as const;

const ROW_KINDS = new Set<DropRateReferenceRowKind>(['item_source', 'location_item', 'seed_output']);
const SOURCE_PAGE_TYPES = new Set<DropRateReferenceSourcePageType>(['item', 'location']);
const SOURCE_KINDS = new Set<DropRateReferenceSourceKind>(['location', 'seed']);

function validateHeaders(headers: string[]): void {
  const missingColumns = DROP_RATE_REFERENCE_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !DROP_RATE_REFERENCE_COLUMNS.includes(header as (typeof DROP_RATE_REFERENCE_COLUMNS)[number]),
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

  throw new Error(`Invalid drop-rate reference schema (${details.join('; ')}).`);
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
    throw new Error(`Missing required ${fieldName} in drop-rate reference data.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseOptionalNumber(value: string, fieldName: string, targetItemName: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (Number.isFinite(parsedValue)) {
    return parsedValue;
  }

  throw new Error(`Invalid ${fieldName} "${value}" for drop-rate row "${targetItemName || 'unknown item'}".`);
}

function parseRequiredNumber(value: string, fieldName: string, targetItemName: string): number {
  const parsedValue = parseOptionalNumber(value, fieldName, targetItemName);

  if (parsedValue === null) {
    throw new Error(`Missing required ${fieldName} in drop-rate reference data.`);
  }

  return parsedValue;
}

function parseOptionalBoolean(value: string, fieldName: string, targetItemName: string): boolean | null {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error(`Invalid ${fieldName} "${value}" for drop-rate row "${targetItemName || 'unknown item'}".`);
}

function parseList(value: string): string[] {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseRowKind(value: string, targetItemName: string): DropRateReferenceRowKind {
  const normalizedValue = value.trim() as DropRateReferenceRowKind;

  if (ROW_KINDS.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(`Invalid row_kind "${value}" for drop-rate row "${targetItemName || 'unknown item'}".`);
}

function parseSourcePageType(value: string, targetItemName: string): DropRateReferenceSourcePageType {
  const normalizedValue = value.trim() as DropRateReferenceSourcePageType;

  if (SOURCE_PAGE_TYPES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(`Invalid source_page_type "${value}" for drop-rate row "${targetItemName || 'unknown item'}".`);
}

function parseSourceKind(value: string, targetItemName: string): DropRateReferenceSourceKind {
  const normalizedValue = value.trim() as DropRateReferenceSourceKind;

  if (SOURCE_KINDS.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(`Invalid source_kind "${value}" for drop-rate row "${targetItemName || 'unknown item'}".`);
}

export function parseDropRateReferenceCsv(csvText: string): DropRateReferenceData {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
      byTargetCanonicalKey: {},
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: DropRateReferenceEntry[] = [];
  const byTargetCanonicalKey: Record<string, DropRateReferenceEntry[]> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const targetItemName = parseRequiredText(readField(values, headerIndex, 'target_item_name'), 'target_item_name');
    const targetCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'target_canonical_key'),
      'target_canonical_key',
    );
    const sourceName = parseRequiredText(readField(values, headerIndex, 'source_name'), 'source_name');
    const sourceCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'source_canonical_key'),
      'source_canonical_key',
    );
    const expectedTargetCanonicalKey = toCanonicalItemKey(targetItemName);
    const expectedSourceCanonicalKey = toCanonicalItemKey(sourceName);

    if (targetCanonicalKey !== expectedTargetCanonicalKey) {
      throw new Error(
        `Target canonical key mismatch for drop-rate row "${targetItemName}": expected "${expectedTargetCanonicalKey}" but found "${targetCanonicalKey}".`,
      );
    }

    if (sourceCanonicalKey !== expectedSourceCanonicalKey) {
      throw new Error(
        `Source canonical key mismatch for drop-rate row "${targetItemName}" from "${sourceName}": expected "${expectedSourceCanonicalKey}" but found "${sourceCanonicalKey}".`,
      );
    }

    const entry: DropRateReferenceEntry = {
      targetItemName,
      targetCanonicalKey,
      sourceName,
      sourceCanonicalKey,
      sourceType: parseRequiredText(readField(values, headerIndex, 'source_type'), 'source_type'),
      sourceKind: parseSourceKind(readField(values, headerIndex, 'source_kind'), targetItemName),
      rowKind: parseRowKind(readField(values, headerIndex, 'row_kind'), targetItemName),
      rawRate: parseRequiredNumber(readField(values, headerIndex, 'raw_rate'), 'raw_rate', targetItemName),
      baseDropRate: parseOptionalNumber(readField(values, headerIndex, 'base_drop_rate'), 'base_drop_rate', targetItemName),
      sourcePageType: parseSourcePageType(readField(values, headerIndex, 'source_page_type'), targetItemName),
      sourcePageName: parseRequiredText(readField(values, headerIndex, 'source_page_name'), 'source_page_name'),
      sourcePageUrl: parseRequiredText(readField(values, headerIndex, 'source_page_url'), 'source_page_url'),
      pageDataUrl: parseRequiredText(readField(values, headerIndex, 'page_data_url'), 'page_data_url'),
      targetItemId: parseOptionalText(readField(values, headerIndex, 'target_item_id')),
      targetItemImage: parseOptionalText(readField(values, headerIndex, 'target_item_image')),
      sourceImage: parseOptionalText(readField(values, headerIndex, 'source_image')),
      ironDepot: parseOptionalBoolean(readField(values, headerIndex, 'iron_depot'), 'iron_depot', targetItemName),
      manualFishing: parseOptionalBoolean(
        readField(values, headerIndex, 'manual_fishing'),
        'manual_fishing',
        targetItemName,
      ),
      runecube: parseOptionalBoolean(readField(values, headerIndex, 'runecube'), 'runecube', targetItemName),
      flags: parseList(readField(values, headerIndex, 'flags')),
      notes: parseList(readField(values, headerIndex, 'notes')),
    };

    entries.push(entry);
    byTargetCanonicalKey[entry.targetCanonicalKey] = [...(byTargetCanonicalKey[entry.targetCanonicalKey] ?? []), entry];
  }

  return {
    entries,
    byTargetCanonicalKey,
  };
}

export function validateDropRateReferenceAgainstLookup(
  dropRateReference: DropRateReferenceData,
  itemReferenceLookup: LocalItemReferenceLookup,
): DropRateReferenceLookupIssue[] {
  const issues: DropRateReferenceLookupIssue[] = [];

  dropRateReference.entries.forEach((entry, index) => {
    const targetResolution = resolveLocalItemReference(entry.targetItemName, itemReferenceLookup);

    if (!targetResolution.recognized) {
      issues.push({
        rowIndex: index,
        targetItemName: entry.targetItemName,
        targetCanonicalKey: entry.targetCanonicalKey,
        code: 'target_item_unrecognized',
        message: `Drop-rate target "${entry.targetItemName}" is not recognized by the local item reference lookup.`,
      });
    }

    if (entry.sourceKind === 'seed') {
      const seedResolution = resolveLocalItemReference(entry.sourceName, itemReferenceLookup);

      if (!seedResolution.recognized) {
        issues.push({
          rowIndex: index,
          targetItemName: entry.targetItemName,
          targetCanonicalKey: entry.targetCanonicalKey,
          code: 'seed_source_unrecognized',
          message: `Drop-rate seed source "${entry.sourceName}" is not recognized by the local item reference lookup.`,
        });
      }
    }
  });

  return issues;
}

export async function loadDropRateReference(): Promise<DropRateReferenceData> {
  const response = await fetch('/data/drop_rate_reference.csv');

  if (!response.ok) {
    throw new Error('Unable to load local drop-rate reference data.');
  }

  const csvText = await response.text();
  return parseDropRateReferenceCsv(csvText);
}
