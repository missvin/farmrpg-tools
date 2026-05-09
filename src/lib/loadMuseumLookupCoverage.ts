import { toCanonicalItemKey } from './normalizeItemKey';

export type MuseumLookupPlanningReferenceStatus =
  | 'matched_local'
  | 'museum_only_icon_ready'
  | 'missing_planning_reference'
  | 'likely_name_mismatch'
  | 'truly_unresolved';

export type MuseumLookupIconReadyCoverageStatus =
  | 'maintained_local'
  | 'derived_ready'
  | 'reviewed_candidate'
  | 'not_ready';

export type MuseumLookupCandidateReviewStatus = 'not_needed' | 'review_needed' | 'reviewed';

export type MuseumLookupUnresolvedCaseType =
  | 'likely_name_mismatch'
  | 'collision_or_ambiguity'
  | 'slug_edge_case'
  | 'likely_new_item'
  | 'missing_planning_reference';

export type MuseumLookupCoverageEntry = {
  itemName: string;
  canonicalKey: string;
  museumCategory: string;
  category: string;
  obtainable: boolean;
  generatedBuddySlug: string | null;
  alternateBuddySlug: string | null;
  planningReferenceStatus: MuseumLookupPlanningReferenceStatus;
  iconReadyCoverageStatus: MuseumLookupIconReadyCoverageStatus;
  candidateReviewStatus: MuseumLookupCandidateReviewStatus;
  unresolvedCaseType: MuseumLookupUnresolvedCaseType | null;
  sourceWorkflow: string;
  notes: string | null;
};

export type MuseumLookupCoverageData = {
  entries: MuseumLookupCoverageEntry[];
  byCanonicalKey: Record<string, MuseumLookupCoverageEntry>;
};

export const MUSEUM_LOOKUP_COVERAGE_COLUMNS = [
  'item_name',
  'canonical_key',
  'museum_category',
  'category',
  'obtainable',
  'generated_buddy_slug',
  'alternate_buddy_slug',
  'planning_reference_status',
  'icon_ready_coverage_status',
  'candidate_review_status',
  'unresolved_case_type',
  'source_workflow',
  'notes',
] as const;

const PLANNING_REFERENCE_STATUSES = new Set<MuseumLookupPlanningReferenceStatus>([
  'matched_local',
  'museum_only_icon_ready',
  'missing_planning_reference',
  'likely_name_mismatch',
  'truly_unresolved',
]);

const ICON_READY_COVERAGE_STATUSES = new Set<MuseumLookupIconReadyCoverageStatus>([
  'maintained_local',
  'derived_ready',
  'reviewed_candidate',
  'not_ready',
]);

const CANDIDATE_REVIEW_STATUSES = new Set<MuseumLookupCandidateReviewStatus>([
  'not_needed',
  'review_needed',
  'reviewed',
]);

const UNRESOLVED_CASE_TYPES = new Set<MuseumLookupUnresolvedCaseType>([
  'likely_name_mismatch',
  'collision_or_ambiguity',
  'slug_edge_case',
  'likely_new_item',
  'missing_planning_reference',
]);

function validateHeaders(headers: string[]): void {
  const missingColumns = MUSEUM_LOOKUP_COVERAGE_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !MUSEUM_LOOKUP_COVERAGE_COLUMNS.includes(header as (typeof MUSEUM_LOOKUP_COVERAGE_COLUMNS)[number]),
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

  throw new Error(`Invalid museum lookup coverage schema (${details.join('; ')}).`);
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
    throw new Error(`Missing required ${fieldName} in museum lookup coverage.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseBooleanFlag(value: string, itemName: string): boolean {
  const normalizedValue = value.trim().toUpperCase();

  if (normalizedValue === 'Y') {
    return true;
  }

  if (normalizedValue === 'N') {
    return false;
  }

  throw new Error(`Invalid obtainable "${value}" for museum lookup coverage row "${itemName || 'unknown item'}".`);
}

function parsePlanningReferenceStatus(value: string, itemName: string): MuseumLookupPlanningReferenceStatus {
  const normalizedValue = value.trim() as MuseumLookupPlanningReferenceStatus;

  if (PLANNING_REFERENCE_STATUSES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(
    `Invalid planning_reference_status "${value}" for museum lookup coverage row "${itemName || 'unknown item'}".`,
  );
}

function parseIconReadyCoverageStatus(value: string, itemName: string): MuseumLookupIconReadyCoverageStatus {
  const normalizedValue = value.trim() as MuseumLookupIconReadyCoverageStatus;

  if (ICON_READY_COVERAGE_STATUSES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(
    `Invalid icon_ready_coverage_status "${value}" for museum lookup coverage row "${itemName || 'unknown item'}".`,
  );
}

function parseCandidateReviewStatus(value: string, itemName: string): MuseumLookupCandidateReviewStatus {
  const normalizedValue = value.trim() as MuseumLookupCandidateReviewStatus;

  if (CANDIDATE_REVIEW_STATUSES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(
    `Invalid candidate_review_status "${value}" for museum lookup coverage row "${itemName || 'unknown item'}".`,
  );
}

function parseUnresolvedCaseType(value: string, itemName: string): MuseumLookupUnresolvedCaseType | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = trimmedValue as MuseumLookupUnresolvedCaseType;

  if (UNRESOLVED_CASE_TYPES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(
    `Invalid unresolved_case_type "${value}" for museum lookup coverage row "${itemName || 'unknown item'}".`,
  );
}

export function parseMuseumLookupCoverageCsv(csvText: string): MuseumLookupCoverageData {
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
  const entries: MuseumLookupCoverageEntry[] = [];
  const byCanonicalKey: Record<string, MuseumLookupCoverageEntry> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const itemName = parseRequiredText(readField(values, headerIndex, 'item_name'), 'item_name');
    const canonicalKey = parseRequiredText(readField(values, headerIndex, 'canonical_key'), 'canonical_key');
    const expectedCanonicalKey = toCanonicalItemKey(itemName);

    if (canonicalKey !== expectedCanonicalKey) {
      throw new Error(
        `Canonical key mismatch for museum lookup coverage row "${itemName}": expected "${expectedCanonicalKey}" but found "${canonicalKey}".`,
      );
    }

    if (byCanonicalKey[canonicalKey]) {
      throw new Error(`Duplicate museum lookup coverage row for canonical key "${canonicalKey}".`);
    }

    const entry: MuseumLookupCoverageEntry = {
      itemName,
      canonicalKey,
      museumCategory: parseRequiredText(readField(values, headerIndex, 'museum_category'), 'museum_category'),
      category: parseRequiredText(readField(values, headerIndex, 'category'), 'category'),
      obtainable: parseBooleanFlag(readField(values, headerIndex, 'obtainable'), itemName),
      generatedBuddySlug: parseOptionalText(readField(values, headerIndex, 'generated_buddy_slug')),
      alternateBuddySlug: parseOptionalText(readField(values, headerIndex, 'alternate_buddy_slug')),
      planningReferenceStatus: parsePlanningReferenceStatus(
        readField(values, headerIndex, 'planning_reference_status'),
        itemName,
      ),
      iconReadyCoverageStatus: parseIconReadyCoverageStatus(
        readField(values, headerIndex, 'icon_ready_coverage_status'),
        itemName,
      ),
      candidateReviewStatus: parseCandidateReviewStatus(
        readField(values, headerIndex, 'candidate_review_status'),
        itemName,
      ),
      unresolvedCaseType: parseUnresolvedCaseType(readField(values, headerIndex, 'unresolved_case_type'), itemName),
      sourceWorkflow: parseRequiredText(readField(values, headerIndex, 'source_workflow'), 'source_workflow'),
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

export async function loadMuseumLookupCoverage(): Promise<MuseumLookupCoverageData> {
  const response = await fetch('/data/museum_lookup_coverage.csv');

  if (!response.ok) {
    throw new Error('Unable to load local museum lookup coverage data.');
  }

  const csvText = await response.text();
  return parseMuseumLookupCoverageCsv(csvText);
}
