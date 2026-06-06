import path from 'node:path';

import { validateBuddyEvidenceArtifactReadiness } from './lib/buddyEvidenceArtifactReadiness.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {
    targetCsvPath: '',
    fanoutDir: '',
    expectedCount: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--targets') {
      options.targetCsvPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (argument === '--fanout-dir') {
      options.fanoutDir = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (argument === '--expected-count') {
      options.expectedCount = Number(argv[index + 1] ?? '');
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
    'Usage: node scripts/validateBuddyEvidenceArtifactReadiness.mjs <buddy-item-evidence-cache-dir> --targets <buddy_item_targets.csv> [--fanout-dir <parsed-multi-source/fanout>] [--expected-count <n>]',
  );
  console.log('Checks local Buddy evidence cache and fan-out artifacts for promotion-readiness. No network is used.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.cacheDir || !args.targetCsvPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await validateBuddyEvidenceArtifactReadiness({
    cacheDir: path.resolve(process.cwd(), args.cacheDir),
    targetCsvPath: path.resolve(process.cwd(), args.targetCsvPath),
    fanoutDir: args.fanoutDir ? path.resolve(process.cwd(), args.fanoutDir) : '',
    expectedCount: Number.isFinite(args.expectedCount) ? args.expectedCount : null,
  });

  console.log(JSON.stringify(result.summary, null, 2));

  if (result.issues.length > 0) {
    console.log('Issues:');
    for (const issue of result.issues.slice(0, 50)) {
      console.log(`- [${issue.severity}] ${issue.code}: ${issue.message}`);
    }

    const remainingCount = result.issues.length - Math.min(result.issues.length, 50);
    if (remainingCount > 0) {
      console.log(`- ...and ${remainingCount.toLocaleString()} more issue(s).`);
    }
  }

  if (!result.valid) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
