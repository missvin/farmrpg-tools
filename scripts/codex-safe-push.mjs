import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  buildProtectedPushApprovalText,
  protectedPushApprovalFileName,
  validateProtectedPushApproval,
} from './lib/codexSafePushApproval.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const extraArgs = process.argv.slice(2);
const protectedBranches = new Set(['main', 'master']);
const protectedApprovalFile = join(repoRoot, 'recovery', protectedPushApprovalFileName);

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
  const headResult = runGit(['rev-parse', 'HEAD'], { capture: true });
  const head = (headResult.stdout ?? '').trim();
  if ((headResult.status ?? 1) !== 0 || !head) {
    fail('Unable to determine current HEAD for protected-branch push approval.');
  }

  if (!existsSync(protectedApprovalFile)) {
    fail(
      `Refusing to push protected branch '${branch}' without explicit approval.\n` +
        `To approve this exact push, write the following to recovery/${protectedPushApprovalFileName}:\n` +
        buildProtectedPushApprovalText({ branch, head }),
    );
  }

  const approval = readFileSync(protectedApprovalFile, 'utf8');
  const validation = validateProtectedPushApproval({ text: approval, branch, head });
  if (!validation.ok) {
    fail(`Refusing to push protected branch '${branch}': ${validation.reason}`);
  }
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

  const exitCode = runGit(['push', 'origin', branch]);
  if (exitCode === 0 && protectedBranches.has(branch) && existsSync(protectedApprovalFile)) {
    unlinkSync(protectedApprovalFile);
  }

  process.exit(exitCode);
}

const exitCode = runGit(['push', '-u', 'origin', branch]);
if (exitCode === 0 && protectedBranches.has(branch) && existsSync(protectedApprovalFile)) {
  unlinkSync(protectedApprovalFile);
}

process.exit(exitCode);
