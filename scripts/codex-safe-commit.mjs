import { existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(reason) {
  console.error(reason);
  process.exit(1);
}

const messagePath = join(repoRoot, 'recovery', 'codex-commit-message.txt');

if (!existsSync(messagePath)) {
  fail('Commit message file not found. Write the message to recovery/codex-commit-message.txt first.');
}

const result = spawnSync('git', ['commit', '-F', messagePath], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

const exitCode = result.status ?? 1;
if (exitCode === 0) {
  unlinkSync(messagePath);
}

process.exit(exitCode);
