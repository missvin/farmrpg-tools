import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(reason) {
  console.error(reason);
  process.exit(1);
}

const pathsFile = join(repoRoot, 'recovery', 'codex-stage-paths.txt');

if (!existsSync(pathsFile)) {
  fail('Stage paths file not found. Write one path per line to recovery/codex-stage-paths.txt first.');
}

const paths = readFileSync(pathsFile, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

if (paths.length === 0) {
  fail('Stage paths file is empty. Write one path per line to recovery/codex-stage-paths.txt first.');
}

const result = spawnSync('git', ['add', '--', ...paths], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

const exitCode = result.status ?? 1;
if (exitCode === 0) {
  unlinkSync(pathsFile);
}

process.exit(exitCode);
