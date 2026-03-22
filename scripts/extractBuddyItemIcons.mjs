import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { filterFoundProbeCandidates, parseBuddyProbeResultsCsv } from './lib/buddyRecipeExtract.mjs';
import {
  deriveBuddyIconObservations,
  extractBuddyItemIcons,
  toBuddyIconExtractionCsv,
  toBuddyIconExtractionJson,
  toBuddyIconObservationCsv,
  toBuddyIconObservationJson,
  toBuddyIconObservationReviewCsv,
  toBuddyIconReviewCsv,
} from './lib/buddyIconExtract.mjs';

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
    'Usage: node scripts/extractBuddyItemIcons.mjs <buddy_item_probe_results.csv> [--output-dir <dir>] [--delay-ms <ms>] [--limit <n>]',
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
    throw new Error('No found buddy probe rows were available for icon extraction.');
  }

  await mkdir(resolvedOutputDir, { recursive: true });

  console.log(
    `Extracting icon URLs from ${selectedCandidates.length.toLocaleString()} confirmed buddy pages with ${delayMs.toLocaleString()}ms delay...`,
  );

  const extractionResult = await extractBuddyItemIcons(selectedCandidates, {
    interRequestDelayMs: delayMs,
  });
  const observationResult = deriveBuddyIconObservations(extractionResult);

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_item_icons.json');
  const resultsCsvPath = path.join(resolvedOutputDir, 'buddy_item_icons.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_review.csv');
  const observationsJsonPath = path.join(resolvedOutputDir, 'buddy_item_icon_observations.json');
  const observationsCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_observations.csv');
  const observationReviewCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_observation_review.csv');

  await writeFile(resultsJsonPath, toBuddyIconExtractionJson(extractionResult), 'utf8');
  await writeFile(resultsCsvPath, toBuddyIconExtractionCsv(extractionResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyIconReviewCsv(extractionResult), 'utf8');
  await writeFile(observationsJsonPath, toBuddyIconObservationJson(observationResult), 'utf8');
  await writeFile(observationsCsvPath, toBuddyIconObservationCsv(observationResult), 'utf8');
  await writeFile(observationReviewCsvPath, toBuddyIconObservationReviewCsv(observationResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${resultsCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);
  console.log(`Wrote ${observationsJsonPath}`);
  console.log(`Wrote ${observationsCsvPath}`);
  console.log(`Wrote ${observationReviewCsvPath}`);

  for (const [status, count] of Object.entries(extractionResult.summary.countsByStatus)) {
    console.log(`${status}: ${count.toLocaleString()}`);
  }

  console.log(`review: ${extractionResult.summary.reviewCount.toLocaleString()}`);
  console.log(`observed_numeric_farmrpg_item_id_candidates: ${observationResult.summary.numericFarmRpgItemIdCandidateCount.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
