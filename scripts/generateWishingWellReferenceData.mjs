import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const WISHING_WELL_REFERENCE_COLUMNS = [
  'thrown_item_name',
  'thrown_canonical_key',
  'reward_item_name',
  'reward_canonical_key',
  'reward_chance',
  'reward_quantity',
  'evidence',
  'notes',
];

const CANDIDATES_PATH = join(
  repoRoot,
  'probe-output',
  'buddy-item-evidence-cache-current-2026-06-04',
  'parsed-multi-source',
  'fanout',
  'wishing_well_reference_candidates.csv',
);

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

function readRequired(row, fieldName, rowLabel) {
  const value = row.get(fieldName).trim();

  if (!value) {
    throw new Error(`Missing ${fieldName} in ${rowLabel}.`);
  }

  if (/[\r\n]/u.test(value)) {
    throw new Error(`Embedded newline in ${fieldName} for ${rowLabel}.`);
  }

  return value;
}

function readPositiveNumber(row, fieldName, rowLabel) {
  const rawValue = readRequired(row, fieldName, rowLabel);
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${fieldName} "${rawValue}" in ${rowLabel}.`);
  }

  return rawValue;
}

function readChance(row, rowLabel) {
  const rawValue = readPositiveNumber(row, 'reward_chance', rowLabel);
  const value = Number(rawValue);

  if (value > 1) {
    throw new Error(`Invalid reward_chance "${rawValue}" in ${rowLabel}; chance must be between 0 and 1.`);
  }

  return rawValue;
}

function toCanonicalItemKey(input) {
  return input
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/gu, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ')
    .trim();
}

function validateCanonicalNameMatch(itemName, canonicalKey, label) {
  const expectedCanonicalKey = toCanonicalItemKey(itemName);

  if (expectedCanonicalKey !== canonicalKey) {
    throw new Error(
      `Canonical key mismatch for ${label}: expected "${expectedCanonicalKey}" from "${itemName}" but found "${canonicalKey}".`,
    );
  }
}

function buildNotes(row) {
  const notes = new Set();
  const sourceUrl = row.get('source_url').trim();
  const pageDataUrl = row.get('page_data_url').trim();
  const cacheFileName = row.get('cache_file_name').trim();
  const flags = row.get('flags').trim();

  notes.add('Promoted from complete cached Buddy page-data fan-out for BL-251.');

  if (flags.includes('reward_quantity_defaulted')) {
    notes.add('Reward quantity defaults to 1 because Buddy page-data exposes chance but not quantity.');
  }

  if (sourceUrl) {
    notes.add(`Source: ${sourceUrl}`);
  }

  if (pageDataUrl) {
    notes.add(`Page data: ${pageDataUrl}`);
  }

  if (cacheFileName) {
    notes.add(`Cache: ${cacheFileName}`);
  } else {
    throw new Error('Missing cache_file_name provenance in Wishing Well candidate row.');
  }

  return [...notes].join('; ');
}

const candidateRows = parseCsv(readFileSync(CANDIDATES_PATH, 'utf8'));
const entriesByKey = new Map();

for (const row of candidateRows) {
  const thrownItemName = readRequired(row, 'thrown_item_name', 'Wishing Well candidate row');
  const rewardItemName = readRequired(row, 'reward_item_name', `Wishing Well row for "${thrownItemName}"`);
  const rowLabel = `Wishing Well row "${thrownItemName}" -> "${rewardItemName}"`;
  readRequired(row, 'thrown_canonical_key', rowLabel);
  readRequired(row, 'reward_canonical_key', rowLabel);

  const thrownCanonicalKey = toCanonicalItemKey(thrownItemName);
  const rewardCanonicalKey = toCanonicalItemKey(rewardItemName);

  validateCanonicalNameMatch(thrownItemName, thrownCanonicalKey, `thrown item "${thrownItemName}"`);
  validateCanonicalNameMatch(rewardItemName, rewardCanonicalKey, `reward item "${rewardItemName}"`);

  const entry = {
    thrownItemName,
    thrownCanonicalKey,
    rewardItemName,
    rewardCanonicalKey,
    rewardChance: readChance(row, rowLabel),
    rewardQuantity: readPositiveNumber(row, 'reward_quantity', rowLabel),
    evidence: 'cached_buddy_page_data',
    notes: buildNotes(row),
  };

  const key = `${entry.thrownCanonicalKey}\t${entry.rewardCanonicalKey}`;
  const existingEntry = entriesByKey.get(key);

  if (existingEntry) {
    throw new Error(`Duplicate Wishing Well candidate for ${rowLabel}.`);
  }

  entriesByKey.set(key, entry);
}

const entries = [...entriesByKey.values()].sort((left, right) => {
  const thrownComparison = left.thrownItemName.localeCompare(right.thrownItemName);

  if (thrownComparison !== 0) {
    return thrownComparison;
  }

  return left.rewardItemName.localeCompare(right.rewardItemName);
});

const csvRows = [
  WISHING_WELL_REFERENCE_COLUMNS.join(','),
  ...entries.map((entry) =>
    [
      entry.thrownItemName,
      entry.thrownCanonicalKey,
      entry.rewardItemName,
      entry.rewardCanonicalKey,
      entry.rewardChance,
      entry.rewardQuantity,
      entry.evidence,
      entry.notes,
    ]
      .map(quoteCsvValue)
      .join(','),
  ),
];

writeFileSync(join(repoRoot, 'data', 'wishing_well_reference.csv'), `${csvRows.join('\n')}\n`, 'utf8');
console.log(`Wrote data/wishing_well_reference.csv with ${entries.length.toLocaleString()} rows.`);
