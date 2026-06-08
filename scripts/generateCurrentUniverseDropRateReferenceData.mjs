import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(repoRoot, 'probe-output', 'buddy-item-evidence-cache-current-2026-06-04');
const candidatePath = join(evidenceRoot, 'parsed-multi-source', 'fanout', 'drop_rate_reference_candidates.csv');
const outputPath = join(repoRoot, 'data', 'drop_rate_reference.csv');

const DROP_RATE_REFERENCE_COLUMNS = [
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
];

const ROW_KINDS = new Set(['item_source', 'location_item', 'seed_output']);
const SOURCE_KINDS = new Set(['location', 'seed']);
const SOURCE_PAGE_TYPES = new Set(['item', 'location']);

function parseCsvRow(line) {
  const values = [];
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

function parseCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.trim().toLowerCase());
  const headerIndex = headers.reduce((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);

    return {
      get(fieldName) {
        const index = headerIndex[fieldName];
        return index === undefined ? '' : values[index] ?? '';
      },
    };
  });
}

function quoteCsvValue(value) {
  const stringValue = String(value ?? '');

  if (!/[",\r\n]/u.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/gu, '""')}"`;
}

function toCanonicalItemKey(input) {
  return input
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/gu, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

function readText(row, fieldName) {
  return row.get(fieldName).trim();
}

function assertScalar(value, fieldName, rowLabel) {
  if (/[\r\n]/u.test(value)) {
    throw new Error(`Embedded newline in ${fieldName} for ${rowLabel}.`);
  }
}

function readRequired(row, fieldName, rowLabel) {
  const value = readText(row, fieldName);

  if (!value) {
    throw new Error(`Missing ${fieldName} in ${rowLabel}.`);
  }

  assertScalar(value, fieldName, rowLabel);
  return value;
}

function readOptional(row, fieldName, rowLabel) {
  const value = readText(row, fieldName);
  assertScalar(value, fieldName, rowLabel);
  return value;
}

function readRequiredNumber(row, fieldName, rowLabel) {
  const rawValue = readRequired(row, fieldName, rowLabel);
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${fieldName} "${rawValue}" in ${rowLabel}; expected a positive finite number.`);
  }

  return rawValue;
}

function readOptionalNumber(row, fieldName, rowLabel) {
  const rawValue = readOptional(row, fieldName, rowLabel);

  if (!rawValue) {
    return '';
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${fieldName} "${rawValue}" in ${rowLabel}; expected a positive finite number.`);
  }

  return rawValue;
}

function readOptionalBoolean(row, fieldName, rowLabel) {
  const value = readOptional(row, fieldName, rowLabel);

  if (!value || value === 'true' || value === 'false') {
    return value;
  }

  throw new Error(`Invalid ${fieldName} "${value}" in ${rowLabel}; expected true, false, or blank.`);
}

function readEnum(row, fieldName, allowedValues, rowLabel) {
  const value = readRequired(row, fieldName, rowLabel);

  if (!allowedValues.has(value)) {
    throw new Error(`Invalid ${fieldName} "${value}" in ${rowLabel}.`);
  }

  return value;
}

function buildNotes(row, rowLabel) {
  const candidateNotes = readOptional(row, 'notes', rowLabel)
    .split(';')
    .map((note) => note.trim())
    .filter(Boolean);
  const sourcePageUrl = readRequired(row, 'source_page_url', rowLabel);
  const pageDataUrl = readRequired(row, 'page_data_url', rowLabel);
  const cacheFileName = readRequired(row, 'cache_file_name', rowLabel);
  const parserVersion = readRequired(row, 'parser_version', rowLabel);

  return [
    'Promoted from complete cached Buddy page-data fan-out for BL-260.',
    ...candidateNotes,
    `Source: ${sourcePageUrl}`,
    `Page data: ${pageDataUrl}`,
    `Cache: ${cacheFileName}`,
    `Parser: ${parserVersion}`,
  ].join('; ');
}

const entriesByKey = new Map();
let skippedFlaggedRows = 0;

for (const row of parseCsv(readFileSync(candidatePath, 'utf8'))) {
  const targetItemName = readRequired(row, 'target_item_name', 'drop-rate candidate row');
  const sourceName = readRequired(row, 'source_name', `drop-rate candidate for "${targetItemName}"`);
  const rowLabel = `drop-rate row "${targetItemName}" from "${sourceName}"`;
  const flags = readOptional(row, 'flags', rowLabel);

  if (flags) {
    skippedFlaggedRows += 1;
    continue;
  }

  const entry = {
    targetItemName,
    targetCanonicalKey: toCanonicalItemKey(targetItemName),
    sourceName,
    sourceCanonicalKey: toCanonicalItemKey(sourceName),
    sourceType: readRequired(row, 'source_type', rowLabel),
    sourceKind: readEnum(row, 'source_kind', SOURCE_KINDS, rowLabel),
    rowKind: readEnum(row, 'row_kind', ROW_KINDS, rowLabel),
    rawRate: readRequiredNumber(row, 'raw_rate', rowLabel),
    baseDropRate: readOptionalNumber(row, 'base_drop_rate', rowLabel),
    sourcePageType: readEnum(row, 'source_page_type', SOURCE_PAGE_TYPES, rowLabel),
    sourcePageName: readRequired(row, 'source_page_name', rowLabel),
    sourcePageUrl: readRequired(row, 'source_page_url', rowLabel),
    pageDataUrl: readRequired(row, 'page_data_url', rowLabel),
    targetItemId: readOptional(row, 'target_item_id', rowLabel),
    targetItemImage: readOptional(row, 'target_item_image', rowLabel),
    sourceImage: readOptional(row, 'source_image', rowLabel),
    ironDepot: readOptionalBoolean(row, 'iron_depot', rowLabel),
    manualFishing: readOptionalBoolean(row, 'manual_fishing', rowLabel),
    runecube: readOptionalBoolean(row, 'runecube', rowLabel),
    flags,
    notes: buildNotes(row, rowLabel),
  };
  const key = [
    entry.targetCanonicalKey,
    entry.sourceCanonicalKey,
    entry.sourceType,
    entry.sourceKind,
    entry.rowKind,
    entry.rawRate,
    entry.baseDropRate,
    entry.ironDepot,
    entry.manualFishing,
    entry.runecube,
    entry.sourcePageUrl,
  ].join('\t');

  if (entriesByKey.has(key)) {
    throw new Error(`Duplicate ${rowLabel} for canonical drop-rate key "${key}".`);
  }

  entriesByKey.set(key, entry);
}

const entries = [...entriesByKey.values()].sort((left, right) => {
  const targetComparison = left.targetItemName.localeCompare(right.targetItemName);

  if (targetComparison !== 0) {
    return targetComparison;
  }

  const sourceComparison = left.sourceName.localeCompare(right.sourceName);

  if (sourceComparison !== 0) {
    return sourceComparison;
  }

  return Number(left.rawRate) - Number(right.rawRate);
});

const csvRows = [
  DROP_RATE_REFERENCE_COLUMNS.join(','),
  ...entries.map((entry) =>
    [
      entry.targetItemName,
      entry.targetCanonicalKey,
      entry.sourceName,
      entry.sourceCanonicalKey,
      entry.sourceType,
      entry.sourceKind,
      entry.rowKind,
      entry.rawRate,
      entry.baseDropRate,
      entry.sourcePageType,
      entry.sourcePageName,
      entry.sourcePageUrl,
      entry.pageDataUrl,
      entry.targetItemId,
      entry.targetItemImage,
      entry.sourceImage,
      entry.ironDepot,
      entry.manualFishing,
      entry.runecube,
      entry.flags,
      entry.notes,
    ]
      .map(quoteCsvValue)
      .join(',')),
];

writeFileSync(outputPath, `${csvRows.join('\n')}\n`, 'utf8');

console.log(`Wrote data/drop_rate_reference.csv with ${entries.length.toLocaleString()} reviewed drop-rate rows.`);
console.log(`Skipped ${skippedFlaggedRows.toLocaleString()} flagged candidate rows.`);
