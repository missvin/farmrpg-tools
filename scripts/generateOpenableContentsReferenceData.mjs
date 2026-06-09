import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(repoRoot, 'probe-output', 'buddy-item-evidence-cache-current-2026-06-04');
const candidatePath = join(evidenceRoot, 'parsed-multi-source', 'fanout', 'openable_contents_candidates.csv');
const pagesPath = join(evidenceRoot, 'pages');
const outputPath = join(repoRoot, 'data', 'openable_contents.csv');

const OPENABLE_CONTENTS_REFERENCE_COLUMNS = [
  'openable_item_name',
  'openable_canonical_key',
  'content_item_name',
  'content_canonical_key',
  'quantity_per_open',
  'quantity_kind',
  'evidence',
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

function readPositiveWholeNumber(row, fieldName, rowLabel) {
  const rawValue = readRequired(row, fieldName, rowLabel);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${fieldName} "${rawValue}" in ${rowLabel}; expected a positive whole number.`);
  }

  return value;
}

function readWholeNumber(row, fieldName, rowLabel) {
  return String(readPositiveWholeNumber(row, fieldName, rowLabel));
}

function loadPageMetadata() {
  const metadataByCandidateKey = new Map();
  const metadataByItemName = new Map();

  for (const fileName of readdirSync(pagesPath)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }

    const page = JSON.parse(readFileSync(join(pagesPath, fileName), 'utf8'));
    const item = page.pageData?.result?.data?.farmrpg?.items?.[0];

    if (!item?.name) {
      continue;
    }

    const metadata = {
      itemName: item.name,
      canonicalKey: page.canonicalKey,
      locksmithGrabBag: Boolean(item.locksmithGrabBag),
      fileName,
    };

    metadataByCandidateKey.set(page.canonicalKey, metadata);
    metadataByItemName.set(item.name, metadata);
  }

  return { metadataByCandidateKey, metadataByItemName };
}

function buildProvenanceNotes(row) {
  const sourceUrl = readRequired(row, 'source_url', 'openable candidate row');
  const pageDataUrl = readRequired(row, 'page_data_url', `openable candidate row from ${sourceUrl}`);
  const cacheFileName = readRequired(row, 'cache_file_name', `openable candidate row from ${sourceUrl}`);
  const parserVersion = readRequired(row, 'parser_version', `openable candidate row from ${sourceUrl}`);

  return {
    sourceUrl,
    pageDataUrl,
    cacheFileName,
    parserVersion,
  };
}

function buildFixedNotes(row) {
  const { sourceUrl, pageDataUrl, cacheFileName, parserVersion } = buildProvenanceNotes(row);

  return [
    'Promoted from complete cached Buddy page-data fan-out for BL-262.',
    'locksmith_grab_bag=false',
    `Source: ${sourceUrl}`,
    `Page data: ${pageDataUrl}`,
    `Cache: ${cacheFileName}`,
    `Parser: ${parserVersion}`,
  ].join('; ');
}

function formatExpectedValue(value) {
  return Number(value.toFixed(6)).toString();
}

function buildExpectedNotes(row, quantityMin, quantityMax, outcomeCount) {
  const { sourceUrl, pageDataUrl, cacheFileName, parserVersion } = buildProvenanceNotes(row);

  return [
    'Promoted from complete cached Buddy page-data fan-out for BL-269.',
    'locksmith_grab_bag=true',
    `quantity_range=${quantityMin}-${quantityMax}`,
    `outcome_count=${outcomeCount}`,
    'outcome_model=equal_outcome_pool',
    'ev_formula=((max-min)/2+min)/outcome_count',
    `Source: ${sourceUrl}`,
    `Page data: ${pageDataUrl}`,
    `Cache: ${cacheFileName}`,
    `Parser: ${parserVersion}`,
  ].join('; ');
}

const candidateRows = parseCsv(readFileSync(candidatePath, 'utf8'));
const { metadataByCandidateKey, metadataByItemName } = loadPageMetadata();
const outcomeCountByOpenableKey = new Map();
const entriesByKey = new Map();
let skippedRangeRows = 0;

for (const row of candidateRows) {
  const openableCanonicalKey = row.get('openable_canonical_key').trim();
  const metadata = metadataByCandidateKey.get(openableCanonicalKey);

  if (!metadata?.locksmithGrabBag) {
    continue;
  }

  outcomeCountByOpenableKey.set(
    openableCanonicalKey,
    (outcomeCountByOpenableKey.get(openableCanonicalKey) ?? 0) + 1,
  );
}

for (const row of candidateRows) {
  const openableItemName = readRequired(row, 'openable_item_name', 'openable candidate row');
  const contentItemName = readRequired(row, 'content_item_name', `openable candidate for "${openableItemName}"`);
  const rowLabel = `openable row "${openableItemName}" -> "${contentItemName}"`;
  const quantityKind = readRequired(row, 'quantity_kind', rowLabel);
  const metadata = metadataByCandidateKey.get(row.get('openable_canonical_key').trim())
    ?? metadataByItemName.get(openableItemName);

  if (!metadata) {
    throw new Error(`Missing cached page metadata for openable "${openableItemName}".`);
  }

  if (metadata.locksmithGrabBag) {
    const quantityMin = readPositiveWholeNumber(row, 'quantity_min', rowLabel);
    const quantityMax = readPositiveWholeNumber(row, 'quantity_max', rowLabel);
    const outcomeCount = outcomeCountByOpenableKey.get(row.get('openable_canonical_key').trim()) ?? 0;

    if (quantityMax < quantityMin) {
      throw new Error(`Invalid quantity range ${quantityMin}-${quantityMax} in ${rowLabel}.`);
    }

    if (outcomeCount <= 1) {
      throw new Error(`Invalid outcome count ${outcomeCount} for grab-bag openable "${openableItemName}".`);
    }

    const expectedQuantity = (((quantityMax - quantityMin) / 2) + quantityMin) / outcomeCount;
    const entry = {
      openableItemName,
      openableCanonicalKey: toCanonicalItemKey(openableItemName),
      contentItemName,
      contentCanonicalKey: toCanonicalItemKey(contentItemName),
      quantityPerOpen: formatExpectedValue(expectedQuantity),
      quantityKind: 'expected',
      evidence: 'reviewed_expected_value',
      notes: buildExpectedNotes(row, quantityMin, quantityMax, outcomeCount),
    };

    const key = `${entry.openableCanonicalKey}\t${entry.contentCanonicalKey}`;

    if (entriesByKey.has(key)) {
      throw new Error(`Duplicate openable-content candidate for ${rowLabel}.`);
    }

    entriesByKey.set(key, entry);
    continue;
  }

  if (quantityKind !== 'fixed') {
    skippedRangeRows += 1;
    continue;
  }

  const entry = {
    openableItemName,
    openableCanonicalKey: toCanonicalItemKey(openableItemName),
    contentItemName,
    contentCanonicalKey: toCanonicalItemKey(contentItemName),
    quantityPerOpen: readWholeNumber(row, 'quantity_per_open', rowLabel),
    quantityKind: 'fixed',
    evidence: 'reviewed_fixed_content',
    notes: buildFixedNotes(row),
  };

  const key = `${entry.openableCanonicalKey}\t${entry.contentCanonicalKey}`;

  if (entriesByKey.has(key)) {
    throw new Error(`Duplicate openable-content candidate for ${rowLabel}.`);
  }

  entriesByKey.set(key, entry);
}

const entries = [...entriesByKey.values()].sort((left, right) => {
  const openableComparison = left.openableItemName.localeCompare(right.openableItemName);

  if (openableComparison !== 0) {
    return openableComparison;
  }

  return left.contentItemName.localeCompare(right.contentItemName);
});

const csvRows = [
  OPENABLE_CONTENTS_REFERENCE_COLUMNS.join(','),
  ...entries.map((entry) =>
    [
      entry.openableItemName,
      entry.openableCanonicalKey,
      entry.contentItemName,
      entry.contentCanonicalKey,
      entry.quantityPerOpen,
      entry.quantityKind,
      entry.evidence,
      entry.notes,
    ]
      .map(quoteCsvValue)
      .join(',')),
];

writeFileSync(outputPath, `${csvRows.join('\n')}\n`, 'utf8');

const fixedEntryCount = entries.filter((entry) => entry.quantityKind === 'fixed').length;
const expectedEntryCount = entries.filter((entry) => entry.quantityKind === 'expected').length;

console.log(`Wrote data/openable_contents.csv with ${entries.length.toLocaleString()} reviewed rows.`);
console.log(`Included ${fixedEntryCount.toLocaleString()} fixed rows.`);
console.log(`Included ${expectedEntryCount.toLocaleString()} expected-value rows.`);
console.log(`Included ${outcomeCountByOpenableKey.size.toLocaleString()} grab-bag openables as expected-value rows.`);
console.log(`Skipped ${skippedRangeRows.toLocaleString()} non-fixed rows.`);
