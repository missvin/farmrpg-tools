import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const ITEM_CATALOG_COLUMNS = [
  'item_name',
  'canonical_key',
  'mastery_possible',
  'farmrpg_item_id',
  'buddy_slug',
  'source_datasets',
  'notes',
];

const BUDDY_ITEM_CATALOG_CANDIDATES_PATH = join(
  repoRoot,
  'probe-output',
  'buddy-item-evidence-cache-current-2026-06-04',
  'parsed-multi-source',
  'fanout',
  'item_catalog_candidates.csv',
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

function toCanonicalItemKey(input) {
  return input
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/g, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function quoteCsvValue(value) {
  const stringValue = String(value ?? '');

  if (!/[",\r\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function mergeOptional(existingValue, incomingValue, label, canonicalKey, notes) {
  if (!incomingValue) {
    return existingValue;
  }

  if (!existingValue) {
    return incomingValue;
  }

  if (existingValue === incomingValue) {
    return existingValue;
  }

  notes.add(`Conflicting ${label} values observed for ${canonicalKey}; kept first value "${existingValue}".`);
  return existingValue;
}

function addItem(catalogByKey, input) {
  const itemName = input.itemName.trim();

  if (!itemName) {
    return;
  }

  const canonicalKey = input.canonicalKey?.trim() || toCanonicalItemKey(itemName);

  if (!canonicalKey) {
    return;
  }

  const entry = catalogByKey.get(canonicalKey) ?? {
    itemName,
    canonicalKey,
    masteryPossible: 'unknown',
    farmrpgItemId: '',
    buddySlug: '',
    sourceDatasets: new Set(),
    notes: new Set(),
  };

  entry.sourceDatasets.add(input.sourceDataset);
  entry.farmrpgItemId = mergeOptional(
    entry.farmrpgItemId,
    input.farmrpgItemId?.trim() ?? '',
    'farmrpg_item_id',
    canonicalKey,
    entry.notes,
  );
  entry.buddySlug = mergeOptional(
    entry.buddySlug,
    input.buddySlug?.trim() ?? '',
    'buddy_slug',
    canonicalKey,
    entry.notes,
  );

  if (input.masteryPossible === 'yes') {
    entry.masteryPossible = 'yes';
  }

  catalogByKey.set(canonicalKey, entry);
}

function readDataCsv(fileName) {
  return parseCsv(readFileSync(join(repoRoot, 'data', fileName), 'utf8'));
}

const catalogByKey = new Map();

for (const row of readDataCsv('mastery_difficulty.csv')) {
  addItem(catalogByKey, {
    itemName: row.get('item_name'),
    masteryPossible: 'yes',
    farmrpgItemId: row.get('farmrpg_item_id'),
    buddySlug: row.get('buddy_slug'),
    sourceDataset: 'mastery_difficulty',
  });
}

for (const row of readDataCsv('tower_requirements.csv')) {
  addItem(catalogByKey, {
    itemName: row.get('item_name'),
    masteryPossible: 'yes',
    farmrpgItemId: row.get('farmrpg_item_id'),
    buddySlug: row.get('buddy_slug'),
    sourceDataset: 'tower_requirements',
  });
}

for (const row of readDataCsv('recipes.csv')) {
  addItem(catalogByKey, {
    itemName: row.get('output_item_name'),
    canonicalKey: row.get('output_canonical_key'),
    masteryPossible: 'unknown',
    sourceDataset: 'recipes.output',
  });
  addItem(catalogByKey, {
    itemName: row.get('recipe_book_item_name'),
    canonicalKey: row.get('recipe_book_canonical_key'),
    masteryPossible: 'unknown',
    sourceDataset: 'recipes.recipe_book',
  });
}

for (const row of readDataCsv('recipe_inputs.csv')) {
  addItem(catalogByKey, {
    itemName: row.get('input_item_name'),
    canonicalKey: row.get('input_canonical_key'),
    masteryPossible: 'unknown',
    sourceDataset: 'recipe_inputs.input',
  });
}

if (existsSync(BUDDY_ITEM_CATALOG_CANDIDATES_PATH)) {
  for (const row of parseCsv(readFileSync(BUDDY_ITEM_CATALOG_CANDIDATES_PATH, 'utf8'))) {
    addItem(catalogByKey, {
      itemName: row.get('item_name'),
      masteryPossible: 'unknown',
      farmrpgItemId: row.get('farmrpg_item_id'),
      buddySlug: row.get('buddy_slug'),
      sourceDataset: 'buddy_item_evidence_cache',
    });
  }
}

const entries = [...catalogByKey.values()].sort((left, right) => left.itemName.localeCompare(right.itemName));
const csvRows = [
  ITEM_CATALOG_COLUMNS.join(','),
  ...entries.map((entry) =>
    [
      entry.itemName,
      entry.canonicalKey,
      entry.masteryPossible,
      entry.farmrpgItemId,
      entry.buddySlug,
      [...entry.sourceDatasets].sort((left, right) => left.localeCompare(right)).join(';'),
      [...entry.notes].sort((left, right) => left.localeCompare(right)).join(' '),
    ]
      .map(quoteCsvValue)
      .join(','),
  ),
];

writeFileSync(join(repoRoot, 'data', 'item_catalog.csv'), `${csvRows.join('\n')}\n`, 'utf8');
console.log(`Wrote data/item_catalog.csv with ${entries.length.toLocaleString()} items.`);
