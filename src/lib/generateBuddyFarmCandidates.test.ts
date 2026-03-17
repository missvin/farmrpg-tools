import { describe, expect, it } from 'vitest';

import {
  generateBuddyFarmCandidates,
  parseMuseumSeedCsv,
  toBuddyFarmCandidateReviewCsv,
} from './generateBuddyFarmCandidates';

describe('generateBuddyFarmCandidates', () => {
  it('parses museum_seed.csv rows and generates buddy candidate URLs', () => {
    const seedRows = parseMuseumSeedCsv(`museum_category,category,item_name,canonical_key,obtainable
Items,Item,Bamboo Trellis,bamboo trellis,Y
Items,Item,Bar of Silver,bar of silver,Y`);

    const result = generateBuddyFarmCandidates(seedRows);

    expect(result.parseSummary.itemsParsed).toBe(2);
    expect(result.reviewItems).toEqual([]);
    expect(result.items).toEqual([
      expect.objectContaining({
        itemName: 'Bamboo Trellis',
        generatedBuddySlug: 'bamboo-trellis',
        candidateBuddyUrl: 'https://buddy.farm/i/bamboo-trellis/',
        confidence: 'high',
      }),
      expect.objectContaining({
        itemName: 'Bar of Silver',
        generatedBuddySlug: 'bar-of-silver',
        candidateBuddyUrl: 'https://buddy.farm/i/bar-of-silver/',
        confidence: 'high',
      }),
    ]);
  });

  it('flags non-ascii and alternate-slug edge cases for review', () => {
    const seedRows = parseMuseumSeedCsv(`museum_category,category,item_name,canonical_key,obtainable
Event,Event,Piñata Whop Stick,piñata whop stick,Y`);

    const result = generateBuddyFarmCandidates(seedRows);

    expect(result.parseSummary.reviewItemsCount).toBe(1);
    expect(result.reviewItems[0]).toEqual(
      expect.objectContaining({
        itemName: 'Piñata Whop Stick',
        generatedBuddySlug: 'pi-ata-whop-stick',
        alternateBuddySlug: 'pinata-whop-stick',
        confidence: 'review',
        flags: expect.arrayContaining(['non_ascii_or_diacritic', 'alternate_slug_variant']),
      }),
    );
  });

  it('exports review CSV with flagged candidate rows only', () => {
    const seedRows = parseMuseumSeedCsv(`museum_category,category,item_name,canonical_key,obtainable
Items,Item,Bamboo Trellis,bamboo trellis,Y
Event,Event,Piñata Whop Stick,piñata whop stick,Y`);

    const result = generateBuddyFarmCandidates(seedRows);
    const reviewCsv = toBuddyFarmCandidateReviewCsv(result);

    expect(reviewCsv).toContain('Piñata Whop Stick');
    expect(reviewCsv).not.toContain('Bamboo Trellis');
    expect(reviewCsv).toContain('pi-ata-whop-stick');
  });
});
