import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  extractBuddyRecipeCandidates,
  filterFoundProbeCandidates,
  parseBuddyProbeResultsCsv,
  toBuddyRecipeExtractionJson,
  toBuddyRecipeExtractionReviewCsv,
  toBuddyRecipeExtractionSummaryCsv,
  toBuddyRecipeIngredientsCsv,
  toBuddyRecipePagesCsv,
  toBuddyRecipeUsedInCsv,
} from './lib/buddyRecipeExtract.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: '',
    delayMs: 1500,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (argument === '--delay-ms') {
      options.delayMs = Number(argv[index + 1] ?? '1500');
      index += 1;
      continue;
    }

    if (argument === '--limit') {
      options.limit = Number(argv[index + 1] ?? '0');
      index += 1;
      continue;
    }

    positional.push(argument);
  }

  return {
    inputPath: positional[0] ?? '',
    ...options,
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/extractBuddyRecipes.mjs <buddy_item_probe_results.csv> [--output-dir <dir>] [--delay-ms <ms>] [--limit <n>]',
  );
}

async function main() {
  const { inputPath, outputDir, delayMs, limit } = parseArgs(process.argv.slice(2));

  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteInputPath = path.resolve(process.cwd(), inputPath);
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir || path.dirname(absoluteInputPath));
  const csvText = await readFile(absoluteInputPath, 'utf8');
  const probeRows = parseBuddyProbeResultsCsv(csvText);
  const foundCandidates = filterFoundProbeCandidates(probeRows);
  const selectedCandidates = limit && limit > 0 ? foundCandidates.slice(0, limit) : foundCandidates;

  if (selectedCandidates.length === 0) {
    throw new Error('No found buddy probe rows were available for recipe extraction.');
  }

  await mkdir(resolvedOutputDir, { recursive: true });

  console.log(
    `Extracting recipes from ${selectedCandidates.length.toLocaleString()} confirmed buddy pages with ${delayMs.toLocaleString()}ms delay...`,
  );

  const extractionResult = await extractBuddyRecipeCandidates(selectedCandidates, {
    interRequestDelayMs: delayMs,
  });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_recipe_results.json');
  const summaryCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_summary.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_review.csv');
  const pagesCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_pages.csv');
  const ingredientsCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_ingredients.csv');
  const usedInCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_used_in.csv');

  await writeFile(resultsJsonPath, toBuddyRecipeExtractionJson(extractionResult), 'utf8');
  await writeFile(summaryCsvPath, toBuddyRecipeExtractionSummaryCsv(extractionResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyRecipeExtractionReviewCsv(extractionResult), 'utf8');
  await writeFile(pagesCsvPath, toBuddyRecipePagesCsv(extractionResult), 'utf8');
  await writeFile(ingredientsCsvPath, toBuddyRecipeIngredientsCsv(extractionResult), 'utf8');
  await writeFile(usedInCsvPath, toBuddyRecipeUsedInCsv(extractionResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${summaryCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);
  console.log(`Wrote ${pagesCsvPath}`);
  console.log(`Wrote ${ingredientsCsvPath}`);
  console.log(`Wrote ${usedInCsvPath}`);

  for (const [status, count] of Object.entries(extractionResult.summary.countsByStatus)) {
    console.log(`${status}: ${count.toLocaleString()}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
