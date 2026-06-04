import { describe, expect, it } from 'vitest';

import {
  buildCurrentMuseumUniverse,
  extractLibraryEverythingPayload,
  toBuddyEvidenceTargetsCsv,
  toNewItemReviewCsv,
} from './currentMuseumUniverse.mjs';

const canonCsv = [
  'museum_category,category_key,slot_index,item_name,canonical_key,obtainable,review_status,source,notes',
  'Items,items,1,Blue,blue,Y,source_parsed,test,test',
  'Items,items,2,Diamond,diamond,Y,source_parsed,test,test',
  'Items,items,3,Fish,fish,Y,source_parsed,test,test',
  'Items,items,4,Bacon,bacon,Y,source_parsed,test,test',
  'Items,items,5,Trout,trout,Y,source_parsed,test,test',
].join('\n');

describe('current museum universe generation', () => {
  it('extracts the Library Everything payload and declared count', () => {
    const result = extractLibraryEverythingPayload('Header\nEvery single item (1,461):\nBlue Diamond Fish\nConsume a meal\nFooter');

    expect(result.declaredCount).toBe(1461);
    expect(result.payload).toBe('BlueDiamondFish');
  });

  it('prioritizes reviewed compound additions over shorter existing canon names', () => {
    const rawText = [
      'Every single item (3):',
      'Blue Diamond FishLucky BaconFuzzy Trout',
      'Consume a meal',
    ].join('\n');

    const result = buildCurrentMuseumUniverse({
      rawText,
      canonCsvText: canonCsv,
      reviewedAdditions: ['Blue Diamond Fish', 'Lucky Bacon', 'Fuzzy Trout'],
    });

    expect(result.parsedCount).toBe(3);
    expect(result.items.map((item) => item.itemName)).toEqual(['Blue Diamond Fish', 'Lucky Bacon', 'Fuzzy Trout']);
    expect(result.items.every((item) => item.sourceStatus === 'new_in_current_museum_export')).toBe(true);
  });

  it('throws when the export contains text that is not covered by canon or reviewed additions', () => {
    const rawText = ['Every single item (1):', 'MysteryThing', 'Consume a meal'].join('\n');

    expect(() =>
      buildCurrentMuseumUniverse({
        rawText,
        canonCsvText: canonCsv,
        reviewedAdditions: [],
      }),
    ).toThrow(/Could not match museum export text/u);
  });

  it('writes Buddy target and new-item review rows without writing canonical data', () => {
    const rawText = ['Every single item (1):', 'Lucky Bacon', 'Consume a meal'].join('\n');
    const result = buildCurrentMuseumUniverse({
      rawText,
      canonCsvText: canonCsv,
      reviewedAdditions: ['Lucky Bacon'],
    });

    expect(toBuddyEvidenceTargetsCsv(result)).toContain('Lucky Bacon,lucky bacon,https://buddy.farm/i/lucky-bacon/');
    expect(toNewItemReviewCsv(result)).toContain('Lucky Bacon,lucky bacon,https://buddy.farm/i/lucky-bacon/');
  });
});
