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

  it('parses Count = N category headers and repeated museum-completion item lines', () => {
    const result = parseMuseumExport(`Museum Completion

Crops Count = 35

Beet Beet Broccoli Broccoli Cabbage Cabbage Carrot Carrot
Corn Corn Cotton Cotton Cucumber Cucumber Eggplant Eggplant
Frozen Cabbage Frozen Cabbage Frozen Corn Frozen Corn Frozen Hops Frozen Hops Frozen Peas Frozen Peas
Frozen Pine Frozen Pine Frozen Radish Frozen Radish Frozen Tomato Frozen Tomato Gold Carrot Gold Carrot
Gold Cucumber Gold Cucumber Gold Eggplant Gold Eggplant Gold Peas Gold Peas Gold Peppers Gold Peppers
Hops Hops Leek Leek Onion Onion Peas Peas
Peppers Peppers Pine Tree Pine Tree Potato Potato Pumpkin Pumpkin
Radish Radish Rice Rice Sugar Cane Sugar Cane Sunflower Sunflower
Tomato Tomato Watermelon Watermelon Wheat Wheat`);

    expect(result.parseSummary.categoriesParsed).toBe(1);
    expect(result.parseSummary.uniqueItemsParsed).toBe(35);
    expect(result.parseSummary.duplicateArtifactsRemoved).toBe(0);
    expect(result.categories[0]).toMatchObject({
      categoryName: 'Crops',
      expectedOwnedCount: null,
      expectedTotalCount: 35,
      parsedItemCount: 35,
      countValidation: 'matches_total',
    });
    expect(result.categories[0].items.map((item) => item.itemName)).toContain('Frozen Cabbage');
    expect(result.categories[0].items.map((item) => item.itemName)).toContain('Pine Tree');
    expect(result.categories[0].items.map((item) => item.itemName)).toContain('Sugar Cane');
    expect(result.parseSummary.warnings).toEqual([]);
  });

  it('stops parsing when the library page ends at Library Home', () => {
    const result = parseMuseumExport(`Event Items Count = 2
Yellow Watermelon Yellow Watermelon
Yule Goat Yule Goat
Library Home
2026-03-16 19:37:49 by Lunarific
Consume a meal
Mushroom Stew
Fish and Chips`);

    expect(result.parseSummary.categoriesParsed).toBe(1);
    expect(result.parseSummary.uniqueItemsParsed).toBe(2);
    expect(result.categories[0].items.map((item) => item.itemName)).toEqual([
      'Yellow Watermelon',
      'Yule Goat',
    ]);
  });
});
