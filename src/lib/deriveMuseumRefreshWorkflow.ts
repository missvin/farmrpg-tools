import type { BuddyFarmCandidate, BuddyFarmCandidateResult, MuseumSeedCsvRow } from './generateBuddyFarmCandidates';
import { generateBuddyFarmCandidates } from './generateBuddyFarmCandidates';
import type { MasteryDifficultyEntry } from './loadMasteryDifficulty';
import type { RecipeRow } from './loadRecipeGraph';
import type { TowerRequirementEntry } from './loadTowerRequirements';
import type { MuseumParseResult } from './parseMuseumExport';

export type MuseumCoverageInputs = {
  masteryEntries: Pick<MasteryDifficultyEntry, 'canonicalKey' | 'buddySlug'>[];
  towerEntries: Pick<TowerRequirementEntry, 'canonicalKey' | 'buddySlug'>[];
  recipeRows: Pick<RecipeRow, 'outputCanonicalKey'>[];
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

export type MuseumRefreshItem = BuddyFarmCandidate & {
  isKnownBaselineItem: boolean;
  isNewSinceBaseline: boolean;
  hasMasteryReferenceCoverage: boolean;
  hasTowerReferenceCoverage: boolean;
  hasRecipeCoverage: boolean;
  hasAnyReferenceCoverage: boolean;
  hasLocalBuddySlugCoverage: boolean;
  needsReferenceCoverageFollowUp: boolean;
  needsBuddySlugFollowUp: boolean;
  needsRecipeCoverageFollowUp: boolean;
  needsCandidateReview: boolean;
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
    newItemsCount: number;
    unmatchedItemsCount: number;
    actionableItemsCount: number;
    missingBuddySlugCount: number;
    missingRecipeCoverageCount: number;
    candidateReviewCount: number;
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
  const masteryKeys = new Set(coverage.masteryEntries.map((entry) => entry.canonicalKey));
  const towerKeys = new Set(coverage.towerEntries.map((entry) => entry.canonicalKey));
  const recipeKeys = new Set(coverage.recipeRows.map((row) => row.outputCanonicalKey));
  const buddySlugCoverageKeys = new Set([
    ...coverage.masteryEntries.filter((entry) => Boolean(entry.buddySlug)).map((entry) => entry.canonicalKey),
    ...coverage.towerEntries.filter((entry) => Boolean(entry.buddySlug)).map((entry) => entry.canonicalKey),
  ]);

  const items = candidateResult.items
    .map<MuseumRefreshItem>((item) => {
      const isKnownBaselineItem = knownBaselineKeys.has(item.canonicalKey);
      const hasMasteryReferenceCoverage = masteryKeys.has(item.canonicalKey);
      const hasTowerReferenceCoverage = towerKeys.has(item.canonicalKey);
      const hasRecipeCoverage = recipeKeys.has(item.canonicalKey);
      const hasAnyReferenceCoverage = hasMasteryReferenceCoverage || hasTowerReferenceCoverage || hasRecipeCoverage;
      const hasLocalBuddySlugCoverage = buddySlugCoverageKeys.has(item.canonicalKey);
      const needsReferenceCoverageFollowUp = !hasAnyReferenceCoverage;
      const needsBuddySlugFollowUp = !hasLocalBuddySlugCoverage;
      const needsRecipeCoverageFollowUp = !hasRecipeCoverage;
      const needsCandidateReview = item.flags.length > 0;
      const followUpReasons: string[] = [];

      if (baseline && !isKnownBaselineItem) {
        followUpReasons.push('New since the saved museum baseline.');
      }

      if (needsReferenceCoverageFollowUp) {
        followUpReasons.push('Missing local mastery/tower/recipe coverage.');
      }

      if (needsBuddySlugFollowUp) {
        followUpReasons.push('Missing local buddy slug metadata for later buddy/icon/reference work.');
      }

      if (needsRecipeCoverageFollowUp) {
        followUpReasons.push('Missing local recipe coverage. This may be intentional for non-craftable items.');
      }

      if (needsCandidateReview) {
        followUpReasons.push(`Generated buddy candidate needs review: ${item.flags.join(', ')}.`);
      }

      return {
        ...item,
        isKnownBaselineItem,
        isNewSinceBaseline: baseline ? !isKnownBaselineItem : false,
        hasMasteryReferenceCoverage,
        hasTowerReferenceCoverage,
        hasRecipeCoverage,
        hasAnyReferenceCoverage,
        hasLocalBuddySlugCoverage,
        needsReferenceCoverageFollowUp,
        needsBuddySlugFollowUp,
        needsRecipeCoverageFollowUp,
        needsCandidateReview,
        followUpReasons,
      };
    })
    .sort((left, right) => left.itemName.localeCompare(right.itemName));

  const newItems = items.filter((item) => item.isNewSinceBaseline);
  const unmatchedItems = items.filter((item) => item.needsReferenceCoverageFollowUp);
  const actionableItems = items.filter(
    (item) =>
      item.isNewSinceBaseline ||
      item.needsReferenceCoverageFollowUp ||
      item.needsBuddySlugFollowUp ||
      item.needsRecipeCoverageFollowUp ||
      item.needsCandidateReview,
  );
  const missingBuddySlugCount = items.filter((item) => item.needsBuddySlugFollowUp).length;
  const missingRecipeCoverageCount = items.filter((item) => item.needsRecipeCoverageFollowUp).length;
  const candidateReviewCount = items.filter((item) => item.needsCandidateReview).length;
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
      newItemsCount: newItems.length,
      unmatchedItemsCount: unmatchedItems.length,
      actionableItemsCount: actionableItems.length,
      missingBuddySlugCount,
      missingRecipeCoverageCount,
      candidateReviewCount,
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
    'museum_category,category,item_name,canonical_key,obtainable,generated_buddy_slug,alternate_buddy_slug,is_new_since_baseline,has_mastery_reference,has_tower_reference,has_recipe_coverage,has_local_buddy_slug,needs_reference_follow_up,needs_buddy_slug_follow_up,needs_recipe_follow_up,needs_candidate_review,flags,follow_up_reasons',
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
        item.hasMasteryReferenceCoverage ? 'Y' : 'N',
        item.hasTowerReferenceCoverage ? 'Y' : 'N',
        item.hasRecipeCoverage ? 'Y' : 'N',
        item.hasLocalBuddySlugCoverage ? 'Y' : 'N',
        item.needsReferenceCoverageFollowUp ? 'Y' : 'N',
        item.needsBuddySlugFollowUp ? 'Y' : 'N',
        item.needsRecipeCoverageFollowUp ? 'Y' : 'N',
        item.needsCandidateReview ? 'Y' : 'N',
        item.flags.join('; '),
        item.followUpReasons.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}
