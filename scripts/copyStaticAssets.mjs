import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(repoRoot, 'dist');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function copyFile(sourcePath, destinationPath) {
  if (!existsSync(sourcePath)) {
    fail(`Missing static asset source: ${sourcePath}`);
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
  console.log(`Copied ${sourcePath} -> ${destinationPath}`);
}

if (!existsSync(distRoot)) {
  fail('dist/ does not exist. Run this script after vite build.');
}

const dataRoot = join(repoRoot, 'data');
for (const fileName of readdirSync(dataRoot)) {
  if (extname(fileName) !== '.csv') {
    continue;
  }

  copyFile(join(dataRoot, fileName), join(distRoot, 'data', basename(fileName)));
}

copyFile(
  join(repoRoot, 'planning', 'backlog.csv'),
  join(distRoot, 'planning', 'backlog.csv'),
);
