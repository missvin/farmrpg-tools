import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const aliases = {
  'codex-branch': '!node "$(git rev-parse --show-toplevel)/scripts/codex-safe-branch.mjs"',
  'codex-stage': '!node "$(git rev-parse --show-toplevel)/scripts/codex-safe-stage.mjs"',
  'codex-commit': '!node "$(git rev-parse --show-toplevel)/scripts/codex-safe-commit.mjs"',
  'codex-push': '!node "$(git rev-parse --show-toplevel)/scripts/codex-safe-push.mjs"',
  'codex-merge': '!node "$(git rev-parse --show-toplevel)/scripts/codex-safe-merge.mjs"',
};

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

for (const [name, value] of Object.entries(aliases)) {
  const exitCode = runGit(['config', `alias.${name}`, value]);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

console.log('Installed repo-local Codex git aliases:');
for (const name of Object.keys(aliases)) {
  console.log(`- git ${name}`);
}
