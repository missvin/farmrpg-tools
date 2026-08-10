import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildT300RaceStoryData } from './lib/t300RaceStoryGenerator.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readArgument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const backupPath = readArgument('backup');
const supplementPath = readArgument('supplement');
const outputPath = resolve(repoRoot, readArgument('output') ?? 'src/features/t300Race/generatedStoryData.json');

if (!backupPath || !supplementPath) {
  console.error('Usage: npm run generate:t300-race -- --backup <backup.json> --supplement <supplement.json>');
  process.exit(1);
}

const backup = JSON.parse(readFileSync(resolve(backupPath), 'utf8'));
const supplement = JSON.parse(readFileSync(resolve(supplementPath), 'utf8'));
const towerRequirementsCsv = readFileSync(join(repoRoot, 'data', 'tower_requirements.csv'), 'utf8');
const story = buildT300RaceStoryData({ backup, towerRequirementsCsv, supplement });

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(story, null, 2)}\n`, 'utf8');

console.log(`Generated ${outputPath}`);
console.log(JSON.stringify(story.summary, null, 2));
if (story.warnings.length > 0) {
  console.warn(`Generation warnings: ${story.warnings.join(' ')}`);
}
