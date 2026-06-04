import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildCurrentMuseumUniverse,
  toBuddyEvidenceTargetsCsv,
  toCurrentMuseumUniverseCsv,
  toCurrentMuseumUniverseSummaryJson,
  toNewItemReviewCsv,
} from './lib/currentMuseumUniverse.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    canonPath: 'data/museum_completion_canon.csv',
    outputDir: 'probe-output/current-museum-universe-2026-06-04',
    sourceLabel: '2026-06-04 museum Library Everything export',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--canon') {
      options.canonPath = argv[index + 1] ?? options.canonPath;
      index += 1;
      continue;
    }

    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? options.outputDir;
      index += 1;
      continue;
    }

    if (argument === '--source-label') {
      options.sourceLabel = argv[index + 1] ?? options.sourceLabel;
      index += 1;
      continue;
    }

    positional.push(argument);
  }

  return {
    rawExportPath: positional[0] ?? '',
    ...options,
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/generateCurrentMuseumUniverse.mjs <museum-everything-export.txt> [--canon <data/museum_completion_canon.csv>] [--output-dir <dir>] [--source-label <label>]',
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.rawExportPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const [rawText, canonCsvText] = await Promise.all([
    readFile(options.rawExportPath, 'utf8'),
    readFile(options.canonPath, 'utf8'),
  ]);

  const result = buildCurrentMuseumUniverse({ rawText, canonCsvText });
  await mkdir(options.outputDir, { recursive: true });

  await Promise.all([
    writeFile(
      path.join(options.outputDir, 'current_museum_universe.csv'),
      `${toCurrentMuseumUniverseCsv(result, { sourceLabel: options.sourceLabel })}\n`,
      'utf8',
    ),
    writeFile(path.join(options.outputDir, 'buddy_item_targets.csv'), `${toBuddyEvidenceTargetsCsv(result)}\n`, 'utf8'),
    writeFile(path.join(options.outputDir, 'new_item_review.csv'), `${toNewItemReviewCsv(result)}\n`, 'utf8'),
    writeFile(
      path.join(options.outputDir, 'summary.json'),
      toCurrentMuseumUniverseSummaryJson(result, { sourceLabel: options.sourceLabel }),
      'utf8',
    ),
  ]);

  console.log(
    `Wrote ${result.parsedCount.toLocaleString()} current museum items, including ${result.reviewedAdditionCount.toLocaleString()} reviewed additions, to ${options.outputDir}.`,
  );

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`Warning: ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
