import { toCanonicalItemKey } from './normalizeItemKey';

export type QuestRequirementType = 'item';
export type QuestRewardType = 'item';
export type QuestCoverageStatus = 'partial' | 'reviewed';

export type QuestCatalogEntry = {
  questKey: string;
  questName: string;
  questlineKey: string;
  questlineName: string;
  questlineAliases: string[];
  stageLabel: string | null;
  npc: string | null;
  farmingLevel: number | null;
  fishingLevel: number | null;
  craftingLevel: number | null;
  exploringLevel: number | null;
  towerLevel: number | null;
  previousQuestKey: string | null;
  nextQuestKeys: string[];
  sourceUrl: string;
  coverageStatus: QuestCoverageStatus;
  notes: string[];
};

export type QuestRequirementEntry = {
  questKey: string;
  requirementType: QuestRequirementType;
  itemName: string;
  canonicalKey: string;
  quantity: number;
  sourceUrl: string;
  notes: string[];
};

export type QuestRewardEntry = {
  questKey: string;
  rewardType: QuestRewardType;
  itemName: string;
  canonicalKey: string;
  quantity: number;
  sourceUrl: string;
  notes: string[];
};

export type QuestItemSourceHintEntry = {
  itemName: string;
  canonicalKey: string;
  sourceName: string;
  sourceCanonicalKey: string;
  sourceType: string;
  preferredUnit: string;
  sourceUrl: string;
  notes: string[];
};

export type QuestReferenceData = {
  quests: QuestCatalogEntry[];
  questsByKey: Record<string, QuestCatalogEntry>;
  requirementsByQuestKey: Record<string, QuestRequirementEntry[]>;
  rewardsByQuestKey: Record<string, QuestRewardEntry[]>;
  sourceHintsByCanonicalKey: Record<string, QuestItemSourceHintEntry[]>;
};

export const QUEST_CATALOG_COLUMNS = [
  'quest_key',
  'quest_name',
  'questline_key',
  'questline_name',
  'questline_aliases',
  'stage_label',
  'npc',
  'farming_level',
  'fishing_level',
  'crafting_level',
  'exploring_level',
  'tower_level',
  'previous_quest_key',
  'next_quest_keys',
  'source_url',
  'coverage_status',
  'notes',
] as const;

export const QUEST_REQUIREMENT_COLUMNS = [
  'quest_key',
  'requirement_type',
  'item_name',
  'canonical_key',
  'quantity',
  'source_url',
  'notes',
] as const;

export const QUEST_REWARD_COLUMNS = [
  'quest_key',
  'reward_type',
  'item_name',
  'canonical_key',
  'quantity',
  'source_url',
  'notes',
] as const;

export const QUEST_SOURCE_HINT_COLUMNS = [
  'item_name',
  'canonical_key',
  'source_name',
  'source_canonical_key',
  'source_type',
  'preferred_unit',
  'source_url',
  'notes',
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

function validateHeaders(headers: string[], expectedColumns: readonly string[], label: string): void {
  const missingColumns = expectedColumns.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter((header) => !expectedColumns.includes(header));

  if (missingColumns.length === 0 && unexpectedColumns.length === 0) {
    return;
  }

  const details: string[] = [];

  if (missingColumns.length > 0) {
    details.push(`missing columns: ${missingColumns.join(', ')}`);
  }

  if (unexpectedColumns.length > 0) {
    details.push(`unexpected columns: ${unexpectedColumns.join(', ')}`);
  }

  throw new Error(`Invalid ${label} schema (${details.join('; ')}).`);
}

function parseCsvRows(csvText: string, expectedColumns: readonly string[], label: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers, expectedColumns, label);

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);

    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function parseRequiredText(value: string, fieldName: string, rowLabel: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} in ${rowLabel}.`);
  }

  return trimmedValue;
}

function parseOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseOptionalNumber(value: string, fieldName: string, rowLabel: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (Number.isFinite(parsedValue) && parsedValue >= 0) {
    return parsedValue;
  }

  throw new Error(`Invalid ${fieldName} "${value}" in ${rowLabel}.`);
}

function parseRequiredNumber(value: string, fieldName: string, rowLabel: string): number {
  const parsedValue = parseOptionalNumber(value, fieldName, rowLabel);

  if (parsedValue === null) {
    throw new Error(`Missing required ${fieldName} in ${rowLabel}.`);
  }

  return parsedValue;
}

function parseList(value: string): string[] {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeQuestKey(value: string): string {
  return toCanonicalItemKey(value);
}

function parseCoverageStatus(value: string, questName: string): QuestCoverageStatus {
  if (value === 'partial' || value === 'reviewed') {
    return value;
  }

  throw new Error(`Invalid coverage_status "${value}" for quest "${questName}".`);
}

function parseRequirementType(value: string, itemName: string): QuestRequirementType {
  if (value === 'item') {
    return value;
  }

  throw new Error(`Invalid requirement_type "${value}" for quest requirement "${itemName}".`);
}

function parseRewardType(value: string, itemName: string): QuestRewardType {
  if (value === 'item') {
    return value;
  }

  throw new Error(`Invalid reward_type "${value}" for quest reward "${itemName}".`);
}

export function parseQuestCatalogCsv(csvText: string): QuestCatalogEntry[] {
  return parseCsvRows(csvText, QUEST_CATALOG_COLUMNS, 'quest catalog CSV')
    .map((row) => {
      const questName = parseRequiredText(row.quest_name, 'quest_name', 'quest catalog row');
      const questKey = parseRequiredText(row.quest_key, 'quest_key', `quest "${questName}"`);
      const expectedQuestKey = normalizeQuestKey(questName);
      const questlineName = parseRequiredText(row.questline_name, 'questline_name', `quest "${questName}"`);
      const questlineKey = parseRequiredText(row.questline_key, 'questline_key', `quest "${questName}"`);

      if (questKey !== expectedQuestKey) {
        throw new Error(`Quest key mismatch for "${questName}": expected "${expectedQuestKey}" but found "${questKey}".`);
      }

      if (questlineKey !== normalizeQuestKey(questlineName)) {
        throw new Error(`Questline key mismatch for "${questName}".`);
      }

      return {
        questKey,
        questName,
        questlineKey,
        questlineName,
        questlineAliases: parseList(row.questline_aliases),
        stageLabel: parseOptionalText(row.stage_label),
        npc: parseOptionalText(row.npc),
        farmingLevel: parseOptionalNumber(row.farming_level, 'farming_level', `quest "${questName}"`),
        fishingLevel: parseOptionalNumber(row.fishing_level, 'fishing_level', `quest "${questName}"`),
        craftingLevel: parseOptionalNumber(row.crafting_level, 'crafting_level', `quest "${questName}"`),
        exploringLevel: parseOptionalNumber(row.exploring_level, 'exploring_level', `quest "${questName}"`),
        towerLevel: parseOptionalNumber(row.tower_level, 'tower_level', `quest "${questName}"`),
        previousQuestKey: parseOptionalText(row.previous_quest_key),
        nextQuestKeys: parseList(row.next_quest_keys),
        sourceUrl: parseRequiredText(row.source_url, 'source_url', `quest "${questName}"`),
        coverageStatus: parseCoverageStatus(row.coverage_status, questName),
        notes: parseList(row.notes),
      };
    })
    .sort((left, right) => {
      return (
        left.questlineName.localeCompare(right.questlineName) ||
        left.questName.localeCompare(right.questName)
      );
    });
}

export function parseQuestRequirementsCsv(csvText: string): QuestRequirementEntry[] {
  return parseCsvRows(csvText, QUEST_REQUIREMENT_COLUMNS, 'quest requirements CSV')
    .map((row) => {
      const itemName = parseRequiredText(row.item_name, 'item_name', 'quest requirement row');
      const canonicalKey = parseRequiredText(row.canonical_key, 'canonical_key', `quest requirement "${itemName}"`);
      const expectedCanonicalKey = toCanonicalItemKey(itemName);

      if (canonicalKey !== expectedCanonicalKey) {
        throw new Error(`Canonical key mismatch for quest requirement "${itemName}": expected "${expectedCanonicalKey}" but found "${canonicalKey}".`);
      }

      return {
        questKey: parseRequiredText(row.quest_key, 'quest_key', `quest requirement "${itemName}"`),
        requirementType: parseRequirementType(row.requirement_type, itemName),
        itemName,
        canonicalKey,
        quantity: parseRequiredNumber(row.quantity, 'quantity', `quest requirement "${itemName}"`),
        sourceUrl: parseRequiredText(row.source_url, 'source_url', `quest requirement "${itemName}"`),
        notes: parseList(row.notes),
      };
    });
}

export function parseQuestRewardsCsv(csvText: string): QuestRewardEntry[] {
  return parseCsvRows(csvText, QUEST_REWARD_COLUMNS, 'quest rewards CSV')
    .map((row) => {
      const itemName = parseRequiredText(row.item_name, 'item_name', 'quest reward row');
      const canonicalKey = parseRequiredText(row.canonical_key, 'canonical_key', `quest reward "${itemName}"`);
      const expectedCanonicalKey = toCanonicalItemKey(itemName);

      if (canonicalKey !== expectedCanonicalKey) {
        throw new Error(`Canonical key mismatch for quest reward "${itemName}": expected "${expectedCanonicalKey}" but found "${canonicalKey}".`);
      }

      return {
        questKey: parseRequiredText(row.quest_key, 'quest_key', `quest reward "${itemName}"`),
        rewardType: parseRewardType(row.reward_type, itemName),
        itemName,
        canonicalKey,
        quantity: parseRequiredNumber(row.quantity, 'quantity', `quest reward "${itemName}"`),
        sourceUrl: parseRequiredText(row.source_url, 'source_url', `quest reward "${itemName}"`),
        notes: parseList(row.notes),
      };
    });
}

export function parseQuestSourceHintsCsv(csvText: string): QuestItemSourceHintEntry[] {
  return parseCsvRows(csvText, QUEST_SOURCE_HINT_COLUMNS, 'quest source hints CSV')
    .map((row) => {
      const itemName = parseRequiredText(row.item_name, 'item_name', 'quest source hint row');
      const canonicalKey = parseRequiredText(row.canonical_key, 'canonical_key', `quest source hint "${itemName}"`);
      const sourceName = parseRequiredText(row.source_name, 'source_name', `quest source hint "${itemName}"`);
      const sourceCanonicalKey = parseRequiredText(
        row.source_canonical_key,
        'source_canonical_key',
        `quest source hint "${itemName}"`,
      );

      if (canonicalKey !== toCanonicalItemKey(itemName)) {
        throw new Error(`Canonical key mismatch for quest source hint "${itemName}".`);
      }

      if (sourceCanonicalKey !== toCanonicalItemKey(sourceName)) {
        throw new Error(`Source canonical key mismatch for quest source hint "${itemName}" from "${sourceName}".`);
      }

      return {
        itemName,
        canonicalKey,
        sourceName,
        sourceCanonicalKey,
        sourceType: parseRequiredText(row.source_type, 'source_type', `quest source hint "${itemName}"`),
        preferredUnit: parseRequiredText(row.preferred_unit, 'preferred_unit', `quest source hint "${itemName}"`),
        sourceUrl: parseRequiredText(row.source_url, 'source_url', `quest source hint "${itemName}"`),
        notes: parseList(row.notes),
      };
    });
}

export function buildQuestReferenceData(input: {
  quests: QuestCatalogEntry[];
  requirements: QuestRequirementEntry[];
  rewards: QuestRewardEntry[];
  sourceHints: QuestItemSourceHintEntry[];
}): QuestReferenceData {
  const questsByKey: Record<string, QuestCatalogEntry> = {};
  const requirementsByQuestKey: Record<string, QuestRequirementEntry[]> = {};
  const rewardsByQuestKey: Record<string, QuestRewardEntry[]> = {};
  const sourceHintsByCanonicalKey: Record<string, QuestItemSourceHintEntry[]> = {};

  for (const quest of input.quests) {
    if (questsByKey[quest.questKey]) {
      throw new Error(`Duplicate quest_key "${quest.questKey}" in quest catalog.`);
    }

    questsByKey[quest.questKey] = quest;
  }

  for (const requirement of input.requirements) {
    requirementsByQuestKey[requirement.questKey] = [
      ...(requirementsByQuestKey[requirement.questKey] ?? []),
      requirement,
    ];
  }

  for (const reward of input.rewards) {
    rewardsByQuestKey[reward.questKey] = [...(rewardsByQuestKey[reward.questKey] ?? []), reward];
  }

  for (const sourceHint of input.sourceHints) {
    sourceHintsByCanonicalKey[sourceHint.canonicalKey] = [
      ...(sourceHintsByCanonicalKey[sourceHint.canonicalKey] ?? []),
      sourceHint,
    ];
  }

  return {
    quests: input.quests,
    questsByKey,
    requirementsByQuestKey,
    rewardsByQuestKey,
    sourceHintsByCanonicalKey,
  };
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Unable to load local quest reference data from ${path}.`);
  }

  return response.text();
}

export async function loadQuestReference(): Promise<QuestReferenceData> {
  const [catalogCsv, requirementsCsv, rewardsCsv, sourceHintsCsv] = await Promise.all([
    fetchText('/data/quest_catalog.csv'),
    fetchText('/data/quest_requirements.csv'),
    fetchText('/data/quest_rewards.csv'),
    fetchText('/data/quest_item_source_hints.csv'),
  ]);

  return buildQuestReferenceData({
    quests: parseQuestCatalogCsv(catalogCsv),
    requirements: parseQuestRequirementsCsv(requirementsCsv),
    rewards: parseQuestRewardsCsv(rewardsCsv),
    sourceHints: parseQuestSourceHintsCsv(sourceHintsCsv),
  });
}
