export const QUEST_EXTRACTION_STATUSES = ['extracted', 'partial', 'uncertain'];

const TARGET_COLUMNS = ['quest_name', 'buddy_url', 'questline_name', 'questline_aliases', 'notes'];

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

function escapeCsvValue(value) {
  const stringValue = value === null || value === undefined ? '' : String(value);

  if (/[",\n]/u.test(stringValue)) {
    return `"${stringValue.replace(/"/gu, '""')}"`;
  }

  return stringValue;
}

function normalizeHeader(header) {
  return header.trim().toLowerCase();
}

function normalizeKey(value) {
  return String(value ?? '').toLowerCase().trim().replace(/\s+/gu, ' ');
}

function readField(values, headerIndex, fieldName) {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function splitList(value) {
  return String(value ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateHeaders(headers, expectedColumns, label) {
  const missingColumns = expectedColumns.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter((header) => !expectedColumns.includes(header));

  if (missingColumns.length === 0 && unexpectedColumns.length === 0) {
    return;
  }

  const details = [];

  if (missingColumns.length > 0) {
    details.push(`missing columns: ${missingColumns.join(', ')}`);
  }

  if (unexpectedColumns.length > 0) {
    details.push(`unexpected columns: ${unexpectedColumns.join(', ')}`);
  }

  throw new Error(`Invalid ${label} schema (${details.join('; ')}).`);
}

function normalizeBuddyUrl(value) {
  try {
    return new URL(value, 'https://buddy.farm').href;
  } catch {
    return value;
  }
}

function asNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function asNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}

function normalizeNamedReference(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (typeof value === 'object') {
    return asNullableString(value.name ?? value.title ?? value.questName);
  }

  return null;
}

function normalizeNamedReferenceList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(normalizeNamedReference).filter(Boolean);
  }

  const singleValue = normalizeNamedReference(value);
  return singleValue ? [singleValue] : [];
}

function inferStageLabel(questName) {
  const match = String(questName ?? '').trim().match(/\b([IVXLCDM]+)$/u);
  return match ? match[1] : null;
}

function normalizeItemQuantityRow(row, fallbackSourceUrl, notes) {
  const item = row?.item ?? row?.reward ?? row?.requirement ?? null;
  const itemName = asNullableString(
    firstPresent(row?.itemName, row?.item_name, item?.name, item?.itemName, row?.name),
  );
  const quantity = asNullableNumber(firstPresent(row?.quantity, row?.qty, row?.amount, row?.count));

  if (!itemName || quantity === null || quantity <= 0) {
    return {
      row: null,
      warning: 'Item quantity row was missing a recognizable item name or positive quantity.',
    };
  }

  return {
    row: {
      itemName,
      canonicalKey: normalizeKey(itemName),
      quantity,
      sourceUrl: asNullableString(row?.sourceUrl) ?? fallbackSourceUrl,
      notes: [...notes, ...splitList(row?.notes ?? '')],
    },
    warning: null,
  };
}

export function getBuddyQuestPageDataUrl(buddyUrl) {
  const parsedUrl = new URL(buddyUrl, 'https://buddy.farm');

  if (parsedUrl.hostname !== 'buddy.farm') {
    throw new Error(`Expected a buddy.farm URL but received ${buddyUrl}.`);
  }

  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const [pageType, slug] = pathParts;

  if (!['q', 'quest'].includes(pageType) || !slug || pathParts.length !== 2) {
    throw new Error(`Expected a buddy quest URL shaped like /q/<slug>/ but received ${buddyUrl}.`);
  }

  return `https://buddy.farm/page-data/${pageType}/${slug}/page-data.json`;
}

export function parseBuddyQuestTargetCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers, TARGET_COLUMNS, 'buddy quest target CSV');
  const headerIndex = headers.reduce((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);

    return {
      questName: readField(values, headerIndex, 'quest_name').trim(),
      buddyUrl: normalizeBuddyUrl(readField(values, headerIndex, 'buddy_url').trim()),
      questlineName: readField(values, headerIndex, 'questline_name').trim(),
      questlineAliases: splitList(readField(values, headerIndex, 'questline_aliases')),
      notes: splitList(readField(values, headerIndex, 'notes')),
    };
  });
}

export function extractBuddyQuestPage(target, pageData, pageDataUrl = getBuddyQuestPageDataUrl(target.buddyUrl)) {
  const farmrpgData = pageData?.result?.data?.farmrpg ?? {};
  const questCandidates = [
    ...(Array.isArray(farmrpgData.quests) ? farmrpgData.quests : []),
    ...(farmrpgData.quest ? [farmrpgData.quest] : []),
  ];
  const flags = [];
  const notes = [...target.notes];

  if (questCandidates.length !== 1) {
    return {
      target,
      pageDataUrl,
      pageName: target.questName,
      extractionStatus: 'uncertain',
      catalogRow: null,
      requirementRows: [],
      rewardRows: [],
      flags: ['quest_payload_not_unique'],
      notes: ['Page data did not contain exactly one recognizable quest payload.'],
    };
  }

  const quest = questCandidates[0];
  const questName = asNullableString(firstPresent(quest.name, quest.title, quest.questName, target.questName));
  const questlineName = asNullableString(
    firstPresent(quest.questline?.name, quest.questLine?.name, quest.questlineName, target.questlineName),
  );

  if (!questName || !questlineName) {
    return {
      target,
      pageDataUrl,
      pageName: questName ?? target.questName,
      extractionStatus: 'uncertain',
      catalogRow: null,
      requirementRows: [],
      rewardRows: [],
      flags: ['missing_quest_identity'],
      notes: ['Quest payload was missing quest name or questline name.'],
    };
  }

  const previousQuestName = normalizeNamedReference(
    firstPresent(quest.previousQuest, quest.previous, quest.prevQuest, quest.pred),
  );
  const nextQuestNames = normalizeNamedReferenceList(
    firstPresent(quest.nextQuests, quest.nextQuest, quest.next, quest.dependentQuests),
  );
  const requirementInputs = Array.isArray(quest.requirements)
    ? quest.requirements
    : Array.isArray(quest.itemsRequired)
      ? quest.itemsRequired
      : Array.isArray(quest.requiredItems)
        ? quest.requiredItems
        : [];
  const rewardInputs = Array.isArray(quest.rewards)
    ? quest.rewards
    : Array.isArray(quest.itemRewards)
      ? quest.itemRewards
      : Array.isArray(quest.rewardItems)
        ? quest.rewardItems
        : [];
  const requirementRows = [];
  const rewardRows = [];

  for (const requirement of requirementInputs) {
    const parsedRequirement = normalizeItemQuantityRow(requirement, target.buddyUrl, notes);

    if (parsedRequirement.row) {
      requirementRows.push({
        questKey: normalizeKey(questName),
        requirementType: 'item',
        ...parsedRequirement.row,
      });
    } else {
      flags.push('requirement_needs_review');
      notes.push(parsedRequirement.warning);
    }
  }

  for (const reward of rewardInputs) {
    const parsedReward = normalizeItemQuantityRow(reward, target.buddyUrl, notes);

    if (parsedReward.row) {
      rewardRows.push({
        questKey: normalizeKey(questName),
        rewardType: 'item',
        ...parsedReward.row,
      });
    } else {
      flags.push('reward_needs_review');
      notes.push(parsedReward.warning);
    }
  }

  if (requirementInputs.length === 0) {
    flags.push('no_requirements_found');
    notes.push('No item requirement array was found in the quest payload.');
  }

  if (rewardInputs.length === 0) {
    flags.push('no_rewards_found');
    notes.push('No item reward array was found in the quest payload.');
  }

  const catalogRow = {
    questKey: normalizeKey(questName),
    questName,
    questlineKey: normalizeKey(questlineName),
    questlineName,
    questlineAliases: target.questlineAliases,
    stageLabel: asNullableString(firstPresent(quest.stageLabel, quest.stage, quest.sequenceLabel)) ?? inferStageLabel(questName),
    npc: normalizeNamedReference(firstPresent(quest.npc, quest.requester, quest.character)),
    farmingLevel: asNullableNumber(firstPresent(quest.farmingLevel, quest.farming_level, quest.requiredFarmingLevel)),
    fishingLevel: asNullableNumber(firstPresent(quest.fishingLevel, quest.fishing_level, quest.requiredFishingLevel)),
    craftingLevel: asNullableNumber(firstPresent(quest.craftingLevel, quest.crafting_level, quest.requiredCraftingLevel)),
    exploringLevel: asNullableNumber(firstPresent(quest.exploringLevel, quest.exploring_level, quest.requiredExploringLevel)),
    towerLevel: asNullableNumber(firstPresent(quest.towerLevel, quest.tower_level, quest.requiredTowerLevel)),
    previousQuestKey: previousQuestName ? normalizeKey(previousQuestName) : null,
    nextQuestKeys: nextQuestNames.map(normalizeKey),
    sourceUrl: target.buddyUrl,
    coverageStatus: flags.length > 0 ? 'partial' : 'reviewed',
    notes,
  };

  return {
    target,
    pageDataUrl,
    pageName: questName,
    extractionStatus: flags.length > 0 ? 'partial' : 'extracted',
    catalogRow,
    requirementRows,
    rewardRows,
    flags,
    notes,
  };
}

export async function extractBuddyQuestTargets(targets, options = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const interRequestDelayMs = options.interRequestDelayMs ?? 3000;
  const results = [];

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    let pageDataUrl = null;

    try {
      pageDataUrl = getBuddyQuestPageDataUrl(target.buddyUrl);
      const response = await fetchFn(pageDataUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        results.push({
          target,
          pageDataUrl,
          pageName: target.questName,
          extractionStatus: 'uncertain',
          catalogRow: null,
          requirementRows: [],
          rewardRows: [],
          httpStatus: response.status,
          flags: [`http_${response.status}`],
          notes: [`Expected a successful buddy page-data fetch but received HTTP ${response.status}.`],
        });
      } else {
        const pageData = await response.json();
        results.push({
          ...extractBuddyQuestPage(target, pageData, pageDataUrl),
          httpStatus: response.status,
        });
      }
    } catch (error) {
      results.push({
        target,
        pageDataUrl,
        pageName: target.questName,
        extractionStatus: 'uncertain',
        catalogRow: null,
        requirementRows: [],
        rewardRows: [],
        httpStatus: null,
        flags: ['fetch_error'],
        notes: [error instanceof Error ? error.message : 'Unknown fetch failure.'],
      });
    }

    if (index < targets.length - 1) {
      await sleepFn(interRequestDelayMs);
    }
  }

  const catalogRows = results.map((result) => result.catalogRow).filter(Boolean);
  const requirementRows = results.flatMap((result) => result.requirementRows);
  const rewardRows = results.flatMap((result) => result.rewardRows);
  const reviewResults = results.filter((result) => result.extractionStatus !== 'extracted');
  const countsByStatus = results.reduce((counts, result) => {
    counts[result.extractionStatus] = (counts[result.extractionStatus] ?? 0) + 1;
    return counts;
  }, {});

  return {
    results,
    catalogRows,
    requirementRows,
    rewardRows,
    summary: {
      targetsProcessed: results.length,
      catalogRows: catalogRows.length,
      requirementRows: requirementRows.length,
      rewardRows: rewardRows.length,
      countsByStatus,
      reviewPageCount: reviewResults.length,
      warnings: reviewResults.length > 0
        ? [`${reviewResults.length.toLocaleString()} quest page(s) need review before promotion.`]
        : [],
    },
  };
}

export function toBuddyQuestExtractionJson(extractionResult) {
  return JSON.stringify(extractionResult, null, 2);
}

export function toBuddyQuestCatalogCsv(extractionResult) {
  const rows = [
    'quest_key,quest_name,questline_key,questline_name,questline_aliases,stage_label,npc,farming_level,fishing_level,crafting_level,exploring_level,tower_level,previous_quest_key,next_quest_keys,source_url,coverage_status,notes',
  ];

  for (const row of extractionResult.catalogRows) {
    rows.push(
      [
        row.questKey,
        row.questName,
        row.questlineKey,
        row.questlineName,
        row.questlineAliases.join('; '),
        row.stageLabel ?? '',
        row.npc ?? '',
        row.farmingLevel ?? '',
        row.fishingLevel ?? '',
        row.craftingLevel ?? '',
        row.exploringLevel ?? '',
        row.towerLevel ?? '',
        row.previousQuestKey ?? '',
        row.nextQuestKeys.join('; '),
        row.sourceUrl,
        row.coverageStatus,
        row.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyQuestRequirementsCsv(extractionResult) {
  const rows = ['quest_key,requirement_type,item_name,canonical_key,quantity,source_url,notes'];

  for (const row of extractionResult.requirementRows) {
    rows.push(
      [
        row.questKey,
        row.requirementType,
        row.itemName,
        row.canonicalKey,
        row.quantity,
        row.sourceUrl,
        row.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyQuestRewardsCsv(extractionResult) {
  const rows = ['quest_key,reward_type,item_name,canonical_key,quantity,source_url,notes'];

  for (const row of extractionResult.rewardRows) {
    rows.push(
      [
        row.questKey,
        row.rewardType,
        row.itemName,
        row.canonicalKey,
        row.quantity,
        row.sourceUrl,
        row.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyQuestReviewCsv(extractionResult) {
  const rows = ['quest_name,buddy_url,page_data_url,status,flags,notes'];

  for (const result of extractionResult.results.filter((entry) => entry.extractionStatus !== 'extracted')) {
    rows.push(
      [
        result.pageName || result.target.questName,
        result.target.buddyUrl,
        result.pageDataUrl ?? '',
        result.extractionStatus,
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}
