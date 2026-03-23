import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  downloadBuddyItemIcons,
  parseBuddyIconSourceCsv,
  toBuddyIconDownloadCsv,
  toBuddyIconDownloadJson,
  toBuddyIconDownloadReviewCsv,
} from './lib/buddyIconDownload.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: '',
    cacheDir: 'generated/item-icons',
    delayMs: 3000,
    jitterMs: 500,
    limit: null,
    refresh: false,
    maxConsecutiveFailures: 3,
    maxTotalFailures: 5,
    maxFailureRate: 0.2,
    failureRateMinAttempts: 10,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (argument === '--cache-dir') {
      options.cacheDir = argv[index + 1] ?? options.cacheDir;
      index += 1;
      continue;
    }

    if (argument === '--delay-ms') {
      options.delayMs = Number(argv[index + 1] ?? '3000');
      index += 1;
      continue;
    }

    if (argument === '--jitter-ms') {
      options.jitterMs = Number(argv[index + 1] ?? '500');
      index += 1;
      continue;
    }

    if (argument === '--limit') {
      options.limit = Number(argv[index + 1] ?? '0');
      index += 1;
      continue;
    }

    if (argument === '--refresh') {
      options.refresh = true;
      continue;
    }

    if (argument === '--max-consecutive-failures') {
      options.maxConsecutiveFailures = Number(argv[index + 1] ?? '3');
      index += 1;
      continue;
    }

    if (argument === '--max-total-failures') {
      options.maxTotalFailures = Number(argv[index + 1] ?? '5');
      index += 1;
      continue;
    }

    if (argument === '--max-failure-rate') {
      options.maxFailureRate = Number(argv[index + 1] ?? '0.2');
      index += 1;
      continue;
    }

    if (argument === '--failure-rate-min-attempts') {
      options.failureRateMinAttempts = Number(argv[index + 1] ?? '10');
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
    'Usage: node scripts/downloadBuddyItemIcons.mjs <buddy_item_icon_observations.csv|buddy_item_icons.csv> [--output-dir <dir>] [--cache-dir <dir>] [--delay-ms <ms>] [--jitter-ms <ms>] [--limit <n>] [--refresh] [--max-consecutive-failures <n>] [--max-total-failures <n>] [--max-failure-rate <decimal>] [--failure-rate-min-attempts <n>]',
  );
}

async function main() {
  const {
    inputPath,
    outputDir,
    cacheDir,
    delayMs,
    jitterMs,
    limit,
    refresh,
    maxConsecutiveFailures,
    maxTotalFailures,
    maxFailureRate,
    failureRateMinAttempts,
  } = parseArgs(process.argv.slice(2));

  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteInputPath = path.resolve(process.cwd(), inputPath);
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir || path.dirname(absoluteInputPath));
  const resolvedCacheDir = path.resolve(process.cwd(), cacheDir);
  const csvText = await readFile(absoluteInputPath, 'utf8');
  const iconRows = parseBuddyIconSourceCsv(csvText);
  const selectedRows = limit && limit > 0 ? iconRows.slice(0, limit) : iconRows;

  await mkdir(resolvedOutputDir, { recursive: true });
  await mkdir(resolvedCacheDir, { recursive: true });

  console.log(
    `Downloading cached icons for ${selectedRows.length.toLocaleString()} icon rows with ${delayMs.toLocaleString()}ms base delay and up to ${jitterMs.toLocaleString()}ms jitter...`,
  );

  const downloadResult = await downloadBuddyItemIcons(selectedRows, {
    cacheDir: resolvedCacheDir,
    interRequestDelayMs: delayMs,
    interRequestJitterMs: jitterMs,
    refresh,
    maxConsecutiveFailures,
    maxTotalFailures,
    maxFailureRate,
    failureRateMinAttempts,
  });

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_item_icon_downloads.json');
  const resultsCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_downloads.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_item_icon_download_review.csv');

  await writeFile(resultsJsonPath, toBuddyIconDownloadJson(downloadResult), 'utf8');
  await writeFile(resultsCsvPath, toBuddyIconDownloadCsv(downloadResult), 'utf8');
  await writeFile(reviewCsvPath, toBuddyIconDownloadReviewCsv(downloadResult), 'utf8');

  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${resultsCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);

  for (const [status, count] of Object.entries(downloadResult.summary.countsByStatus)) {
    console.log(`${status}: ${count.toLocaleString()}`);
  }

  console.log(`unique_icon_urls: ${downloadResult.summary.uniqueIconUrls.toLocaleString()}`);
  console.log(`review: ${downloadResult.summary.reviewCount.toLocaleString()}`);
  console.log(`network_attempts: ${downloadResult.summary.networkAttempts.toLocaleString()}`);
  console.log(`total_failures: ${downloadResult.summary.totalFailures.toLocaleString()}`);
  console.log(`base_delay_ms: ${downloadResult.summary.interRequestDelayMs.toLocaleString()}`);
  console.log(`jitter_ms: ${downloadResult.summary.interRequestJitterMs.toLocaleString()}`);

  if (downloadResult.summary.stoppedByGuard) {
    console.log(`guard_stop: ${downloadResult.summary.guardStopReason}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
