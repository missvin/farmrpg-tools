import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseBuddyRecipeResultsJson,
  parseMuseumSeedCsv,
  reconcileRecipeEntities,
  toRecipeReconciliationJson,
  toRecipeReconciliationSubsetCsv,
  toRecipeReconciliationSummaryCsv,
} from './lib/buddyRecipeReconcile.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    positional.push(argument);
  }

  return {
    recipeResultsPath: positional[0] ?? '',
    museumSeedPath: positional[1] ?? '',
    ...options,
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/reconcileBuddyRecipes.mjs <buddy_recipe_results.json> <museum_seed.csv> [--output-dir <dir>]',
  );
}

async function main() {
  const { recipeResultsPath, museumSeedPath, outputDir } = parseArgs(process.argv.slice(2));

  if (!recipeResultsPath || !museumSeedPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteRecipeResultsPath = path.resolve(process.cwd(), recipeResultsPath);
  const absoluteMuseumSeedPath = path.resolve(process.cwd(), museumSeedPath);
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir || path.dirname(absoluteRecipeResultsPath));

  const [recipeResultsText, museumSeedText] = await Promise.all([
    readFile(absoluteRecipeResultsPath, 'utf8'),
    readFile(absoluteMuseumSeedPath, 'utf8'),
  ]);

  const extractionResult = parseBuddyRecipeResultsJson(recipeResultsText);
  const universeRows = parseMuseumSeedCsv(museumSeedText);
  const reconciliationResult = reconcileRecipeEntities(extractionResult, universeRows);

  await mkdir(resolvedOutputDir, { recursive: true });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_recipe_reconciliation.json');
  const summaryCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_reconciliation_summary.csv');
  const matchedCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_reconciliation_matched.csv');
  const unmatchedCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_reconciliation_unmatched.csv');
  const ambiguousCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_reconciliation_ambiguous.csv');

  await writeFile(resultsJsonPath, toRecipeReconciliationJson(reconciliationResult), 'utf8');
  await writeFile(summaryCsvPath, toRecipeReconciliationSummaryCsv(reconciliationResult), 'utf8');
  await writeFile(matchedCsvPath, toRecipeReconciliationSubsetCsv(reconciliationResult.matched), 'utf8');
  await writeFile(unmatchedCsvPath, toRecipeReconciliationSubsetCsv(reconciliationResult.unmatched), 'utf8');
  await writeFile(ambiguousCsvPath, toRecipeReconciliationSubsetCsv(reconciliationResult.ambiguous), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${summaryCsvPath}`);
  console.log(`Wrote ${matchedCsvPath}`);
  console.log(`Wrote ${unmatchedCsvPath}`);
  console.log(`Wrote ${ambiguousCsvPath}`);
  console.log(`matched: ${reconciliationResult.summary.matchedCount.toLocaleString()}`);
  console.log(`unmatched: ${reconciliationResult.summary.unmatchedCount.toLocaleString()}`);
  console.log(`ambiguous: ${reconciliationResult.summary.ambiguousCount.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
