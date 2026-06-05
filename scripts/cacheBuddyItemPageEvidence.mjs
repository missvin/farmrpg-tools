import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  cacheBuddyItemEvidenceTargets,
  DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS,
  DEFAULT_BUDDY_ITEM_EVIDENCE_LIMIT,
  DEFAULT_BUDDY_ITEM_EVIDENCE_REQUEST_TIMEOUT_MS,
  getBuddyItemEvidenceCacheKey,
  getBuddyItemEvidenceFileName,
  MAX_BUDDY_ITEM_EVIDENCE_LIMIT,
  MIN_BUDDY_ITEM_EVIDENCE_DELAY_MS,
  normalizeBuddyItemEvidenceOptions,
  parseBuddyItemEvidenceTargetCsv,
  toBuddyItemEvidenceManifestCsv,
  toBuddyItemEvidencePlanCsv,
  toBuddyItemEvidenceResultJson,
  toBuddyItemEvidenceReviewCsv,
} from './lib/buddyItemEvidenceCache.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: '',
    delayMs: DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS,
    limit: DEFAULT_BUDDY_ITEM_EVIDENCE_LIMIT,
    maxAgeDays: 30,
    requestTimeoutMs: DEFAULT_BUDDY_ITEM_EVIDENCE_REQUEST_TIMEOUT_MS,
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (argument === '--delay-ms') {
      options.delayMs = Number(argv[index + 1] ?? String(DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS));
      index += 1;
      continue;
    }

    if (argument === '--limit') {
      options.limit = Number(argv[index + 1] ?? String(DEFAULT_BUDDY_ITEM_EVIDENCE_LIMIT));
      index += 1;
      continue;
    }

    if (argument === '--max-age-days') {
      options.maxAgeDays = Number(argv[index + 1] ?? '30');
      index += 1;
      continue;
    }

    if (argument === '--request-timeout-ms') {
      options.requestTimeoutMs = Number(argv[index + 1] ?? String(DEFAULT_BUDDY_ITEM_EVIDENCE_REQUEST_TIMEOUT_MS));
      index += 1;
      continue;
    }

    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (argument === '--force') {
      options.force = true;
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
    'Usage: node scripts/cacheBuddyItemPageEvidence.mjs <buddy_item_targets.csv|buddy_item_probe_results.csv> [--output-dir <dir>] [--delay-ms <ms>] [--limit <n>] [--max-age-days <n>] [--request-timeout-ms <ms>] [--dry-run] [--force]',
  );
  console.log('Expected target CSV header: item_name,canonical_key,buddy_url,notes');
  console.log('Existing probe results CSVs from scripts/probeBuddyFarmCandidates.mjs are also accepted.');
  console.log(
    `Gentle defaults: --delay-ms ${DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS}, --limit ${DEFAULT_BUDDY_ITEM_EVIDENCE_LIMIT}, max limit ${MAX_BUDDY_ITEM_EVIDENCE_LIMIT}.`,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientWriteError(error) {
  return ['EBUSY', 'EPERM', 'UNKNOWN'].includes(error?.code);
}

async function writeFileWithRetry(filePath, data, encoding = 'utf8') {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await writeFile(filePath, data, encoding);
      return;
    } catch (error) {
      if (!isTransientWriteError(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(250 * attempt);
    }
  }
}

async function readExistingEvidence(targets, pagesDir) {
  const existingEvidenceByCacheKey = {};

  for (const target of targets) {
    const cacheKey = getBuddyItemEvidenceCacheKey(target);
    const filePath = path.join(pagesDir, getBuddyItemEvidenceFileName(target));

    try {
      existingEvidenceByCacheKey[cacheKey] = JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn(`Could not read existing Buddy evidence cache file ${filePath}: ${error.message}`);
      }
    }
  }

  return existingEvidenceByCacheKey;
}

async function writeEvidenceFiles(cacheResult, pagesDir) {
  await mkdir(pagesDir, { recursive: true });

  for (const result of cacheResult.results) {
    if (!result.evidence || result.action !== 'fetch') {
      continue;
    }

    await writeFileWithRetry(path.join(pagesDir, result.cacheFileName), JSON.stringify(result.evidence, null, 2), 'utf8');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  normalizeBuddyItemEvidenceOptions(args);

  if (args.delayMs < MIN_BUDDY_ITEM_EVIDENCE_DELAY_MS) {
    throw new Error(`Use --delay-ms ${MIN_BUDDY_ITEM_EVIDENCE_DELAY_MS} or greater.`);
  }

  const absoluteInputPath = path.resolve(process.cwd(), args.inputPath);
  const resolvedOutputDir = path.resolve(
    process.cwd(),
    args.outputDir || path.join(path.dirname(absoluteInputPath), 'buddy-item-evidence-cache'),
  );
  const pagesDir = path.join(resolvedOutputDir, 'pages');
  const csvText = await readFile(absoluteInputPath, 'utf8');
  const targets = parseBuddyItemEvidenceTargetCsv(csvText);

  if (targets.length === 0) {
    throw new Error('No Buddy item evidence targets were available for caching.');
  }

  const existingEvidenceByCacheKey = await readExistingEvidence(targets, pagesDir);
  const cacheResult = await cacheBuddyItemEvidenceTargets(targets, {
    existingEvidenceByCacheKey,
    delayMs: args.delayMs,
    limit: args.limit,
    maxAgeDays: args.maxAgeDays,
    dryRun: args.dryRun,
    force: args.force,
    requestTimeoutMs: args.requestTimeoutMs,
  });

  if (args.dryRun) {
    console.log('Dry run only. No Buddy requests were made and no files were written.');
    console.log(toBuddyItemEvidencePlanCsv(cacheResult.plan));
    return;
  }

  await mkdir(resolvedOutputDir, { recursive: true });
  await writeEvidenceFiles(cacheResult, pagesDir);

  const resultsJsonPath = path.join(resolvedOutputDir, 'buddy_item_evidence_manifest.json');
  const manifestCsvPath = path.join(resolvedOutputDir, 'buddy_item_evidence_manifest.csv');
  const reviewCsvPath = path.join(resolvedOutputDir, 'buddy_item_evidence_review.csv');

  await writeFileWithRetry(resultsJsonPath, toBuddyItemEvidenceResultJson(cacheResult), 'utf8');
  await writeFileWithRetry(manifestCsvPath, toBuddyItemEvidenceManifestCsv(cacheResult), 'utf8');
  await writeFileWithRetry(reviewCsvPath, toBuddyItemEvidenceReviewCsv(cacheResult), 'utf8');

  console.log(
    `Processed ${cacheResult.summary.targetsProcessed.toLocaleString()} Buddy item evidence targets with ${args.delayMs.toLocaleString()}ms delay and limit ${args.limit.toLocaleString()}.`,
  );
  console.log(`Wrote ${resultsJsonPath}`);
  console.log(`Wrote ${manifestCsvPath}`);
  console.log(`Wrote ${reviewCsvPath}`);
  console.log(`Wrote page evidence cache files under ${pagesDir}`);

  for (const [status, count] of Object.entries(cacheResult.summary.countsByStatus)) {
    console.log(`${status}: ${count.toLocaleString()}`);
  }

  if (cacheResult.summary.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of cacheResult.summary.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
