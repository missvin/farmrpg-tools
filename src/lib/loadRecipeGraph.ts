import { toCanonicalItemKey } from './normalizeItemKey';

export type RecipeType = 'craft' | 'cooking';

export type RecipeRow = {
  outputItemName: string;
  outputCanonicalKey: string;
  recipeType: RecipeType;
  recipeBookItemName: string | null;
  recipeBookCanonicalKey: string | null;
  cookingLevel: string | null;
  baseTime: string | null;
  sourceBuddyUrl: string;
};

export type RecipeInputRow = {
  outputCanonicalKey: string;
  outputItemName: string;
  inputOrder: number;
  inputItemName: string;
  inputCanonicalKey: string;
  quantity: number;
};

export type RecipeInput = {
  inputOrder: number;
  itemName: string;
  canonicalKey: string;
  quantity: number;
};

export type RecipeNode = {
  outputItemName: string;
  outputCanonicalKey: string;
  recipeType: RecipeType;
  recipeBookItemName: string | null;
  recipeBookCanonicalKey: string | null;
  cookingLevel: string | null;
  baseTime: string | null;
  sourceBuddyUrl: string;
  inputs: RecipeInput[];
};

export type RecipeGraph = {
  recipes: RecipeNode[];
  byOutputCanonicalKey: Record<string, RecipeNode>;
  byInputCanonicalKey: Record<string, RecipeNode[]>;
  craftRecipes: RecipeNode[];
  cookingRecipes: RecipeNode[];
};

export const RECIPE_COLUMNS = [
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
] as const;

export const RECIPE_INPUT_COLUMNS = [
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
] as const;

function validateHeaders(headers: string[], expectedColumns: readonly string[], label: string): void {
  const missingColumns = expectedColumns.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter((header) => !expectedColumns.includes(header));

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

  throw new Error(`Invalid ${label} schema (${details.join('; ')}).`);
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

function parseRequiredText(value: string, fieldName: string, label: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} for ${label}.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseRecipeType(value: string, outputItemName: string): RecipeType {
  const trimmedValue = value.trim().toLowerCase();

  if (trimmedValue === 'craft' || trimmedValue === 'cooking') {
    return trimmedValue;
  }

  throw new Error(`Invalid recipe_type "${value}" for recipe "${outputItemName}".`);
}

function parsePositiveInteger(value: string, fieldName: string, label: string): number {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} for ${label}.`);
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid ${fieldName} "${value}" for ${label}.`);
  }

  return parsedValue;
}

function validateCanonicalNameMatch(itemName: string, canonicalKey: string, label: string): void {
  const expectedCanonicalKey = toCanonicalItemKey(itemName);

  if (expectedCanonicalKey !== canonicalKey) {
    throw new Error(
      `Canonical key mismatch for ${label}: expected "${expectedCanonicalKey}" from "${itemName}" but found "${canonicalKey}".`,
    );
  }
}

export function parseRecipesCsv(csvText: string): RecipeRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers, RECIPE_COLUMNS, 'recipes.csv');
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    const outputItemName = parseRequiredText(
      readField(values, headerIndex, 'output_item_name'),
      'output_item_name',
      'recipe row',
    );
    const outputCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'output_canonical_key'),
      'output_canonical_key',
      `recipe "${outputItemName}"`,
    );

    validateCanonicalNameMatch(outputItemName, outputCanonicalKey, `recipe output "${outputItemName}"`);

    const recipeType = parseRecipeType(readField(values, headerIndex, 'recipe_type'), outputItemName);
    const recipeBookItemName = parseOptionalText(readField(values, headerIndex, 'recipe_book_item_name'));
    const recipeBookCanonicalKey = parseOptionalText(readField(values, headerIndex, 'recipe_book_canonical_key'));
    const cookingLevel = parseOptionalText(readField(values, headerIndex, 'cooking_level'));
    const baseTime = parseOptionalText(readField(values, headerIndex, 'base_time'));
    const sourceBuddyUrl = parseOptionalText(readField(values, headerIndex, 'source_buddy_url')) ?? '';

    if (recipeType === 'cooking') {
      if (!recipeBookItemName || !recipeBookCanonicalKey || !cookingLevel || !baseTime) {
        throw new Error(`Cooking recipe "${outputItemName}" is missing required cooking metadata.`);
      }

      validateCanonicalNameMatch(
        recipeBookItemName,
        recipeBookCanonicalKey,
        `recipe book item "${recipeBookItemName}"`,
      );
    } else if (recipeBookItemName || recipeBookCanonicalKey || cookingLevel || baseTime) {
      throw new Error(`Craft recipe "${outputItemName}" should not include cooking-only metadata.`);
    }

    return {
      outputItemName,
      outputCanonicalKey,
      recipeType,
      recipeBookItemName,
      recipeBookCanonicalKey,
      cookingLevel,
      baseTime,
      sourceBuddyUrl,
    };
  });
}

export function parseRecipeInputsCsv(csvText: string): RecipeInputRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers, RECIPE_INPUT_COLUMNS, 'recipe_inputs.csv');
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    const outputCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'output_canonical_key'),
      'output_canonical_key',
      'recipe input row',
    );
    const outputItemName = parseRequiredText(
      readField(values, headerIndex, 'output_item_name'),
      'output_item_name',
      `recipe input "${outputCanonicalKey}"`,
    );
    const inputOrder = parsePositiveInteger(
      readField(values, headerIndex, 'input_order'),
      'input_order',
      `recipe input "${outputItemName}"`,
    );
    const inputItemName = parseRequiredText(
      readField(values, headerIndex, 'input_item_name'),
      'input_item_name',
      `recipe input "${outputItemName}"`,
    );
    const inputCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'input_canonical_key'),
      'input_canonical_key',
      `recipe input "${outputItemName}"`,
    );
    const quantity = parsePositiveInteger(
      readField(values, headerIndex, 'quantity'),
      'quantity',
      `recipe input "${outputItemName}"`,
    );

    validateCanonicalNameMatch(inputItemName, inputCanonicalKey, `recipe input "${inputItemName}"`);

    return {
      outputCanonicalKey,
      outputItemName,
      inputOrder,
      inputItemName,
      inputCanonicalKey,
      quantity,
    };
  });
}

export function buildRecipeGraph(recipeRows: RecipeRow[], recipeInputRows: RecipeInputRow[]): RecipeGraph {
  const byOutputCanonicalKey: Record<string, RecipeNode> = {};
  const byInputCanonicalKey: Record<string, RecipeNode[]> = {};

  for (const row of recipeRows) {
    if (byOutputCanonicalKey[row.outputCanonicalKey]) {
      throw new Error(`Duplicate recipe output "${row.outputCanonicalKey}" detected in recipes.csv.`);
    }

    byOutputCanonicalKey[row.outputCanonicalKey] = {
      outputItemName: row.outputItemName,
      outputCanonicalKey: row.outputCanonicalKey,
      recipeType: row.recipeType,
      recipeBookItemName: row.recipeBookItemName,
      recipeBookCanonicalKey: row.recipeBookCanonicalKey,
      cookingLevel: row.cookingLevel,
      baseTime: row.baseTime,
      sourceBuddyUrl: row.sourceBuddyUrl,
      inputs: [],
    };
  }

  const seenInputOrders = new Set<string>();
  const seenInputPairs = new Set<string>();

  for (const row of recipeInputRows) {
    const recipe = byOutputCanonicalKey[row.outputCanonicalKey];

    if (!recipe) {
      throw new Error(
        `Broken recipe input reference: output key "${row.outputCanonicalKey}" is not present in recipes.csv.`,
      );
    }

    if (recipe.outputItemName !== row.outputItemName) {
      throw new Error(
        `Recipe input output-name mismatch for "${row.outputCanonicalKey}": recipes.csv has "${recipe.outputItemName}" but recipe_inputs.csv has "${row.outputItemName}".`,
      );
    }

    const inputOrderKey = `${row.outputCanonicalKey}|${row.inputOrder}`;
    if (seenInputOrders.has(inputOrderKey)) {
      throw new Error(
        `Duplicate input_order ${row.inputOrder} for recipe "${row.outputCanonicalKey}" in recipe_inputs.csv.`,
      );
    }
    seenInputOrders.add(inputOrderKey);

    const inputPairKey = `${row.outputCanonicalKey}|${row.inputCanonicalKey}`;
    if (seenInputPairs.has(inputPairKey)) {
      throw new Error(
        `Duplicate input "${row.inputCanonicalKey}" for recipe "${row.outputCanonicalKey}" in recipe_inputs.csv.`,
      );
    }
    seenInputPairs.add(inputPairKey);

    const input: RecipeInput = {
      inputOrder: row.inputOrder,
      itemName: row.inputItemName,
      canonicalKey: row.inputCanonicalKey,
      quantity: row.quantity,
    };

    recipe.inputs.push(input);
    byInputCanonicalKey[row.inputCanonicalKey] = [...(byInputCanonicalKey[row.inputCanonicalKey] ?? []), recipe];
  }

  const recipes = Object.values(byOutputCanonicalKey)
    .map((recipe) => ({
      ...recipe,
      inputs: [...recipe.inputs].sort((left, right) => left.inputOrder - right.inputOrder),
    }))
    .sort((left, right) => left.outputItemName.localeCompare(right.outputItemName));

  for (const recipe of recipes) {
    if (recipe.inputs.length === 0) {
      throw new Error(`Recipe "${recipe.outputItemName}" has no recipe inputs.`);
    }
  }

  const craftRecipes = recipes.filter((recipe) => recipe.recipeType === 'craft');
  const cookingRecipes = recipes.filter((recipe) => recipe.recipeType === 'cooking');

  return {
    recipes,
    byOutputCanonicalKey,
    byInputCanonicalKey,
    craftRecipes,
    cookingRecipes,
  };
}

export async function loadRecipeGraph(): Promise<RecipeGraph> {
  const [recipesResponse, recipeInputsResponse] = await Promise.all([
    fetch('/data/recipes.csv'),
    fetch('/data/recipe_inputs.csv'),
  ]);

  if (!recipesResponse.ok) {
    throw new Error('Unable to load local recipe data.');
  }

  if (!recipeInputsResponse.ok) {
    throw new Error('Unable to load local recipe input data.');
  }

  const [recipesCsvText, recipeInputsCsvText] = await Promise.all([
    recipesResponse.text(),
    recipeInputsResponse.text(),
  ]);

  return buildRecipeGraph(parseRecipesCsv(recipesCsvText), parseRecipeInputsCsv(recipeInputsCsvText));
}
