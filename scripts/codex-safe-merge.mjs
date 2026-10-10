import { existsSync, readFileSync, unlinkSync } from 'node:fs';
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
    const originAncestorResult = runGit(['merge-base', '--is-ancestor', `origin/${defaultBranch}`, defaultBranch], {
      capture: true,
    });

    if ((originAncestorResult.status ?? 1) !== 0) {
      fail(
        `Local ${defaultBranch} does not match origin/${defaultBranch}. ` +
          `Update ${defaultBranch} explicitly before running git codex-merge.`,
      );
    }
  }
}

const branchHeadResult = runGit(['rev-parse', branch], { capture: true });
const branchHead = (branchHeadResult.stdout ?? '').trim();
if ((branchHeadResult.status ?? 1) !== 0 || !branchHead) {
  fail(`Unable to determine HEAD for branch '${branch}'.`);
}

// Prepare an explicitly pinned parallel branch on the current task branch.
// Default-branch landing below remains fast-forward-only.
const integrateFile = join(repoRoot, 'recovery', 'codex-integrate-source.txt');
if (existsSync(integrateFile)) {
  const source = readFileSync(integrateFile, 'utf8').trim();
  if (!/^[a-f0-9]{40}$/.test(source)) fail('Integration source must be an exact 40-character commit SHA.');
  const checked = runGit(['rev-parse', '--verify', `${source}^{commit}`], { capture: true });
  if (checked.status !== 0 || checked.stdout.trim() !== source) fail('Integration source commit is unavailable.');
  const preflight = runGit(['merge-tree', '--write-tree', branchHead, source], { capture: true });
  if (preflight.status !== 0) fail(`Integration preflight found conflicts; no checkout changed.\n${preflight.stdout}`);
  const prepared = runGit(['merge', '--no-ff', '--no-commit', source]);
  if (prepared === 0) {
    unlinkSync(integrateFile);
    console.log('Integration prepared on task branch. Verify, then use git codex-commit; no default branch was changed or pushed.');
  }
  process.exit(prepared);
}

let exitCode = runGit(['switch', defaultBranch]);
if (exitCode !== 0) {
  process.exit(exitCode);
}

exitCode = runGit(['merge', '--ff-only', branch]);
if (exitCode !== 0) {
  process.exit(exitCode);
}

exitCode = runGit(['push', 'origin', defaultBranch]);
process.exit(exitCode);
