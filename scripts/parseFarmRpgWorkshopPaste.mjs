import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseFarmRpgWorkshopPaste,
  toWorkshopItemsCsv,
  toWorkshopQuestionsCsv,
  toWorkshopRecipesCsv,
} from './lib/farmRpgWorkshopPaste.mjs';

function parseArgs(argv) {
  const options = {
    inputPath: '',
    outputDir: 'planning/new-item-intake',
    evidenceDate: new Date().toISOString().slice(0, 10),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output-dir') {
      options.outputDir = argv[index + 1] ?? '';
      index += 1;
    } else if (argument === '--date') {
      options.evidenceDate = argv[index + 1] ?? '';
      index += 1;
    } else if (!options.inputPath) {
      options.inputPath = argument;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.inputPath || !options.outputDir || !/^\d{4}-\d{2}-\d{2}$/u.test(options.evidenceDate)) {
    throw new Error('Usage: node scripts/parseFarmRpgWorkshopPaste.mjs <paste.txt> [--output-dir <dir>] [--date YYYY-MM-DD]');
  }

  const inputText = await readFile(path.resolve(options.inputPath), 'utf8');
  const result = parseFarmRpgWorkshopPaste(inputText);
  const outputDir = path.resolve(options.outputDir);
  const suffix = options.evidenceDate;
  await mkdir(outputDir, { recursive: true });

  const itemPath = path.join(outputDir, `workshop-items-${suffix}.csv`);
  const recipePath = path.join(outputDir, `workshop-recipes-${suffix}.csv`);
  const questionPath = path.join(outputDir, `workshop-questions-${suffix}.csv`);

  await writeFile(itemPath, `${toWorkshopItemsCsv(result, options.evidenceDate)}\n`, 'utf8');
  await writeFile(recipePath, `${toWorkshopRecipesCsv(result, options.evidenceDate)}\n`, 'utf8');
  await writeFile(questionPath, `${toWorkshopQuestionsCsv(result)}\n`, 'utf8');

  console.log(`Wrote ${itemPath}`);
  console.log(`Wrote ${recipePath}`);
  console.log(`Wrote ${questionPath}`);
  console.log(`outputs: ${result.summary.outputCount}`);
  console.log(`ready_outputs: ${result.summary.readyOutputCount}`);
  console.log(`ingredient_rows: ${result.summary.ingredientRowCount}`);
  console.log(`questions: ${result.summary.questionCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
