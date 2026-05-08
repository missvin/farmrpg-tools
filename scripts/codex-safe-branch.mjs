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

const exitCode = runGit(['switch', '-c', branchName]);
if (exitCode === 0) {
  unlinkSync(branchFile);
}

process.exit(exitCode);
