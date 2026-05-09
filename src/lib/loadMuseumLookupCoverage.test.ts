import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseMuseumLookupCoverageCsv } from './loadMuseumLookupCoverage';

const HEADER =
  'item_name,canonical_key,museum_category,category,obtainable,generated_buddy_slug,alternate_buddy_slug,planning_reference_status,icon_ready_coverage_status,candidate_review_status,unresolved_case_type,source_workflow,notes';

describe('parseMuseumLookupCoverageCsv', () => {
  it('parses reviewed museum lookup coverage rows', () => {
    const result = parseMuseumLookupCoverageCsv(`${HEADER}
Mystery Goo,mystery goo,Items,Other,Y,mystery-goo,,museum_only_icon_ready,derived_ready,not_needed,,museum_refresh,"Museum-only lookup coverage"
Pot of Gold (Large),pot of gold (large),Items,Other,N,pot-of-gold-large,,likely_name_mismatch,derived_ready,review_needed,likely_name_mismatch,museum_refresh,Review alias`);

    expect(result.entries).toHaveLength(2);
    expect(result.byCanonicalKey['mystery goo']).toMatchObject({
      itemName: 'Mystery Goo',
      canonicalKey: 'mystery goo',
      obtainable: true,
      generatedBuddySlug: 'mystery-goo',
      alternateBuddySlug: null,
      planningReferenceStatus: 'museum_only_icon_ready',
      iconReadyCoverageStatus: 'derived_ready',
      candidateReviewStatus: 'not_needed',
      unresolvedCaseType: null,
      sourceWorkflow: 'museum_refresh',
      notes: 'Museum-only lookup coverage',
    });
    expect(result.byCanonicalKey['pot of gold (large)']).toMatchObject({
      obtainable: false,
      unresolvedCaseType: 'likely_name_mismatch',
    });
  });

  it('rejects invalid headers', () => {
    expect(() =>
      parseMuseumLookupCoverageCsv(`item_name,canonical_key,museum_category
Mystery Goo,mystery goo,Items`),
    ).toThrow('Invalid museum lookup coverage schema');
  });

  it('rejects canonical key mismatches', () => {
    expect(() =>
      parseMuseumLookupCoverageCsv(`${HEADER}
Mystery Goo,wrong key,Items,Other,Y,mystery-goo,,museum_only_icon_ready,derived_ready,not_needed,,museum_refresh,`),
    ).toThrow('Canonical key mismatch for museum lookup coverage row "Mystery Goo"');
  });

  it('rejects invalid status values', () => {
    expect(() =>
      parseMuseumLookupCoverageCsv(`${HEADER}
Mystery Goo,mystery goo,Items,Other,Y,mystery-goo,,maybe,derived_ready,not_needed,,museum_refresh,`),
    ).toThrow('Invalid planning_reference_status "maybe"');
  });

  it('rejects duplicate canonical keys', () => {
    expect(() =>
      parseMuseumLookupCoverageCsv(`${HEADER}
Mystery Goo,mystery goo,Items,Other,Y,mystery-goo,,museum_only_icon_ready,derived_ready,not_needed,,museum_refresh,
Mystery Goo,mystery goo,Items,Other,Y,mystery-goo,,museum_only_icon_ready,derived_ready,not_needed,,museum_refresh,`),
    ).toThrow('Duplicate museum lookup coverage row for canonical key "mystery goo".');
  });

  it('parses the checked-in local museum lookup coverage file', () => {
    const result = parseMuseumLookupCoverageCsv(
      readFileSync(join(process.cwd(), 'data', 'museum_lookup_coverage.csv'), 'utf8'),
    );

    expect(result.entries).toEqual([]);
    expect(result.byCanonicalKey).toEqual({});
  });
});
