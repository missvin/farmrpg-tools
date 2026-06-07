import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildBuddyEvidenceRecheckQueue,
  DEFAULT_BUDDY_EVIDENCE_BLANK_RECHECK_DAYS,
  DEFAULT_BUDDY_EVIDENCE_STALE_AFTER_DAYS,
  DEFAULT_BUDDY_EVIDENCE_TERMINAL_RECHECK_DAYS,
  parseBuddyEvidenceManifestCsv,
  toBuddyEvidenceFreshnessCsv,
} from './lib/buddyEvidenceRecheckQueue.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    outputDir: '',
    asOf: new Date().toISOString(),
    blankRecheckDays: DEFAULT_BUDDY_EVIDENCE_BLANK_RECHECK_DAYS,
    terminalRecheckDays: DEFAULT_BUDDY_EVIDENCE_TERMINAL_RECHECK_DAYS,
    staleAfterDays: DEFAULT_BUDDY_EVIDENCE_STALE_AFTER_DAYS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (argument === '--as-of') {
      options.asOf = argv[index + 1] ?? options.asOf;
      index += 1;
      continue;
    }

    if (argument === '--blank-recheck-days') {
      options.blankRecheckDays = Number(argv[index + 1] ?? String(DEFAULT_BUDDY_EVIDENCE_BLANK_RECHECK_DAYS));
      index += 1;
      continue;
    }

    if (argument === '--terminal-recheck-days') {
      options.terminalRecheckDays = Number(argv[index + 1] ?? String(DEFAULT_BUDDY_EVIDENCE_TERMINAL_RECHECK_DAYS));
      index += 1;
      continue;
    }

    if (argument === '--stale-after-days') {
      options.staleAfterDays = Number(argv[index + 1] ?? String(DEFAULT_BUDDY_EVIDENCE_STALE_AFTER_DAYS));
      index += 1;
      continue;
    }

    positional.push(argument);
  }

  return {
    manifestPath: positional[0] ?? '',
    ...options,
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/generateBuddyEvidenceRecheckQueue.mjs <buddy_item_evidence_manifest.csv> [--output-dir <dir>] [--as-of <date>] [--blank-recheck-days <n>] [--terminal-recheck-days <n>] [--stale-after-days <n>]',
  );
  console.log('This is offline-only metadata generation. It does not fetch Buddy or FarmRPG.');
}

function assertPositiveNumber(value, label) {
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Use ${label} 1 or greater.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.manifestPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  assertPositiveNumber(args.blankRecheckDays, '--blank-recheck-days');
  assertPositiveNumber(args.terminalRecheckDays, '--terminal-recheck-days');
  assertPositiveNumber(args.staleAfterDays, '--stale-after-days');

  const absoluteManifestPath = path.resolve(process.cwd(), args.manifestPath);
  const outputDir = path.resolve(
    process.cwd(),
    args.outputDir || path.join(path.dirname(absoluteManifestPath), 'recheck-queue'),
  );
  const manifestText = await readFile(absoluteManifestPath, 'utf8');
  const manifestRows = parseBuddyEvidenceManifestCsv(manifestText);
  const result = buildBuddyEvidenceRecheckQueue(manifestRows, {
    asOf: args.asOf,
    blankRecheckDays: args.blankRecheckDays,
    terminalRecheckDays: args.terminalRecheckDays,
    staleAfterDays: args.staleAfterDays,
  });

  await mkdir(outputDir, { recursive: true });

  const freshnessCsvPath = path.join(outputDir, 'buddy_item_evidence_freshness.csv');
  const queueCsvPath = path.join(outputDir, 'buddy_item_evidence_recheck_queue.csv');
  const summaryJsonPath = path.join(outputDir, 'buddy_item_evidence_recheck_summary.json');

  await writeFile(freshnessCsvPath, toBuddyEvidenceFreshnessCsv(result.freshnessRows), 'utf8');
  await writeFile(queueCsvPath, toBuddyEvidenceFreshnessCsv(result.queueRows), 'utf8');
  await writeFile(summaryJsonPath, JSON.stringify(result.summary, null, 2), 'utf8');

  console.log(`Processed ${result.summary.rowsProcessed.toLocaleString()} Buddy evidence manifest rows.`);
  console.log(`Queued ${result.summary.queueRowCount.toLocaleString()} rows for later manual recheck.`);
  console.log(`Wrote ${freshnessCsvPath}`);
  console.log(`Wrote ${queueCsvPath}`);
  console.log(`Wrote ${summaryJsonPath}`);

  for (const [state, count] of Object.entries(result.summary.countsByState)) {
    console.log(`${state}: ${count.toLocaleString()}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
