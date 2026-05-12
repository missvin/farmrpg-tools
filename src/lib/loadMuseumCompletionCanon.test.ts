import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { parseMuseumCompletionCanonCsv } from './loadMuseumCompletionCanon';

describe('parseMuseumCompletionCanonCsv', () => {
  it('parses reviewed ordered museum canon rows by category and slot', () => {
    const result = parseMuseumCompletionCanonCsv(`museum_category,category_key,slot_index,item_name,canonical_key,obtainable,review_status,source,notes
Items,items,2,Board,board,Y,reviewed,manual review,
Items,items,1,Ant Apple,ant apple,Y,source_parsed,raw sample,
Event Items,event,1,Blue Milk,blue milk,N,source_parsed,raw sample,unreleased`);

    expect(result.entries).toHaveLength(3);
    expect(result.byCategoryKey.items.map((entry) => entry.itemName)).toEqual(['Ant Apple', 'Board']);
    expect(result.byCategoryKey.event[0]).toMatchObject({
      categoryKey: 'event',
      slotIndex: 1,
      obtainable: false,
      reviewStatus: 'source_parsed',
      notes: 'unreleased',
    });
  });

  it('rejects canonical-key mismatches', () => {
    expect(() =>
      parseMuseumCompletionCanonCsv(`museum_category,category_key,slot_index,item_name,canonical_key,obtainable,review_status,source,notes
Items,items,1,Ant Apple,ant_apple,Y,reviewed,manual review,`),
    ).toThrow(
      'Canonical key mismatch for museum completion canon row "Ant Apple": expected "ant apple" but found "ant_apple".',
    );
  });

  it('rejects duplicate category slot rows', () => {
    expect(() =>
      parseMuseumCompletionCanonCsv(`museum_category,category_key,slot_index,item_name,canonical_key,obtainable,review_status,source,notes
Items,items,1,Ant Apple,ant apple,Y,reviewed,manual review,
Items,items,1,Board,board,Y,reviewed,manual review,`),
    ).toThrow('Duplicate museum completion canon row for Items slot 1.');
  });

  it('parses the checked-in museum completion canon seed', () => {
    const csvText = readFileSync('data/museum_completion_canon.csv', 'utf8');
    const result = parseMuseumCompletionCanonCsv(csvText);

    expect(result.byCategoryKey.items).toHaveLength(946);
    expect(result.byCategoryKey.event).toHaveLength(261);
    expect(result.entries).toHaveLength(1416);
  });
});
