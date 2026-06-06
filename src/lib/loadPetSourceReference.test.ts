import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseItemAliasesCsv } from './itemAliases';
import { parseItemCatalogCsv } from './loadItemCatalog';
import { parseMuseumLookupCoverageCsv } from './loadMuseumLookupCoverage';
import {
  findPetSourceReference,
  parsePetSourceReferenceCsv,
  validatePetSourceReferenceAgainstLookup,
} from './loadPetSourceReference';
import { createLocalItemReferenceLookup } from './localItemReferenceLookup';

const HEADER =
  'pet_name,pet_canonical_key,item_name,item_canonical_key,unlock_level,source_url,page_data_url,pet_availability,coverage_status,notes';

function createLookup() {
  return createLocalItemReferenceLookup({
    itemCatalog: parseItemCatalogCsv(
      `item_name,canonical_key,mastery_possible,farmrpg_item_id,buddy_slug,source_datasets,notes
Frost Snapper Shell,frost snapper shell,unknown,,frost-snapper-shell,manual_seed,`,
    ),
    aliases: parseItemAliasesCsv('alias_name,alias_key,canonical_item_name,canonical_key,review_status,source,notes'),
    museumCoverage: parseMuseumLookupCoverageCsv(
      'item_name,canonical_key,museum_category,category,obtainable,generated_buddy_slug,alternate_buddy_slug,planning_reference_status,icon_ready_coverage_status,candidate_review_status,unresolved_case_type,source_workflow,notes',
    ),
  });
}

describe('parsePetSourceReferenceCsv', () => {
  it('parses reviewed pet-source availability rows', () => {
    const result = parsePetSourceReferenceCsv(`${HEADER}
Seal,seal,Frost Snapper Shell,frost snapper shell,6,https://buddy.farm/i/frost-snapper-shell/,https://buddy.farm/page-data/i/frost-snapper-shell/page-data.json,normal,reviewed,seed row`);

    expect(result.entries).toHaveLength(1);
    expect(result.byItemCanonicalKey['frost snapper shell']).toHaveLength(1);
    expect(result.byPetCanonicalKey.seal).toHaveLength(1);
    expect(findPetSourceReference(result, 'Seal', 'frost snapper shell')).toMatchObject({
      petName: 'Seal',
      itemName: 'Frost Snapper Shell',
      unlockLevel: 6,
      petAvailability: 'normal',
      coverageStatus: 'reviewed',
      notes: ['seed row'],
    });
  });

  it('rejects invalid schema, canonical mismatches, and duplicate pet-item rows', () => {
    expect(() => parsePetSourceReferenceCsv('pet_name,pet_canonical_key\nSeal,seal')).toThrow(
      'Invalid pet-source reference schema',
    );

    expect(() =>
      parsePetSourceReferenceCsv(`${HEADER}
Seal,wrong,Frost Snapper Shell,frost snapper shell,6,https://buddy.farm/i/frost-snapper-shell/,https://buddy.farm/page-data/i/frost-snapper-shell/page-data.json,normal,reviewed,`),
    ).toThrow('Pet canonical key mismatch');

    expect(() =>
      parsePetSourceReferenceCsv(`${HEADER}
Seal,seal,Frost Snapper Shell,wrong,6,https://buddy.farm/i/frost-snapper-shell/,https://buddy.farm/page-data/i/frost-snapper-shell/page-data.json,normal,reviewed,`),
    ).toThrow('Item canonical key mismatch');

    expect(() =>
      parsePetSourceReferenceCsv(`${HEADER}
Seal,seal,Frost Snapper Shell,frost snapper shell,6,https://buddy.farm/i/frost-snapper-shell/,https://buddy.farm/page-data/i/frost-snapper-shell/page-data.json,normal,reviewed,
Seal,seal,Frost Snapper Shell,frost snapper shell,6,https://buddy.farm/i/frost-snapper-shell/,https://buddy.farm/page-data/i/frost-snapper-shell/page-data.json,normal,reviewed,`),
    ).toThrow('Duplicate pet-source row');
  });

  it('returns non-fatal lookup issues for unrecognized item coverage', () => {
    const result = parsePetSourceReferenceCsv(`${HEADER}
Seal,seal,Unknown Shell,unknown shell,6,https://buddy.farm/i/unknown-shell/,https://buddy.farm/page-data/i/unknown-shell/page-data.json,normal,partial,`);

    expect(validatePetSourceReferenceAgainstLookup(result, createLookup())).toEqual([
      expect.objectContaining({
        code: 'item_unrecognized',
        itemName: 'Unknown Shell',
      }),
    ]);
  });

  it('parses the checked-in local pet-source reference file', () => {
    const result = parsePetSourceReferenceCsv(
      readFileSync(join(process.cwd(), 'data', 'pet_source_reference.csv'), 'utf8'),
    );

    expect(result.entries).toHaveLength(336);
    expect(result.byPetCanonicalKey.hedgehog).toHaveLength(12);
    expect(findPetSourceReference(result, 'Skunk', 'salt')).toMatchObject({
      petName: 'Skunk',
      itemName: 'Salt',
      unlockLevel: 3,
      petAvailability: 'normal',
      coverageStatus: 'reviewed',
    });
    expect(findPetSourceReference(result, 'Red Dragon', 'salt')).toMatchObject({
      petName: 'Red Dragon',
      itemName: 'Salt',
      unlockLevel: 6,
      petAvailability: 'normal',
      coverageStatus: 'reviewed',
    });
    expect(findPetSourceReference(result, 'Seal', 'frost snapper shell')).toMatchObject({
      petName: 'Seal',
      itemName: 'Frost Snapper Shell',
      unlockLevel: 6,
      petAvailability: 'normal',
      coverageStatus: 'reviewed',
    });
    expect(findPetSourceReference(result, 'Dog', 'antler')).toMatchObject({
      petName: 'Dog',
      itemName: 'Antler',
      unlockLevel: 3,
      petAvailability: 'normal',
      coverageStatus: 'reviewed',
    });
    expect(findPetSourceReference(result, 'Hummingbird', 'honeysuckle')).toMatchObject({
      petAvailability: 'seasonal',
    });
  });
});
