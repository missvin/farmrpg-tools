import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseBuddyCandidateCsv,
  probeBuddyFarmCandidates,
  toBuddyProbeResultsCsv,
  toBuddyProbeResultsJson,
  toBuddyProbeReviewCsv,
} from './lib/buddyFarmProbe.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: '',
    delayMs: 1500,
    retryDelayMs: 2000,
    maxRetries: 1,
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

    if (argument === '--retry-delay-ms') {
      options.retryDelayMs = Number(argv[index + 1] ?? '2000');
      index += 1;
      continue;
    }

    if (argument === '--max-retries') {
      options.maxRetries = Number(argv[index + 1] ?? '1');
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
    'Usage: node scripts/probeBuddyFarmCandidates.mjs <buddy_item_candidates.csv> [--output-dir <dir>] [--delay-ms <ms>] [--retry-delay-ms <ms>] [--max-retries <n>] [--limit <n>]',
  );
}

async function main() {
  const { inputPath, outputDir, delayMs, retryDelayMs, maxRetries, limit } = parseArgs(process.argv.slice(2));

  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteInputPath = path.resolve(process.cwd(), inputPath);
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir || path.dirname(absoluteInputPath));
  const csvText = await readFile(absoluteInputPath, 'utf8');
  const candidates = parseBuddyCandidateCsv(csvText);
  const selectedCandidates = limit && limit > 0 ? candidates.slice(0, limit) : candidates;

  await mkdir(resolvedOutputDir, { recursive: true });

  console.log(
    `Probing ${selectedCandidates.length.toLocaleString()} buddy candidate URLs with ${delayMs.toLocaleString()}ms delay and ${maxRetries.toLocaleString()} retry limit...`,
  );

  const probeResult = await probeBuddyFarmCandidates(selectedCandidates, {
    interRequestDelayMs: delayMs,
    retryDelayMs,
    maxRetries,
  });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_item_probe_results.json');
  const resultsCsvPath = path.join(resolvedOutputDir, 'buddy_item_probe_results.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_item_probe_review.csv');

  await writeFile(resultsJsonPath, toBuddyProbeResultsJson(probeResult), 'utf8');
  await writeFile(resultsCsvPath, toBuddyProbeResultsCsv(probeResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyProbeReviewCsv(probeResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${resultsCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);

  for (const [status, count] of Object.entries(probeResult.summary.countsByStatus)) {
    console.log(`${status}: ${count.toLocaleString()}`);
  }

  if (probeResult.summary.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of probeResult.summary.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
