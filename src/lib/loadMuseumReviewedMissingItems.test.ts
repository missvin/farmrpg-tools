import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseMuseumReviewedMissingItemsCsv } from './loadMuseumReviewedMissingItems';

describe('parseMuseumReviewedMissingItemsCsv', () => {
  it('parses reviewed missing item rows and grouped rows', () => {
    const result = parseMuseumReviewedMissingItemsCsv(`category_name,category_key,item_name,canonical_key,slot_count,review_status,source,notes
Items,items,Apple Basket,apple basket,1,reviewed,manual,
Items,items,Certificates of Farm Giving,certificates of farm giving,8,reviewed_group,manual,grouped row`);

    expect(result.entries).toEqual([
      {
        id: 'reviewed-items-apple basket',
        categoryKey: 'items',
        categoryName: 'Items',
        itemName: 'Apple Basket',
        canonicalKey: 'apple basket',
        slotCount: 1,
        note: '',
        reviewStatus: 'reviewed',
        source: 'manual',
      },
      {
        id: 'reviewed-items-certificates of farm giving',
        categoryKey: 'items',
        categoryName: 'Items',
        itemName: 'Certificates of Farm Giving',
        canonicalKey: 'certificates of farm giving',
        slotCount: 8,
        note: 'grouped row',
        reviewStatus: 'reviewed_group',
        source: 'manual',
      },
    ]);
  });

  it('rejects canonical-key mismatches', () => {
    expect(() =>
      parseMuseumReviewedMissingItemsCsv(`category_name,category_key,item_name,canonical_key,slot_count,review_status,source,notes
Items,items,Apple Basket,apple-basket,1,reviewed,manual,`),
    ).toThrow(
      'Canonical key mismatch for reviewed museum missing item "Apple Basket": expected "apple basket" but found "apple-basket".',
    );
  });

  it('parses the checked-in reviewed missing item data', () => {
    const csvText = readFileSync('data/museum_reviewed_missing_items.csv', 'utf8');
    const result = parseMuseumReviewedMissingItemsCsv(csvText);

    expect(result.entries).toHaveLength(45);
    expect(result.entries.reduce((total, entry) => total + entry.slotCount, 0)).toBe(56);
  });
});
