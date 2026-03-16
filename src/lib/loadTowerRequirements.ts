import { toCanonicalItemKey } from './normalizeItemKey';

export type TowerMasteryLevelNeeded = 'M' | 'GM' | 'MM';

export type TowerRequirementEntry = {
  towerLevel: number;
  towerLevelRange: string;
  slotIndex: number;
  itemName: string;
  canonicalKey: string;
  masteryLevelNeeded: TowerMasteryLevelNeeded;
  farmrpgItemId: string | null;
  buddySlug: string | null;
  notes: string | null;
  sourceSheet: string | null;
  sourceRow: string | null;
};

export type TowerRequirementsData = {
  entries: TowerRequirementEntry[];
  byCanonicalKey: Record<string, TowerRequirementEntry[]>;
};

export const TOWER_REQUIREMENTS_COLUMNS = [
  'tower_level',
  'tower_level_range',
  'slot_index',
  'item_name',
  'farmrpg_item_id',
  'mastery_level_needed',
  'buddy_slug',
  'notes',
  'source_sheet',
  'source_row',
] as const;

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

function parseRequiredNumber(value: string, fieldName: string, itemName: string): number {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} for tower requirement "${itemName || 'unknown item'}".`);
  }

  const parsedValue = Number(trimmedValue);
  if (!Number.isInteger(parsedValue)) {
    throw new Error(`Invalid ${fieldName} "${value}" for tower requirement "${itemName || 'unknown item'}".`);
  }

  return parsedValue;
}

function parseRequiredText(value: string, fieldName: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} in tower requirements data.`);
  }

  return trimmedValue;
}

function parseMasteryLevelNeeded(value: string, itemName: string): TowerMasteryLevelNeeded {
  const trimmedValue = value.trim().toUpperCase();

  if (trimmedValue === 'M' || trimmedValue === 'GM' || trimmedValue === 'MM') {
    return trimmedValue;
  }

  throw new Error(
    `Invalid mastery_level_needed "${value}" for tower requirement "${itemName || 'unknown item'}".`,
  );
}

export function parseTowerRequirementsCsv(csvText: string): TowerRequirementsData {
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
  const entries: TowerRequirementEntry[] = [];
  const byCanonicalKey: Record<string, TowerRequirementEntry[]> = {};

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const itemName = parseRequiredText(readField(values, headerIndex, 'item_name'), 'item_name');
    const entry: TowerRequirementEntry = {
      towerLevel: parseRequiredNumber(readField(values, headerIndex, 'tower_level'), 'tower_level', itemName),
      towerLevelRange: parseRequiredText(
        readField(values, headerIndex, 'tower_level_range'),
        'tower_level_range',
      ),
      slotIndex: parseRequiredNumber(readField(values, headerIndex, 'slot_index'), 'slot_index', itemName),
      itemName,
      canonicalKey: toCanonicalItemKey(itemName),
      masteryLevelNeeded: parseMasteryLevelNeeded(
        readField(values, headerIndex, 'mastery_level_needed'),
        itemName,
      ),
      farmrpgItemId: toOptionalField(readField(values, headerIndex, 'farmrpg_item_id')),
      buddySlug: toOptionalField(readField(values, headerIndex, 'buddy_slug')),
      notes: toOptionalField(readField(values, headerIndex, 'notes')),
      sourceSheet: toOptionalField(readField(values, headerIndex, 'source_sheet')),
      sourceRow: toOptionalField(readField(values, headerIndex, 'source_row')),
    };

    entries.push(entry);
    byCanonicalKey[entry.canonicalKey] = [...(byCanonicalKey[entry.canonicalKey] ?? []), entry];
  }

  return {
    entries,
    byCanonicalKey,
  };
}

export async function loadTowerRequirements(): Promise<TowerRequirementsData> {
  const response = await fetch('/data/tower_requirements.csv');

  if (!response.ok) {
    throw new Error('Unable to load local tower requirements data.');
  }

  const csvText = await response.text();
  return parseTowerRequirementsCsv(csvText);
}
