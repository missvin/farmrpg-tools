import { describe, expect, it } from 'vitest';

import { parseMuseumExport } from './parseMuseumExport';
import {
  createMuseumCandidateReviewKey,
  createMuseumKnownBaseline,
  createMuseumUnresolvedTriageKey,
  deriveMuseumRefreshWorkflow,
  toMuseumRefreshActionableCsv,
  toMuseumRefreshCandidateReviewCsv,
  toMuseumUnresolvedTriageCsv,
} from './deriveMuseumRefreshWorkflow';

describe('deriveMuseumRefreshWorkflow', () => {
  it('distinguishes recipe expected, not expected, and unresolved cases truthfully', () => {
    const parseResult = parseMuseumExport(`Items Count = 4
Fancy Pipe Fancy Pipe
Barracuda Barracuda
Glass Eye Urchin Glass Eye Urchin
Mystery Goo Mystery Goo`);

    const workflowResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            itemName: 'Fancy Pipe',
            canonicalKey: 'fancy pipe',
            method: 'Crafting',
            buddySlug: null,
          },
          {
            itemName: 'Barracuda',
            canonicalKey: 'barracuda',
            method: 'Fishing',
            buddySlug: null,
          },
          {
            itemName: 'Glass Eye Urchin',
            canonicalKey: 'glass eye urchin',
            method: null,
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [],
      },
      null,
    );

    const fancyPipe = workflowResult.items.find((item) => item.canonicalKey === 'fancy pipe');
    const barracuda = workflowResult.items.find((item) => item.canonicalKey === 'barracuda');
    const urchin = workflowResult.items.find((item) => item.canonicalKey === 'glass eye urchin');
    const mysteryGoo = workflowResult.items.find((item) => item.canonicalKey === 'mystery goo');

    expect(fancyPipe?.recipeCoverageStatus).toBe('missing_expected');
    expect(barracuda?.recipeCoverageStatus).toBe('not_expected');
    expect(urchin?.recipeCoverageStatus).toBe('unresolved');
    expect(mysteryGoo?.recipeCoverageStatus).toBe('unresolved');
    expect(workflowResult.summary.recipeMissingExpectedCount).toBe(1);
    expect(workflowResult.summary.recipeNotExpectedCount).toBe(1);
    expect(workflowResult.summary.recipeExpectationUnresolvedCount).toBe(2);
  });

  it('treats clean auto-derived buddy slug candidates separately from true missing slug gaps', () => {
    const parseResult = parseMuseumExport(`Items Count = 2
11th Leaf Centerpiece 11th Leaf Centerpiece
Mystery Goo Mystery Goo`);

    const workflowResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            itemName: '11th Leaf Centerpiece',
            canonicalKey: '11th leaf centerpiece',
            method: null,
            buddySlug: null,
          },
          {
            itemName: 'Mystery Goo',
            canonicalKey: 'mystery goo',
            method: 'Crafting',
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [],
      },
      null,
    );

    const centerpiece = workflowResult.items.find((item) => item.canonicalKey === '11th leaf centerpiece');
    const mysteryGoo = workflowResult.items.find((item) => item.canonicalKey === 'mystery goo');

    expect(centerpiece?.buddySlugCoverageStatus).toBe('derived_candidate_ready');
    expect(centerpiece?.candidateReviewStatus).toBe('not_needed');
    expect(centerpiece?.needsBuddySlugFollowUp).toBe(false);
    expect(mysteryGoo?.buddySlugCoverageStatus).toBe('derived_candidate_ready');
    expect(workflowResult.summary.autoDerivedBuddySlugReadyCount).toBe(2);
    expect(workflowResult.summary.knownItemsMissingExpectedBuddySlugCount).toBe(0);
  });

  it('classifies unresolved museum items with likely local-match hints and triage status', () => {
    const parseResult = parseMuseumExport(`Items Count = 2
Pot of Gold (Large) Pot of Gold (Large)
Mystery Goo Mystery Goo`);

    const initialResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            itemName: 'Pot of Gold Large',
            canonicalKey: 'pot of gold large',
            method: null,
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [],
      },
      null,
    );

    const potOfGold = initialResult.items.find((item) => item.canonicalKey === 'pot of gold (large)');
    const mysteryGoo = initialResult.items.find((item) => item.canonicalKey === 'mystery goo');

    expect(potOfGold?.unresolvedCaseType).toBe('likely_name_mismatch');
    expect(potOfGold?.likelyReferenceMatches).toEqual([
      expect.objectContaining({
        itemName: 'Pot of Gold Large',
        canonicalKey: 'pot of gold large',
      }),
    ]);
    expect(potOfGold?.unresolvedTriageStatus).toBe('active');
    expect(mysteryGoo?.unresolvedCaseType).toBe('missing_local_reference');
    expect(initialResult.summary.activeUnresolvedTriageCount).toBe(2);
    expect(initialResult.summary.likelyNameMismatchCount).toBe(1);
    expect(initialResult.summary.missingLocalReferenceCount).toBe(1);

    const triagedResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            itemName: 'Pot of Gold Large',
            canonicalKey: 'pot of gold large',
            method: null,
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [],
      },
      null,
      {
        triagedUnresolvedKeys: [createMuseumUnresolvedTriageKey(potOfGold!)],
      },
    );

    const triagedPotOfGold = triagedResult.items.find((item) => item.canonicalKey === 'pot of gold (large)');
    expect(triagedPotOfGold?.unresolvedTriageStatus).toBe('triaged');
    expect(triagedPotOfGold?.needsUnresolvedTriageFollowUp).toBe(false);
    expect(triagedResult.summary.activeUnresolvedTriageCount).toBe(1);
    expect(triagedResult.summary.triagedUnresolvedCount).toBe(1);
  });

  it('keeps reviewed candidate rows out of active review counts until the candidate changes', () => {
    const parseResult = parseMuseumExport(`Items Count = 1
PiÃƒÂ±ata Whop Stick PiÃƒÂ±ata Whop Stick`);

    const initialResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            itemName: 'PiÃƒÂ±ata Whop Stick',
            canonicalKey: 'piÃ£Â±ata whop stick',
            method: null,
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [],
      },
      null,
    );

    const candidate = initialResult.items[0];
    const reviewedResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            itemName: 'PiÃƒÂ±ata Whop Stick',
            canonicalKey: 'piÃ£Â±ata whop stick',
            method: null,
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [],
      },
      null,
      {
        reviewedCandidateKeys: [createMuseumCandidateReviewKey(candidate)],
      },
    );

    expect(initialResult.summary.candidateReviewCount).toBe(1);
    expect(reviewedResult.summary.candidateReviewCount).toBe(0);
    expect(reviewedResult.summary.reviewedCandidateCount).toBe(1);
    expect(reviewedResult.items[0].candidateReviewStatus).toBe('reviewed');
    expect(reviewedResult.items[0].buddySlugCoverageStatus).toBe('unresolved');
    expect(reviewedResult.items[0].needsCandidateReview).toBe(false);
  });

  it('exports review, actionable, and unresolved triage rows with explicit status columns', () => {
    const parseResult = parseMuseumExport(`Items Count = 3
PiÃƒÂ±ata Whop Stick PiÃƒÂ±ata Whop Stick
Mystery Goo Mystery Goo
Pot of Gold (Large) Pot of Gold (Large)`);
    const result = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            itemName: 'Pot of Gold Large',
            canonicalKey: 'pot of gold large',
            method: null,
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [],
      },
      null,
    );

    expect(toMuseumRefreshActionableCsv(result.actionableItems)).toContain('unresolved_case_type');
    expect(toMuseumRefreshActionableCsv(result.actionableItems)).toContain('likely_reference_matches');
    expect(toMuseumRefreshCandidateReviewCsv(result.items)).toContain('candidate_review_status');
    expect(toMuseumUnresolvedTriageCsv(result.unresolvedItems)).toContain('unresolved_triage_status');
    expect(toMuseumUnresolvedTriageCsv(result.unresolvedItems)).toContain('likely_reference_matches');
    expect(toMuseumUnresolvedTriageCsv(result.unresolvedItems)).toContain('likely_name_mismatch');
  });

  it('credits recipe source URLs as local buddy slug coverage for known matched items', () => {
    const parseResult = parseMuseumExport(`Items Count = 2
Bamboo Trellis Bamboo Trellis
Fancy Pipe Fancy Pipe`);

    const workflowResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            itemName: 'Bamboo Trellis',
            canonicalKey: 'bamboo trellis',
            method: null,
            buddySlug: null,
          },
          {
            itemName: 'Fancy Pipe',
            canonicalKey: 'fancy pipe',
            method: 'Crafting',
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [
          {
            outputItemName: 'Bamboo Trellis',
            outputCanonicalKey: 'bamboo trellis',
            sourceBuddyUrl: 'https://buddy.farm/i/bamboo-trellis/',
          },
          {
            outputItemName: 'Fancy Pipe',
            outputCanonicalKey: 'fancy pipe',
            sourceBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
          },
        ],
      },
      null,
    );

    expect(workflowResult.summary.knownItemsWithBuddySlugCoverageCount).toBe(2);
    expect(workflowResult.summary.knownItemsMissingExpectedBuddySlugCount).toBe(0);
    expect(workflowResult.items.map((item) => item.buddySlugCoverageStatus)).toEqual([
      'covered_local',
      'covered_local',
    ]);
  });

  it('separates new-item slug follow-up from unresolved unmatched cases', () => {
    const bootstrapParseResult = parseMuseumExport(`Items Count = 1
Bamboo Trellis Bamboo Trellis`);
    const baseline = createMuseumKnownBaseline(
      deriveMuseumRefreshWorkflow(
        bootstrapParseResult,
        {
          masteryEntries: [],
          towerEntries: [],
          recipeRows: [],
        },
        null,
      ),
    );

    const incrementalParseResult = parseMuseumExport(`Items Count = 3
Bamboo Trellis Bamboo Trellis
New Rope New Rope
PiÃƒÂ±ata Whop Stick PiÃƒÂ±ata Whop Stick`);
    const incrementalResult = deriveMuseumRefreshWorkflow(
      incrementalParseResult,
      {
        masteryEntries: [
          {
            itemName: 'Bamboo Trellis',
            canonicalKey: 'bamboo trellis',
            method: null,
            buddySlug: 'bamboo-trellis',
          },
          {
            itemName: 'New Rope',
            canonicalKey: 'new rope',
            method: 'Crafting',
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [],
      },
      baseline,
    );

    const newRope = incrementalResult.items.find((item) => item.canonicalKey === 'new rope');
    const pinata = incrementalResult.items.find((item) => item.itemName.includes('Pi'));

    expect(newRope?.buddySlugCoverageStatus).toBe('derived_candidate_ready');
    expect(pinata?.buddySlugCoverageStatus).toBe('unresolved');
    expect(pinata?.unresolvedCaseType).toBe('slug_edge_case');
    expect(incrementalResult.summary.autoDerivedBuddySlugReadyCount).toBe(1);
    expect(incrementalResult.summary.unresolvedBuddySlugStatusCount).toBe(1);
  });
});
