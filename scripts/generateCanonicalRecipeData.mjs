import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  generateCanonicalRecipeData,
  toCanonicalRecipeInputsCsv,
  toCanonicalRecipesCsv,
} from './lib/generateCanonicalRecipeData.mjs';

function parseArgs(argv) {
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    positional.push(argv[index]);
  }

  return {
    recipeResultsPath: positional[0] ?? '',
    reconciliationPath: positional[1] ?? '',
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/generateCanonicalRecipeData.mjs <buddy_recipe_results.json> <buddy_recipe_reconciliation.json>',
  );
}

async function main() {
  const { recipeResultsPath, reconciliationPath } = parseArgs(process.argv.slice(2));

  if (!recipeResultsPath || !reconciliationPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteRecipeResultsPath = path.resolve(process.cwd(), recipeResultsPath);
  const absoluteReconciliationPath = path.resolve(process.cwd(), reconciliationPath);
  const [recipeResultsText, reconciliationText] = await Promise.all([
    readFile(absoluteRecipeResultsPath, 'utf8'),
    readFile(absoluteReconciliationPath, 'utf8'),
  ]);

  const canonicalData = generateCanonicalRecipeData(recipeResultsText, reconciliationText);

  const recipesPath = path.resolve(process.cwd(), 'data', 'recipes.csv');
  const recipeInputsPath = path.resolve(process.cwd(), 'data', 'recipe_inputs.csv');

  await writeFile(recipesPath, toCanonicalRecipesCsv(canonicalData), 'utf8');
  await writeFile(recipeInputsPath, toCanonicalRecipeInputsCsv(canonicalData), 'utf8');

  console.log(`Wrote ${recipesPath}`);
  console.log(`Wrote ${recipeInputsPath}`);
  console.log(`recipes: ${canonicalData.summary.totalRecipes.toLocaleString()}`);
  console.log(`recipe inputs: ${canonicalData.summary.totalRecipeInputs.toLocaleString()}`);
  console.log(`excluded non-recipe pages: ${canonicalData.summary.excludedNonRecipePages.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
