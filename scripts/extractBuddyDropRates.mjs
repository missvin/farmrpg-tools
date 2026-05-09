import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  extractBuddyDropRateTargets,
  parseBuddyDropRateTargetCsv,
  toBuddyDropRateExtractionJson,
  toBuddyDropRatePagesCsv,
  toBuddyDropRateReviewCsv,
  toBuddyDropRateRowsCsv,
} from './lib/buddyDropRateExtract.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: '',
    delayMs: 3000,
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
      options.delayMs = Number(argv[index + 1] ?? '3000');
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
    'Usage: node scripts/extractBuddyDropRates.mjs <buddy_drop_rate_targets.csv> [--output-dir <dir>] [--delay-ms <ms>] [--limit <n>]',
  );
  console.log('Expected CSV header: target_type,target_name,buddy_url,notes');
}

async function main() {
  const { inputPath, outputDir, delayMs, limit } = parseArgs(process.argv.slice(2));

  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!Number.isFinite(delayMs) || delayMs < 1000) {
    throw new Error('Use --delay-ms 1000 or greater so buddy.farm is probed respectfully.');
  }

  const absoluteInputPath = path.resolve(process.cwd(), inputPath);
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir || path.dirname(absoluteInputPath));
  const csvText = await readFile(absoluteInputPath, 'utf8');
  const targets = parseBuddyDropRateTargetCsv(csvText);
  const selectedTargets = limit && limit > 0 ? targets.slice(0, limit) : targets;

  if (selectedTargets.length === 0) {
    throw new Error('No buddy drop-rate targets were available for extraction.');
  }

  await mkdir(resolvedOutputDir, { recursive: true });

  console.log(
    `Extracting drop-rate page-data from ${selectedTargets.length.toLocaleString()} buddy targets with ${delayMs.toLocaleString()}ms delay...`,
  );

  const extractionResult = await extractBuddyDropRateTargets(selectedTargets, {
    interRequestDelayMs: delayMs,
  });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_drop_rate_results.json');
  const pagesCsvPath = path.join(resolvedOutputDir, 'buddy_drop_rate_pages.csv');
  const rowsCsvPath = path.join(resolvedOutputDir, 'buddy_drop_rate_rows.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_drop_rate_review.csv');

  await writeFile(resultsJsonPath, toBuddyDropRateExtractionJson(extractionResult), 'utf8');
  await writeFile(pagesCsvPath, toBuddyDropRatePagesCsv(extractionResult), 'utf8');
  await writeFile(rowsCsvPath, toBuddyDropRateRowsCsv(extractionResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyDropRateReviewCsv(extractionResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${pagesCsvPath}`);
  console.log(`Wrote ${rowsCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);

  console.log(`drop_rate_rows: ${extractionResult.summary.dropRateRows.toLocaleString()}`);
  for (const [status, count] of Object.entries(extractionResult.summary.countsByStatus)) {
    console.log(`${status}: ${count.toLocaleString()}`);
  }

  if (extractionResult.summary.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of extractionResult.summary.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
