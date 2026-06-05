export const BUDDY_ITEM_MULTI_SOURCE_PARSER_VERSION = 'buddy-item-multi-source-v1';

const ITEM_PAGE_URL_PREFIX = 'https://buddy.farm/i/';
const ITEM_IMAGE_URL_PREFIX = 'https://farmrpg.com';

const KNOWN_SOURCE_SECTION_KEYS = new Set([
  'cardsTrades',
  'communityCenterOutputs',
  'cookingRecipeCookable',
  'cookingRecipeItem',
  'dropRates',
  'dropRatesItems',
  'exchangeCenterInputs',
  'exchangeCenterOutputs',
  'locksmithItems',
  'locksmithKey',
  'locksmithKeyItems',
  'locksmithOutputItems',
  'manualProductions',
  'npcItems',
  'npcRewards',
  'passwordItems',
  'petItems',
  'quizRewards',
  'recipeIngredientItems',
  'recipeItems',
  'requiredForQuests',
  'rewardForQuests',
  'skillLevelRewards',
  'templeRewardItems',
  'towerRewards',
  'wishingWellInputItems',
  'wishingWellOutputItems',
]);

function escapeCsvValue(value) {
  const stringValue = value === null || value === undefined ? '' : String(value);

  if (/[",\n]/u.test(stringValue)) {
    return `"${stringValue.replace(/"/gu, '""')}"`;
  }

  return stringValue;
}

function normalizeBoolean(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  return null;
}

function toCanonicalItemKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[â€™`]/gu, "'")
    .replace(/&/gu, 'and')
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function getBuddySlug(buddyUrl) {
  try {
    const [, slug] = new URL(buddyUrl).pathname.split('/').filter(Boolean);
    return slug ?? '';
  } catch {
    return '';
  }
}

function getBuddyItemUrlFromSlug(slug) {
  return slug ? `${ITEM_PAGE_URL_PREFIX}${slug}/` : '';
}

function getBuddyItemUrlFromName(itemName) {
  const slug = String(itemName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return getBuddyItemUrlFromSlug(slug);
}

function normalizeIconPathname(image) {
  if (!image) {
    return null;
  }

  try {
    return new URL(image, ITEM_IMAGE_URL_PREFIX).pathname;
  } catch {
    return image.startsWith('/') ? image : `/${image}`;
  }
}

function getIconUrl(image) {
  if (!image) {
    return null;
  }

  try {
    return new URL(image, ITEM_IMAGE_URL_PREFIX).href;
  } catch {
    return null;
  }
}

function getIconFilename(image) {
  const pathname = normalizeIconPathname(image);

  if (!pathname) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

function getIconAssetKey(iconFilename) {
  if (!iconFilename) {
    return null;
  }

  const extension = iconFilename.match(/\.[^.]+$/u)?.[0] ?? '';
  return extension ? iconFilename.slice(0, -extension.length) : iconFilename;
}

function getFarmRpgItemIdCandidate(iconFilename) {
  const assetKey = getIconAssetKey(iconFilename);
  return assetKey && /^\d+$/u.test(assetKey) ? assetKey : null;
}

function itemRef(item) {
  if (!item?.name) {
    return {
      itemName: '',
      canonicalKey: '',
      farmrpgItemId: null,
      image: null,
      buddyUrl: '',
    };
  }

  return {
    itemName: item.name,
    canonicalKey: toCanonicalItemKey(item.name),
    farmrpgItemId: item.id === undefined || item.id === null ? null : String(item.id),
    image: item.image ?? null,
    buddyUrl: getBuddyItemUrlFromName(item.name),
  };
}

function quantityKind(quantityMin, quantityMax) {
  if (quantityMin === null || quantityMin === undefined || quantityMax === null || quantityMax === undefined) {
    return 'unknown';
  }

  return Number(quantityMin) === Number(quantityMax) ? 'fixed' : 'range';
}

function recipeTypeForItem(item) {
  if (item?.canCook || item?.cookingRecipeItem) {
    return 'cooking';
  }

  if (item?.canCraft) {
    return 'craft';
  }

  return 'unknown';
}

function createBaseFact(evidence, item, factType, fields = {}) {
  return {
    factType,
    itemName: item?.name ?? evidence.itemName,
    canonicalKey: toCanonicalItemKey(item?.name ?? evidence.itemName),
    buddyUrl: evidence.buddyUrl,
    pageDataUrl: evidence.pageDataUrl,
    cacheFileName: evidence.cacheFileName ?? '',
    fetchedAt: evidence.fetchedAt ?? '',
    parserVersion: BUDDY_ITEM_MULTI_SOURCE_PARSER_VERSION,
    flags: [],
    notes: [],
    ...fields,
  };
}

function extractItem(evidence) {
  return evidence?.pageData?.result?.data?.farmrpg?.items?.[0] ?? null;
}

function extractItemMetadata(evidence, item) {
  const iconFilename = getIconFilename(item?.image);
  const iconAssetKey = getIconAssetKey(iconFilename);

  return {
    itemName: item?.name ?? evidence.itemName,
    canonicalKey: toCanonicalItemKey(item?.name ?? evidence.itemName),
    farmrpgItemId: item?.id === undefined || item?.id === null ? null : String(item.id),
    buddySlug: getBuddySlug(evidence.buddyUrl),
    buddyUrl: evidence.buddyUrl,
    pageDataUrl: evidence.pageDataUrl,
    pageTitle: evidence.pageTitle ?? item?.name ?? evidence.itemName,
    itemType: item?.type ?? null,
    description: item?.description ?? null,
    canBuy: normalizeBoolean(item?.canBuy),
    canMail: normalizeBoolean(item?.canMail),
    canCraft: normalizeBoolean(item?.canCraft),
    canCook: normalizeBoolean(item?.canCook),
    canFleaMarket: normalizeBoolean(item?.canFleaMarket),
    craftingLevel: item?.craftingLevel ?? null,
    cookingLevel: item?.cookingLevel ?? null,
    iconUrl: getIconUrl(item?.image),
    iconPathname: normalizeIconPathname(item?.image),
    iconFilename,
    iconAssetKey,
    farmrpgItemIdCandidate: getFarmRpgItemIdCandidate(iconFilename),
  };
}

function extractRecipeFacts(evidence, item) {
  const ingredients = item?.recipeItems ?? [];

  if (ingredients.length === 0) {
    return [];
  }

  return [
    createBaseFact(evidence, item, 'recipe', {
      outputItemName: item.name,
      outputCanonicalKey: toCanonicalItemKey(item.name),
      recipeType: recipeTypeForItem(item),
      recipeBookItemName: item.cookingRecipeItem?.name ?? '',
      recipeBookCanonicalKey: toCanonicalItemKey(item.cookingRecipeItem?.name ?? ''),
      cookingLevel: item.canCook || item.cookingRecipeItem ? item.cookingLevel ?? '' : '',
      baseTime: '',
      ingredients: ingredients.map((entry, index) => {
        const ingredient = itemRef(entry.item);
        return {
          inputOrder: index + 1,
          inputItemName: ingredient.itemName,
          inputCanonicalKey: ingredient.canonicalKey,
          inputFarmrpgItemId: ingredient.farmrpgItemId,
          inputImage: ingredient.image,
          quantity: entry.quantity ?? null,
        };
      }),
    }),
  ];
}

function extractUsedInFacts(evidence, item) {
  return (item?.recipeIngredientItems ?? []).map((entry) => {
    const output = itemRef(entry.item);

    return createBaseFact(evidence, item, 'used_in_recipe', {
      inputItemName: item.name,
      inputCanonicalKey: toCanonicalItemKey(item.name),
      outputItemName: output.itemName,
      outputCanonicalKey: output.canonicalKey,
      outputFarmrpgItemId: output.farmrpgItemId,
      outputImage: output.image,
      quantity: entry.quantity ?? null,
      outputCanCraft: normalizeBoolean(entry.item?.canCraft),
      outputCanCook: normalizeBoolean(entry.item?.canCook),
    });
  });
}

function extractDropRateFacts(evidence, item) {
  return (item?.dropRatesItems ?? []).map((entry) => {
    const sourceLocation = entry.dropRates?.location ?? null;
    const sourceSeed = entry.dropRates?.seed ?? null;
    const source = sourceLocation ?? sourceSeed ?? null;
    const flags = [];
    const notes = [];

    if (!source) {
      flags.push('missing_source');
      notes.push('Drop-rate row did not include a location or seed source.');
    }

    if (sourceLocation && sourceSeed) {
      flags.push('multiple_source_shapes');
      notes.push('Drop-rate row included both location and seed source data.');
    }

    return createBaseFact(evidence, item, 'drop_rate', {
      targetItemName: item.name,
      targetCanonicalKey: toCanonicalItemKey(item.name),
      targetFarmrpgItemId: item.id === undefined || item.id === null ? null : String(item.id),
      targetItemImage: item.image ?? null,
      sourceName: source?.name ?? '',
      sourceCanonicalKey: toCanonicalItemKey(source?.name ?? ''),
      sourceType: sourceLocation?.type ?? (sourceSeed ? 'farming' : ''),
      sourceKind: sourceLocation ? 'location' : sourceSeed ? 'seed' : '',
      sourceImage: source?.image ?? null,
      rawRate: entry.rate ?? null,
      baseDropRate: sourceLocation?.baseDropRate ?? null,
      ironDepot: normalizeBoolean(entry.dropRates?.ironDepot),
      manualFishing: normalizeBoolean(entry.dropRates?.manualFishing),
      runecube: normalizeBoolean(entry.dropRates?.runecube),
      rowKind: 'item_source',
      flags,
      notes,
    });
  });
}

function extractPetFacts(evidence, item) {
  return (item?.petItems ?? []).map((entry) => {
    const pet = itemRef(entry.pet);

    return createBaseFact(evidence, item, 'pet_source', {
      petName: pet.itemName,
      petCanonicalKey: pet.canonicalKey,
      petImage: pet.image,
      itemName: item.name,
      itemCanonicalKey: toCanonicalItemKey(item.name),
      unlockLevel: entry.level ?? null,
      coverageStatus: 'candidate',
    });
  });
}

function extractOpenableContentFacts(evidence, item) {
  return (item?.locksmithItems ?? []).map((entry) => {
    const output = itemRef(entry.outputItem);

    return createBaseFact(evidence, item, 'openable_content', {
      relationDirection: 'container_to_content',
      openableItemName: item.name,
      openableCanonicalKey: toCanonicalItemKey(item.name),
      contentItemName: output.itemName,
      contentCanonicalKey: output.canonicalKey,
      contentFarmrpgItemId: output.farmrpgItemId,
      contentImage: output.image,
      quantityMin: entry.quantityMin ?? null,
      quantityMax: entry.quantityMax ?? null,
      quantityKind: quantityKind(entry.quantityMin, entry.quantityMax),
    });
  });
}

function extractOpenableSourceFacts(evidence, item) {
  return (item?.locksmithOutputItems ?? []).map((entry) => {
    const openable = itemRef(entry.item);

    return createBaseFact(evidence, item, 'openable_source', {
      relationDirection: 'content_to_container',
      openableItemName: openable.itemName,
      openableCanonicalKey: openable.canonicalKey,
      openableFarmrpgItemId: openable.farmrpgItemId,
      openableImage: openable.image,
      contentItemName: item.name,
      contentCanonicalKey: toCanonicalItemKey(item.name),
      quantityMin: entry.quantityMin ?? null,
      quantityMax: entry.quantityMax ?? null,
      quantityKind: quantityKind(entry.quantityMin, entry.quantityMax),
    });
  });
}

function extractWishingWellOutputFacts(evidence, item) {
  return (item?.wishingWellInputItems ?? []).map((entry) => {
    const output = itemRef(entry.outputItem);

    return createBaseFact(evidence, item, 'wishing_well_output', {
      relationDirection: 'thrown_to_reward',
      thrownItemName: item.name,
      thrownCanonicalKey: toCanonicalItemKey(item.name),
      rewardItemName: output.itemName,
      rewardCanonicalKey: output.canonicalKey,
      rewardFarmrpgItemId: output.farmrpgItemId,
      rewardImage: output.image,
      rewardChance: entry.chance ?? null,
      rewardQuantity: 1,
      flags: ['reward_quantity_defaulted'],
      notes: ['Buddy page data exposes reward chance but not reward quantity; candidate export defaults quantity to 1 for review.'],
    });
  });
}

function extractWishingWellInputFacts(evidence, item) {
  return (item?.wishingWellOutputItems ?? []).map((entry) => {
    const input = itemRef(entry.inputItem);

    return createBaseFact(evidence, item, 'wishing_well_input', {
      relationDirection: 'reward_to_thrown',
      thrownItemName: input.itemName,
      thrownCanonicalKey: input.canonicalKey,
      thrownFarmrpgItemId: input.farmrpgItemId,
      thrownImage: input.image,
      rewardItemName: item.name,
      rewardCanonicalKey: toCanonicalItemKey(item.name),
      rewardChance: entry.chance ?? null,
      rewardQuantity: 1,
      flags: ['reverse_relation', 'reward_quantity_defaulted'],
      notes: ['Reverse Wishing Well relation from reward page; candidate export defaults quantity to 1 for review.'],
    });
  });
}

function extractQuestFacts(evidence, item) {
  const required = (item?.requiredForQuests ?? []).map((entry) =>
    createBaseFact(evidence, item, 'quest_requirement', {
      itemName: item.name,
      canonicalKey: toCanonicalItemKey(item.name),
      quantity: entry.quantity ?? null,
      questId: entry.quest?.id === undefined || entry.quest?.id === null ? null : String(entry.quest.id),
      questName: entry.quest?.name ?? '',
      questImage: entry.quest?.image ?? null,
      questEndDate: entry.quest?.endDate ?? null,
      questHidden: normalizeBoolean(entry.quest?.isHidden),
    }),
  );
  const rewarded = (item?.rewardForQuests ?? []).map((entry) =>
    createBaseFact(evidence, item, 'quest_reward', {
      itemName: item.name,
      canonicalKey: toCanonicalItemKey(item.name),
      quantity: entry.quantity ?? null,
      questId: entry.quest?.id === undefined || entry.quest?.id === null ? null : String(entry.quest.id),
      questName: entry.quest?.name ?? '',
      questImage: entry.quest?.image ?? null,
      questEndDate: entry.quest?.endDate ?? null,
      questHidden: normalizeBoolean(entry.quest?.isHidden),
    }),
  );

  return [...required, ...rewarded];
}

function findUnknownDetectedSections(evidence) {
  return (evidence.detectedSections ?? []).filter((section) => !KNOWN_SOURCE_SECTION_KEYS.has(section));
}

export function parseBuddyItemEvidenceRecord(evidence, options = {}) {
  const cacheFileName = options.cacheFileName ?? evidence.cacheFileName ?? '';
  const item = extractItem(evidence);
  const warnings = [];
  const flags = [];

  if (evidence.httpStatus !== 200) {
    flags.push('terminal_or_non_success_evidence');
    warnings.push(`Evidence HTTP status is ${evidence.httpStatus ?? 'unknown'}; source facts were not parsed.`);
  }

  if (!item) {
    flags.push('missing_item_payload');
    warnings.push('No FarmRPG item payload was found in the cached Buddy page data.');
  }

  const unknownDetectedSections = findUnknownDetectedSections(evidence);
  if (unknownDetectedSections.length > 0) {
    flags.push('unknown_detected_sections');
    warnings.push(`Detected non-empty page sections without parser handling: ${unknownDetectedSections.join(', ')}.`);
  }

  const parsed = {
    parserVersion: BUDDY_ITEM_MULTI_SOURCE_PARSER_VERSION,
    evidenceType: evidence.evidenceType ?? '',
    evidenceExtractionVersion: evidence.extractionVersion ?? '',
    cacheFileName,
    fetchedAt: evidence.fetchedAt ?? '',
    httpStatus: evidence.httpStatus ?? null,
    sourceStatus: evidence.sourceStatus ?? '',
    itemName: item?.name ?? evidence.itemName,
    canonicalKey: toCanonicalItemKey(item?.name ?? evidence.itemName),
    buddyUrl: evidence.buddyUrl,
    pageDataUrl: evidence.pageDataUrl,
    pageTitle: evidence.pageTitle ?? item?.name ?? evidence.itemName,
    metadata: item ? extractItemMetadata(evidence, item) : null,
    facts: {
      recipes: [],
      usedInRecipes: [],
      dropRates: [],
      petSources: [],
      openableContents: [],
      openableSources: [],
      wishingWellOutputs: [],
      wishingWellInputs: [],
      questRequirementsAndRewards: [],
    },
    unknownDetectedSections,
    flags,
    warnings,
  };

  if (!item || evidence.httpStatus !== 200) {
    return parsed;
  }

  parsed.facts.recipes = extractRecipeFacts(evidence, item);
  parsed.facts.usedInRecipes = extractUsedInFacts(evidence, item);
  parsed.facts.dropRates = extractDropRateFacts(evidence, item);
  parsed.facts.petSources = extractPetFacts(evidence, item);
  parsed.facts.openableContents = extractOpenableContentFacts(evidence, item);
  parsed.facts.openableSources = extractOpenableSourceFacts(evidence, item);
  parsed.facts.wishingWellOutputs = extractWishingWellOutputFacts(evidence, item);
  parsed.facts.wishingWellInputs = extractWishingWellInputFacts(evidence, item);
  parsed.facts.questRequirementsAndRewards = extractQuestFacts(evidence, item);

  return parsed;
}

export function parseBuddyItemEvidenceRecords(evidenceRecords) {
  const results = evidenceRecords.map(({ evidence, cacheFileName }) =>
    parseBuddyItemEvidenceRecord(evidence, { cacheFileName }),
  );
  const countsByStatus = results.reduce((counts, result) => {
    const status = result.warnings.length > 0 ? 'review_needed' : 'parsed';
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const factCounts = results.reduce((counts, result) => {
    for (const [factGroup, facts] of Object.entries(result.facts)) {
      counts[factGroup] = (counts[factGroup] ?? 0) + facts.length;
    }
    return counts;
  }, {});

  return {
    parserVersion: BUDDY_ITEM_MULTI_SOURCE_PARSER_VERSION,
    results,
    reviewResults: results.filter((result) => result.warnings.length > 0),
    summary: {
      evidenceRecordsProcessed: results.length,
      countsByStatus,
      factCounts,
      warnings: results.filter((result) => result.warnings.length > 0).length
        ? [`${results.filter((result) => result.warnings.length > 0).length.toLocaleString()} parsed item pages need review.`]
        : [],
    },
  };
}

function csvFromRows(headers, rows) {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n');
}

function provenance(fact) {
  return {
    source_url: fact.buddyUrl,
    page_data_url: fact.pageDataUrl,
    cache_file_name: fact.cacheFileName,
    parser_version: fact.parserVersion,
    flags: (fact.flags ?? []).join('; '),
    notes: (fact.notes ?? []).join('; '),
  };
}

function flattenParsedResults(parsedResult) {
  const results = parsedResult.results ?? [];
  return {
    metadata: results.map((result) => result.metadata).filter(Boolean),
    recipes: results.flatMap((result) => result.facts.recipes),
    usedInRecipes: results.flatMap((result) => result.facts.usedInRecipes),
    dropRates: results.flatMap((result) => result.facts.dropRates),
    petSources: results.flatMap((result) => result.facts.petSources),
    openableContents: results.flatMap((result) => result.facts.openableContents),
    openableSources: results.flatMap((result) => result.facts.openableSources),
    wishingWellOutputs: results.flatMap((result) => result.facts.wishingWellOutputs),
    wishingWellInputs: results.flatMap((result) => result.facts.wishingWellInputs),
    questRequirementsAndRewards: results.flatMap((result) => result.facts.questRequirementsAndRewards),
  };
}

export function deriveBuddyEvidencePromotionFanout(parsedResult) {
  const flat = flattenParsedResults(parsedResult);
  const itemCatalogCandidates = flat.metadata.map((metadata) => ({
    item_name: metadata.itemName,
    canonical_key: metadata.canonicalKey,
    mastery_possible: 'unknown',
    farmrpg_item_id: metadata.farmrpgItemId ?? '',
    buddy_slug: metadata.buddySlug,
    source_datasets: 'buddy_item_evidence_cache',
    source_url: metadata.buddyUrl,
    page_data_url: metadata.pageDataUrl,
    parser_version: BUDDY_ITEM_MULTI_SOURCE_PARSER_VERSION,
    notes: 'Candidate only; review before canonical promotion and do not infer mastery eligibility.',
  }));
  const iconObservationCandidates = flat.metadata.map((metadata) => ({
    item_name: metadata.itemName,
    canonical_key: metadata.canonicalKey,
    generated_buddy_slug: metadata.buddySlug,
    candidate_buddy_url: metadata.buddyUrl,
    page_title: metadata.pageTitle,
    extraction_status: metadata.iconUrl ? 'icon_found' : 'no_icon',
    observation_status: metadata.iconUrl ? 'observed' : 'review_needed',
    icon_url: metadata.iconUrl ?? '',
    icon_pathname: metadata.iconPathname ?? '',
    icon_filename: metadata.iconFilename ?? '',
    icon_asset_key: metadata.iconAssetKey ?? '',
    farmrpg_item_id_candidate: metadata.farmrpgItemIdCandidate ?? '',
    flags: '',
    notes: 'Observed from cached Buddy page-data item image; review before asset download or canonical promotion.',
  }));
  const recipeCandidates = flat.recipes.map((fact) => ({
    output_item_name: fact.outputItemName,
    output_canonical_key: fact.outputCanonicalKey,
    recipe_type: fact.recipeType,
    recipe_book_item_name: fact.recipeBookItemName,
    recipe_book_canonical_key: fact.recipeBookCanonicalKey,
    cooking_level: fact.cookingLevel,
    base_time: fact.baseTime,
    ...provenance(fact),
  }));
  const recipeInputCandidates = flat.recipes.flatMap((fact) =>
    fact.ingredients.map((ingredient) => ({
      output_canonical_key: fact.outputCanonicalKey,
      output_item_name: fact.outputItemName,
      input_order: String(ingredient.inputOrder),
      input_item_name: ingredient.inputItemName,
      input_canonical_key: ingredient.inputCanonicalKey,
      quantity: ingredient.quantity ?? '',
      ...provenance(fact),
    })),
  );
  const usedInCandidates = flat.usedInRecipes.map((fact) => ({
    input_item_name: fact.inputItemName,
    input_canonical_key: fact.inputCanonicalKey,
    output_item_name: fact.outputItemName,
    output_canonical_key: fact.outputCanonicalKey,
    quantity: fact.quantity ?? '',
    output_can_craft: fact.outputCanCraft === null ? '' : String(fact.outputCanCraft),
    output_can_cook: fact.outputCanCook === null ? '' : String(fact.outputCanCook),
    ...provenance(fact),
  }));
  const dropRateCandidates = flat.dropRates.map((fact) => ({
    target_item_name: fact.targetItemName,
    target_canonical_key: fact.targetCanonicalKey,
    source_name: fact.sourceName,
    source_canonical_key: fact.sourceCanonicalKey,
    source_type: fact.sourceType,
    source_kind: fact.sourceKind,
    row_kind: fact.rowKind,
    raw_rate: fact.rawRate ?? '',
    base_drop_rate: fact.baseDropRate ?? '',
    source_page_type: 'item',
    source_page_name: fact.itemName,
    source_page_url: fact.buddyUrl,
    page_data_url: fact.pageDataUrl,
    target_item_id: fact.targetFarmrpgItemId ?? '',
    target_item_image: fact.targetItemImage ?? '',
    source_image: fact.sourceImage ?? '',
    iron_depot: fact.ironDepot === null ? '' : String(fact.ironDepot),
    manual_fishing: fact.manualFishing === null ? '' : String(fact.manualFishing),
    runecube: fact.runecube === null ? '' : String(fact.runecube),
    flags: (fact.flags ?? []).join('; '),
    notes: (fact.notes ?? []).join('; '),
    cache_file_name: fact.cacheFileName,
    parser_version: fact.parserVersion,
  }));
  const petSourceCandidates = flat.petSources.map((fact) => ({
    pet_name: fact.petName,
    pet_canonical_key: fact.petCanonicalKey,
    item_name: fact.itemName,
    item_canonical_key: fact.itemCanonicalKey,
    unlock_level: fact.unlockLevel ?? '',
    source_url: fact.buddyUrl,
    page_data_url: fact.pageDataUrl,
    coverage_status: 'candidate',
    notes: `Candidate from cached Buddy page-data; review before canonical promotion. ${provenance(fact).notes}`.trim(),
    cache_file_name: fact.cacheFileName,
    parser_version: fact.parserVersion,
  }));
  const openableCandidates = flat.openableContents.map((fact) => ({
    openable_item_name: fact.openableItemName,
    openable_canonical_key: fact.openableCanonicalKey,
    content_item_name: fact.contentItemName,
    content_canonical_key: fact.contentCanonicalKey,
    quantity_per_open: fact.quantityKind === 'fixed' ? fact.quantityMin ?? '' : '',
    quantity_min: fact.quantityMin ?? '',
    quantity_max: fact.quantityMax ?? '',
    quantity_kind: fact.quantityKind,
    evidence: fact.relationDirection,
    notes: `Candidate from cached Buddy page-data; review before canonical promotion. ${provenance(fact).notes}`.trim(),
    source_url: fact.buddyUrl,
    page_data_url: fact.pageDataUrl,
    cache_file_name: fact.cacheFileName,
    parser_version: fact.parserVersion,
  }));
  const wishingWellCandidates = flat.wishingWellOutputs.map((fact) => ({
    thrown_item_name: fact.thrownItemName,
    thrown_canonical_key: fact.thrownCanonicalKey,
    reward_item_name: fact.rewardItemName,
    reward_canonical_key: fact.rewardCanonicalKey,
    reward_chance: fact.rewardChance ?? '',
    reward_quantity: fact.rewardQuantity ?? '',
    evidence: fact.relationDirection,
    notes: `Candidate from cached Buddy page-data; review before canonical promotion. ${provenance(fact).notes}`.trim(),
    source_url: fact.buddyUrl,
    page_data_url: fact.pageDataUrl,
    cache_file_name: fact.cacheFileName,
    parser_version: fact.parserVersion,
    flags: (fact.flags ?? []).join('; '),
  }));
  const sourceHintCandidates = [
    ...flat.openableSources.map((fact) => ({
      source_type: 'openable_reverse',
      item_name: fact.contentItemName,
      canonical_key: fact.contentCanonicalKey,
      source_name: fact.openableItemName,
      source_canonical_key: fact.openableCanonicalKey,
      detail: `${fact.quantityMin ?? ''}-${fact.quantityMax ?? ''}`,
      ...provenance(fact),
    })),
    ...flat.wishingWellInputs.map((fact) => ({
      source_type: 'wishing_well_reverse',
      item_name: fact.rewardItemName,
      canonical_key: fact.rewardCanonicalKey,
      source_name: fact.thrownItemName,
      source_canonical_key: fact.thrownCanonicalKey,
      detail: String(fact.rewardChance ?? ''),
      ...provenance(fact),
    })),
  ];

  const outputs = {
    itemCatalogCandidates,
    iconObservationCandidates,
    recipeCandidates,
    recipeInputCandidates,
    usedInCandidates,
    dropRateCandidates,
    petSourceCandidates,
    openableCandidates,
    wishingWellCandidates,
    sourceHintCandidates,
  };

  return {
    fanoutVersion: 'buddy-evidence-promotion-fanout-v1',
    parserVersion: BUDDY_ITEM_MULTI_SOURCE_PARSER_VERSION,
    outputs,
    summary: Object.fromEntries(Object.entries(outputs).map(([key, rows]) => [key, rows.length])),
  };
}

export function toBuddyItemParserSummaryCsv(parsedResult) {
  return csvFromRows(
    [
      'item_name',
      'canonical_key',
      'buddy_url',
      'page_data_url',
      'cache_file_name',
      'http_status',
      'source_status',
      'recipes',
      'used_in_recipes',
      'drop_rates',
      'pet_sources',
      'openable_contents',
      'openable_sources',
      'wishing_well_outputs',
      'wishing_well_inputs',
      'quest_rows',
      'unknown_detected_sections',
      'flags',
      'warnings',
    ],
    parsedResult.results.map((result) => ({
      item_name: result.itemName,
      canonical_key: result.canonicalKey,
      buddy_url: result.buddyUrl,
      page_data_url: result.pageDataUrl,
      cache_file_name: result.cacheFileName,
      http_status: result.httpStatus ?? '',
      source_status: result.sourceStatus,
      recipes: result.facts.recipes.length,
      used_in_recipes: result.facts.usedInRecipes.length,
      drop_rates: result.facts.dropRates.length,
      pet_sources: result.facts.petSources.length,
      openable_contents: result.facts.openableContents.length,
      openable_sources: result.facts.openableSources.length,
      wishing_well_outputs: result.facts.wishingWellOutputs.length,
      wishing_well_inputs: result.facts.wishingWellInputs.length,
      quest_rows: result.facts.questRequirementsAndRewards.length,
      unknown_detected_sections: result.unknownDetectedSections.join('; '),
      flags: result.flags.join('; '),
      warnings: result.warnings.join('; '),
    })),
  );
}

export function toBuddyItemParserReviewCsv(parsedResult) {
  return toBuddyItemParserSummaryCsv({
    ...parsedResult,
    results: parsedResult.reviewResults,
  });
}

export function toBuddyEvidenceFanoutCsvs(fanoutResult) {
  return {
    'item_catalog_candidates.csv': csvFromRows(
      ['item_name', 'canonical_key', 'mastery_possible', 'farmrpg_item_id', 'buddy_slug', 'source_datasets', 'source_url', 'page_data_url', 'parser_version', 'notes'],
      fanoutResult.outputs.itemCatalogCandidates,
    ),
    'icon_observation_candidates.csv': csvFromRows(
      ['item_name', 'canonical_key', 'generated_buddy_slug', 'candidate_buddy_url', 'page_title', 'extraction_status', 'observation_status', 'icon_url', 'icon_pathname', 'icon_filename', 'icon_asset_key', 'farmrpg_item_id_candidate', 'flags', 'notes'],
      fanoutResult.outputs.iconObservationCandidates,
    ),
    'recipes_candidates.csv': csvFromRows(
      ['output_item_name', 'output_canonical_key', 'recipe_type', 'recipe_book_item_name', 'recipe_book_canonical_key', 'cooking_level', 'base_time', 'source_url', 'page_data_url', 'cache_file_name', 'parser_version', 'flags', 'notes'],
      fanoutResult.outputs.recipeCandidates,
    ),
    'recipe_inputs_candidates.csv': csvFromRows(
      ['output_canonical_key', 'output_item_name', 'input_order', 'input_item_name', 'input_canonical_key', 'quantity', 'source_url', 'page_data_url', 'cache_file_name', 'parser_version', 'flags', 'notes'],
      fanoutResult.outputs.recipeInputCandidates,
    ),
    'used_in_recipe_candidates.csv': csvFromRows(
      ['input_item_name', 'input_canonical_key', 'output_item_name', 'output_canonical_key', 'quantity', 'output_can_craft', 'output_can_cook', 'source_url', 'page_data_url', 'cache_file_name', 'parser_version', 'flags', 'notes'],
      fanoutResult.outputs.usedInCandidates,
    ),
    'drop_rate_reference_candidates.csv': csvFromRows(
      ['target_item_name', 'target_canonical_key', 'source_name', 'source_canonical_key', 'source_type', 'source_kind', 'row_kind', 'raw_rate', 'base_drop_rate', 'source_page_type', 'source_page_name', 'source_page_url', 'page_data_url', 'target_item_id', 'target_item_image', 'source_image', 'iron_depot', 'manual_fishing', 'runecube', 'flags', 'notes', 'cache_file_name', 'parser_version'],
      fanoutResult.outputs.dropRateCandidates,
    ),
    'pet_source_reference_candidates.csv': csvFromRows(
      ['pet_name', 'pet_canonical_key', 'item_name', 'item_canonical_key', 'unlock_level', 'source_url', 'page_data_url', 'coverage_status', 'notes', 'cache_file_name', 'parser_version'],
      fanoutResult.outputs.petSourceCandidates,
    ),
    'openable_contents_candidates.csv': csvFromRows(
      ['openable_item_name', 'openable_canonical_key', 'content_item_name', 'content_canonical_key', 'quantity_per_open', 'quantity_min', 'quantity_max', 'quantity_kind', 'evidence', 'notes', 'source_url', 'page_data_url', 'cache_file_name', 'parser_version'],
      fanoutResult.outputs.openableCandidates,
    ),
    'wishing_well_reference_candidates.csv': csvFromRows(
      ['thrown_item_name', 'thrown_canonical_key', 'reward_item_name', 'reward_canonical_key', 'reward_chance', 'reward_quantity', 'evidence', 'notes', 'source_url', 'page_data_url', 'cache_file_name', 'parser_version', 'flags'],
      fanoutResult.outputs.wishingWellCandidates,
    ),
    'source_hint_candidates.csv': csvFromRows(
      ['source_type', 'item_name', 'canonical_key', 'source_name', 'source_canonical_key', 'detail', 'source_url', 'page_data_url', 'cache_file_name', 'parser_version', 'flags', 'notes'],
      fanoutResult.outputs.sourceHintCandidates,
    ),
  };
}
