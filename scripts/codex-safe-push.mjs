import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const extraArgs = process.argv.slice(2);
const protectedBranches = new Set(['main', 'master']);

function fail(reason) {
  console.error(reason);
  process.exit(1);
}

function runGit(args, { capture = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (capture) {
    if (result.error) {
      throw result.error;
    }

    return result;
  }

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

if (extraArgs.length > 0) {
  fail('Unexpected arguments. This command only supports pushing the current branch to origin.');
}

const branchResult = runGit(['branch', '--show-current'], { capture: true });
const branch = (branchResult.stdout ?? '').trim();
if ((branchResult.status ?? 1) !== 0 || !branch) {
  fail('Unable to determine the current branch.');
}

if (protectedBranches.has(branch)) {
  fail(`Refusing to push protected branch '${branch}' without explicit approval.`);
}

const formatResult = runGit(['check-ref-format', '--branch', branch], { capture: true });
if ((formatResult.status ?? 1) !== 0) {
  fail(`Current branch name '${branch}' is not a valid branch ref.`);
}

const remoteResult = runGit(['config', '--get', `branch.${branch}.remote`], { capture: true });
const mergeRefResult = runGit(['config', '--get', `branch.${branch}.merge`], { capture: true });
const remote = (remoteResult.stdout ?? '').trim();
const mergeRef = (mergeRefResult.stdout ?? '').trim();

if ((remoteResult.status ?? 1) === 0 && (mergeRefResult.status ?? 1) === 0 && remote && mergeRef) {
  const expectedMergeRef = `refs/heads/${branch}`;
  if (remote !== 'origin' || mergeRef !== expectedMergeRef) {
    const upstream = `${remote}/${mergeRef.replace(/^refs\/heads\//, '')}`;
    fail(`Refusing to push because upstream '${upstream}' does not match 'origin/${branch}'.`);
  }

  process.exit(runGit(['push', 'origin', branch]));
}

process.exit(runGit(['push', '-u', 'origin', branch]));
