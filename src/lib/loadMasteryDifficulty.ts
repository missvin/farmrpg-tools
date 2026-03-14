import { toCanonicalItemKey } from './normalizeItemKey';

export type MasteryDifficultyEntry = {
  itemName: string;
  canonicalKey: string;
  difficulty: number | null;
  method: string | null;
  notes: string | null;
  tags: string | null;
  passiveCraftworksInfo: string | null;
  farmrpgItemId: string | null;
  buddyItemId: string | null;
  buddySlug: string | null;
  sourceSheet: string | null;
  sourceRow: string | null;
};

export type MasteryDifficultyData = {
  entries: MasteryDifficultyEntry[];
  byCanonicalKey: Record<string, MasteryDifficultyEntry>;
};

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function readField(values: string[], headerIndex: Record<string, number>, fieldName: string): string {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function toOptionalField(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseDifficulty(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function parseMasteryDifficultyCsv(csvText: string): MasteryDifficultyData {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      entries: [],
      byCanonicalKey: {},
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});
  const entries: MasteryDifficultyEntry[] = [];
  const byCanonicalKey: Record<string, MasteryDifficultyEntry> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const itemName = readField(values, headerIndex, 'item_name').trim();

    if (!itemName) {
      continue;
    }

    const entry: MasteryDifficultyEntry = {
      itemName,
      canonicalKey: toCanonicalItemKey(itemName),
      difficulty: parseDifficulty(readField(values, headerIndex, 'difficulty')),
      method: toOptionalField(readField(values, headerIndex, 'method')),
      notes: toOptionalField(readField(values, headerIndex, 'notes')),
      tags: toOptionalField(readField(values, headerIndex, 'tags')),
      passiveCraftworksInfo: toOptionalField(readField(values, headerIndex, 'passive_craftworks_info')),
      farmrpgItemId: toOptionalField(readField(values, headerIndex, 'farmrpg_item_id')),
      buddyItemId: toOptionalField(readField(values, headerIndex, 'buddy_item_id')),
      buddySlug: toOptionalField(readField(values, headerIndex, 'buddy_slug')),
      sourceSheet: toOptionalField(readField(values, headerIndex, 'source_sheet')),
      sourceRow: toOptionalField(readField(values, headerIndex, 'source_row')),
    };

    entries.push(entry);
    byCanonicalKey[entry.canonicalKey] = entry;
  }

  return {
    entries,
    byCanonicalKey,
  };
}

export async function loadMasteryDifficulty(): Promise<MasteryDifficultyData> {
  const response = await fetch('/data/mastery_difficulty.csv');

  if (!response.ok) {
    throw new Error('Unable to load local mastery difficulty data.');
  }

  const csvText = await response.text();
  return parseMasteryDifficultyCsv(csvText);
}
