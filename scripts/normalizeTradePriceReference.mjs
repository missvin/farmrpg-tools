import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildItemReferenceLookup,
  parseTradePricePastedText,
  toTradePriceReferenceCsv,
} from './lib/tradePriceReferenceParser.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(args) {
  const options = {
    input: '',
    output: join(repoRoot, 'data', 'trade_price_reference.csv'),
    capturedDate: '',
    allowUnknown: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--input') {
      options.input = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--output') {
      options.output = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--captured-date') {
      options.capturedDate = args[index + 1] ?? '';
      index += 1;
    } else if (arg === '--allow-unknown') {
      options.allowUnknown = true;
    } else {
      throw new Error(`Unknown argument "${arg}".`);
    }
  }

  if (!options.input) {
    throw new Error('Missing required --input path.');
  }

  if (!options.output) {
    throw new Error('Missing required --output path.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(options.capturedDate)) {
    throw new Error('Missing or invalid --captured-date value; expected YYYY-MM-DD.');
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const itemReferenceLookup = buildItemReferenceLookup({
  itemCatalogCsvText: readFileSync(join(repoRoot, 'data', 'item_catalog.csv'), 'utf8'),
  itemAliasesCsvText: readFileSync(join(repoRoot, 'data', 'item_aliases.csv'), 'utf8'),
});
const result = parseTradePricePastedText(readFileSync(resolve(options.input), 'utf8'), {
  itemReferenceLookup,
  capturedDate: options.capturedDate,
  allowUnknown: options.allowUnknown,
});

writeFileSync(resolve(options.output), toTradePriceReferenceCsv(result.rows));

const unknownSummary =
  result.unknownItems.length === 0 ? '0 unknown items' : `${result.unknownItems.length} unknown items:\n${result.unknownItems.join('\n')}`;

console.log(`Wrote ${result.rows.length} trade price rows to ${resolve(options.output)} (${unknownSummary}).`);
