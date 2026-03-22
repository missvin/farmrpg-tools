import type { BuddyFarmCandidate, BuddyFarmCandidateResult, MuseumSeedCsvRow } from './generateBuddyFarmCandidates';
import { generateBuddyFarmCandidates } from './generateBuddyFarmCandidates';
import type { MasteryDifficultyEntry } from './loadMasteryDifficulty';
import type { RecipeRow } from './loadRecipeGraph';
import type { TowerRequirementEntry } from './loadTowerRequirements';
import type { MuseumParseResult } from './parseMuseumExport';

export type MuseumCoverageInputs = {
  masteryEntries: Pick<MasteryDifficultyEntry, 'canonicalKey' | 'buddySlug' | 'method'>[];
  towerEntries: Pick<TowerRequirementEntry, 'canonicalKey' | 'buddySlug'>[];
  recipeRows: Pick<RecipeRow, 'outputCanonicalKey' | 'sourceBuddyUrl'>[];
};

export type MuseumKnownBaselineItem = Pick<
  BuddyFarmCandidate,
  | 'museumCategory'
  | 'category'
  | 'itemName'
  | 'canonicalKey'
  | 'obtainable'
  | 'generatedBuddySlug'
  | 'alternateBuddySlug'
>;

export type MuseumKnownBaseline = {
  savedAt: string;
  items: MuseumKnownBaselineItem[];
};

export type RecipeCoverageStatus = 'covered' | 'missing_expected' | 'not_expected' | 'unresolved';
export type BuddySlugCoverageStatus =
  | 'covered_known'
  | 'missing_known_expected'
  | 'missing_new_item'
  | 'unresolved';

export type MuseumRefreshItem = BuddyFarmCandidate & {
  isKnownBaselineItem: boolean;
  isNewSinceBaseline: boolean;
  hasMasteryReferenceCoverage: boolean;
  hasTowerReferenceCoverage: boolean;
  hasRecipeCoverage: boolean;
  hasAnyReferenceCoverage: boolean;
  isMatchedKnownItem: boolean;
  localBuddySlug: string | null;
  recipeCoverageStatus: RecipeCoverageStatus;
  buddySlugCoverageStatus: BuddySlugCoverageStatus;
  needsReferenceCoverageFollowUp: boolean;
  needsRecipeCoverageFollowUp: boolean;
  needsBuddySlugFollowUp: boolean;
  needsCandidateReview: boolean;
  isActionableFollowUp: boolean;
  followUpReasons: string[];
};

export type MuseumRefreshWorkflowResult = {
  seedRows: MuseumSeedCsvRow[];
  candidateResult: BuddyFarmCandidateResult;
  items: MuseumRefreshItem[];
  newItems: MuseumRefreshItem[];
  unmatchedItems: MuseumRefreshItem[];
  actionableItems: MuseumRefreshItem[];
  knownBaselineItemCount: number;
  summary: {
    itemsParsed: number;
    knownBaselineItemCount: number;
    matchedKnownItemsCount: number;
    unmatchedItemsCount: number;
    newItemsCount: number;
    candidateReviewCount: number;
    recipeCoveredCount: number;
    recipeMissingExpectedCount: number;
    recipeNotExpectedCount: number;
    recipeExpectationUnresolvedCount: number;
    knownItemsWithBuddySlugCoverageCount: number;
    knownItemsMissingExpectedBuddySlugCount: number;
    newItemsMissingBuddySlugCount: number;
    unresolvedBuddySlugStatusCount: number;
    actionableItemsCount: number;
  };
  warnings: string[];
};

function toSeedRows(parseResult: MuseumParseResult): MuseumSeedCsvRow[] {
  return parseResult.uniqueItems.map((item) => ({
    museumCategory: item.categoryName,
    category: item.category,
    itemName: item.itemName,
    canonicalKey: item.canonicalKey,
    obtainable: item.obtainable,
  }));
}

function parseBuddySlugFromUrl(sourceBuddyUrl: string): string | null {
  const trimmedUrl = sourceBuddyUrl.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const url = new URL(trimmedUrl);
    const match = url.pathname.match(/^\/i\/(?<slug>[^/]+)\/?$/u);
    return match?.groups?.slug?.trim() || null;
  } catch {
    return null;
  }
}

function expectsRecipeCoverage(method: string | null): boolean | null {
  if (!method) {
    return null;
  }

  const normalizedMethod = method.toLowerCase();

  if (normalizedMethod.includes('crafting') || normalizedMethod.includes('cooking')) {
    return true;
  }

  return false;
}

export function createMuseumKnownBaseline(result: MuseumRefreshWorkflowResult): MuseumKnownBaseline {
  return {
    savedAt: new Date().toISOString(),
    items: result.items.map((item) => ({
      museumCategory: item.museumCategory,
      category: item.category,
      itemName: item.itemName,
      canonicalKey: item.canonicalKey,
      obtainable: item.obtainable,
      generatedBuddySlug: item.generatedBuddySlug,
      alternateBuddySlug: item.alternateBuddySlug,
    })),
  };
}

export function deriveMuseumRefreshWorkflow(
  parseResult: MuseumParseResult,
  coverage: MuseumCoverageInputs,
  baseline: MuseumKnownBaseline | null = null,
): MuseumRefreshWorkflowResult {
  const seedRows = toSeedRows(parseResult);
  const candidateResult = generateBuddyFarmCandidates(seedRows);
  const knownBaselineKeys = new Set((baseline?.items ?? []).map((item) => item.canonicalKey));
  const masteryByKey = coverage.masteryEntries.reduce<Record<string, MuseumCoverageInputs['masteryEntries'][number]>>(
    (lookup, entry) => {
      lookup[entry.canonicalKey] = entry;
      return lookup;
    },
    {},
  );
  const masteryKeys = new Set(coverage.masteryEntries.map((entry) => entry.canonicalKey));
  const towerKeys = new Set(coverage.towerEntries.map((entry) => entry.canonicalKey));
  const recipeKeys = new Set(coverage.recipeRows.map((row) => row.outputCanonicalKey));
  const buddySlugByKey = new Map<string, string>();

  for (const entry of coverage.masteryEntries) {
    if (entry.buddySlug) {
      buddySlugByKey.set(entry.canonicalKey, entry.buddySlug);
    }
  }

  for (const entry of coverage.towerEntries) {
    if (entry.buddySlug && !buddySlugByKey.has(entry.canonicalKey)) {
      buddySlugByKey.set(entry.canonicalKey, entry.buddySlug);
    }
  }

  for (const row of coverage.recipeRows) {
    const parsedBuddySlug = parseBuddySlugFromUrl(row.sourceBuddyUrl);

    if (parsedBuddySlug && !buddySlugByKey.has(row.outputCanonicalKey)) {
      buddySlugByKey.set(row.outputCanonicalKey, parsedBuddySlug);
    }
  }

  const items = candidateResult.items
    .map<MuseumRefreshItem>((item) => {
      const isKnownBaselineItem = knownBaselineKeys.has(item.canonicalKey);
      const hasMasteryReferenceCoverage = masteryKeys.has(item.canonicalKey);
      const hasTowerReferenceCoverage = towerKeys.has(item.canonicalKey);
      const hasRecipeCoverage = recipeKeys.has(item.canonicalKey);
      const hasAnyReferenceCoverage = hasMasteryReferenceCoverage || hasTowerReferenceCoverage || hasRecipeCoverage;
      const isMatchedKnownItem = hasAnyReferenceCoverage;
      const isNewSinceBaseline = baseline ? !isKnownBaselineItem : false;
      const needsCandidateReview = item.flags.length > 0;
      const localBuddySlug = buddySlugByKey.get(item.canonicalKey) ?? null;
      const masteryEntry = masteryByKey[item.canonicalKey] ?? null;
      const recipeExpectation = hasRecipeCoverage ? true : expectsRecipeCoverage(masteryEntry?.method ?? null);

      let recipeCoverageStatus: RecipeCoverageStatus;

      if (hasRecipeCoverage) {
        recipeCoverageStatus = 'covered';
      } else if (!isMatchedKnownItem) {
        recipeCoverageStatus = 'unresolved';
      } else if (recipeExpectation === true) {
        recipeCoverageStatus = 'missing_expected';
      } else if (recipeExpectation === false) {
        recipeCoverageStatus = 'not_expected';
      } else {
        recipeCoverageStatus = 'unresolved';
      }

      let buddySlugCoverageStatus: BuddySlugCoverageStatus;

      if (localBuddySlug && isMatchedKnownItem) {
        buddySlugCoverageStatus = 'covered_known';
      } else if (!localBuddySlug && needsCandidateReview) {
        buddySlugCoverageStatus = 'unresolved';
      } else if (!localBuddySlug && !isMatchedKnownItem) {
        buddySlugCoverageStatus = 'unresolved';
      } else if (!localBuddySlug && isNewSinceBaseline) {
        buddySlugCoverageStatus = 'missing_new_item';
      } else {
        buddySlugCoverageStatus = 'missing_known_expected';
      }

      const needsReferenceCoverageFollowUp = !isMatchedKnownItem;
      const needsRecipeCoverageFollowUp = recipeCoverageStatus === 'missing_expected';
      const needsBuddySlugFollowUp =
        buddySlugCoverageStatus === 'missing_known_expected' || buddySlugCoverageStatus === 'missing_new_item';
      const isActionableFollowUp =
        needsReferenceCoverageFollowUp ||
        needsRecipeCoverageFollowUp ||
        needsBuddySlugFollowUp ||
        needsCandidateReview;
      const followUpReasons: string[] = [];

      if (isNewSinceBaseline) {
        followUpReasons.push('New since the saved museum baseline.');
      }

      if (needsReferenceCoverageFollowUp) {
        followUpReasons.push('Unmatched against current local mastery, tower, and recipe outputs.');
      }

      if (needsRecipeCoverageFollowUp) {
        followUpReasons.push('Expected recipe coverage is missing for this matched item.');
      } else if (recipeCoverageStatus === 'unresolved') {
        followUpReasons.push('Recipe expectation is unresolved until this item is reconciled more safely.');
      }

      if (buddySlugCoverageStatus === 'missing_known_expected') {
        followUpReasons.push('Known matched item is missing expected local buddy slug coverage.');
      } else if (buddySlugCoverageStatus === 'missing_new_item') {
        followUpReasons.push('Newly discovered item still needs buddy slug follow-up.');
      } else if (buddySlugCoverageStatus === 'unresolved') {
        followUpReasons.push('Buddy slug status is unresolved until this item is reconciled more safely.');
      }

      if (needsCandidateReview) {
        followUpReasons.push(`Generated buddy candidate needs review: ${item.flags.join(', ')}.`);
      }

      return {
        ...item,
        isKnownBaselineItem,
        isNewSinceBaseline,
        hasMasteryReferenceCoverage,
        hasTowerReferenceCoverage,
        hasRecipeCoverage,
        hasAnyReferenceCoverage,
        isMatchedKnownItem,
        localBuddySlug,
        recipeCoverageStatus,
        buddySlugCoverageStatus,
        needsReferenceCoverageFollowUp,
        needsRecipeCoverageFollowUp,
        needsBuddySlugFollowUp,
        needsCandidateReview,
        isActionableFollowUp,
        followUpReasons,
      };
    })
    .sort((left, right) => left.itemName.localeCompare(right.itemName));

  const newItems = items.filter((item) => item.isNewSinceBaseline);
  const unmatchedItems = items.filter((item) => !item.isMatchedKnownItem);
  const actionableItems = items.filter((item) => item.isActionableFollowUp);
  const warnings = [...parseResult.parseSummary.warnings, ...candidateResult.parseSummary.warnings];

  if (!baseline) {
    warnings.push(
      'No saved museum baseline yet. Run a bootstrap pass and save the current parsed museum items locally before using incremental refresh.',
    );
  }

  return {
    seedRows,
    candidateResult,
    items,
    newItems,
    unmatchedItems,
    actionableItems,
    knownBaselineItemCount: knownBaselineKeys.size,
    summary: {
      itemsParsed: items.length,
      knownBaselineItemCount: knownBaselineKeys.size,
      matchedKnownItemsCount: items.filter((item) => item.isMatchedKnownItem).length,
      unmatchedItemsCount: unmatchedItems.length,
      newItemsCount: newItems.length,
      candidateReviewCount: items.filter((item) => item.needsCandidateReview).length,
      recipeCoveredCount: items.filter((item) => item.recipeCoverageStatus === 'covered').length,
      recipeMissingExpectedCount: items.filter((item) => item.recipeCoverageStatus === 'missing_expected').length,
      recipeNotExpectedCount: items.filter((item) => item.recipeCoverageStatus === 'not_expected').length,
      recipeExpectationUnresolvedCount: items.filter((item) => item.recipeCoverageStatus === 'unresolved').length,
      knownItemsWithBuddySlugCoverageCount: items.filter((item) => item.buddySlugCoverageStatus === 'covered_known')
        .length,
      knownItemsMissingExpectedBuddySlugCount: items.filter(
        (item) => item.buddySlugCoverageStatus === 'missing_known_expected',
      ).length,
      newItemsMissingBuddySlugCount: items.filter((item) => item.buddySlugCoverageStatus === 'missing_new_item').length,
      unresolvedBuddySlugStatusCount: items.filter((item) => item.buddySlugCoverageStatus === 'unresolved').length,
      actionableItemsCount: actionableItems.length,
    },
    warnings,
  };
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

export function toMuseumRefreshActionableCsv(items: MuseumRefreshItem[]): string {
  const rows = [
    'museum_category,category,item_name,canonical_key,obtainable,generated_buddy_slug,alternate_buddy_slug,is_new_since_baseline,is_matched_known_item,recipe_coverage_status,buddy_slug_coverage_status,needs_reference_follow_up,needs_recipe_follow_up,needs_buddy_slug_follow_up,needs_candidate_review,is_actionable_follow_up,flags,follow_up_reasons',
  ];

  for (const item of items) {
    rows.push(
      [
        item.museumCategory,
        item.category,
        item.itemName,
        item.canonicalKey,
        item.obtainable ? 'Y' : 'N',
        item.generatedBuddySlug,
        item.alternateBuddySlug ?? '',
        item.isNewSinceBaseline ? 'Y' : 'N',
        item.isMatchedKnownItem ? 'Y' : 'N',
        item.recipeCoverageStatus,
        item.buddySlugCoverageStatus,
        item.needsReferenceCoverageFollowUp ? 'Y' : 'N',
        item.needsRecipeCoverageFollowUp ? 'Y' : 'N',
        item.needsBuddySlugFollowUp ? 'Y' : 'N',
        item.needsCandidateReview ? 'Y' : 'N',
        item.isActionableFollowUp ? 'Y' : 'N',
        item.flags.join('; '),
        item.followUpReasons.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}
