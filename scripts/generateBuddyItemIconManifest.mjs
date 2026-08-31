import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deriveBuddyIconManifest,
  mergeBuddyIconManifestResults,
  toBuddyIconManifestCsv,
  toBuddyIconManifestJson,
  toBuddyIconManifestReviewCsv,
} from './lib/buddyIconManifest.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: 'generated',
    existingManifestPath: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? options.outputDir;
      index += 1;
      continue;
    }

    if (argument === '--existing-manifest') {
      options.existingManifestPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    positional.push(argument);
  }

  return {
    observationCsvPath: positional[0] ?? '',
    downloadCsvPath: positional[1] ?? '',
    ...options,
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/generateBuddyItemIconManifest.mjs <buddy_item_icon_observations.csv> <buddy_item_icon_downloads.csv> [--output-dir <dir>] [--existing-manifest <manifest.json>]',
  );
}

async function main() {
  const { observationCsvPath, downloadCsvPath, outputDir, existingManifestPath } = parseArgs(process.argv.slice(2));

  if (!observationCsvPath || !downloadCsvPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteObservationPath = path.resolve(process.cwd(), observationCsvPath);
  const absoluteDownloadPath = path.resolve(process.cwd(), downloadCsvPath);
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir);
  const [observationCsvText, downloadCsvText] = await Promise.all([
    readFile(absoluteObservationPath, 'utf8'),
    readFile(absoluteDownloadPath, 'utf8'),
  ]);

  const manifestResult = await deriveBuddyIconManifest(observationCsvText, downloadCsvText, {
    repoRoot: process.cwd(),
  });
  let outputResult = manifestResult;

  if (existingManifestPath) {
    const existingManifestText = await readFile(path.resolve(process.cwd(), existingManifestPath), 'utf8');
    const existingManifest = JSON.parse(existingManifestText);
    outputResult = mergeBuddyIconManifestResults(existingManifest, manifestResult);
  }

  await mkdir(resolvedOutputDir, { recursive: true });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_item_icon_manifest.json');
  const resultsCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_manifest.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_manifest_review.csv');

  await writeFile(resultsJsonPath, toBuddyIconManifestJson(outputResult), 'utf8');
  await writeFile(resultsCsvPath, toBuddyIconManifestCsv(outputResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyIconManifestReviewCsv(outputResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${resultsCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);
  console.log(`item_rows_processed: ${outputResult.results.length.toLocaleString()}`);
  console.log(`clean_manifest_rows: ${outputResult.results.filter((result) => result.manifestStatus === 'ready').length.toLocaleString()}`);
  console.log(`shared_asset_reuse_rows: ${outputResult.results.filter((result) => result.sharedAssetReuse).length.toLocaleString()}`);
  console.log(`review: ${outputResult.reviewResults.length.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
