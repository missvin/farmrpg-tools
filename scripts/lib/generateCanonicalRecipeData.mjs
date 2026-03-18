import { normalizeItemKey, parseBuddyRecipeResultsJson } from './buddyRecipeReconcile.mjs';

export const CANONICAL_RECIPE_COLUMNS = [
  'output_item_name',
  'output_canonical_key',
  'recipe_type',
  'recipe_book_item_name',
  'recipe_book_canonical_key',
  'cooking_level',
  'base_time',
  'source_buddy_url',
];

export const CANONICAL_RECIPE_INPUT_COLUMNS = [
  'output_canonical_key',
  'output_item_name',
  'input_order',
  'input_item_name',
  'input_canonical_key',
  'quantity',
];

function escapeCsvValue(value) {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

function parseReconciliationJson(jsonText) {
  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed.entities) || !parsed.summary) {
    throw new Error('Invalid recipe reconciliation JSON: missing entities or summary.');
  }

  return parsed;
}

function buildMatchedLookup(reconciliationResult) {
  if ((reconciliationResult.summary.unmatchedCount ?? 0) > 0 || (reconciliationResult.summary.ambiguousCount ?? 0) > 0) {
    throw new Error(
      `Cannot generate canonical recipe data while reconciliation still has ${reconciliationResult.summary.unmatchedCount ?? 0} unmatched and ${reconciliationResult.summary.ambiguousCount ?? 0} ambiguous entities.`,
    );
  }

  return reconciliationResult.entities.reduce((lookup, entity) => {
    if (entity.matchStatus === 'matched' && entity.matchedUniverseRow) {
      lookup.set(entity.normalizedKey, entity.matchedUniverseRow);
    }

    return lookup;
  }, new Map());
}

function requireMatchedUniverseRow(name, matchedLookup, label) {
  const normalizedKey = normalizeItemKey(name);
  const row = matchedLookup.get(normalizedKey);

  if (!row) {
    throw new Error(`Missing matched universe row for ${label} "${name}".`);
  }

  return row;
}

export function generateCanonicalRecipeData(recipeResultsJsonText, reconciliationJsonText) {
  const extractionResult = parseBuddyRecipeResultsJson(recipeResultsJsonText);
  const reconciliationResult = parseReconciliationJson(reconciliationJsonText);
  const matchedLookup = buildMatchedLookup(reconciliationResult);
  const recipeRows = [];
  const recipeInputRows = [];

  for (const result of extractionResult.results) {
    if (result.extractionStatus !== 'recipe_found') {
      continue;
    }

    const outputRow = requireMatchedUniverseRow(result.itemName, matchedLookup, 'recipe output');
    const recipeBookName = result.recipe?.recipeBookItem?.itemName ?? '';
    const recipeBookRow = recipeBookName
      ? requireMatchedUniverseRow(recipeBookName, matchedLookup, 'recipe book item')
      : null;
    const cookingLevel = result.recipe?.parameters?.find((parameter) => parameter.label === 'Cooking Level')?.value ?? '';
    const baseTime = result.recipe?.parameters?.find((parameter) => parameter.label === 'Base Time')?.value ?? '';

    recipeRows.push({
      outputItemName: outputRow.itemName,
      outputCanonicalKey: outputRow.canonicalKey,
      recipeType: result.recipeType,
      recipeBookItemName: recipeBookRow?.itemName ?? '',
      recipeBookCanonicalKey: recipeBookRow?.canonicalKey ?? '',
      cookingLevel,
      baseTime,
      sourceBuddyUrl: result.candidateBuddyUrl,
    });

    for (const [index, ingredient] of (result.recipe?.ingredients ?? []).entries()) {
      const inputRow = requireMatchedUniverseRow(ingredient.itemName, matchedLookup, 'recipe input');

      recipeInputRows.push({
        outputCanonicalKey: outputRow.canonicalKey,
        outputItemName: outputRow.itemName,
        inputOrder: index + 1,
        inputItemName: inputRow.itemName,
        inputCanonicalKey: inputRow.canonicalKey,
        quantity: ingredient.quantity,
      });
    }
  }

  validateCanonicalRecipeData({ recipeRows, recipeInputRows });

  return {
    recipeRows,
    recipeInputRows,
    summary: {
      totalRecipes: recipeRows.length,
      totalRecipeInputs: recipeInputRows.length,
      excludedNonRecipePages: extractionResult.results.filter((result) => result.extractionStatus !== 'recipe_found').length,
      unresolvedEntitiesExcluded: 0,
    },
  };
}

export function validateCanonicalRecipeData(canonicalData) {
  const recipeKeySet = new Set();

  for (const row of canonicalData.recipeRows) {
    if (!row.outputItemName || !row.outputCanonicalKey || !row.recipeType || !row.sourceBuddyUrl) {
      throw new Error(`Invalid canonical recipe row for "${row.outputItemName || row.outputCanonicalKey || 'unknown'}".`);
    }

    if (!['craft', 'cooking'].includes(row.recipeType)) {
      throw new Error(`Unsupported canonical recipe type "${row.recipeType}" for "${row.outputItemName}".`);
    }

    if (recipeKeySet.has(row.outputCanonicalKey)) {
      throw new Error(`Duplicate canonical recipe row for "${row.outputCanonicalKey}".`);
    }

    if (row.recipeType === 'cooking') {
      if (!row.recipeBookItemName || !row.recipeBookCanonicalKey || !row.cookingLevel || !row.baseTime) {
        throw new Error(`Cooking recipe "${row.outputItemName}" is missing recipe-book or cooking metadata.`);
      }
    }

    recipeKeySet.add(row.outputCanonicalKey);
  }

  const inputPairSet = new Set();

  for (const row of canonicalData.recipeInputRows) {
    if (
      !row.outputCanonicalKey ||
      !row.outputItemName ||
      !row.inputItemName ||
      !row.inputCanonicalKey ||
      !Number.isInteger(row.inputOrder) ||
      !Number.isInteger(row.quantity) ||
      row.quantity <= 0
    ) {
      throw new Error(`Invalid canonical recipe input row for "${row.outputItemName || row.outputCanonicalKey || 'unknown'}".`);
    }

    if (!recipeKeySet.has(row.outputCanonicalKey)) {
      throw new Error(`Recipe input references unknown output key "${row.outputCanonicalKey}".`);
    }

    const pairKey = `${row.outputCanonicalKey}::${row.inputCanonicalKey}`;

    if (inputPairSet.has(pairKey)) {
      throw new Error(`Duplicate canonical recipe input pair "${pairKey}".`);
    }

    inputPairSet.add(pairKey);
  }
}

export function toCanonicalRecipesCsv(canonicalData) {
  const rows = [CANONICAL_RECIPE_COLUMNS.join(',')];

  for (const row of canonicalData.recipeRows) {
    rows.push(
      [
        row.outputItemName,
        row.outputCanonicalKey,
        row.recipeType,
        row.recipeBookItemName,
        row.recipeBookCanonicalKey,
        row.cookingLevel,
        row.baseTime,
        row.sourceBuddyUrl,
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toCanonicalRecipeInputsCsv(canonicalData) {
  const rows = [CANONICAL_RECIPE_INPUT_COLUMNS.join(',')];

  for (const row of canonicalData.recipeInputRows) {
    rows.push(
      [
        row.outputCanonicalKey,
        row.outputItemName,
        String(row.inputOrder),
        row.inputItemName,
        row.inputCanonicalKey,
        String(row.quantity),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}
