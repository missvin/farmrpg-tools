import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(repoRoot, 'probe-output', 'buddy-item-evidence-cache-current-2026-06-04');
const fanoutRoot = join(evidenceRoot, 'parsed-multi-source', 'fanout');
const recipesCandidatePath = join(fanoutRoot, 'recipes_candidates.csv');
const recipeInputsCandidatePath = join(fanoutRoot, 'recipe_inputs_candidates.csv');
const recipesOutputPath = join(repoRoot, 'data', 'recipes.csv');
const recipeInputsOutputPath = join(repoRoot, 'data', 'recipe_inputs.csv');

const RECIPE_REFERENCE_COLUMNS = [
  'output_item_name',
  'output_canonical_key',
  'recipe_type',
  'recipe_book_item_name',
  'recipe_book_canonical_key',
  'cooking_level',
  'base_time',
  'source_buddy_url',
  'source_page_data_url',
  'cache_file_name',
  'parser_version',
  'notes',
];

const RECIPE_INPUT_REFERENCE_COLUMNS = [
  'output_canonical_key',
  'output_item_name',
  'input_order',
  'input_item_name',
  'input_canonical_key',
  'quantity',
  'source_buddy_url',
  'source_page_data_url',
  'cache_file_name',
  'parser_version',
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

function readPositiveInteger(row, fieldName, rowLabel) {
  const rawValue = readRequired(row, fieldName, rowLabel);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${fieldName} "${rawValue}" in ${rowLabel}; expected a positive whole number.`);
  }

  return rawValue;
}

function loadExistingCookingBaseTimes() {
  const fallbackByOutputKey = new Map();

  for (const row of parseCsv(readFileSync(recipesOutputPath, 'utf8'))) {
    const outputItemName = readText(row, 'output_item_name');
    const recipeType = readText(row, 'recipe_type');
    const baseTime = readText(row, 'base_time');

    if (recipeType !== 'cooking' || !outputItemName || !baseTime) {
      continue;
    }

    fallbackByOutputKey.set(toCanonicalItemKey(outputItemName), baseTime);
  }

  return fallbackByOutputKey;
}

function buildRecipeNotes(row, usedBaseTimeFallback) {
  const notes = [
    'Promoted from complete cached Buddy page-data fan-out for BL-259.',
    `Page data: ${readRequired(row, 'page_data_url', 'recipe candidate row')}`,
    `Cache: ${readRequired(row, 'cache_file_name', 'recipe candidate row')}`,
    `Parser: ${readRequired(row, 'parser_version', 'recipe candidate row')}`,
  ];

  if (usedBaseTimeFallback) {
    notes.push('Base time carried forward from previous canonical recipe data because the current Buddy cache does not expose cooking base time.');
  }

  return notes.join('; ');
}

function buildRecipeInputNotes(row) {
  return [
    'Promoted from complete cached Buddy page-data fan-out for BL-259.',
    `Page data: ${readRequired(row, 'page_data_url', 'recipe input candidate row')}`,
    `Cache: ${readRequired(row, 'cache_file_name', 'recipe input candidate row')}`,
    `Parser: ${readRequired(row, 'parser_version', 'recipe input candidate row')}`,
  ].join('; ');
}

const existingCookingBaseTimes = loadExistingCookingBaseTimes();
const recipeRowsByOutputKey = new Map();
let cookingBaseTimesCarriedForward = 0;
let skippedCookingRowsMissingBaseTime = 0;

for (const row of parseCsv(readFileSync(recipesCandidatePath, 'utf8'))) {
  const outputItemName = readRequired(row, 'output_item_name', 'recipe candidate row');
  const outputCanonicalKey = toCanonicalItemKey(outputItemName);
  const recipeType = readRequired(row, 'recipe_type', `recipe "${outputItemName}"`);
  const sourceBuddyUrl = readRequired(row, 'source_url', `recipe "${outputItemName}"`);
  const sourcePageDataUrl = readRequired(row, 'page_data_url', `recipe "${outputItemName}"`);
  const cacheFileName = readRequired(row, 'cache_file_name', `recipe "${outputItemName}"`);
  const parserVersion = readRequired(row, 'parser_version', `recipe "${outputItemName}"`);

  if (recipeType !== 'craft' && recipeType !== 'cooking') {
    throw new Error(`Unsupported recipe_type "${recipeType}" for "${outputItemName}".`);
  }

  let recipeBookItemName = '';
  let recipeBookCanonicalKey = '';
  let cookingLevel = '';
  let baseTime = '';
  let usedBaseTimeFallback = false;

  if (recipeType === 'cooking') {
    recipeBookItemName = readRequired(row, 'recipe_book_item_name', `cooking recipe "${outputItemName}"`);
    recipeBookCanonicalKey = toCanonicalItemKey(recipeBookItemName);
    cookingLevel = readRequired(row, 'cooking_level', `cooking recipe "${outputItemName}"`);
    baseTime = readText(row, 'base_time');

    if (!baseTime) {
      const fallbackBaseTime = existingCookingBaseTimes.get(outputCanonicalKey) ?? '';

      if (!fallbackBaseTime) {
        skippedCookingRowsMissingBaseTime += 1;
        continue;
      }

      baseTime = fallbackBaseTime;
      usedBaseTimeFallback = true;
      cookingBaseTimesCarriedForward += 1;
    }
  }

  const entry = {
    outputItemName,
    outputCanonicalKey,
    recipeType,
    recipeBookItemName,
    recipeBookCanonicalKey,
    cookingLevel,
    baseTime,
    sourceBuddyUrl,
    sourcePageDataUrl,
    cacheFileName,
    parserVersion,
    notes: buildRecipeNotes(row, usedBaseTimeFallback),
  };

  if (recipeRowsByOutputKey.has(outputCanonicalKey)) {
    throw new Error(`Duplicate recipe candidate for "${outputItemName}".`);
  }

  recipeRowsByOutputKey.set(outputCanonicalKey, entry);
}

const recipeInputRows = [];
const inputOrderKeys = new Set();
const inputPairKeys = new Set();

for (const row of parseCsv(readFileSync(recipeInputsCandidatePath, 'utf8'))) {
  const outputItemName = readRequired(row, 'output_item_name', 'recipe input candidate row');
  const outputCanonicalKey = toCanonicalItemKey(outputItemName);
  const recipe = recipeRowsByOutputKey.get(outputCanonicalKey);

  if (!recipe) {
    continue;
  }

  const inputItemName = readRequired(row, 'input_item_name', `recipe input for "${outputItemName}"`);
  const inputOrder = readPositiveInteger(row, 'input_order', `recipe input for "${outputItemName}"`);
  const inputCanonicalKey = toCanonicalItemKey(inputItemName);
  const quantity = readPositiveInteger(row, 'quantity', `recipe input "${outputItemName}" -> "${inputItemName}"`);
  const sourceBuddyUrl = readRequired(row, 'source_url', `recipe input for "${outputItemName}"`);
  const sourcePageDataUrl = readRequired(row, 'page_data_url', `recipe input for "${outputItemName}"`);
  const cacheFileName = readRequired(row, 'cache_file_name', `recipe input for "${outputItemName}"`);
  const parserVersion = readRequired(row, 'parser_version', `recipe input for "${outputItemName}"`);
  const inputOrderKey = `${outputCanonicalKey}\t${inputOrder}`;
  const inputPairKey = `${outputCanonicalKey}\t${inputCanonicalKey}`;

  if (inputOrderKeys.has(inputOrderKey)) {
    throw new Error(`Duplicate input_order ${inputOrder} for "${outputItemName}".`);
  }

  if (inputPairKeys.has(inputPairKey)) {
    throw new Error(`Duplicate input "${inputItemName}" for "${outputItemName}".`);
  }

  inputOrderKeys.add(inputOrderKey);
  inputPairKeys.add(inputPairKey);

  recipeInputRows.push({
    outputCanonicalKey,
    outputItemName: recipe.outputItemName,
    inputOrder,
    inputItemName,
    inputCanonicalKey,
    quantity,
    sourceBuddyUrl,
    sourcePageDataUrl,
    cacheFileName,
    parserVersion,
    notes: buildRecipeInputNotes(row),
  });
}

const recipeRows = [...recipeRowsByOutputKey.values()].sort((left, right) =>
  left.outputItemName.localeCompare(right.outputItemName));
const sortedRecipeInputRows = recipeInputRows.sort((left, right) => {
  const outputComparison = left.outputItemName.localeCompare(right.outputItemName);

  if (outputComparison !== 0) {
    return outputComparison;
  }

  return left.inputOrder - right.inputOrder;
});

const recipesCsvRows = [
  RECIPE_REFERENCE_COLUMNS.join(','),
  ...recipeRows.map((entry) =>
    [
      entry.outputItemName,
      entry.outputCanonicalKey,
      entry.recipeType,
      entry.recipeBookItemName,
      entry.recipeBookCanonicalKey,
      entry.cookingLevel,
      entry.baseTime,
      entry.sourceBuddyUrl,
      entry.sourcePageDataUrl,
      entry.cacheFileName,
      entry.parserVersion,
      entry.notes,
    ]
      .map(quoteCsvValue)
      .join(',')),
];

const recipeInputsCsvRows = [
  RECIPE_INPUT_REFERENCE_COLUMNS.join(','),
  ...sortedRecipeInputRows.map((entry) =>
    [
      entry.outputCanonicalKey,
      entry.outputItemName,
      String(entry.inputOrder),
      entry.inputItemName,
      entry.inputCanonicalKey,
      entry.quantity,
      entry.sourceBuddyUrl,
      entry.sourcePageDataUrl,
      entry.cacheFileName,
      entry.parserVersion,
      entry.notes,
    ]
      .map(quoteCsvValue)
      .join(',')),
];

writeFileSync(recipesOutputPath, `${recipesCsvRows.join('\n')}\n`, 'utf8');
writeFileSync(recipeInputsOutputPath, `${recipeInputsCsvRows.join('\n')}\n`, 'utf8');

console.log(`Wrote data/recipes.csv with ${recipeRows.length.toLocaleString()} reviewed recipe rows.`);
console.log(`Wrote data/recipe_inputs.csv with ${sortedRecipeInputRows.length.toLocaleString()} reviewed input rows.`);
console.log(`Carried forward ${cookingBaseTimesCarriedForward.toLocaleString()} cooking base times from previous canonical data.`);
console.log(`Skipped ${skippedCookingRowsMissingBaseTime.toLocaleString()} cooking rows missing base time with no fallback.`);
