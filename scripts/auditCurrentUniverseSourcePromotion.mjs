import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(repoRoot, 'probe-output', 'buddy-item-evidence-cache-current-2026-06-04');
const fanoutRoot = join(evidenceRoot, 'parsed-multi-source', 'fanout');

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      value = '';
      continue;
    }

    value += character;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])),
  );
}

function readCsvRecords(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing CSV: ${path}`);
  }
  return parseCsv(readFileSync(path, 'utf8'));
}

function countCsv(path) {
  return readCsvRecords(path).length;
}

function byQuantityKind(rows, quantityKind) {
  return rows.filter((row) => row.quantity_kind === quantityKind).length;
}

function assertEqual(label, actual, expected, errors) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${expected}, found ${actual}`);
  }
}

const fanoutSummaryPath = join(fanoutRoot, 'buddy_evidence_promotion_fanout_summary.json');
const fanoutSummary = JSON.parse(readFileSync(fanoutSummaryPath, 'utf8'));
const openableCandidateRows = readCsvRecords(join(fanoutRoot, 'openable_contents_candidates.csv'));

const counts = {
  evidenceManifest: countCsv(join(evidenceRoot, 'buddy_item_evidence_manifest.csv')),
  evidenceReview: countCsv(join(evidenceRoot, 'buddy_item_evidence_review.csv')),
  itemCatalogCandidates: countCsv(join(fanoutRoot, 'item_catalog_candidates.csv')),
  itemCatalog: countCsv(join(repoRoot, 'data', 'item_catalog.csv')),
  iconObservationCandidates: countCsv(join(fanoutRoot, 'icon_observation_candidates.csv')),
  iconManifest: countCsv(join(repoRoot, 'generated', 'buddy_item_icon_manifest.csv')),
  recipeCandidates: countCsv(join(fanoutRoot, 'recipes_candidates.csv')),
  recipes: countCsv(join(repoRoot, 'data', 'recipes.csv')),
  recipeInputCandidates: countCsv(join(fanoutRoot, 'recipe_inputs_candidates.csv')),
  recipeInputs: countCsv(join(repoRoot, 'data', 'recipe_inputs.csv')),
  dropRateCandidates: countCsv(join(fanoutRoot, 'drop_rate_reference_candidates.csv')),
  dropRates: countCsv(join(repoRoot, 'data', 'drop_rate_reference.csv')),
  petSourceCandidates: countCsv(join(fanoutRoot, 'pet_source_reference_candidates.csv')),
  petSources: countCsv(join(repoRoot, 'data', 'pet_source_reference.csv')),
  openableCandidates: openableCandidateRows.length,
  openableCandidateFixed: byQuantityKind(openableCandidateRows, 'fixed'),
  openables: countCsv(join(repoRoot, 'data', 'openable_contents.csv')),
  wishingWellCandidates: countCsv(join(fanoutRoot, 'wishing_well_reference_candidates.csv')),
  wishingWell: countCsv(join(repoRoot, 'data', 'wishing_well_reference.csv')),
  sourceHintCandidates: countCsv(join(fanoutRoot, 'source_hint_candidates.csv')),
  sourceHints: countCsv(join(repoRoot, 'data', 'quest_item_source_hints.csv')),
  aliases: countCsv(join(repoRoot, 'data', 'item_aliases.csv')),
};

counts.openableSkippedForEvReview = counts.openableCandidates - counts.openables;
counts.sourceHintPreservedSeeds = counts.sourceHints - counts.sourceHintCandidates;

const errors = [];

assertEqual('evidence manifest rows', counts.evidenceManifest, 1461, errors);
assertEqual('fanout itemCatalogCandidates', fanoutSummary.itemCatalogCandidates, counts.itemCatalogCandidates, errors);
assertEqual('fanout iconObservationCandidates', fanoutSummary.iconObservationCandidates, counts.iconObservationCandidates, errors);
assertEqual('fanout recipeCandidates', fanoutSummary.recipeCandidates, counts.recipeCandidates, errors);
assertEqual('fanout recipeInputCandidates', fanoutSummary.recipeInputCandidates, counts.recipeInputCandidates, errors);
assertEqual('fanout dropRateCandidates', fanoutSummary.dropRateCandidates, counts.dropRateCandidates, errors);
assertEqual('fanout petSourceCandidates', fanoutSummary.petSourceCandidates, counts.petSourceCandidates, errors);
assertEqual('fanout openableCandidates', fanoutSummary.openableCandidates, counts.openableCandidates, errors);
assertEqual('fanout wishingWellCandidates', fanoutSummary.wishingWellCandidates, counts.wishingWellCandidates, errors);
assertEqual('fanout sourceHintCandidates', fanoutSummary.sourceHintCandidates, counts.sourceHintCandidates, errors);

assertEqual('item_catalog.csv rows', counts.itemCatalog, 1461, errors);
assertEqual('buddy_item_icon_manifest.csv rows', counts.iconManifest, 1461, errors);
assertEqual('recipes.csv rows', counts.recipes, 273, errors);
assertEqual('recipe_inputs.csv rows', counts.recipeInputs, 998, errors);
assertEqual('drop_rate_reference.csv rows', counts.dropRates, 1244, errors);
assertEqual('pet_source_reference.csv rows', counts.petSources, 336, errors);
assertEqual('openable_contents.csv rows', counts.openables, 634, errors);
assertEqual('wishing_well_reference.csv rows', counts.wishingWell, 361, errors);
assertEqual('quest_item_source_hints.csv rows', counts.sourceHints, 1262, errors);
assertEqual('item_aliases.csv rows', counts.aliases, 89, errors);
assertEqual('openable rows skipped for EV review', counts.openableSkippedForEvReview, 263, errors);
assertEqual('source hint preserved seed rows', counts.sourceHintPreservedSeeds, 4, errors);

const report = {
  checkedAt: new Date().toISOString(),
  evidenceRoot: 'probe-output/buddy-item-evidence-cache-current-2026-06-04',
  counts,
  result: errors.length === 0 ? 'pass' : 'fail',
  errors,
};

console.log(JSON.stringify(report, null, 2));

if (errors.length > 0) {
  process.exitCode = 1;
}
