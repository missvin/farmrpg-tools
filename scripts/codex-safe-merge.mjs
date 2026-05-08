import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
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

function localBranchExists(branch) {
  const result = runGit(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { capture: true });
  return (result.status ?? 1) === 0;
}

function detectDefaultBranch() {
  const originHeadResult = runGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { capture: true });
  const originHead = (originHeadResult.stdout ?? '').trim().replace(/^origin\//, '');
  if ((originHeadResult.status ?? 1) === 0 && originHead && localBranchExists(originHead)) {
    return originHead;
  }

  const configuredResult = runGit(['config', '--get', 'init.defaultBranch'], { capture: true });
  const configured = (configuredResult.stdout ?? '').trim();
  if ((configuredResult.status ?? 1) === 0 && configured && localBranchExists(configured)) {
    return configured;
  }

  for (const candidate of ['master', 'main']) {
    if (localBranchExists(candidate)) {
      return candidate;
    }
  }

  fail('Unable to detect the default branch. Expected a local main or master branch.');
}

const defaultBranch = detectDefaultBranch();

const branchResult = runGit(['branch', '--show-current'], { capture: true });
const branch = (branchResult.stdout ?? '').trim();
if ((branchResult.status ?? 1) !== 0 || !branch) {
  fail('Unable to determine the current branch.');
}

if (protectedBranches.has(branch)) {
  fail(`Run this command from the feature branch you want to land, not from '${branch}'.`);
}

const statusResult = runGit(['status', '--porcelain'], { capture: true });
const status = (statusResult.stdout ?? '').trim();
if ((statusResult.status ?? 1) !== 0) {
  fail('Unable to determine working tree status.');
}

if (status) {
  fail('Working tree must be clean before merging.');
}

const originDefaultResult = runGit(
  ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${defaultBranch}`],
  { capture: true },
);

if ((originDefaultResult.status ?? 1) === 0) {
  const localRevResult = runGit(['rev-parse', defaultBranch], { capture: true });
  const originRevResult = runGit(['rev-parse', `origin/${defaultBranch}`], { capture: true });
  const localRev = (localRevResult.stdout ?? '').trim();
  const originRev = (originRevResult.stdout ?? '').trim();

  if (localRev !== originRev) {
    fail(
      `Local ${defaultBranch} does not match origin/${defaultBranch}. ` +
        `Update ${defaultBranch} explicitly before running git codex-merge.`,
    );
  }
}

let exitCode = runGit(['switch', defaultBranch]);
if (exitCode !== 0) {
  process.exit(exitCode);
}

exitCode = runGit(['merge', '--ff-only', branch]);
if (exitCode !== 0) {
  process.exit(exitCode);
}

process.exit(runGit(['push', 'origin', defaultBranch]));
