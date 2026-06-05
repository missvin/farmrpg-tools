import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deriveBuddyEvidencePromotionFanout,
  parseBuddyItemEvidenceRecords,
  toBuddyEvidenceFanoutCsvs,
  toBuddyItemParserReviewCsv,
  toBuddyItemParserSummaryCsv,
} from './lib/buddyItemEvidenceParser.mjs';

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
    cacheDir: positional[0] ?? '',
    ...options,
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/parseBuddyItemEvidence.mjs <buddy-item-evidence-cache-dir> [--output-dir <dir>]',
  );
  console.log('Reads local cached Buddy page evidence JSON files and writes parser plus review fan-out artifacts.');
  console.log('No network access is used and no canonical data files are modified.');
}

async function readEvidenceRecords(pagesDir) {
  const entries = await readdir(pagesDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    jsonFiles.map(async (cacheFileName) => ({
      cacheFileName,
      evidence: JSON.parse(await readFile(path.join(pagesDir, cacheFileName), 'utf8')),
    })),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.cacheDir) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const cacheDir = path.resolve(process.cwd(), args.cacheDir);
  const pagesDir = path.join(cacheDir, 'pages');
  const outputDir = path.resolve(process.cwd(), args.outputDir || path.join(cacheDir, 'parsed-multi-source'));
  const fanoutDir = path.join(outputDir, 'fanout');
  const evidenceRecords = await readEvidenceRecords(pagesDir);

  if (evidenceRecords.length === 0) {
    throw new Error(`No cached Buddy item evidence files were found under ${pagesDir}.`);
  }

  const parsedResult = parseBuddyItemEvidenceRecords(evidenceRecords);
  const fanoutResult = deriveBuddyEvidencePromotionFanout(parsedResult);
  const fanoutCsvs = toBuddyEvidenceFanoutCsvs(fanoutResult);

  await mkdir(outputDir, { recursive: true });
  await mkdir(fanoutDir, { recursive: true });
  await writeFile(path.join(outputDir, 'buddy_item_multi_source_facts.json'), JSON.stringify(parsedResult, null, 2), 'utf8');
  await writeFile(path.join(outputDir, 'buddy_item_multi_source_summary.csv'), toBuddyItemParserSummaryCsv(parsedResult), 'utf8');
  await writeFile(path.join(outputDir, 'buddy_item_multi_source_review.csv'), toBuddyItemParserReviewCsv(parsedResult), 'utf8');
  await writeFile(path.join(fanoutDir, 'buddy_evidence_promotion_fanout_summary.json'), JSON.stringify(fanoutResult.summary, null, 2), 'utf8');

  for (const [fileName, csvText] of Object.entries(fanoutCsvs)) {
    await writeFile(path.join(fanoutDir, fileName), csvText, 'utf8');
  }

  console.log(`Parsed ${parsedResult.summary.evidenceRecordsProcessed.toLocaleString()} cached Buddy item evidence files.`);
  console.log(`Wrote parser artifacts under ${outputDir}`);
  console.log(`Wrote fan-out candidate CSVs under ${fanoutDir}`);

  for (const [factGroup, count] of Object.entries(parsedResult.summary.factCounts)) {
    console.log(`${factGroup}: ${count.toLocaleString()}`);
  }

  if (parsedResult.summary.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of parsedResult.summary.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
