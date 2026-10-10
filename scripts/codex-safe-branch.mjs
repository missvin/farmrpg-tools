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

const branchFile = join(repoRoot, 'recovery', 'codex-branch-name.txt');
const startFile = join(repoRoot, 'recovery', 'codex-branch-start.txt');

if (!existsSync(branchFile)) {
  fail('Branch name file not found. Write the branch name to recovery/codex-branch-name.txt first.');
}

const branchName = readFileSync(branchFile, 'utf8').trim();
if (!branchName) {
  fail('Branch name file is empty. Write the branch name to recovery/codex-branch-name.txt first.');
}

if (protectedBranches.has(branchName)) {
  fail(`Refusing to create a task branch named '${branchName}'.`);
}

const formatResult = runGit(['check-ref-format', '--branch', branchName], { capture: true });
if ((formatResult.status ?? 1) !== 0) {
  fail(`Branch name '${branchName}' is not a valid branch ref.`);
}

const existsResult = runGit(['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], {
  capture: true,
});
if ((existsResult.status ?? 1) === 0) {
  fail(`Branch '${branchName}' already exists locally.`);
}

const start = existsSync(startFile) ? readFileSync(startFile, 'utf8').trim() : null;
if (start !== null) {
  if (!/^[a-f0-9]{40}$/.test(start)) fail('Branch start must be an exact 40-character commit SHA.');
  const checked = runGit(['rev-parse', '--verify', `${start}^{commit}`], { capture: true });
  if (checked.status !== 0 || checked.stdout.trim() !== start) fail('Branch start commit is unavailable.');
}
const exitCode = runGit(['switch', '-c', branchName, ...(start ? [start] : [])]);
if (exitCode === 0) {
  unlinkSync(branchFile);
  if (start !== null) unlinkSync(startFile);
}

process.exit(exitCode);
