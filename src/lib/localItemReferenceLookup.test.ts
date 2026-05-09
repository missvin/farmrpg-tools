import { describe, expect, it } from 'vitest';

import { parseItemAliasesCsv } from './itemAliases';
import { parseItemCatalogCsv } from './loadItemCatalog';
import { parseMuseumLookupCoverageCsv } from './loadMuseumLookupCoverage';
import {
  createLocalItemReferenceLookup,
  resolveLocalItemReference,
  toLocalItemReferenceReviewCsv,
} from './localItemReferenceLookup';

function createLookup() {
  return createLocalItemReferenceLookup({
    itemCatalog: parseItemCatalogCsv(
      `item_name,canonical_key,mastery_possible,farmrpg_item_id,buddy_slug,source_datasets,notes
Acorn,acorn,unknown,,,recipe_inputs.input,
Pot of Gold Large,pot of gold large,unknown,,,item_catalog,`,
    ),
    aliases: parseItemAliasesCsv(
      `alias_name,alias_key,canonical_item_name,canonical_key,review_status,source,notes
Pot of Gold (Large),pot of gold (large),Pot of Gold Large,pot of gold large,approved,museum_workflow,
Farmers Hat,farmers hat,Farmer's Hat,farmer's hat,needs_review,museum_workflow,`,
    ),
    museumCoverage: parseMuseumLookupCoverageCsv(
      `item_name,canonical_key,museum_category,category,obtainable,generated_buddy_slug,alternate_buddy_slug,planning_reference_status,icon_ready_coverage_status,candidate_review_status,unresolved_case_type,source_workflow,notes
Mystery Goo,mystery goo,Items,Other,Y,mystery-goo,,museum_only_icon_ready,derived_ready,not_needed,,museum_refresh,`,
    ),
  });
}

describe('local item reference lookup', () => {
  it('recognizes catalog items without making mastery eligibility assumptions', () => {
    const result = resolveLocalItemReference('Acorn', createLookup());

    expect(result).toMatchObject({
      canonicalKey: 'acorn',
      displayName: 'Acorn',
      recognized: true,
      recognitionStatus: 'catalog',
      masteryPossible: 'unknown',
      sourceDatasets: ['recipe_inputs.input'],
      warnings: [],
    });
  });

  it('uses only approved aliases to resolve naming drift', () => {
    const lookup = createLookup();

    expect(resolveLocalItemReference('Pot of Gold (Large)', lookup)).toMatchObject({
      inputKey: 'pot of gold (large)',
      canonicalKey: 'pot of gold large',
      displayName: 'Pot of Gold Large',
      recognized: true,
      recognitionStatus: 'alias',
      sourceDatasets: ['item_aliases', 'item_catalog'],
      warnings: [],
    });

    expect(resolveLocalItemReference('Farmers Hat', lookup)).toMatchObject({
      inputKey: 'farmers hat',
      canonicalKey: 'farmers hat',
      recognized: false,
      recognitionStatus: 'unrecognized',
    });
    expect(resolveLocalItemReference('Farmers Hat', lookup).warnings).toEqual([
      'Alias "Farmers Hat" is needs_review; unresolved until it is approved.',
      'No local item reference coverage found; keep this visible as a review candidate.',
    ]);
  });

  it('recognizes museum-only coverage without treating it as mastery eligible', () => {
    const result = resolveLocalItemReference('Mystery Goo', createLookup());

    expect(result).toMatchObject({
      canonicalKey: 'mystery goo',
      displayName: 'Mystery Goo',
      recognized: true,
      recognitionStatus: 'museum_only',
      masteryPossible: 'unknown',
      sourceDatasets: ['museum_lookup_coverage'],
    });
    expect(result.warnings).toEqual(['Recognized from museum lookup coverage only; do not infer mastery eligibility.']);
  });

  it('exports only warning and unresolved rows for review', () => {
    const lookup = createLookup();
    const csv = toLocalItemReferenceReviewCsv([
      resolveLocalItemReference('Acorn', lookup),
      resolveLocalItemReference('Mystery Goo', lookup),
      resolveLocalItemReference('Farmers Hat', lookup),
    ]);

    expect(csv).toContain('observed_item_name');
    expect(csv).not.toContain('Acorn,acorn');
    expect(csv).toContain('Mystery Goo,mystery goo');
    expect(csv).toContain('Farmers Hat,farmers hat');
    expect(csv).toContain('do not infer mastery eligibility');
  });
});
