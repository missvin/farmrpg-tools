import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseBuddyIconExtractionCsv } from './lib/buddyIconDownload.mjs';
import {
  deriveBuddyIconObservations,
  toBuddyIconObservationCsv,
  toBuddyIconObservationJson,
  toBuddyIconObservationReviewCsv,
} from './lib/buddyIconExtract.mjs';

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
    inputPath: positional[0] ?? '',
    ...options,
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/preserveBuddyItemIconObservations.mjs <buddy_item_icons.csv> [--output-dir <dir>]',
  );
}

async function main() {
  const { inputPath, outputDir } = parseArgs(process.argv.slice(2));

  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteInputPath = path.resolve(process.cwd(), inputPath);
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir || path.dirname(absoluteInputPath));
  const csvText = await readFile(absoluteInputPath, 'utf8');
  const extractionRows = parseBuddyIconExtractionCsv(csvText);
  const observationResult = deriveBuddyIconObservations({ results: extractionRows });

  await mkdir(resolvedOutputDir, { recursive: true });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_item_icon_observations.json');
  const resultsCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_observations.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_observation_review.csv');

  await writeFile(resultsJsonPath, toBuddyIconObservationJson(observationResult), 'utf8');
  await writeFile(resultsCsvPath, toBuddyIconObservationCsv(observationResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyIconObservationReviewCsv(observationResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${resultsCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);

  for (const [status, count] of Object.entries(observationResult.summary.countsByStatus)) {
    console.log(`${status}: ${count.toLocaleString()}`);
  }

  console.log(`numeric_farmrpg_item_id_candidates: ${observationResult.summary.numericFarmRpgItemIdCandidateCount.toLocaleString()}`);
  console.log(`review: ${observationResult.summary.reviewCount.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
