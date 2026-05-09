import type { BuddyFarmCandidate, BuddyFarmCandidateResult, MuseumSeedCsvRow } from './generateBuddyFarmCandidates';
import { generateBuddyFarmCandidates } from './generateBuddyFarmCandidates';
import type { MasteryDifficultyEntry } from './loadMasteryDifficulty';
import type { RecipeRow } from './loadRecipeGraph';
import type { TowerRequirementEntry } from './loadTowerRequirements';
import { normalizeName } from './normalizeItemKey';
import type { MuseumParseResult } from './parseMuseumExport';

export type MuseumCoverageInputs = {
  masteryEntries: Pick<MasteryDifficultyEntry, 'itemName' | 'canonicalKey' | 'buddySlug' | 'method' | 'farmrpgItemId'>[];
  towerEntries: Pick<TowerRequirementEntry, 'itemName' | 'canonicalKey' | 'buddySlug' | 'farmrpgItemId'>[];
  recipeRows: Pick<RecipeRow, 'outputItemName' | 'outputCanonicalKey' | 'sourceBuddyUrl'>[];
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
export type CandidateReviewStatus = 'not_needed' | 'review_needed' | 'reviewed';
export type BuddySlugCoverageStatus =
  | 'covered_local'
  | 'derived_candidate_ready'
  | 'missing_known_expected'
  | 'missing_new_item'
  | 'candidate_review_needed'
  | 'candidate_reviewed'
  | 'unresolved';
export type IconReadyCoverageStatus = 'maintained_local' | 'derived_ready' | 'reviewed_candidate' | 'not_ready';
export type MuseumIconCandidateStatus =
  | 'from_local_item_id'
  | 'assumed_from_clean_slug'
  | 'assumed_from_reviewed_slug'
  | 'undetermined';
export type PlanningReferenceStatus =
  | 'matched_local'
  | 'museum_only_icon_ready'
  | 'missing_planning_reference'
  | 'likely_name_mismatch'
  | 'truly_unresolved';
export type MuseumReferenceSource = 'mastery' | 'tower' | 'recipe';
export type MuseumUnresolvedCaseType =
  | 'likely_name_mismatch'
  | 'collision_or_ambiguity'
  | 'slug_edge_case'
  | 'likely_new_item'
  | 'missing_planning_reference';
export type MuseumUnresolvedTriageStatus = 'not_applicable' | 'active' | 'triaged';

export type MuseumLikelyReferenceMatch = {
  itemName: string;
  canonicalKey: string;
  sources: MuseumReferenceSource[];
  reason: string;
};

type MuseumReferenceCatalogEntry = {
  itemName: string;
  canonicalKey: string;
  sources: MuseumReferenceSource[];
};

export type MuseumRefreshItem = BuddyFarmCandidate & {
  candidateReviewKey: string;
  candidateReviewStatus: CandidateReviewStatus;
  isKnownBaselineItem: boolean;
  isNewSinceBaseline: boolean;
  hasMasteryReferenceCoverage: boolean;
  hasTowerReferenceCoverage: boolean;
  hasRecipeCoverage: boolean;
  hasAnyReferenceCoverage: boolean;
  isMatchedKnownItem: boolean;
  localBuddySlug: string | null;
  localFarmrpgItemId: string | null;
  recipeCoverageStatus: RecipeCoverageStatus;
  buddySlugCoverageStatus: BuddySlugCoverageStatus;
  iconReadyCoverageStatus: IconReadyCoverageStatus;
  hasIconReadyCoverage: boolean;
  iconCandidateStatus: MuseumIconCandidateStatus;
  candidateIconKeyHint: string | null;
  candidateIconUrl: string | null;
  candidateIconPathname: string | null;
  planningReferenceStatus: PlanningReferenceStatus;
  unresolvedCaseType: MuseumUnresolvedCaseType | null;
  unresolvedTriageKey: string | null;
  unresolvedTriageStatus: MuseumUnresolvedTriageStatus;
  likelyReferenceMatches: MuseumLikelyReferenceMatch[];
  needsReferenceCoverageFollowUp: boolean;
  needsUnresolvedTriageFollowUp: boolean;
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
  unresolvedItems: MuseumRefreshItem[];
  activeUnresolvedItems: MuseumRefreshItem[];
  triagedUnresolvedItems: MuseumRefreshItem[];
  actionableItems: MuseumRefreshItem[];
  knownBaselineItemCount: number;
  summary: {
    itemsParsed: number;
    knownBaselineItemCount: number;
    matchedKnownItemsCount: number;
    unmatchedItemsCount: number;
    newItemsCount: number;
    candidateReviewCount: number;
    reviewedCandidateCount: number;
    recipeCoveredCount: number;
    recipeMissingExpectedCount: number;
    recipeNotExpectedCount: number;
    recipeExpectationUnresolvedCount: number;
    knownItemsWithBuddySlugCoverageCount: number;
    autoDerivedBuddySlugReadyCount: number;
    knownItemsMissingExpectedBuddySlugCount: number;
    newItemsMissingBuddySlugCount: number;
    unresolvedBuddySlugStatusCount: number;
    activeUnresolvedTriageCount: number;
    triagedUnresolvedCount: number;
    likelyNameMismatchCount: number;
    unresolvedCollisionCount: number;
    unresolvedSlugEdgeCaseCount: number;
    likelyNewItemCount: number;
    museumOnlyIconReadyCount: number;
    missingPlanningReferenceCount: number;
    trulyUnresolvedCount: number;
    actionableItemsCount: number;
  };
  warnings: string[];
};

export type MuseumRefreshWorkflowOptions = {
  reviewedCandidateKeys?: Iterable<string>;
  triagedUnresolvedKeys?: Iterable<string>;
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

function buildFarmRpgIconPathname(iconIdentifier: string): string {
  return `/img/items/${iconIdentifier}.png`;
}

function buildFarmRpgIconUrl(iconIdentifier: string): string {
  return `https://farmrpg.com${buildFarmRpgIconPathname(iconIdentifier)}`;
}

function toLooseComparableValue(value: string): string {
  return normalizeName(value)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/gu, '');
}

function toSignificantTokens(value: string): string[] {
  return [...new Set(normalizeName(value).split(/[^a-z0-9]+/u).filter((token) => token.length >= 2))];
}

function buildReferenceCatalog(coverage: MuseumCoverageInputs): MuseumReferenceCatalogEntry[] {
  const byCanonicalKey = new Map<string, MuseumReferenceCatalogEntry>();

  function addEntry(itemName: string, canonicalKey: string, source: MuseumReferenceSource): void {
    const existingEntry = byCanonicalKey.get(canonicalKey);

    if (existingEntry) {
      if (!existingEntry.sources.includes(source)) {
        existingEntry.sources.push(source);
      }
      return;
    }

    byCanonicalKey.set(canonicalKey, {
      itemName,
      canonicalKey,
      sources: [source],
    });
  }

  for (const entry of coverage.masteryEntries) {
    addEntry(entry.itemName, entry.canonicalKey, 'mastery');
  }

  for (const entry of coverage.towerEntries) {
    addEntry(entry.itemName, entry.canonicalKey, 'tower');
  }

  for (const row of coverage.recipeRows) {
    addEntry(row.outputItemName, row.outputCanonicalKey, 'recipe');
  }

  return [...byCanonicalKey.values()].sort((left, right) => left.itemName.localeCompare(right.itemName));
}

function findLikelyReferenceMatches(
  item: Pick<BuddyFarmCandidate, 'itemName' | 'canonicalKey'>,
  referenceCatalog: MuseumReferenceCatalogEntry[],
): MuseumLikelyReferenceMatch[] {
  const itemLoose = toLooseComparableValue(item.itemName);
  const itemTokens = toSignificantTokens(item.itemName);
  const scoredMatches = referenceCatalog
    .filter((entry) => entry.canonicalKey !== item.canonicalKey)
    .map((entry) => {
      const entryLoose = toLooseComparableValue(entry.itemName);
      const entryTokens = toSignificantTokens(entry.itemName);
      const sharedTokens = itemTokens.filter((token) => entryTokens.includes(token));
      let score = 0;
      let reason: string | null = null;

      if (itemLoose && itemLoose === entryLoose) {
        score = 300;
        reason = 'Same letters after punctuation or diacritic cleanup.';
      } else if (
        itemLoose &&
        entryLoose &&
        Math.min(itemLoose.length, entryLoose.length) >= 8 &&
        (itemLoose.includes(entryLoose) || entryLoose.includes(itemLoose))
      ) {
        score = 200;
        reason = 'One relaxed name contains the other after cleanup.';
      } else if (sharedTokens.length >= 2) {
        const overlapRatio = sharedTokens.length / Math.max(itemTokens.length, entryTokens.length);

        if (overlapRatio >= 0.5) {
          score = 100 + sharedTokens.length;
          reason = `Shares key tokens with a known local item: ${sharedTokens.join(', ')}.`;
        }
      }

      return score > 0
        ? {
            itemName: entry.itemName,
            canonicalKey: entry.canonicalKey,
            sources: [...entry.sources].sort(),
            reason,
            score,
          }
        : null;
    })
    .filter((match): match is NonNullable<typeof match> => match !== null)
    .sort((left, right) => right.score - left.score || left.itemName.localeCompare(right.itemName));

  return scoredMatches.slice(0, 3).map(({ itemName, canonicalKey, sources, reason }) => ({
    itemName,
    canonicalKey,
    sources,
    reason: reason ?? 'Shares similarity with a known local item.',
  }));
}

function deriveUnresolvedCaseType(
  item: Pick<BuddyFarmCandidate, 'flags'> & {
    isMatchedKnownItem: boolean;
    isNewSinceBaseline: boolean;
    candidateReviewStatus: CandidateReviewStatus;
    hasIconReadyCoverage: boolean;
    likelyReferenceMatches: MuseumLikelyReferenceMatch[];
  },
): MuseumUnresolvedCaseType | null {
  if (item.isMatchedKnownItem) {
    return null;
  }

  if (item.flags.includes('slug_collision')) {
    return 'collision_or_ambiguity';
  }

  if (item.likelyReferenceMatches.length > 0) {
    return 'likely_name_mismatch';
  }

  if (item.hasIconReadyCoverage) {
    return null;
  }

  if (item.candidateReviewStatus !== 'not_needed') {
    return 'slug_edge_case';
  }

  if (item.isNewSinceBaseline) {
    return 'likely_new_item';
  }

  return 'missing_planning_reference';
}

export function createMuseumCandidateReviewKey(
  item: Pick<BuddyFarmCandidate, 'canonicalKey' | 'generatedBuddySlug' | 'alternateBuddySlug' | 'flags'>,
): string {
  return [
    item.canonicalKey,
    item.generatedBuddySlug,
    item.alternateBuddySlug ?? '',
    [...item.flags].sort().join(';'),
  ].join('|');
}

export function createMuseumUnresolvedTriageKey(
  item: Pick<
    MuseumRefreshItem,
    'canonicalKey' | 'generatedBuddySlug' | 'alternateBuddySlug' | 'flags' | 'unresolvedCaseType' | 'likelyReferenceMatches'
  >,
): string {
  return [
    item.canonicalKey,
    item.generatedBuddySlug,
    item.alternateBuddySlug ?? '',
    item.unresolvedCaseType ?? '',
    item.likelyReferenceMatches.map((match) => match.canonicalKey).join(';'),
    [...item.flags].sort().join(';'),
  ].join('|');
}

function describeUnresolvedCaseType(caseType: MuseumUnresolvedCaseType): string {
  switch (caseType) {
    case 'likely_name_mismatch':
      return 'Likely a known local item with a naming or normalization mismatch.';
    case 'collision_or_ambiguity':
      return 'Generated slug collides or remains ambiguous and needs manual reconciliation.';
    case 'slug_edge_case':
      return 'Slug edge cases still block safe reconciliation.';
    case 'likely_new_item':
      return 'Likely a museum item not yet represented in current local reference coverage.';
    default:
      return 'No planning-relevant local reference match or safe icon-ready slug candidate was found yet; keep this as active local planning follow-up until reviewed.';
  }
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
  options: MuseumRefreshWorkflowOptions = {},
): MuseumRefreshWorkflowResult {
  const seedRows = toSeedRows(parseResult);
  const candidateResult = generateBuddyFarmCandidates(seedRows);
  const knownBaselineKeys = new Set((baseline?.items ?? []).map((item) => item.canonicalKey));
  const reviewedCandidateKeys = new Set(options.reviewedCandidateKeys ?? []);
  const triagedUnresolvedKeys = new Set(options.triagedUnresolvedKeys ?? []);
  const referenceCatalog = buildReferenceCatalog(coverage);
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
  const farmRpgItemIdByKey = new Map<string, string>();

  for (const entry of coverage.masteryEntries) {
    if (entry.buddySlug) {
      buddySlugByKey.set(entry.canonicalKey, entry.buddySlug);
    }

    if (entry.farmrpgItemId) {
      farmRpgItemIdByKey.set(entry.canonicalKey, entry.farmrpgItemId);
    }
  }

  for (const entry of coverage.towerEntries) {
    if (entry.buddySlug && !buddySlugByKey.has(entry.canonicalKey)) {
      buddySlugByKey.set(entry.canonicalKey, entry.buddySlug);
    }

    if (entry.farmrpgItemId && !farmRpgItemIdByKey.has(entry.canonicalKey)) {
      farmRpgItemIdByKey.set(entry.canonicalKey, entry.farmrpgItemId);
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
      const candidateReviewKey = createMuseumCandidateReviewKey(item);
      const isKnownBaselineItem = knownBaselineKeys.has(item.canonicalKey);
      const hasMasteryReferenceCoverage = masteryKeys.has(item.canonicalKey);
      const hasTowerReferenceCoverage = towerKeys.has(item.canonicalKey);
      const hasRecipeCoverage = recipeKeys.has(item.canonicalKey);
      const hasAnyReferenceCoverage = hasMasteryReferenceCoverage || hasTowerReferenceCoverage || hasRecipeCoverage;
      const isMatchedKnownItem = hasAnyReferenceCoverage;
      const isNewSinceBaseline = baseline ? !isKnownBaselineItem : false;
      const candidateReviewStatus: CandidateReviewStatus =
        item.flags.length === 0 ? 'not_needed' : reviewedCandidateKeys.has(candidateReviewKey) ? 'reviewed' : 'review_needed';
      const needsCandidateReview = candidateReviewStatus === 'review_needed';
      const localBuddySlug = buddySlugByKey.get(item.canonicalKey) ?? null;
      const localFarmrpgItemId = farmRpgItemIdByKey.get(item.canonicalKey) ?? null;
      const masteryEntry = masteryByKey[item.canonicalKey] ?? null;
      const recipeExpectation = hasRecipeCoverage ? true : expectsRecipeCoverage(masteryEntry?.method ?? null);
      const likelyReferenceMatches = isMatchedKnownItem ? [] : findLikelyReferenceMatches(item, referenceCatalog);

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
        buddySlugCoverageStatus = 'covered_local';
      } else if (candidateReviewStatus === 'review_needed') {
        buddySlugCoverageStatus = 'candidate_review_needed';
      } else if (candidateReviewStatus === 'reviewed') {
        buddySlugCoverageStatus = 'candidate_reviewed';
      } else if (item.generatedBuddySlug) {
        buddySlugCoverageStatus = 'derived_candidate_ready';
      } else if (!isMatchedKnownItem) {
        buddySlugCoverageStatus = 'unresolved';
      } else if (isNewSinceBaseline) {
        buddySlugCoverageStatus = 'missing_new_item';
      } else {
        buddySlugCoverageStatus = 'missing_known_expected';
      }

      const iconReadyCoverageStatus: IconReadyCoverageStatus =
        localBuddySlug && isMatchedKnownItem
          ? 'maintained_local'
          : candidateReviewStatus === 'reviewed' && item.generatedBuddySlug
            ? 'reviewed_candidate'
            : candidateReviewStatus === 'not_needed' && item.generatedBuddySlug
              ? 'derived_ready'
              : 'not_ready';
      const hasIconReadyCoverage = iconReadyCoverageStatus !== 'not_ready';
      const iconCandidateStatus: MuseumIconCandidateStatus = localFarmrpgItemId
        ? 'from_local_item_id'
        : candidateReviewStatus === 'reviewed' && item.generatedBuddySlug
          ? 'assumed_from_reviewed_slug'
          : candidateReviewStatus === 'not_needed' && item.generatedBuddySlug
            ? 'assumed_from_clean_slug'
            : 'undetermined';
      const candidateIconKeyHint =
        iconCandidateStatus === 'from_local_item_id'
          ? localFarmrpgItemId
          : iconCandidateStatus === 'assumed_from_clean_slug' || iconCandidateStatus === 'assumed_from_reviewed_slug'
            ? item.generatedBuddySlug
            : null;
      const candidateIconUrl =
        iconCandidateStatus === 'from_local_item_id'
          ? buildFarmRpgIconUrl(localFarmrpgItemId!)
          : null;
      const candidateIconPathname =
        iconCandidateStatus === 'from_local_item_id'
          ? buildFarmRpgIconPathname(localFarmrpgItemId!)
          : null;
      const planningReferenceStatus: PlanningReferenceStatus = isMatchedKnownItem
        ? 'matched_local'
        : likelyReferenceMatches.length > 0
          ? 'likely_name_mismatch'
          : hasIconReadyCoverage
            ? 'museum_only_icon_ready'
            : item.flags.includes('slug_collision') || candidateReviewStatus !== 'not_needed' || isNewSinceBaseline
              ? 'truly_unresolved'
              : 'missing_planning_reference';

      const unresolvedCaseType = deriveUnresolvedCaseType({
        flags: item.flags,
        isMatchedKnownItem,
        isNewSinceBaseline,
        candidateReviewStatus,
        hasIconReadyCoverage,
        likelyReferenceMatches,
      });
      const unresolvedTriageKey =
        unresolvedCaseType === null
          ? null
          : createMuseumUnresolvedTriageKey({
              canonicalKey: item.canonicalKey,
              generatedBuddySlug: item.generatedBuddySlug,
              alternateBuddySlug: item.alternateBuddySlug,
              flags: item.flags,
              unresolvedCaseType,
              likelyReferenceMatches,
            } as MuseumRefreshItem);
      const unresolvedTriageStatus: MuseumUnresolvedTriageStatus =
        unresolvedTriageKey === null ? 'not_applicable' : triagedUnresolvedKeys.has(unresolvedTriageKey) ? 'triaged' : 'active';

      const needsReferenceCoverageFollowUp =
        planningReferenceStatus === 'likely_name_mismatch' ||
        planningReferenceStatus === 'missing_planning_reference' ||
        planningReferenceStatus === 'truly_unresolved';
      const needsUnresolvedTriageFollowUp = unresolvedTriageStatus === 'active';
      const needsRecipeCoverageFollowUp = recipeCoverageStatus === 'missing_expected';
      const needsBuddySlugFollowUp =
        buddySlugCoverageStatus === 'missing_known_expected' || buddySlugCoverageStatus === 'missing_new_item';
      const isActionableFollowUp =
        needsUnresolvedTriageFollowUp ||
        needsRecipeCoverageFollowUp ||
        needsBuddySlugFollowUp ||
        needsCandidateReview;
      const followUpReasons: string[] = [];

      if (isNewSinceBaseline) {
        followUpReasons.push('New since the saved museum baseline.');
      }

      if (unresolvedCaseType) {
        followUpReasons.push(describeUnresolvedCaseType(unresolvedCaseType));
      }

      if (planningReferenceStatus === 'museum_only_icon_ready') {
        followUpReasons.push(
          'No current local mastery, tower, or recipe match was found, but this row already has enough slug coverage to stay museum-only and icon-ready for now without forcing it into active planning/reference coverage.',
        );
      } else if (needsReferenceCoverageFollowUp) {
        followUpReasons.push('Still needs local planning/reference follow-up against current mastery, tower, and recipe coverage.');
      }

      if (likelyReferenceMatches.length > 0) {
        followUpReasons.push(
          `Likely local matches: ${likelyReferenceMatches
            .map((match) => `${match.itemName} [${match.sources.join('/')}] (${match.reason})`)
            .join('; ')}.`,
        );
      }

      if (unresolvedTriageStatus === 'triaged') {
        followUpReasons.push(
          'This unresolved row was marked triaged locally and will stay out of the active unresolved queue unless its signature changes.',
        );
      } else if (unresolvedTriageStatus === 'active') {
        followUpReasons.push('This unresolved row is still in the active local triage queue.');
      }

      if (needsRecipeCoverageFollowUp) {
        followUpReasons.push('Expected recipe coverage is missing for this matched item.');
      } else if (recipeCoverageStatus === 'unresolved') {
        followUpReasons.push('Recipe expectation is unresolved until this item is reconciled more safely.');
      }

      if (buddySlugCoverageStatus === 'covered_local') {
        followUpReasons.push('Local maintained buddy slug coverage already exists for this matched item.');
      } else if (buddySlugCoverageStatus === 'derived_candidate_ready') {
        followUpReasons.push(
          'A clean auto-derived buddy slug candidate exists locally and does not currently need review, but it has not been promoted into maintained local slug coverage.',
        );
      } else if (buddySlugCoverageStatus === 'missing_known_expected') {
        followUpReasons.push('Known matched item is missing expected local buddy slug coverage.');
      } else if (buddySlugCoverageStatus === 'missing_new_item') {
        followUpReasons.push('Newly discovered item still needs buddy slug follow-up.');
      } else if (buddySlugCoverageStatus === 'candidate_review_needed') {
        followUpReasons.push('Buddy slug candidate exists but still needs review before it should be trusted.');
      } else if (buddySlugCoverageStatus === 'candidate_reviewed') {
        followUpReasons.push(
          'Buddy slug candidate was reviewed locally and will stay quiet unless the derived candidate changes materially.',
        );
      } else if (buddySlugCoverageStatus === 'unresolved') {
        followUpReasons.push('Buddy slug status is unresolved until this item is reconciled more safely.');
      }

      if (iconReadyCoverageStatus === 'maintained_local') {
        followUpReasons.push('Icon-ready coverage already exists from maintained local buddy slug metadata.');
      } else if (iconReadyCoverageStatus === 'derived_ready') {
        followUpReasons.push('Icon-ready coverage can be preserved from the clean derived buddy slug candidate even without pulling this item into active planning coverage.');
      } else if (iconReadyCoverageStatus === 'reviewed_candidate') {
        followUpReasons.push('Icon-ready coverage can be preserved from the locally reviewed buddy slug candidate.');
      } else {
        followUpReasons.push('Icon-ready coverage is not yet safe enough to preserve from current local candidate data.');
      }

      if (iconCandidateStatus === 'from_local_item_id') {
        followUpReasons.push('Candidate icon URL is being exposed from local farmrpg_item_id metadata for manual inspection.');
      } else if (iconCandidateStatus === 'assumed_from_clean_slug') {
        followUpReasons.push(
          'Only an unverified slug-based icon key hint is available right now. Live buddy pages show that icon filenames are not reliably the same as buddy slugs, so no direct icon URL is exposed from this guess.',
        );
      } else if (iconCandidateStatus === 'assumed_from_reviewed_slug') {
        followUpReasons.push(
          'Only a reviewed-but-still-unverified slug-based icon key hint is available right now. Live buddy pages show that icon filenames are not reliably the same as buddy slugs, so no direct icon URL is exposed from this guess.',
        );
      } else {
        followUpReasons.push('No candidate icon URL is exposed yet because current local evidence is not strong enough to derive one safely.');
      }

      if (needsCandidateReview) {
        followUpReasons.push(`Generated buddy candidate needs review: ${item.flags.join(', ')}.`);
      } else if (candidateReviewStatus === 'reviewed') {
        followUpReasons.push('Candidate review flags were marked reviewed locally for this exact derived candidate.');
      }

      return {
        ...item,
        candidateReviewKey,
        candidateReviewStatus,
        isKnownBaselineItem,
        isNewSinceBaseline,
        hasMasteryReferenceCoverage,
        hasTowerReferenceCoverage,
        hasRecipeCoverage,
        hasAnyReferenceCoverage,
        isMatchedKnownItem,
        localBuddySlug,
        localFarmrpgItemId,
        recipeCoverageStatus,
        buddySlugCoverageStatus,
        iconReadyCoverageStatus,
        hasIconReadyCoverage,
        iconCandidateStatus,
        candidateIconKeyHint,
        candidateIconUrl,
        candidateIconPathname,
        planningReferenceStatus,
        unresolvedCaseType,
        unresolvedTriageKey,
        unresolvedTriageStatus,
        likelyReferenceMatches,
        needsReferenceCoverageFollowUp,
        needsUnresolvedTriageFollowUp,
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
  const unresolvedItems = items.filter((item) => item.unresolvedCaseType !== null);
  const activeUnresolvedItems = unresolvedItems.filter((item) => item.unresolvedTriageStatus === 'active');
  const triagedUnresolvedItems = unresolvedItems.filter((item) => item.unresolvedTriageStatus === 'triaged');
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
    unresolvedItems,
    activeUnresolvedItems,
    triagedUnresolvedItems,
    actionableItems,
    knownBaselineItemCount: knownBaselineKeys.size,
    summary: {
      itemsParsed: items.length,
      knownBaselineItemCount: knownBaselineKeys.size,
      matchedKnownItemsCount: items.filter((item) => item.isMatchedKnownItem).length,
      unmatchedItemsCount: unmatchedItems.length,
      newItemsCount: newItems.length,
      candidateReviewCount: items.filter((item) => item.candidateReviewStatus === 'review_needed').length,
      reviewedCandidateCount: items.filter((item) => item.candidateReviewStatus === 'reviewed').length,
      recipeCoveredCount: items.filter((item) => item.recipeCoverageStatus === 'covered').length,
      recipeMissingExpectedCount: items.filter((item) => item.recipeCoverageStatus === 'missing_expected').length,
      recipeNotExpectedCount: items.filter((item) => item.recipeCoverageStatus === 'not_expected').length,
      recipeExpectationUnresolvedCount: items.filter((item) => item.recipeCoverageStatus === 'unresolved').length,
      knownItemsWithBuddySlugCoverageCount: items.filter((item) => item.buddySlugCoverageStatus === 'covered_local')
        .length,
      autoDerivedBuddySlugReadyCount: items.filter((item) => item.buddySlugCoverageStatus === 'derived_candidate_ready')
        .length,
      knownItemsMissingExpectedBuddySlugCount: items.filter(
        (item) => item.buddySlugCoverageStatus === 'missing_known_expected',
      ).length,
      newItemsMissingBuddySlugCount: items.filter((item) => item.buddySlugCoverageStatus === 'missing_new_item').length,
      unresolvedBuddySlugStatusCount: items.filter(
        (item) =>
          item.buddySlugCoverageStatus === 'unresolved' || item.buddySlugCoverageStatus === 'candidate_review_needed',
      ).length,
      activeUnresolvedTriageCount: activeUnresolvedItems.length,
      triagedUnresolvedCount: triagedUnresolvedItems.length,
      likelyNameMismatchCount: unresolvedItems.filter((item) => item.unresolvedCaseType === 'likely_name_mismatch').length,
      unresolvedCollisionCount: unresolvedItems.filter((item) => item.unresolvedCaseType === 'collision_or_ambiguity')
        .length,
      unresolvedSlugEdgeCaseCount: unresolvedItems.filter((item) => item.unresolvedCaseType === 'slug_edge_case').length,
      likelyNewItemCount: unresolvedItems.filter((item) => item.unresolvedCaseType === 'likely_new_item').length,
      museumOnlyIconReadyCount: items.filter((item) => item.planningReferenceStatus === 'museum_only_icon_ready').length,
      missingPlanningReferenceCount: unresolvedItems.filter((item) => item.unresolvedCaseType === 'missing_planning_reference')
        .length,
      trulyUnresolvedCount: items.filter((item) => item.planningReferenceStatus === 'truly_unresolved').length,
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
    'museum_category,category,item_name,canonical_key,obtainable,generated_buddy_slug,alternate_buddy_slug,candidate_review_key,candidate_review_status,planning_reference_status,icon_ready_coverage_status,icon_candidate_status,candidate_icon_key_hint,local_farmrpg_item_id,candidate_icon_url,candidate_icon_pathname,unresolved_case_type,unresolved_triage_key,unresolved_triage_status,likely_reference_matches,is_new_since_baseline,is_matched_known_item,recipe_coverage_status,buddy_slug_coverage_status,needs_reference_follow_up,needs_unresolved_triage_follow_up,needs_recipe_follow_up,needs_buddy_slug_follow_up,needs_candidate_review,is_actionable_follow_up,flags,follow_up_reasons',
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
        item.candidateReviewKey,
        item.candidateReviewStatus,
        item.planningReferenceStatus,
        item.iconReadyCoverageStatus,
        item.iconCandidateStatus,
        item.candidateIconKeyHint ?? '',
        item.localFarmrpgItemId ?? '',
        item.candidateIconUrl ?? '',
        item.candidateIconPathname ?? '',
        item.unresolvedCaseType ?? '',
        item.unresolvedTriageKey ?? '',
        item.unresolvedTriageStatus,
        item.likelyReferenceMatches
          .map((match) => `${match.itemName} [${match.sources.join('/')}] (${match.reason})`)
          .join('; '),
        item.isNewSinceBaseline ? 'Y' : 'N',
        item.isMatchedKnownItem ? 'Y' : 'N',
        item.recipeCoverageStatus,
        item.buddySlugCoverageStatus,
        item.needsReferenceCoverageFollowUp ? 'Y' : 'N',
        item.needsUnresolvedTriageFollowUp ? 'Y' : 'N',
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

export function toMuseumLookupCoverageCsv(items: MuseumRefreshItem[]): string {
  const rows = [
    'item_name,canonical_key,museum_category,category,obtainable,generated_buddy_slug,alternate_buddy_slug,planning_reference_status,icon_ready_coverage_status,candidate_review_status,unresolved_case_type,source_workflow,notes',
  ];

  for (const item of items) {
    rows.push(
      [
        item.itemName,
        item.canonicalKey,
        item.museumCategory,
        item.category,
        item.obtainable ? 'Y' : 'N',
        item.generatedBuddySlug,
        item.alternateBuddySlug ?? '',
        item.planningReferenceStatus,
        item.iconReadyCoverageStatus,
        item.candidateReviewStatus,
        item.unresolvedCaseType ?? '',
        'museum_refresh',
        item.followUpReasons.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toMuseumRefreshCandidateReviewCsv(items: MuseumRefreshItem[]): string {
  const rows = [
    'museum_category,category,item_name,canonical_key,generated_buddy_slug,alternate_buddy_slug,candidate_buddy_url,icon_candidate_status,candidate_icon_key_hint,candidate_icon_url,candidate_icon_pathname,candidate_review_key,candidate_review_status,buddy_slug_coverage_status,flags,notes',
  ];

  for (const item of items.filter((candidate) => candidate.flags.length > 0)) {
    rows.push(
      [
        item.museumCategory,
        item.category,
        item.itemName,
        item.canonicalKey,
        item.generatedBuddySlug,
        item.alternateBuddySlug ?? '',
        item.candidateBuddyUrl,
        item.iconCandidateStatus,
        item.candidateIconKeyHint ?? '',
        item.candidateIconUrl ?? '',
        item.candidateIconPathname ?? '',
        item.candidateReviewKey,
        item.candidateReviewStatus,
        item.buddySlugCoverageStatus,
        item.flags.join('; '),
        item.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toMuseumUnresolvedTriageCsv(items: MuseumRefreshItem[]): string {
  const rows = [
    'museum_category,category,item_name,canonical_key,obtainable,generated_buddy_slug,alternate_buddy_slug,candidate_buddy_url,planning_reference_status,icon_ready_coverage_status,icon_candidate_status,candidate_icon_key_hint,candidate_icon_url,candidate_icon_pathname,unresolved_case_type,unresolved_triage_key,unresolved_triage_status,candidate_review_status,flags,is_new_since_baseline,likely_reference_matches,follow_up_reasons',
  ];

  for (const item of items.filter((candidate) => candidate.unresolvedCaseType !== null)) {
    rows.push(
      [
        item.museumCategory,
        item.category,
        item.itemName,
        item.canonicalKey,
        item.obtainable ? 'Y' : 'N',
        item.generatedBuddySlug,
        item.alternateBuddySlug ?? '',
        item.candidateBuddyUrl,
        item.planningReferenceStatus,
        item.iconReadyCoverageStatus,
        item.iconCandidateStatus,
        item.candidateIconKeyHint ?? '',
        item.candidateIconUrl ?? '',
        item.candidateIconPathname ?? '',
        item.unresolvedCaseType ?? '',
        item.unresolvedTriageKey ?? '',
        item.unresolvedTriageStatus,
        item.candidateReviewStatus,
        item.flags.join('; '),
        item.isNewSinceBaseline ? 'Y' : 'N',
        item.likelyReferenceMatches
          .map((match) => `${match.itemName} [${match.sources.join('/')}] (${match.reason})`)
          .join('; '),
        item.followUpReasons.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toMuseumIconCandidateInspectionCsv(items: MuseumRefreshItem[]): string {
  const rows = [
    'museum_category,category,item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,local_farmrpg_item_id,icon_candidate_status,candidate_icon_key_hint,candidate_icon_url,candidate_icon_pathname,candidate_review_status,buddy_slug_coverage_status,icon_ready_coverage_status,flags,notes',
  ];

  for (const item of items) {
    rows.push(
      [
        item.museumCategory,
        item.category,
        item.itemName,
        item.canonicalKey,
        item.generatedBuddySlug,
        item.candidateBuddyUrl,
        item.localFarmrpgItemId ?? '',
        item.iconCandidateStatus,
        item.candidateIconKeyHint ?? '',
        item.candidateIconUrl ?? '',
        item.candidateIconPathname ?? '',
        item.candidateReviewStatus,
        item.buddySlugCoverageStatus,
        item.iconReadyCoverageStatus,
        item.flags.join('; '),
        item.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}
