import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(repoRoot, 'probe-output', 'buddy-item-evidence-cache-current-2026-06-04');
const summaryPath = join(evidenceRoot, 'parsed-multi-source', 'buddy_item_multi_source_summary.csv');
const catalogPath = join(repoRoot, 'data', 'item_catalog.csv');
const aliasPath = join(repoRoot, 'data', 'item_aliases.csv');

const ITEM_ALIAS_COLUMNS = [
  'alias_name',
  'alias_key',
  'canonical_item_name',
  'canonical_key',
  'review_status',
  'source',
  'notes',
];

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

function readRequired(row, fieldName, rowLabel) {
  const value = readText(row, fieldName);

  if (!value) {
    throw new Error(`Missing ${fieldName} in ${rowLabel}.`);
  }

  if (/[\r\n]/u.test(value)) {
    throw new Error(`Embedded newline in ${fieldName} for ${rowLabel}.`);
  }

  return value;
}

function readOptional(row, fieldName, rowLabel) {
  const value = readText(row, fieldName);

  if (/[\r\n]/u.test(value)) {
    throw new Error(`Embedded newline in ${fieldName} for ${rowLabel}.`);
  }

  return value;
}

function toAliasDisplayName(aliasKey) {
  return aliasKey
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (/^\d+$/u.test(word)) {
        return word;
      }

      return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

function readCatalogRows() {
  return parseCsv(readFileSync(catalogPath, 'utf8')).map((row) => {
    const itemName = readRequired(row, 'item_name', 'item catalog row');

    return {
      itemName,
      canonicalKey: readRequired(row, 'canonical_key', `item catalog row "${itemName}"`),
    };
  });
}

function readExistingAliasRows() {
  return parseCsv(readFileSync(aliasPath, 'utf8')).map((row) => {
    const aliasName = readRequired(row, 'alias_name', 'existing alias row');
    const canonicalItemName = readRequired(row, 'canonical_item_name', `existing alias "${aliasName}"`);

    return {
      aliasName,
      aliasKey: readRequired(row, 'alias_key', `existing alias "${aliasName}"`),
      canonicalItemName,
      canonicalKey: readRequired(row, 'canonical_key', `existing alias "${aliasName}"`),
      reviewStatus: readRequired(row, 'review_status', `existing alias "${aliasName}"`),
      source: readRequired(row, 'source', `existing alias "${aliasName}"`),
      notes: readOptional(row, 'notes', `existing alias "${aliasName}"`),
    };
  });
}

function buildCandidateRows(catalogRows) {
  const catalogByName = new Map(catalogRows.map((row) => [row.itemName, row]));
  const catalogByKey = new Map(catalogRows.map((row) => [row.canonicalKey, row]));
  const summaryRows = parseCsv(readFileSync(summaryPath, 'utf8'));
  const candidates = [];
  let skippedConflicts = 0;

  for (const row of summaryRows) {
    const itemName = readRequired(row, 'item_name', 'Buddy summary row');
    const catalogRow = catalogByName.get(itemName);

    if (!catalogRow) {
      continue;
    }

    const parserCanonicalKey = readRequired(row, 'canonical_key', `Buddy summary row "${itemName}"`);

    if (parserCanonicalKey === catalogRow.canonicalKey) {
      continue;
    }

    if (catalogByKey.has(parserCanonicalKey)) {
      skippedConflicts += 1;
      continue;
    }

    const buddyUrl = readRequired(row, 'buddy_url', `Buddy summary row "${itemName}"`);
    const pageDataUrl = readRequired(row, 'page_data_url', `Buddy summary row "${itemName}"`);
    const cacheFileName = readRequired(row, 'cache_file_name', `Buddy summary row "${itemName}"`);

    candidates.push({
      aliasName: toAliasDisplayName(parserCanonicalKey),
      aliasKey: parserCanonicalKey,
      canonicalItemName: itemName,
      canonicalKey: catalogRow.canonicalKey,
      reviewStatus: 'approved',
      source: 'BL-253/BL-246 current Buddy evidence cache',
      notes: [
        'Approved BL-264 source-system alias from complete cached Buddy parser output.',
        'Preserves app canonical identity while recognizing punctuation-stripped Buddy/source keys.',
        `Source: ${buddyUrl}`,
        `Page data: ${pageDataUrl}`,
        `Cache: ${cacheFileName}`,
      ].join('; '),
    });
  }

  return { candidates, skippedConflicts };
}

function validateAliasRows(rows, catalogRows) {
  const catalogKeys = new Set(catalogRows.map((row) => row.canonicalKey));
  const aliasKeys = new Set();

  for (const row of rows) {
    const rowLabel = `alias "${row.aliasName}"`;

    for (const [fieldName, value] of Object.entries(row)) {
      if (/[\r\n]/u.test(String(value ?? ''))) {
        throw new Error(`Embedded newline in ${fieldName} for ${rowLabel}.`);
      }
    }

    if (row.aliasKey !== toCanonicalItemKey(row.aliasName)) {
      throw new Error(`Alias key mismatch for ${rowLabel}.`);
    }

    if (row.canonicalKey !== toCanonicalItemKey(row.canonicalItemName)) {
      throw new Error(`Canonical key mismatch for ${rowLabel}.`);
    }

    if (row.aliasKey === row.canonicalKey) {
      throw new Error(`${rowLabel} maps an item to itself.`);
    }

    if (aliasKeys.has(row.aliasKey)) {
      throw new Error(`Duplicate alias key "${row.aliasKey}".`);
    }

    if (!catalogKeys.has(row.canonicalKey)) {
      throw new Error(`${rowLabel} maps to missing catalog key "${row.canonicalKey}".`);
    }

    if (catalogKeys.has(row.aliasKey)) {
      throw new Error(`${rowLabel} conflicts with existing catalog key "${row.aliasKey}".`);
    }

    aliasKeys.add(row.aliasKey);
  }
}

function writeAliasRows(rows) {
  const csvRows = [
    ITEM_ALIAS_COLUMNS.join(','),
    ...rows.map((row) =>
      [
        row.aliasName,
        row.aliasKey,
        row.canonicalItemName,
        row.canonicalKey,
        row.reviewStatus,
        row.source,
        row.notes,
      ]
        .map(quoteCsvValue)
        .join(','),
    ),
  ];

  writeFileSync(aliasPath, `${csvRows.join('\n')}\n`);
}

const catalogRows = readCatalogRows();
const existingRows = readExistingAliasRows();
const { candidates, skippedConflicts } = buildCandidateRows(catalogRows);
const existingAliasKeys = new Set(existingRows.map((row) => row.aliasKey));
const newRows = candidates.filter((row) => !existingAliasKeys.has(row.aliasKey));
const outputRows = [...existingRows, ...newRows].sort((left, right) => {
  const canonicalCompare = left.canonicalItemName.localeCompare(right.canonicalItemName);

  if (canonicalCompare !== 0) {
    return canonicalCompare;
  }

  return left.aliasName.localeCompare(right.aliasName);
});

validateAliasRows(outputRows, catalogRows);
writeAliasRows(outputRows);

console.log(`Wrote ${aliasPath} with ${outputRows.length} approved alias rows.`);
console.log(`Preserved ${existingRows.length} existing alias row${existingRows.length === 1 ? '' : 's'}.`);
console.log(`Promoted ${newRows.length} current-universe source-system alias rows.`);
console.log(`Skipped ${skippedConflicts} parser-key candidate${skippedConflicts === 1 ? '' : 's'} due to catalog conflicts.`);
