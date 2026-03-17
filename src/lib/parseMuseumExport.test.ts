import { describe, expect, it } from 'vitest';

import { parseMuseumExport, toMuseumSeedCsv } from './parseMuseumExport';

describe('parseMuseumExport', () => {
  it('parses museum categories and removes duplicated item-name artifacts', () => {
    const result = parseMuseumExport(`Farm RPG
Back
Museum

Fish (2 / 3)
Blue Catfish
Blue Catfish
Yellow Perch

Bugs 1 / 1
Firefly
Firefly`);

    expect(result.parseSummary.categoriesParsed).toBe(2);
    expect(result.parseSummary.uniqueItemsParsed).toBe(3);
    expect(result.parseSummary.duplicateArtifactsRemoved).toBe(2);
    expect(result.categories[0]).toMatchObject({
      categoryName: 'Fish',
      parsedItemCount: 2,
      countValidation: 'matches_owned',
    });
    expect(result.categories[0].items.map((item) => item.itemName)).toEqual(['Blue Catfish', 'Yellow Perch']);
    expect(result.categories[1]).toMatchObject({
      categoryName: 'Bugs',
      parsedItemCount: 1,
      countValidation: 'matches_total',
    });
  });

  it('preserves multi-word names, punctuation, and numeric suffixes', () => {
    const result = parseMuseumExport(`Artifacts (3 / 3)
Chef's Hat 2
Red Shield Mk. II
Ancient Coin, Replica`);

    expect(result.uniqueItems.map((item) => item.itemName)).toEqual([
      'Ancient Coin, Replica',
      "Chef's Hat 2",
      'Red Shield Mk. II',
    ]);
  });

  it('warns when parsed counts do not match owned or total header counts', () => {
    const result = parseMuseumExport(`Fish (2 / 5)
Blue Catfish
Yellow Perch
Golden Trout`);

    expect(result.categories[0]).toMatchObject({
      categoryName: 'Fish',
      parsedItemCount: 3,
      countValidation: 'mismatch',
    });
    expect(result.parseSummary.warnings).toContain(
      'Fish: parsed 3 items, but the header shows 2 / 5.',
    );
  });

  it('builds CSV seed output from the deduplicated global item list', () => {
    const result = parseMuseumExport(`Fish (2 / 2)
Blue Catfish
Yellow Perch`);

    expect(toMuseumSeedCsv(result)).toBe(
      ['museum_category,item_name,canonical_key', 'Fish,Blue Catfish,blue catfish', 'Fish,Yellow Perch,yellow perch'].join(
        '\n',
      ),
    );
  });
});
