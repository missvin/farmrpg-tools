import type { LocalItemReferenceLookup } from './localItemReferenceLookup';
import { resolveLocalItemReference } from './localItemReferenceLookup';
import { toCanonicalItemKey } from './normalizeItemKey';

export type PetSourceCoverageStatus = 'partial' | 'reviewed';
export type PetSourceAvailability = 'normal' | 'seasonal';

export type PetSourceReferenceEntry = {
  petName: string;
  petCanonicalKey: string;
  itemName: string;
  itemCanonicalKey: string;
  unlockLevel: number;
  sourceUrl: string;
  pageDataUrl: string;
  petAvailability: PetSourceAvailability;
  coverageStatus: PetSourceCoverageStatus;
  notes: string[];
};

export type PetSourceReferenceData = {
  entries: PetSourceReferenceEntry[];
  byItemCanonicalKey: Record<string, PetSourceReferenceEntry[]>;
  byPetCanonicalKey: Record<string, PetSourceReferenceEntry[]>;
  byPetAndItemKey: Record<string, PetSourceReferenceEntry>;
};

export type PetSourceReferenceLookupIssue = {
  rowIndex: number;
  itemName: string;
  itemCanonicalKey: string;
  code: 'item_unrecognized';
  message: string;
};

export const PET_SOURCE_REFERENCE_COLUMNS = [
  'pet_name',
  'pet_canonical_key',
  'item_name',
  'item_canonical_key',
  'unlock_level',
  'source_url',
  'page_data_url',
  'pet_availability',
  'coverage_status',
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
  const missingColumns = PET_SOURCE_REFERENCE_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !PET_SOURCE_REFERENCE_COLUMNS.includes(header as (typeof PET_SOURCE_REFERENCE_COLUMNS)[number]),
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

  throw new Error(`Invalid pet-source reference schema (${details.join('; ')}).`);
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

function parseRequiredPositiveNumber(value: string, fieldName: string, rowLabel: string): number {
  const parsedValue = Number(value.trim());

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  throw new Error(`Invalid ${fieldName} "${value}" in ${rowLabel}.`);
}

function parseCoverageStatus(value: string, itemName: string): PetSourceCoverageStatus {
  if (value === 'partial' || value === 'reviewed') {
    return value;
  }

  throw new Error(`Invalid coverage_status "${value}" for pet-source item "${itemName}".`);
}

function parsePetAvailability(value: string, itemName: string): PetSourceAvailability {
  if (value === 'normal' || value === 'seasonal') {
    return value;
  }

  throw new Error(`Invalid pet_availability "${value}" for pet-source item "${itemName}".`);
}

function parseList(value: string): string[] {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getPetAndItemKey(petCanonicalKey: string, itemCanonicalKey: string): string {
  return `${petCanonicalKey}:${itemCanonicalKey}`;
}

export function parsePetSourceReferenceCsv(csvText: string): PetSourceReferenceData {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
      byItemCanonicalKey: {},
      byPetCanonicalKey: {},
      byPetAndItemKey: {},
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: PetSourceReferenceEntry[] = [];
  const byItemCanonicalKey: Record<string, PetSourceReferenceEntry[]> = {};
  const byPetCanonicalKey: Record<string, PetSourceReferenceEntry[]> = {};
  const byPetAndItemKey: Record<string, PetSourceReferenceEntry> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const petName = parseRequiredText(readField(values, headerIndex, 'pet_name'), 'pet_name', 'pet-source row');
    const petCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'pet_canonical_key'),
      'pet_canonical_key',
      `pet-source row "${petName}"`,
    );
    const itemName = parseRequiredText(readField(values, headerIndex, 'item_name'), 'item_name', `pet "${petName}"`);
    const itemCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'item_canonical_key'),
      'item_canonical_key',
      `pet-source row "${petName}" -> "${itemName}"`,
    );

    if (petCanonicalKey !== toCanonicalItemKey(petName)) {
      throw new Error(`Pet canonical key mismatch for "${petName}".`);
    }

    if (itemCanonicalKey !== toCanonicalItemKey(itemName)) {
      throw new Error(`Item canonical key mismatch for pet-source item "${itemName}".`);
    }

    const entry: PetSourceReferenceEntry = {
      petName,
      petCanonicalKey,
      itemName,
      itemCanonicalKey,
      unlockLevel: parseRequiredPositiveNumber(
        readField(values, headerIndex, 'unlock_level'),
        'unlock_level',
        `pet-source row "${petName}" -> "${itemName}"`,
      ),
      sourceUrl: parseRequiredText(readField(values, headerIndex, 'source_url'), 'source_url', `pet-source item "${itemName}"`),
      pageDataUrl: parseRequiredText(
        readField(values, headerIndex, 'page_data_url'),
        'page_data_url',
        `pet-source item "${itemName}"`,
      ),
      petAvailability: parsePetAvailability(readField(values, headerIndex, 'pet_availability'), itemName),
      coverageStatus: parseCoverageStatus(readField(values, headerIndex, 'coverage_status'), itemName),
      notes: parseList(readField(values, headerIndex, 'notes')),
    };
    const petAndItemKey = getPetAndItemKey(entry.petCanonicalKey, entry.itemCanonicalKey);

    if (byPetAndItemKey[petAndItemKey]) {
      throw new Error(`Duplicate pet-source row for "${entry.petName}" -> "${entry.itemName}".`);
    }

    entries.push(entry);
    byItemCanonicalKey[entry.itemCanonicalKey] = [...(byItemCanonicalKey[entry.itemCanonicalKey] ?? []), entry];
    byPetCanonicalKey[entry.petCanonicalKey] = [...(byPetCanonicalKey[entry.petCanonicalKey] ?? []), entry];
    byPetAndItemKey[petAndItemKey] = entry;
  }

  return {
    entries,
    byItemCanonicalKey,
    byPetCanonicalKey,
    byPetAndItemKey,
  };
}

export function findPetSourceReference(
  data: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null | undefined,
  petName: string,
  itemCanonicalKey: string,
): PetSourceReferenceEntry | null {
  if (!data) {
    return null;
  }

  return data.byPetAndItemKey[getPetAndItemKey(toCanonicalItemKey(petName), toCanonicalItemKey(itemCanonicalKey))] ?? null;
}

export function validatePetSourceReferenceAgainstLookup(
  petSourceReference: PetSourceReferenceData,
  itemReferenceLookup: LocalItemReferenceLookup,
): PetSourceReferenceLookupIssue[] {
  const issues: PetSourceReferenceLookupIssue[] = [];

  petSourceReference.entries.forEach((entry, index) => {
    const itemResolution = resolveLocalItemReference(entry.itemName, itemReferenceLookup);

    if (!itemResolution.recognized) {
      issues.push({
        rowIndex: index,
        itemName: entry.itemName,
        itemCanonicalKey: entry.itemCanonicalKey,
        code: 'item_unrecognized',
        message: `Pet-source item "${entry.itemName}" is not recognized by the local item reference lookup.`,
      });
    }
  });

  return issues;
}

export async function loadPetSourceReference(): Promise<PetSourceReferenceData> {
  const response = await fetch('/data/pet_source_reference.csv');

  if (!response.ok) {
    throw new Error('Unable to load local pet-source reference data.');
  }

  const csvText = await response.text();
  return parsePetSourceReferenceCsv(csvText);
}
