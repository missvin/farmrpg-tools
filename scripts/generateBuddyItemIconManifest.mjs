import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deriveBuddyIconManifest,
  toBuddyIconManifestCsv,
  toBuddyIconManifestJson,
  toBuddyIconManifestReviewCsv,
} from './lib/buddyIconManifest.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: 'generated',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? options.outputDir;
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
    'Usage: node scripts/generateBuddyItemIconManifest.mjs <buddy_item_icon_observations.csv> <buddy_item_icon_downloads.csv> [--output-dir <dir>]',
  );
}

async function main() {
  const { observationCsvPath, downloadCsvPath, outputDir } = parseArgs(process.argv.slice(2));

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

  await mkdir(resolvedOutputDir, { recursive: true });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_item_icon_manifest.json');
  const resultsCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_manifest.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_manifest_review.csv');

  await writeFile(resultsJsonPath, toBuddyIconManifestJson(manifestResult), 'utf8');
  await writeFile(resultsCsvPath, toBuddyIconManifestCsv(manifestResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyIconManifestReviewCsv(manifestResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${resultsCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);
  console.log(`item_rows_processed: ${manifestResult.summary.itemRowsProcessed.toLocaleString()}`);
  console.log(`clean_manifest_rows: ${manifestResult.summary.cleanManifestRowCount.toLocaleString()}`);
  console.log(`shared_asset_reuse_rows: ${manifestResult.summary.sharedAssetReuseRowCount.toLocaleString()}`);
  console.log(`review: ${manifestResult.summary.reviewCount.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
