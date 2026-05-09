import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseItemAliasesCsv } from './itemAliases';
import { parseItemCatalogCsv } from './loadItemCatalog';
import {
  parseDropRateReferenceCsv,
  validateDropRateReferenceAgainstLookup,
} from './loadDropRateReference';
import { parseMuseumLookupCoverageCsv } from './loadMuseumLookupCoverage';
import { createLocalItemReferenceLookup } from './localItemReferenceLookup';

const HEADER =
  'target_item_name,target_canonical_key,source_name,source_canonical_key,source_type,source_kind,row_kind,raw_rate,base_drop_rate,source_page_type,source_page_name,source_page_url,page_data_url,target_item_id,target_item_image,source_image,iron_depot,manual_fishing,runecube,flags,notes';

function createLookup() {
  return createLocalItemReferenceLookup({
    itemCatalog: parseItemCatalogCsv(
      `item_name,canonical_key,mastery_possible,farmrpg_item_id,buddy_slug,source_datasets,notes
Glass Orb,glass orb,yes,78,glass-orb,mastery_difficulty,
Pumpkin,pumpkin,yes,69,pumpkin,mastery_difficulty,
Pumpkin Seeds,pumpkin seeds,no,70,pumpkin-seeds,museum_lookup_coverage,`,
    ),
    aliases: parseItemAliasesCsv('alias_name,alias_key,canonical_item_name,canonical_key,review_status,source,notes'),
    museumCoverage: parseMuseumLookupCoverageCsv(
      'item_name,canonical_key,museum_category,category,obtainable,generated_buddy_slug,alternate_buddy_slug,planning_reference_status,icon_ready_coverage_status,candidate_review_status,unresolved_case_type,source_workflow,notes',
    ),
  });
}

describe('parseDropRateReferenceCsv', () => {
  it('parses reviewed Buddy-derived drop-rate rows', () => {
    const result = parseDropRateReferenceCsv(`${HEADER}
Glass Orb,glass orb,Ember Lagoon,ember lagoon,explore,location,item_source,20.838802071738133,0.3333333333333333,item,Glass Orb,https://buddy.farm/i/glass-orb/,https://buddy.farm/page-data/i/glass-orb/page-data.json,78,/img/items/5708.PNG,/img/items/lagoon.png,false,,true,,"sample row"
Pumpkin,pumpkin,Pumpkin Seeds,pumpkin seeds,farming,seed,seed_output,1,1,item,Pumpkin Seeds,https://buddy.farm/i/pumpkin-seeds/,https://buddy.farm/page-data/i/pumpkin-seeds/page-data.json,69,/img/items/8294.png,/img/items/seeds_pumpkin.png,,,false,,`);

    expect(result.entries).toHaveLength(2);
    expect(result.byTargetCanonicalKey['glass orb']).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      targetItemName: 'Glass Orb',
      sourceName: 'Ember Lagoon',
      sourceType: 'explore',
      sourceKind: 'location',
      rowKind: 'item_source',
      rawRate: 20.838802071738133,
      baseDropRate: 0.3333333333333333,
      ironDepot: false,
      manualFishing: null,
      runecube: true,
      notes: ['sample row'],
    });
  });

  it('rejects invalid schema and malformed values', () => {
    expect(() =>
      parseDropRateReferenceCsv(`target_item_name,target_canonical_key
Glass Orb,glass orb`),
    ).toThrow('Invalid drop-rate reference schema');

    expect(() =>
      parseDropRateReferenceCsv(`${HEADER}
Glass Orb,wrong,Ember Lagoon,ember lagoon,explore,location,item_source,1,,item,Glass Orb,https://buddy.farm/i/glass-orb/,https://buddy.farm/page-data/i/glass-orb/page-data.json,,,,,,,true,,`),
    ).toThrow('Target canonical key mismatch');

    expect(() =>
      parseDropRateReferenceCsv(`${HEADER}
Glass Orb,glass orb,Ember Lagoon,ember lagoon,explore,location,item_source,not-a-number,,item,Glass Orb,https://buddy.farm/i/glass-orb/,https://buddy.farm/page-data/i/glass-orb/page-data.json,,,,,,,true,,`),
    ).toThrow('Invalid raw_rate "not-a-number"');

    expect(() =>
      parseDropRateReferenceCsv(`${HEADER}
Glass Orb,glass orb,Ember Lagoon,ember lagoon,explore,location,item_source,1,,item,Glass Orb,https://buddy.farm/i/glass-orb/,https://buddy.farm/page-data/i/glass-orb/page-data.json,,,,maybe,,true,,`),
    ).toThrow('Invalid iron_depot "maybe"');
  });

  it('returns non-fatal lookup issues for missing item coverage', () => {
    const dropRates = parseDropRateReferenceCsv(`${HEADER}
Unknown Drop,unknown drop,Ember Lagoon,ember lagoon,explore,location,location_item,1,0.3333333333333333,location,Ember Lagoon,https://buddy.farm/l/ember-lagoon/,https://buddy.farm/page-data/l/ember-lagoon/page-data.json,,,,false,,true,,
Pumpkin,pumpkin,Unknown Seeds,unknown seeds,farming,seed,seed_output,1,1,item,Unknown Seeds,https://buddy.farm/i/unknown-seeds/,https://buddy.farm/page-data/i/unknown-seeds/page-data.json,,,,,,false,,`);

    expect(validateDropRateReferenceAgainstLookup(dropRates, createLookup())).toEqual([
      expect.objectContaining({
        code: 'target_item_unrecognized',
        targetItemName: 'Unknown Drop',
      }),
      expect.objectContaining({
        code: 'seed_source_unrecognized',
        targetItemName: 'Pumpkin',
      }),
    ]);
  });

  it('parses the checked-in local drop-rate reference file', () => {
    const result = parseDropRateReferenceCsv(
      readFileSync(join(process.cwd(), 'data', 'drop_rate_reference.csv'), 'utf8'),
    );

    expect(result.entries).toEqual([]);
    expect(result.byTargetCanonicalKey).toEqual({});
  });
});
