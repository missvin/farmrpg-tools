import { describe, expect, it } from 'vitest';

import { parseMuseumExport } from './parseMuseumExport';
import {
  createMuseumKnownBaseline,
  deriveMuseumRefreshWorkflow,
  toMuseumRefreshActionableCsv,
} from './deriveMuseumRefreshWorkflow';

describe('deriveMuseumRefreshWorkflow', () => {
  it('chains museum parsing, candidate generation, and local coverage follow-up reporting', () => {
    const parseResult = parseMuseumExport(`Items Count = 3
Bamboo Trellis Bamboo Trellis
Fancy Pipe Fancy Pipe
Mystery Goo Mystery Goo`);

    const workflowResult = deriveMuseumRefreshWorkflow(
      parseResult,
      {
        masteryEntries: [
          {
            canonicalKey: 'bamboo trellis',
            buddySlug: 'bamboo-trellis',
          },
        ],
        towerEntries: [
          {
            canonicalKey: 'fancy pipe',
            buddySlug: null,
          },
        ],
        recipeRows: [
          {
            outputCanonicalKey: 'fancy pipe',
          },
        ],
      },
      null,
    );

    expect(workflowResult.summary.itemsParsed).toBe(3);
    expect(workflowResult.summary.unmatchedItemsCount).toBe(1);
    expect(workflowResult.summary.missingBuddySlugCount).toBe(2);
    expect(workflowResult.summary.missingRecipeCoverageCount).toBe(2);
    expect(workflowResult.unmatchedItems.map((item) => item.canonicalKey)).toEqual(['mystery goo']);
    expect(workflowResult.actionableItems.map((item) => item.canonicalKey)).toEqual([
      'bamboo trellis',
      'fancy pipe',
      'mystery goo',
    ]);
    expect(workflowResult.warnings).toContain(
      'No saved museum baseline yet. Run a bootstrap pass and save the current parsed museum items locally before using incremental refresh.',
    );
  });

  it('compares against a saved baseline and surfaces only new or still-uncovered items', () => {
    const bootstrapParseResult = parseMuseumExport(`Items Count = 2
Bamboo Trellis Bamboo Trellis
Fancy Pipe Fancy Pipe`);
    const bootstrapResult = deriveMuseumRefreshWorkflow(
      bootstrapParseResult,
      {
        masteryEntries: [],
        towerEntries: [],
        recipeRows: [],
      },
      null,
    );
    const baseline = createMuseumKnownBaseline(bootstrapResult);

    const incrementalParseResult = parseMuseumExport(`Items Count = 3
Bamboo Trellis Bamboo Trellis
Fancy Pipe Fancy Pipe
PiÃ±ata Whop Stick PiÃ±ata Whop Stick`);
    const incrementalResult = deriveMuseumRefreshWorkflow(
      incrementalParseResult,
      {
        masteryEntries: [
          {
            canonicalKey: 'bamboo trellis',
            buddySlug: 'bamboo-trellis',
          },
        ],
        towerEntries: [],
        recipeRows: [
          {
            outputCanonicalKey: 'fancy pipe',
          },
        ],
      },
      baseline,
    );

    expect(incrementalResult.summary.knownBaselineItemCount).toBe(2);
    expect(incrementalResult.summary.newItemsCount).toBe(1);
    expect(incrementalResult.newItems.map((item) => item.canonicalKey)).toEqual(['piã±ata whop stick']);
    expect(incrementalResult.actionableItems.map((item) => item.canonicalKey)).toEqual([
      'bamboo trellis',
      'fancy pipe',
      'piã±ata whop stick',
    ]);
    const newItem = incrementalResult.actionableItems.find((item) => item.canonicalKey === 'piã±ata whop stick');

    expect(newItem?.followUpReasons).toEqual(
      expect.arrayContaining([
        'New since the saved museum baseline.',
        'Generated buddy candidate needs review: non_ascii_or_diacritic, symbol_cleanup, alternate_slug_variant.',
      ]),
    );
  });

  it('exports actionable rows as a review CSV', () => {
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

    expect(toMuseumRefreshActionableCsv(result.actionableItems)).toContain('Mystery Goo');
    expect(toMuseumRefreshActionableCsv(result.actionableItems)).toContain(
      'Missing local mastery/tower/recipe coverage.',
    );
  });
});
