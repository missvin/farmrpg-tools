import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CATALOG_COLUMNS = [
  'item_name',
  'canonical_key',
  'mastery_possible',
  'farmrpg_item_id',
  'buddy_slug',
  'source_datasets',
  'notes',
];
const RECIPE_COLUMNS = [
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
const INPUT_COLUMNS = [
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
const RECONCILIATION_COLUMNS = [
  'output_item_name',
  'output_canonical_key',
  'catalog_action',
  'mastery_action',
  'recipe_action',
  'input_count',
  'notes',
];

function parseCsvRow(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseCsv(text, expectedColumns, label) {
  const lines = text.split(/\r?\n/u).filter((line) => line.length > 0);
  if (lines.length === 0) throw new Error(`${label} is empty.`);
  const headers = parseCsvRow(lines[0]);
  if (headers.join('|') !== expectedColumns.join('|')) {
    throw new Error(`${label} has an unexpected schema.`);
  }
  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    if (values.length !== headers.length) throw new Error(`${label} has a malformed row: ${line}`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function serializeRow(columns, row) {
  return columns.map((column) => escapeCsv(row[column])).join(',');
}

function appendRows(originalText, columns, rows) {
  const base = originalText.replace(/\s*$/u, '');
  return rows.length === 0 ? `${base}\n` : `${base}\n${rows.map((row) => serializeRow(columns, row)).join('\n')}\n`;
}

function replaceRow(originalText, columns, canonicalKey, replacement) {
  const lines = originalText.replace(/\s*$/u, '').split(/\r?\n/u);
  const keyIndex = columns.indexOf('canonical_key');
  let matches = 0;
  const updated = lines.map((line, index) => {
    if (index === 0) return line;
    const values = parseCsvRow(line);
    if (values[keyIndex] !== canonicalKey) return line;
    matches += 1;
    return serializeRow(columns, replacement);
  });
  if (matches !== 1) throw new Error(`Expected one catalog row for ${canonicalKey}; found ${matches}.`);
  return `${updated.join('\n')}\n`;
}

function signaturesMatch(candidateInputs, existingInputs) {
  if (candidateInputs.length !== existingInputs.length) return false;
  const existingByKey = new Map(existingInputs.map((input) => [input.input_canonical_key, input]));
  return candidateInputs.every((candidate) => {
    const existing = existingByKey.get(candidate.input_canonical_key);
    return existing && Number(candidate.per_craft_quantity) === Number(existing.quantity);
  });
}

function mergeSourceDataset(existing) {
  const values = new Set(existing.split(';').filter(Boolean));
  values.add('workshop_paste_2026_08_31');
  return [...values].join(';');
}

function mergeNotes(existing, addition) {
  return existing ? `${existing} ${addition}` : addition;
}

export function reconcileWorkshopReferenceData({
  itemRows,
  workshopInputRows,
  questionRows,
  catalogRows,
  recipeRows,
  recipeInputRows,
}) {
  const blockingQuestions = questionRows.filter((row) => row.blocking_canonical_promotion === 'yes' && !row.resolution);
  if (blockingQuestions.length > 0) {
    throw new Error(`${blockingQuestions.length} unresolved Workshop question(s) block canonical promotion.`);
  }

  const listedByKey = new Map();
  for (const item of itemRows) {
    if (listedByKey.has(item.canonical_key)) throw new Error(`Duplicate Workshop output: ${item.canonical_key}`);
    if (item.review_status !== 'recipe_normalized_pending_reconciliation') {
      throw new Error(`Workshop output is not ready: ${item.canonical_key}`);
    }
    listedByKey.set(item.canonical_key, item);
  }

  const candidateInputsByOutput = new Map();
  for (const input of workshopInputRows) {
    if (!candidateInputsByOutput.has(input.output_canonical_key)) candidateInputsByOutput.set(input.output_canonical_key, []);
    candidateInputsByOutput.get(input.output_canonical_key).push(input);
  }
  for (const [outputKey, inputs] of candidateInputsByOutput) {
    inputs.sort((left, right) => Number(left.input_order) - Number(right.input_order));
    const pairs = new Set();
    for (const input of inputs) {
      const pair = `${input.input_order}|${input.input_canonical_key}`;
      if (pairs.has(pair)) throw new Error(`Duplicate Workshop input for ${outputKey}: ${pair}`);
      pairs.add(pair);
      if (!Number.isSafeInteger(Number(input.per_craft_quantity)) || Number(input.per_craft_quantity) <= 0) {
        throw new Error(`Invalid per-craft quantity for ${outputKey}: ${input.per_craft_quantity}`);
      }
    }
  }

  const catalogByKey = new Map(catalogRows.map((row) => [row.canonical_key, row]));
  if (catalogByKey.size !== catalogRows.length) throw new Error('Canonical item catalog already contains duplicate keys.');
  const recipesByKey = new Map(recipeRows.map((row) => [row.output_canonical_key, row]));
  if (recipesByKey.size !== recipeRows.length) throw new Error('Canonical recipes already contain duplicate outputs.');
  const existingInputsByOutput = new Map();
  for (const input of recipeInputRows) {
    if (!existingInputsByOutput.has(input.output_canonical_key)) existingInputsByOutput.set(input.output_canonical_key, []);
    existingInputsByOutput.get(input.output_canonical_key).push(input);
  }
  for (const inputs of existingInputsByOutput.values()) {
    inputs.sort((left, right) => Number(left.input_order) - Number(right.input_order));
  }

  const catalogAdds = [];
  const catalogUpdates = [];
  const recipeAdds = [];
  const recipeInputAdds = [];
  const reconciliationRows = [];
  const knownCatalogKeys = new Set(catalogByKey.keys());
  const provenanceNote = 'User confirmed this listed Workshop output is masterable in BL-337 on 2026-08-31.';
  const recipeNote = 'Normalized from the user-supplied Workshop paste for BL-337 on 2026-08-31; listed output was user-confirmed masterable.';

  for (const item of itemRows) {
    const key = item.canonical_key;
    const existingCatalog = catalogByKey.get(key);
    let catalogAction = 'existing';
    let masteryAction = 'already_yes';
    if (!existingCatalog) {
      catalogAdds.push({
        item_name: item.observed_item_name,
        canonical_key: key,
        mastery_possible: 'yes',
        farmrpg_item_id: '',
        buddy_slug: '',
        source_datasets: 'workshop_paste_2026_08_31;recipes.output',
        notes: provenanceNote,
      });
      knownCatalogKeys.add(key);
      catalogAction = 'added';
      masteryAction = 'set_yes';
    } else if (existingCatalog.mastery_possible !== 'yes') {
      catalogUpdates.push({
        ...existingCatalog,
        mastery_possible: 'yes',
        source_datasets: mergeSourceDataset(existingCatalog.source_datasets),
        notes: mergeNotes(existingCatalog.notes, provenanceNote),
      });
      masteryAction = `${existingCatalog.mastery_possible}_to_yes`;
    }

    const candidateInputs = candidateInputsByOutput.get(key) ?? [];
    if (candidateInputs.length === 0) throw new Error(`Workshop output has no candidate inputs: ${key}`);
    const existingRecipe = recipesByKey.get(key);
    let recipeAction = 'matched_existing';
    if (existingRecipe) {
      const existingInputs = existingInputsByOutput.get(key) ?? [];
      if (!signaturesMatch(candidateInputs, existingInputs)) {
        throw new Error(`Workshop recipe conflicts with canonical recipe for ${key}.`);
      }
    } else {
      recipeAdds.push({
        output_item_name: item.observed_item_name,
        output_canonical_key: key,
        recipe_type: 'craft',
        recipe_book_item_name: '',
        recipe_book_canonical_key: '',
        cooking_level: '',
        base_time: '',
        source_buddy_url: '',
        source_page_data_url: '',
        cache_file_name: 'user-workshop-paste-2026-08-31',
        parser_version: 'farmrpg-workshop-paste-v1',
        notes: recipeNote,
      });
      recipeAction = 'added';
      for (const input of candidateInputs) {
        recipeInputAdds.push({
          output_canonical_key: key,
          output_item_name: item.observed_item_name,
          input_order: input.input_order,
          input_item_name: input.input_item_name,
          input_canonical_key: input.input_canonical_key,
          quantity: input.per_craft_quantity,
          source_buddy_url: '',
          source_page_data_url: '',
          cache_file_name: 'user-workshop-paste-2026-08-31',
          parser_version: 'farmrpg-workshop-paste-v1',
          notes: recipeNote,
        });
      }
    }
    reconciliationRows.push({
      output_item_name: item.observed_item_name,
      output_canonical_key: key,
      catalog_action: catalogAction,
      mastery_action: masteryAction,
      recipe_action: recipeAction,
      input_count: candidateInputs.length,
      notes: 'Reconciled by normalized item name; no duplicate output added.',
    });
  }

  for (const input of workshopInputRows) {
    if (knownCatalogKeys.has(input.input_canonical_key)) continue;
    catalogAdds.push({
      item_name: input.input_item_name,
      canonical_key: input.input_canonical_key,
      mastery_possible: 'unknown',
      farmrpg_item_id: '',
      buddy_slug: '',
      source_datasets: 'workshop_paste_2026_08_31;recipe_inputs.input',
      notes: 'Observed only as a recipe input in the user-supplied Workshop paste for BL-337; mastery eligibility was not inferred.',
    });
    knownCatalogKeys.add(input.input_canonical_key);
  }

  return { catalogAdds, catalogUpdates, recipeAdds, recipeInputAdds, reconciliationRows };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const root = process.cwd();
  const paths = {
    items: path.join(root, 'planning', 'new-item-intake', 'workshop-items-2026-08-31.csv'),
    workshopRecipes: path.join(root, 'planning', 'new-item-intake', 'workshop-recipes-2026-08-31.csv'),
    questions: path.join(root, 'planning', 'new-item-intake', 'workshop-questions-2026-08-31.csv'),
    catalog: path.join(root, 'data', 'item_catalog.csv'),
    recipes: path.join(root, 'data', 'recipes.csv'),
    recipeInputs: path.join(root, 'data', 'recipe_inputs.csv'),
    reconciliation: path.join(root, 'planning', 'new-item-intake', 'workshop-reconciliation-2026-08-31.csv'),
  };
  const texts = Object.fromEntries(await Promise.all(
    Object.entries(paths).filter(([key]) => key !== 'reconciliation').map(async ([key, filePath]) => [key, await readFile(filePath, 'utf8')]),
  ));
  const result = reconcileWorkshopReferenceData({
    itemRows: parseCsv(texts.items, ['observed_item_name', 'canonical_key', 'owned_quantity', 'derived_craft_quantity', 'mastery_confirmation_status', 'evidence_source', 'evidence_date', 'review_status', 'notes'], 'Workshop items'),
    workshopInputRows: parseCsv(texts.workshopRecipes, ['output_item_name', 'output_canonical_key', 'derived_craft_quantity', 'input_order', 'input_item_name', 'input_canonical_key', 'input_inventory_quantity', 'displayed_required_quantity', 'per_craft_quantity', 'evidence_source', 'evidence_date', 'review_status', 'notes'], 'Workshop recipes'),
    questionRows: parseCsv(texts.questions, ['question_id', 'output_item_name', 'output_canonical_key', 'question_type', 'details', 'source_line', 'blocking_canonical_promotion', 'resolution'], 'Workshop questions'),
    catalogRows: parseCsv(texts.catalog, CATALOG_COLUMNS, 'item catalog'),
    recipeRows: parseCsv(texts.recipes, RECIPE_COLUMNS, 'recipes'),
    recipeInputRows: parseCsv(texts.recipeInputs, INPUT_COLUMNS, 'recipe inputs'),
  });

  console.log(`catalog_adds: ${result.catalogAdds.length}`);
  console.log(`catalog_updates: ${result.catalogUpdates.length}`);
  console.log(`recipe_adds: ${result.recipeAdds.length}`);
  console.log(`recipe_input_adds: ${result.recipeInputAdds.length}`);
  console.log(`reconciled_outputs: ${result.reconciliationRows.length}`);
  if (!apply) {
    console.log('dry_run: true');
    return;
  }

  let catalogText = texts.catalog;
  for (const update of result.catalogUpdates) {
    catalogText = replaceRow(catalogText, CATALOG_COLUMNS, update.canonical_key, update);
  }
  catalogText = appendRows(catalogText, CATALOG_COLUMNS, result.catalogAdds);
  await writeFile(paths.catalog, catalogText, 'utf8');
  await writeFile(paths.recipes, appendRows(texts.recipes, RECIPE_COLUMNS, result.recipeAdds), 'utf8');
  await writeFile(paths.recipeInputs, appendRows(texts.recipeInputs, INPUT_COLUMNS, result.recipeInputAdds), 'utf8');
  await writeFile(paths.reconciliation, `${RECONCILIATION_COLUMNS.join(',')}\n${result.reconciliationRows.map((row) => serializeRow(RECONCILIATION_COLUMNS, row)).join('\n')}\n`, 'utf8');
  console.log('applied: true');
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/gu, '/')}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
