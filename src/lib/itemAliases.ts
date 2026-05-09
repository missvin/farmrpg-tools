import type { ItemCatalogData } from './loadItemCatalog';
import { toCanonicalItemKey } from './normalizeItemKey';

export type ItemAliasReviewStatus = 'approved' | 'rejected' | 'needs_review';

export type ItemAliasEntry = {
  aliasName: string;
  aliasKey: string;
  canonicalItemName: string;
  canonicalKey: string;
  reviewStatus: ItemAliasReviewStatus;
  source: string;
  notes: string | null;
};

export type ItemAliasData = {
  entries: ItemAliasEntry[];
  byAliasKey: Record<string, ItemAliasEntry>;
  approvedByAliasKey: Record<string, ItemAliasEntry>;
};

export type ItemAliasResolution = {
  inputName: string;
  inputKey: string;
  canonicalKey: string;
  matchedAlias: ItemAliasEntry | null;
  status: 'direct' | 'alias';
};

export type ItemAliasCatalogValidationIssue = {
  aliasName: string;
  aliasKey: string;
  canonicalKey: string;
  code: 'canonical_not_in_catalog' | 'alias_conflicts_with_catalog';
  message: string;
};

export type ItemAliasReviewCandidate = {
  observedItemName: string;
  suggestedCanonicalItemName?: string | null;
  source: string;
  reason: string;
  notes?: string | null;
};

export const ITEM_ALIAS_COLUMNS = [
  'alias_name',
  'alias_key',
  'canonical_item_name',
  'canonical_key',
  'review_status',
  'source',
  'notes',
] as const;

const REVIEW_STATUSES = new Set<ItemAliasReviewStatus>(['approved', 'rejected', 'needs_review']);

function validateHeaders(headers: string[]): void {
  const missingColumns = ITEM_ALIAS_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !ITEM_ALIAS_COLUMNS.includes(header as (typeof ITEM_ALIAS_COLUMNS)[number]),
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

  throw new Error(`Invalid item alias schema (${details.join('; ')}).`);
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

function escapeCsvValue(value: string): string {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
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
    throw new Error(`Missing required ${fieldName} in item alias data.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseReviewStatus(value: string, aliasName: string): ItemAliasReviewStatus {
  const normalizedValue = value.trim() as ItemAliasReviewStatus;

  if (REVIEW_STATUSES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(`Invalid review_status "${value}" for item alias row "${aliasName || 'unknown alias'}".`);
}

export function parseItemAliasesCsv(csvText: string): ItemAliasData {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
      byAliasKey: {},
      approvedByAliasKey: {},
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: ItemAliasEntry[] = [];
  const byAliasKey: Record<string, ItemAliasEntry> = {};
  const approvedByAliasKey: Record<string, ItemAliasEntry> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const aliasName = parseRequiredText(readField(values, headerIndex, 'alias_name'), 'alias_name');
    const aliasKey = parseRequiredText(readField(values, headerIndex, 'alias_key'), 'alias_key');
    const canonicalItemName = parseRequiredText(
      readField(values, headerIndex, 'canonical_item_name'),
      'canonical_item_name',
    );
    const canonicalKey = parseRequiredText(readField(values, headerIndex, 'canonical_key'), 'canonical_key');
    const expectedAliasKey = toCanonicalItemKey(aliasName);
    const expectedCanonicalKey = toCanonicalItemKey(canonicalItemName);

    if (aliasKey !== expectedAliasKey) {
      throw new Error(
        `Alias key mismatch for item alias row "${aliasName}": expected "${expectedAliasKey}" but found "${aliasKey}".`,
      );
    }

    if (canonicalKey !== expectedCanonicalKey) {
      throw new Error(
        `Canonical key mismatch for item alias row "${aliasName}": expected "${expectedCanonicalKey}" but found "${canonicalKey}".`,
      );
    }

    if (aliasKey === canonicalKey) {
      throw new Error(`Item alias row "${aliasName}" maps an item to itself.`);
    }

    if (byAliasKey[aliasKey]) {
      throw new Error(`Duplicate item alias row for alias key "${aliasKey}".`);
    }

    const entry: ItemAliasEntry = {
      aliasName,
      aliasKey,
      canonicalItemName,
      canonicalKey,
      reviewStatus: parseReviewStatus(readField(values, headerIndex, 'review_status'), aliasName),
      source: parseRequiredText(readField(values, headerIndex, 'source'), 'source'),
      notes: parseOptionalText(readField(values, headerIndex, 'notes')),
    };

    entries.push(entry);
    byAliasKey[entry.aliasKey] = entry;

    if (entry.reviewStatus === 'approved') {
      approvedByAliasKey[entry.aliasKey] = entry;
    }
  }

  return {
    entries,
    byAliasKey,
    approvedByAliasKey,
  };
}

export function resolveItemAlias(inputName: string, aliases: ItemAliasData): ItemAliasResolution {
  const inputKey = toCanonicalItemKey(inputName);
  const matchedAlias = aliases.approvedByAliasKey[inputKey] ?? null;

  if (!matchedAlias) {
    return {
      inputName,
      inputKey,
      canonicalKey: inputKey,
      matchedAlias: null,
      status: 'direct',
    };
  }

  return {
    inputName,
    inputKey,
    canonicalKey: matchedAlias.canonicalKey,
    matchedAlias,
    status: 'alias',
  };
}

export function validateItemAliasesAgainstCatalog(
  aliases: ItemAliasData,
  itemCatalog: ItemCatalogData,
): ItemAliasCatalogValidationIssue[] {
  const issues: ItemAliasCatalogValidationIssue[] = [];

  for (const entry of aliases.entries) {
    if (!itemCatalog.byCanonicalKey[entry.canonicalKey]) {
      issues.push({
        aliasName: entry.aliasName,
        aliasKey: entry.aliasKey,
        canonicalKey: entry.canonicalKey,
        code: 'canonical_not_in_catalog',
        message: `Alias "${entry.aliasName}" maps to "${entry.canonicalItemName}", which is not in the local item catalog.`,
      });
    }

    if (itemCatalog.byCanonicalKey[entry.aliasKey]) {
      issues.push({
        aliasName: entry.aliasName,
        aliasKey: entry.aliasKey,
        canonicalKey: entry.canonicalKey,
        code: 'alias_conflicts_with_catalog',
        message: `Alias "${entry.aliasName}" is already a canonical item catalog key and should be reviewed before remapping.`,
      });
    }
  }

  return issues;
}

export function toItemAliasReviewCsv(candidates: ItemAliasReviewCandidate[], aliases: ItemAliasData): string {
  const rows = [
    'observed_item_name,observed_alias_key,suggested_canonical_item_name,suggested_canonical_key,existing_alias_status,source,reason,notes',
  ];

  for (const candidate of candidates) {
    const observedAliasKey = toCanonicalItemKey(candidate.observedItemName);
    const suggestedCanonicalItemName = candidate.suggestedCanonicalItemName?.trim() ?? '';
    const suggestedCanonicalKey = suggestedCanonicalItemName ? toCanonicalItemKey(suggestedCanonicalItemName) : '';
    const existingAlias = aliases.byAliasKey[observedAliasKey] ?? null;
    const existingAliasStatus = existingAlias ? existingAlias.reviewStatus : 'needs_review';

    rows.push(
      [
        candidate.observedItemName,
        observedAliasKey,
        suggestedCanonicalItemName,
        suggestedCanonicalKey,
        existingAliasStatus,
        candidate.source,
        candidate.reason,
        candidate.notes ?? '',
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export async function loadItemAliases(): Promise<ItemAliasData> {
  const response = await fetch('/data/item_aliases.csv');

  if (!response.ok) {
    throw new Error('Unable to load local item alias data.');
  }

  const csvText = await response.text();
  return parseItemAliasesCsv(csvText);
}
