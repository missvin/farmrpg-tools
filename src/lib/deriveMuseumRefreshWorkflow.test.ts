import { describe, expect, it } from 'vitest';

import { parseMuseumExport } from './parseMuseumExport';
import {
  createMuseumKnownBaseline,
  deriveMuseumRefreshWorkflow,
  toMuseumRefreshActionableCsv,
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
            canonicalKey: 'fancy pipe',
            method: 'Crafting',
            buddySlug: null,
          },
          {
            canonicalKey: 'barracuda',
            method: 'Fishing',
            buddySlug: null,
          },
          {
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

  it('credits recipe source URLs as local buddy slug coverage for known matched items', () => {
    const parseResult = parseMuseumExport(`Items Count = 2
Bamboo Trellis Bamboo Trellis
Fancy Pipe Fancy Pipe`);

    const workflowResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            canonicalKey: 'bamboo trellis',
            method: null,
            buddySlug: null,
          },
          {
            canonicalKey: 'fancy pipe',
            method: 'Crafting',
            buddySlug: null,
          },
        ],
        towerEntries: [],
        recipeRows: [
          {
            outputCanonicalKey: 'bamboo trellis',
            sourceBuddyUrl: 'https://buddy.farm/i/bamboo-trellis/',
          },
          {
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
      'covered_known',
      'covered_known',
    ]);
  });

  it('separates new-item slug follow-up from unresolved review-needed cases', () => {
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
            canonicalKey: 'bamboo trellis',
            method: null,
            buddySlug: 'bamboo-trellis',
          },
          {
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
    const pinata = incrementalResult.items.find((item) => item.canonicalKey === 'piãƒâ±ata whop stick');

    expect(newRope?.buddySlugCoverageStatus).toBe('missing_new_item');
    expect(pinata?.buddySlugCoverageStatus).toBe('unresolved');
    expect(incrementalResult.summary.newItemsMissingBuddySlugCount).toBe(1);
    expect(incrementalResult.summary.unresolvedBuddySlugStatusCount).toBe(1);
  });

  it('exports actionable rows with explicit coverage statuses', () => {
    const parseResult = parseMuseumExport(`Items Count = 1
Mystery Goo Mystery Goo`);
    const result = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [],
        towerEntries: [],
        recipeRows: [],
      },
      null,
    );

    expect(toMuseumRefreshActionableCsv(result.actionableItems)).toContain('recipe_coverage_status');
    expect(toMuseumRefreshActionableCsv(result.actionableItems)).toContain('buddy_slug_coverage_status');
    expect(toMuseumRefreshActionableCsv(result.actionableItems)).toContain('unresolved');
  });
});
