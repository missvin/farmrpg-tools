import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  extractBuddyRecipeCandidates,
  parseBuddyRecipeSampleCsv,
  toBuddyRecipeExtractionJson,
  toBuddyRecipeExtractionReviewCsv,
  toBuddyRecipeExtractionSummaryCsv,
} from './lib/buddyRecipeExtract.mjs';

const DEFAULT_SAMPLE_ITEMS = [
  'Fancy Violin',
  'Fancy Pipe',
  'Yellow Shirt',
  'Wood',
  'Salt Rock',
  'Heart-shaped Gem',
  "Cecil's Shrimp-a-Plenty",
  'Quandary Chowder',
  'Red Twine',
  'Piñata Whop Stick',
];

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: '',
    delayMs: 1500,
    items: [],
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

    if (argument === '--item') {
      options.items.push(argv[index + 1] ?? '');
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
    'Usage: node scripts/extractBuddyRecipeSample.mjs <buddy_item_candidates.csv> [--output-dir <dir>] [--delay-ms <ms>] [--item <item name>]',
  );
}

async function main() {
  const { inputPath, outputDir, delayMs, items } = parseArgs(process.argv.slice(2));

  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteInputPath = path.resolve(process.cwd(), inputPath);
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir || path.dirname(absoluteInputPath));
  const csvText = await readFile(absoluteInputPath, 'utf8');
  const candidates = parseBuddyRecipeSampleCsv(csvText);
  const sampleItems = items.length > 0 ? items : DEFAULT_SAMPLE_ITEMS;
  const sampleItemSet = new Set(sampleItems);
  const selectedCandidates = candidates.filter((candidate) => sampleItemSet.has(candidate.itemName));
  const missingItems = sampleItems.filter(
    (itemName) => !selectedCandidates.some((candidate) => candidate.itemName === itemName),
  );

  if (selectedCandidates.length === 0) {
    throw new Error('No sample items were found in the candidate CSV.');
  }

  await mkdir(resolvedOutputDir, { recursive: true });

  console.log(
    `Extracting recipe samples for ${selectedCandidates.length.toLocaleString()} buddy pages with ${delayMs.toLocaleString()}ms delay...`,
  );

  if (missingItems.length > 0) {
    console.log(`Missing requested sample items: ${missingItems.join(', ')}`);
  }

  const extractionResult = await extractBuddyRecipeCandidates(selectedCandidates, {
    interRequestDelayMs: delayMs,
  });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_recipe_sample_results.json');
  const summaryCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_sample_summary.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_recipe_sample_review.csv');

  await writeFile(resultsJsonPath, toBuddyRecipeExtractionJson(extractionResult), 'utf8');
  await writeFile(summaryCsvPath, toBuddyRecipeExtractionSummaryCsv(extractionResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyRecipeExtractionReviewCsv(extractionResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${summaryCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);

  for (const [status, count] of Object.entries(extractionResult.summary.countsByStatus)) {
    console.log(`${status}: ${count.toLocaleString()}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
