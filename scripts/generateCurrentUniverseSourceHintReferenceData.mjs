import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(repoRoot, 'probe-output', 'buddy-item-evidence-cache-current-2026-06-04');
const candidatePath = join(evidenceRoot, 'parsed-multi-source', 'fanout', 'source_hint_candidates.csv');
const existingPath = join(repoRoot, 'data', 'quest_item_source_hints.csv');
const outputPath = existingPath;

const QUEST_SOURCE_HINT_COLUMNS = [
  'item_name',
  'canonical_key',
  'source_name',
  'source_canonical_key',
  'source_type',
  'preferred_unit',
  'source_url',
  'notes',
];

const SOURCE_TYPE_OUTPUTS = {
  openable_reverse: {
    sourceType: 'openable',
    preferredUnit: 'openable',
    detailLabel: 'Quantity range',
  },
  wishing_well_reverse: {
    sourceType: 'wishing_well',
    preferredUnit: 'Wishing Well throw',
    detailLabel: 'Reward chance',
  },
};

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

function readExistingSourceHints() {
  return parseCsv(readFileSync(existingPath, 'utf8')).map((row) => {
    const itemName = readRequired(row, 'item_name', 'existing source hint row');
    const sourceName = readRequired(row, 'source_name', `existing source hint for "${itemName}"`);

    return {
      itemName,
      canonicalKey: toCanonicalItemKey(itemName),
      sourceName,
      sourceCanonicalKey: toCanonicalItemKey(sourceName),
      sourceType: readRequired(row, 'source_type', `existing source hint "${itemName}" from "${sourceName}"`),
      preferredUnit: readRequired(row, 'preferred_unit', `existing source hint "${itemName}" from "${sourceName}"`),
      sourceUrl: readRequired(row, 'source_url', `existing source hint "${itemName}" from "${sourceName}"`),
      notes: readOptional(row, 'notes', `existing source hint "${itemName}" from "${sourceName}"`),
    };
  });
}

function buildCandidateNotes(row, rowLabel, output) {
  const detail = readOptional(row, 'detail', rowLabel);
  const flags = readOptional(row, 'flags', rowLabel);
  const candidateNotes = readOptional(row, 'notes', rowLabel)
    .split(';')
    .map((note) => note.trim())
    .filter(Boolean);
  const sourceUrl = readRequired(row, 'source_url', rowLabel);
  const pageDataUrl = readRequired(row, 'page_data_url', rowLabel);
  const cacheFileName = readRequired(row, 'cache_file_name', rowLabel);
  const parserVersion = readRequired(row, 'parser_version', rowLabel);

  return [
    'Promoted as advisory source hint from complete cached Buddy page-data fan-out for BL-263.',
    'Not counted as exact supply by this table.',
    detail ? `${output.detailLabel}: ${detail}` : '',
    flags ? `Candidate flags: ${flags}` : '',
    ...candidateNotes,
    `Source: ${sourceUrl}`,
    `Page data: ${pageDataUrl}`,
    `Cache: ${cacheFileName}`,
    `Parser: ${parserVersion}`,
  ]
    .filter(Boolean)
    .join('; ');
}

const entriesByKey = new Map();

function addEntry(entry) {
  const key = [
    entry.canonicalKey,
    entry.sourceCanonicalKey,
    entry.sourceType,
    entry.preferredUnit,
    entry.sourceUrl,
  ].join('\t');

  if (entriesByKey.has(key)) {
    throw new Error(`Duplicate source hint for "${entry.itemName}" from "${entry.sourceName}".`);
  }

  entriesByKey.set(key, entry);
}

const existingSourceHints = readExistingSourceHints();

for (const entry of existingSourceHints) {
  addEntry(entry);
}

let promotedCandidateRows = 0;
const promotedByType = new Map();

for (const row of parseCsv(readFileSync(candidatePath, 'utf8'))) {
  const sourceType = readRequired(row, 'source_type', 'source hint candidate row');
  const output = SOURCE_TYPE_OUTPUTS[sourceType];

  if (!output) {
    throw new Error(`Unsupported source hint candidate type "${sourceType}".`);
  }

  const itemName = readRequired(row, 'item_name', 'source hint candidate row');
  const sourceName = readRequired(row, 'source_name', `source hint candidate for "${itemName}"`);
  const rowLabel = `source hint row "${itemName}" from "${sourceName}"`;

  addEntry({
    itemName,
    canonicalKey: toCanonicalItemKey(itemName),
    sourceName,
    sourceCanonicalKey: toCanonicalItemKey(sourceName),
    sourceType: output.sourceType,
    preferredUnit: output.preferredUnit,
    sourceUrl: readRequired(row, 'source_url', rowLabel),
    notes: buildCandidateNotes(row, rowLabel, output),
  });
  promotedCandidateRows += 1;
  promotedByType.set(sourceType, (promotedByType.get(sourceType) ?? 0) + 1);
}

const entries = [...entriesByKey.values()].sort((left, right) => {
  return (
    left.itemName.localeCompare(right.itemName) ||
    left.sourceType.localeCompare(right.sourceType) ||
    left.sourceName.localeCompare(right.sourceName) ||
    left.preferredUnit.localeCompare(right.preferredUnit)
  );
});

const csvRows = [
  QUEST_SOURCE_HINT_COLUMNS.join(','),
  ...entries.map((entry) =>
    [
      entry.itemName,
      entry.canonicalKey,
      entry.sourceName,
      entry.sourceCanonicalKey,
      entry.sourceType,
      entry.preferredUnit,
      entry.sourceUrl,
      entry.notes,
    ]
      .map(quoteCsvValue)
      .join(',')),
];

writeFileSync(outputPath, `${csvRows.join('\n')}\n`, 'utf8');

console.log(`Wrote data/quest_item_source_hints.csv with ${entries.length.toLocaleString()} advisory source hints.`);
console.log(`Preserved ${existingSourceHints.length.toLocaleString()} existing reviewed hints.`);
console.log(`Promoted ${promotedCandidateRows.toLocaleString()} candidate hints.`);
for (const [sourceType, count] of [...promotedByType.entries()].sort()) {
  console.log(`Promoted ${count.toLocaleString()} ${sourceType} hints.`);
}
