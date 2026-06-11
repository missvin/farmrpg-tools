import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidencePath = join(
  repoRoot,
  'probe-output',
  'buddy-item-evidence-cache-current-2026-06-04',
  'parsed-multi-source',
  'buddy_item_multi_source_facts.json',
);
const questCatalogPath = join(repoRoot, 'data', 'quest_catalog.csv');
const questRequirementsPath = join(repoRoot, 'data', 'quest_requirements.csv');
const questRewardsPath = join(repoRoot, 'data', 'quest_rewards.csv');

const QUEST_CATALOG_COLUMNS = [
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
];

const QUEST_REQUIREMENT_COLUMNS = [
  'quest_key',
  'requirement_type',
  'item_name',
  'canonical_key',
  'quantity',
  'source_url',
  'notes',
];

const QUEST_REWARD_COLUMNS = [
  'quest_key',
  'reward_type',
  'item_name',
  'canonical_key',
  'quantity',
  'source_url',
  'notes',
];

const ROMAN_VALUES = new Map([
  ['I', 1],
  ['V', 5],
  ['X', 10],
  ['L', 50],
  ['C', 100],
  ['D', 500],
  ['M', 1000],
]);

const QUESTLINE_ALIASES = new Map([
  ['distant illusions', ['DI']],
  ['pirates start arriving', ['PSA', 'Pirates']],
  ['problems start arising', ['PSA', 'Problems']],
  ['pleasantly arbitrating misconstrued relational affronts, troubles skirted', ['PSA', 'Problems']],
  ['the masonry requires attention', ['PSA', 'Masonry']],
  ['the masonry requires action', ['PSA', 'Masonry']],
  ['the masonry requires activity', ['PSA', 'Masonry']],
  ['augment redbrook through masonry', ['PSA', 'Masonry']],
  ['rage against tattered masonry', ['PSA', 'Masonry']],
  ['you must build a stealth boat', ['PSA', 'Pirates']],
  ['pirate stealth arrival', ['PSA', 'Pirates']],
]);

function parseCsvRow(line) {
  const values = [];
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

function parseCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.trim().toLowerCase());
  const headerIndex = headers.reduce((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);

    return {
      get(fieldName) {
        const index = headerIndex[fieldName];
        return index === undefined ? '' : values[index] ?? '';
      },
    };
  });
}

function quoteCsvValue(value) {
  const stringValue = String(value ?? '');

  if (!/[",\r\n]/u.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/gu, '""')}"`;
}

function toCanonicalItemKey(input) {
  return input
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/gu, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

function toReviewScalar(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function readText(row, fieldName) {
  return toReviewScalar(row.get(fieldName));
}

function readRequired(row, fieldName, rowLabel) {
  const value = readText(row, fieldName);

  if (!value) {
    throw new Error(`Missing ${fieldName} in ${rowLabel}.`);
  }

  return value;
}

function splitList(value) {
  return toReviewScalar(value)
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinList(values) {
  return Array.from(new Set(values.map(toReviewScalar).filter(Boolean))).join('; ');
}

function parseRomanNumeral(value) {
  let total = 0;
  let previous = 0;

  for (const character of [...value.toUpperCase()].reverse()) {
    const current = ROMAN_VALUES.get(character);

    if (!current) {
      return null;
    }

    if (current < previous) {
      total -= current;
    } else {
      total += current;
      previous = current;
    }
  }

  return total > 0 ? total : null;
}

function getStageLabel(questName) {
  const match = toReviewScalar(questName).match(/\s([IVXLCDM]+)$/u);
  return match ? match[1] : '';
}

function getStageNumber(questName) {
  const stageLabel = getStageLabel(questName);
  return stageLabel ? parseRomanNumeral(stageLabel) : null;
}

function getQuestlineName(questName) {
  const stageLabel = getStageLabel(questName);

  if (!stageLabel) {
    return questName;
  }

  return questName.slice(0, -stageLabel.length).trim();
}

function toBuddySlug(value) {
  return toReviewScalar(value)
    .toLowerCase()
    .replace(/&/gu, ' and ')
    .replace(/['’]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function getQuestSourceUrl(questName) {
  const slug = toBuddySlug(questName);
  return slug ? `https://buddy.farm/q/${slug}/` : '';
}

function getQuestNotes(input) {
  const notes = [
    'Promoted from complete cached Buddy item-page quest evidence for BL-274.',
    'Item requirements and rewards are reverse-derived from item pages; non-item prerequisites may be absent.',
  ];

  if (input.questId) {
    notes.push(`Buddy quest id: ${input.questId}`);
  }

  if (input.questImage) {
    notes.push(`Quest image: ${input.questImage}`);
  }

  if (input.questEndDate) {
    notes.push(`Quest end date: ${input.questEndDate}`);
  }

  if (input.questHidden === true) {
    notes.push('Buddy marks this quest hidden.');
  }

  return notes.join('; ');
}

function getFactNotes(fact, kind) {
  return [
    `Promoted from complete cached Buddy item-page ${kind} evidence for BL-274.`,
    `Observed on item page: ${fact.buddyUrl}`,
    `Page data: ${fact.pageDataUrl}`,
    `Cache: ${fact.cacheFileName}`,
    `Parser: ${fact.parserVersion}`,
    fact.questId ? `Buddy quest id: ${fact.questId}` : '',
    fact.questEndDate ? `Quest end date: ${fact.questEndDate}` : '',
    fact.questHidden === true ? 'Buddy marks this quest hidden.' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function readExistingCatalog() {
  return parseCsv(readFileSync(questCatalogPath, 'utf8')).map((row) => ({
    questKey: readRequired(row, 'quest_key', 'existing quest catalog row'),
    questName: readRequired(row, 'quest_name', 'existing quest catalog row'),
    questlineKey: readRequired(row, 'questline_key', 'existing quest catalog row'),
    questlineName: readRequired(row, 'questline_name', 'existing quest catalog row'),
    questlineAliases: readText(row, 'questline_aliases'),
    stageLabel: readText(row, 'stage_label'),
    npc: readText(row, 'npc'),
    farmingLevel: readText(row, 'farming_level'),
    fishingLevel: readText(row, 'fishing_level'),
    craftingLevel: readText(row, 'crafting_level'),
    exploringLevel: readText(row, 'exploring_level'),
    towerLevel: readText(row, 'tower_level'),
    previousQuestKey: readText(row, 'previous_quest_key'),
    nextQuestKeys: readText(row, 'next_quest_keys'),
    sourceUrl: readRequired(row, 'source_url', 'existing quest catalog row'),
    coverageStatus: readRequired(row, 'coverage_status', 'existing quest catalog row'),
    notes: readText(row, 'notes'),
  }));
}

function readExistingQuestItems(path, typeFieldName) {
  return parseCsv(readFileSync(path, 'utf8')).map((row) => {
    const itemName = readRequired(row, 'item_name', `existing ${typeFieldName} row`);

    return {
      questKey: readRequired(row, 'quest_key', `existing ${typeFieldName} row`),
      type: readRequired(row, typeFieldName, `existing ${typeFieldName} row`),
      itemName,
      canonicalKey: readRequired(row, 'canonical_key', `existing ${typeFieldName} "${itemName}"`),
      quantity: readRequired(row, 'quantity', `existing ${typeFieldName} "${itemName}"`),
      sourceUrl: readRequired(row, 'source_url', `existing ${typeFieldName} "${itemName}"`),
      notes: readText(row, 'notes'),
    };
  });
}

function loadQuestFacts() {
  const parsed = JSON.parse(readFileSync(evidencePath, 'utf8'));
  return parsed.results.flatMap((result) => result.facts.questRequirementsAndRewards ?? []);
}

function isGeneratedBl274Row(entry) {
  return entry.notes.includes('complete cached Buddy item-page') && entry.notes.includes('BL-274');
}

function addQuestCatalogEntry(entriesByQuestKey, entry) {
  const existing = entriesByQuestKey.get(entry.questKey);

  if (existing) {
    return existing;
  }

  entriesByQuestKey.set(entry.questKey, entry);
  return entry;
}

function addQuestItemEntry(entriesByKey, entry, label) {
  const key = [entry.questKey, entry.canonicalKey].join('\t');
  const existing = entriesByKey.get(key);

  if (!existing) {
    entriesByKey.set(key, entry);
    return;
  }

  if (existing.quantity !== entry.quantity) {
    throw new Error(
      `Conflicting ${label} quantity for "${entry.questKey}" -> "${entry.itemName}": ${existing.quantity} vs ${entry.quantity}.`,
    );
  }
}

const existingCatalogEntries = readExistingCatalog();
const existingRequirements = readExistingQuestItems(questRequirementsPath, 'requirement_type');
const existingRewards = readExistingQuestItems(questRewardsPath, 'reward_type');
const questFacts = loadQuestFacts();
const entriesByQuestKey = new Map();
const requirementsByKey = new Map();
const rewardsByKey = new Map();
const generatedQuestMetadata = new Map();
let generatedCatalogRows = 0;
let generatedRequirementRows = 0;
let generatedRewardRows = 0;
let skippedInvalidQuantityRows = 0;

const preservedCatalogEntries = existingCatalogEntries.filter((entry) => !isGeneratedBl274Row(entry));
const preservedRequirements = existingRequirements.filter((entry) => !isGeneratedBl274Row(entry));
const preservedRewards = existingRewards.filter((entry) => !isGeneratedBl274Row(entry));

for (const entry of preservedCatalogEntries) {
  addQuestCatalogEntry(entriesByQuestKey, entry);
}

for (const entry of preservedRequirements) {
  addQuestItemEntry(requirementsByKey, entry, 'requirement');
}

for (const entry of preservedRewards) {
  addQuestItemEntry(rewardsByKey, entry, 'reward');
}

for (const fact of questFacts) {
  const questName = toReviewScalar(fact.questName);
  const itemName = toReviewScalar(fact.itemName);
  const quantity = Number(fact.quantity);

  if (!questName || !itemName || !Number.isInteger(quantity) || quantity <= 0) {
    skippedInvalidQuantityRows += 1;
    continue;
  }

  const questKey = toCanonicalItemKey(questName);
  const questlineName = getQuestlineName(questName);
  const questlineKey = toCanonicalItemKey(questlineName);
  const stageLabel = getStageLabel(questName);
  const aliases = QUESTLINE_ALIASES.get(questlineKey) ?? [];
  const existingGeneratedMetadata = generatedQuestMetadata.get(questKey) ?? {};

  generatedQuestMetadata.set(questKey, {
    questId: existingGeneratedMetadata.questId ?? toReviewScalar(fact.questId),
    questImage: existingGeneratedMetadata.questImage ?? toReviewScalar(fact.questImage),
    questEndDate: existingGeneratedMetadata.questEndDate ?? toReviewScalar(fact.questEndDate),
    questHidden: existingGeneratedMetadata.questHidden ?? fact.questHidden,
  });

  if (!entriesByQuestKey.has(questKey)) {
    addQuestCatalogEntry(entriesByQuestKey, {
      questKey,
      questName,
      questlineKey,
      questlineName,
      questlineAliases: joinList(aliases),
      stageLabel,
      npc: '',
      farmingLevel: '',
      fishingLevel: '',
      craftingLevel: '',
      exploringLevel: '',
      towerLevel: '',
      previousQuestKey: '',
      nextQuestKeys: '',
      sourceUrl: getQuestSourceUrl(questName),
      coverageStatus: 'reviewed',
      notes: getQuestNotes({
        questId: fact.questId,
        questImage: fact.questImage,
        questEndDate: fact.questEndDate,
        questHidden: fact.questHidden,
      }),
    });
    generatedCatalogRows += 1;
  }

  const itemEntry = {
    questKey,
    type: 'item',
    itemName,
    canonicalKey: toCanonicalItemKey(itemName),
    quantity: String(quantity),
    sourceUrl: fact.buddyUrl,
    notes: getFactNotes(fact, fact.factType === 'quest_requirement' ? 'requirement' : 'reward'),
  };

  if (fact.factType === 'quest_requirement') {
    const before = requirementsByKey.size;
    addQuestItemEntry(requirementsByKey, itemEntry, 'requirement');
    generatedRequirementRows += requirementsByKey.size > before ? 1 : 0;
  } else if (fact.factType === 'quest_reward') {
    const before = rewardsByKey.size;
    addQuestItemEntry(rewardsByKey, itemEntry, 'reward');
    generatedRewardRows += rewardsByKey.size > before ? 1 : 0;
  }
}

const entriesByQuestlineKey = new Map();

for (const entry of entriesByQuestKey.values()) {
  entriesByQuestlineKey.set(entry.questlineKey, [
    ...(entriesByQuestlineKey.get(entry.questlineKey) ?? []),
    entry,
  ]);
}

for (const questlineEntries of entriesByQuestlineKey.values()) {
  const entriesByStage = new Map();

  for (const entry of questlineEntries) {
    const stageNumber = getStageNumber(entry.questName);

    if (stageNumber !== null && !entriesByStage.has(stageNumber)) {
      entriesByStage.set(stageNumber, entry);
    }
  }

  for (const [stageNumber, entry] of entriesByStage.entries()) {
    if (!entry.previousQuestKey) {
      entry.previousQuestKey = entriesByStage.get(stageNumber - 1)?.questKey ?? '';
    }

    if (!entry.nextQuestKeys) {
      entry.nextQuestKeys = entriesByStage.get(stageNumber + 1)?.questKey ?? '';
    }
  }
}

for (const entry of entriesByQuestKey.values()) {
  if (!entry.previousQuestKey) {
    continue;
  }

  const previousEntry = entriesByQuestKey.get(entry.previousQuestKey);

  if (!previousEntry) {
    continue;
  }

  previousEntry.nextQuestKeys = joinList([...splitList(previousEntry.nextQuestKeys), entry.questKey]);
}

const catalogEntries = [...entriesByQuestKey.values()].sort((left, right) => {
  const questlineComparison = left.questlineName.localeCompare(right.questlineName);

  if (questlineComparison !== 0) {
    return questlineComparison;
  }

  const leftStage = getStageNumber(left.questName);
  const rightStage = getStageNumber(right.questName);

  if (leftStage !== null && rightStage !== null && leftStage !== rightStage) {
    return leftStage - rightStage;
  }

  return left.questName.localeCompare(right.questName);
});

const requirementEntries = [...requirementsByKey.values()].sort((left, right) => {
  return left.questKey.localeCompare(right.questKey) || left.itemName.localeCompare(right.itemName);
});

const rewardEntries = [...rewardsByKey.values()].sort((left, right) => {
  return left.questKey.localeCompare(right.questKey) || left.itemName.localeCompare(right.itemName);
});

writeFileSync(
  questCatalogPath,
  [
    QUEST_CATALOG_COLUMNS.join(','),
    ...catalogEntries.map((entry) =>
      [
        entry.questKey,
        entry.questName,
        entry.questlineKey,
        entry.questlineName,
        entry.questlineAliases,
        entry.stageLabel,
        entry.npc,
        entry.farmingLevel,
        entry.fishingLevel,
        entry.craftingLevel,
        entry.exploringLevel,
        entry.towerLevel,
        entry.previousQuestKey,
        entry.nextQuestKeys,
        entry.sourceUrl,
        entry.coverageStatus,
        entry.notes,
      ]
        .map(quoteCsvValue)
        .join(',')),
  ].join('\n') + '\n',
  'utf8',
);

writeFileSync(
  questRequirementsPath,
  [
    QUEST_REQUIREMENT_COLUMNS.join(','),
    ...requirementEntries.map((entry) =>
      [
        entry.questKey,
        entry.type,
        entry.itemName,
        entry.canonicalKey,
        entry.quantity,
        entry.sourceUrl,
        entry.notes,
      ]
        .map(quoteCsvValue)
        .join(',')),
  ].join('\n') + '\n',
  'utf8',
);

writeFileSync(
  questRewardsPath,
  [
    QUEST_REWARD_COLUMNS.join(','),
    ...rewardEntries.map((entry) =>
      [
        entry.questKey,
        entry.type,
        entry.itemName,
        entry.canonicalKey,
        entry.quantity,
        entry.sourceUrl,
        entry.notes,
      ]
        .map(quoteCsvValue)
        .join(',')),
  ].join('\n') + '\n',
  'utf8',
);

console.log(`Wrote data/quest_catalog.csv with ${catalogEntries.length.toLocaleString()} quest rows.`);
console.log(`Wrote data/quest_requirements.csv with ${requirementEntries.length.toLocaleString()} requirement rows.`);
console.log(`Wrote data/quest_rewards.csv with ${rewardEntries.length.toLocaleString()} reward rows.`);
console.log(`Preserved ${preservedCatalogEntries.length.toLocaleString()} existing quest catalog rows as metadata overrides.`);
console.log(`Regenerated ${(existingCatalogEntries.length - preservedCatalogEntries.length).toLocaleString()} prior BL-274 quest catalog rows.`);
console.log(`Preserved ${preservedRequirements.length.toLocaleString()} existing requirement rows as metadata overrides.`);
console.log(`Regenerated ${(existingRequirements.length - preservedRequirements.length).toLocaleString()} prior BL-274 requirement rows.`);
console.log(`Preserved ${preservedRewards.length.toLocaleString()} existing reward rows as metadata overrides.`);
console.log(`Regenerated ${(existingRewards.length - preservedRewards.length).toLocaleString()} prior BL-274 reward rows.`);
console.log(`Generated ${generatedCatalogRows.toLocaleString()} new quest catalog rows.`);
console.log(`Generated ${generatedRequirementRows.toLocaleString()} new requirement rows.`);
console.log(`Generated ${generatedRewardRows.toLocaleString()} new reward rows.`);
console.log(`Skipped ${skippedInvalidQuantityRows.toLocaleString()} quest fact rows with invalid quantities or names.`);
