import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseMuseumReviewedMissingItemsCsv } from './loadMuseumReviewedMissingItems';
import {
  deriveMuseumCompletionFromPersonalExport,
  deriveMuseumCompletionProgress,
  extractMuseumFullListMetadata,
  parsePersonalMuseumExport,
} from './museumCompletion';

const FULL_LIST = `Museum Completion
This is the current list of museum completion items, there are currently 7 items in the game plus 3 Event items. (Last Updated March 16th, 2026)

Crops Count = 3
Beet Beet Corn Corn Cotton Cotton

Items Count = 4
Ant Apple Ant Apple Board Board Corn Oil Corn Oil Hammer Hammer

Event Count = 3
Blue Milk Blue Milk Red Balloon Red Balloon Yellow Watermelon Yellow Watermelon

Library Home
2026-03-16 19:37:49 by Lunarific
Consume a meal
Mushroom Stew`;

describe('museumCompletion', () => {
  it('parses personal museum exports with seen items and missing markers', () => {
    const result = parsePersonalMuseumExport(`Back
Town
Collection Progress
Items
5 of 7 (71.42%)
Crops (3 / 3)
Beet
Corn
Cotton
Items (2 / 4)
Ant Apple
-
Corn Oil
-
Consume a meal
Mushroom Stew`);

    expect(result.parseSummary).toMatchObject({
      categoriesParsed: 2,
      totalSlotsParsed: 7,
      seenItemsParsed: 5,
      missingMarkersParsed: 2,
    });
    expect(result.categories[1]).toMatchObject({
      categoryName: 'Items',
      expectedOwnedCount: 2,
      expectedTotalCount: 4,
      seenCount: 2,
      missingMarkerCount: 2,
      parsedSlotCount: 4,
      countValidation: 'matches_header',
    });
  });

  it('extracts source update labels from the full museum list', () => {
    expect(extractMuseumFullListMetadata(FULL_LIST)).toEqual({
      lastUpdatedLabel: 'March 16th, 2026',
      footerUpdatedLabel: '2026-03-16 19:37:49 by Lunarific',
    });
  });

  it('aligns missing personal slots to the full list by category and order', () => {
    const result = deriveMuseumCompletionProgress(
      FULL_LIST,
      `Crops (3 / 3)
Beet
Corn
Cotton
Items (2 / 4)
Ant Apple
-
Corn Oil
-
Event (2 / 3)
Blue Milk
-
Yellow Watermelon`,
    );

    expect(result.summary).toMatchObject({
      totalSlots: 10,
      seenItems: 7,
      missingMarkers: 3,
      knownMissingItems: 3,
      possibleMissingItems: 0,
      unresolvedMissingSlots: 0,
    });
    expect(result.knownMissingItems.map((item) => item.itemName)).toEqual([
      'Board',
      'Hammer',
      'Red Balloon',
    ]);
  });

  it('does not mark an inferred missing item when that item is seen elsewhere', () => {
    const result = deriveMuseumCompletionProgress(
      FULL_LIST,
      `Crops (3 / 3)
Beet
Corn
Cotton
Items (3 / 4)
-
Board
Corn Oil
Hammer
Event (3 / 3)
Blue Milk
Ant Apple
Yellow Watermelon`,
    );

    expect(result.knownMissingItems).toEqual([]);
    expect(result.unresolvedSlots).toEqual([
      {
        categoryName: 'Items',
        categoryKey: 'items',
        slotIndex: 0,
        reason: 'candidate_seen_elsewhere',
        candidateItemName: 'Ant Apple',
        candidateCanonicalKey: 'ant apple',
      },
    ]);
  });

  it('surfaces stale full-list warnings and keeps named items as possible candidates', () => {
    const result = deriveMuseumCompletionProgress(
      FULL_LIST,
      `Items (2 / 5)
Ant Apple
-
Corn Oil
-
Newer Item`,
    );

    expect(result.warnings).toContain(
      'Items: your museum export expects 5 slots, but the full museum list has 4 entries. Full list source: 2026-03-16 19:37:49 by Lunarific.',
    );
    expect(result.possibleMissingItems.map((item) => item.itemName)).toEqual(['Board', 'Hammer']);
    expect(result.possibleMissingItems.every((item) => item.confidence === 'possible_stale_full_list')).toBe(true);
  });

  it('derives progress from a personal export plus reviewed local missing entries', () => {
    const result = deriveMuseumCompletionFromPersonalExport(
      `Items (2 / 4)
Ant Apple
-
Corn Oil
-`,
      [
        {
          id: 'manual-board',
          categoryKey: 'items',
          categoryName: 'Items',
          itemName: 'Board',
          canonicalKey: 'board',
          slotCount: 1,
          note: 'manual review',
        },
      ],
    );

    expect(result.summary).toMatchObject({
      totalSlots: 4,
      seenItems: 2,
      missingMarkers: 2,
      namedMissingItems: 1,
      namedMissingSlots: 1,
      unresolvedMissingSlots: 1,
    });
    expect(result.namedMissingItems.map((item) => item.itemName)).toEqual(['Board']);
    expect(result.categories[0]).toMatchObject({
      categoryName: 'Items',
      missingMarkerCount: 2,
      namedMissingCount: 1,
      unresolvedMissingCount: 1,
    });
  });

  it('names missing slots from checked-in canon only when category totals match', () => {
    const result = deriveMuseumCompletionFromPersonalExport(
      `Items (2 / 4)
Ant Apple
-
Corn Oil
-`,
      [],
      {
        entries: [],
        byCategoryKey: {
          items: [
            {
              museumCategory: 'Items',
              categoryKey: 'items',
              slotIndex: 1,
              itemName: 'Ant Apple',
              canonicalKey: 'ant apple',
              obtainable: true,
              reviewStatus: 'source_parsed',
              source: 'test',
              notes: null,
            },
            {
              museumCategory: 'Items',
              categoryKey: 'items',
              slotIndex: 2,
              itemName: 'Board',
              canonicalKey: 'board',
              obtainable: true,
              reviewStatus: 'source_parsed',
              source: 'test',
              notes: null,
            },
            {
              museumCategory: 'Items',
              categoryKey: 'items',
              slotIndex: 3,
              itemName: 'Corn Oil',
              canonicalKey: 'corn oil',
              obtainable: true,
              reviewStatus: 'source_parsed',
              source: 'test',
              notes: null,
            },
            {
              museumCategory: 'Items',
              categoryKey: 'items',
              slotIndex: 4,
              itemName: 'Hammer',
              canonicalKey: 'hammer',
              obtainable: true,
              reviewStatus: 'reviewed',
              source: 'test',
              notes: 'manual confirmation',
            },
          ],
        },
      },
    );

    expect(result.summary).toMatchObject({
      namedMissingItems: 2,
      namedMissingSlots: 2,
      unresolvedMissingSlots: 0,
    });
    expect(result.namedMissingItems.map((item) => item.itemName)).toEqual(['Board', 'Hammer']);
    expect(result.namedMissingItems[1].note).toBe('manual confirmation');
  });

  it('leaves canon-named slots unresolved when category totals look stale', () => {
    const result = deriveMuseumCompletionFromPersonalExport(
      `Items (1 / 3)
Ant Apple
-
-`,
      [],
      {
        entries: [],
        byCategoryKey: {
          items: [
            {
              museumCategory: 'Items',
              categoryKey: 'items',
              slotIndex: 1,
              itemName: 'Ant Apple',
              canonicalKey: 'ant apple',
              obtainable: true,
              reviewStatus: 'source_parsed',
              source: 'test',
              notes: null,
            },
            {
              museumCategory: 'Items',
              categoryKey: 'items',
              slotIndex: 2,
              itemName: 'Board',
              canonicalKey: 'board',
              obtainable: true,
              reviewStatus: 'source_parsed',
              source: 'test',
              notes: null,
            },
          ],
        },
      },
    );

    expect(result.namedMissingItems).toEqual([]);
    expect(result.summary.unresolvedMissingSlots).toBe(2);
    expect(result.warnings).toContain(
      'Items: the reviewed museum list has 2 slots, but your export expects 3; unnamed slots remain until the list is updated.',
    );
  });

  it('does not use a canon candidate when that item appears elsewhere in the current export', () => {
    const result = deriveMuseumCompletionFromPersonalExport(
      `Items (1 / 2)
-
Board
Event (1 / 1)
Ant Apple`,
      [],
      {
        entries: [],
        byCategoryKey: {
          items: [
            {
              museumCategory: 'Items',
              categoryKey: 'items',
              slotIndex: 1,
              itemName: 'Ant Apple',
              canonicalKey: 'ant apple',
              obtainable: true,
              reviewStatus: 'source_parsed',
              source: 'test',
              notes: null,
            },
            {
              museumCategory: 'Items',
              categoryKey: 'items',
              slotIndex: 2,
              itemName: 'Board',
              canonicalKey: 'board',
              obtainable: true,
              reviewStatus: 'source_parsed',
              source: 'test',
              notes: null,
            },
          ],
          event: [
            {
              museumCategory: 'Event',
              categoryKey: 'event',
              slotIndex: 1,
              itemName: 'Ant Apple',
              canonicalKey: 'ant apple',
              obtainable: true,
              reviewStatus: 'source_parsed',
              source: 'test',
              notes: null,
            },
          ],
        },
      },
    );

    expect(result.namedMissingItems).toEqual([]);
    expect(result.summary.unresolvedMissingSlots).toBe(1);
    expect(result.warnings).toContain(
      'Ant Apple: the reviewed museum list suggests this missing slot, but the item appears elsewhere in your current export.',
    );
  });

  it('keeps reviewed entries non-fatal when they no longer line up with the current export', () => {
    const result = deriveMuseumCompletionFromPersonalExport(
      `Items (2 / 2)
Board
Corn Oil`,
      [
        {
          id: 'manual-board',
          categoryKey: 'items',
          categoryName: 'Items',
          itemName: 'Board',
          canonicalKey: 'board',
          slotCount: 1,
          note: '',
        },
        {
          id: 'manual-event',
          categoryKey: 'event',
          categoryName: 'Event',
          itemName: 'Red Balloon',
          canonicalKey: 'red balloon',
          slotCount: 1,
          note: '',
        },
      ],
    );

    expect(result.namedMissingItems).toEqual([]);
    expect(result.warnings).toContain(
      'Board: saved museum review entry looks resolved because this item appears in the current museum export.',
    );
    expect(result.warnings).toContain(
      'Red Balloon: saved museum review entry is for Event, but that category was not found in the current museum export.',
    );
  });

  it('uses the checked-in reviewed missing item file for Rebecca reviewed museum gaps', () => {
    const personalExport = readFileSync('planning/museum-me-raw-sample-2026-05-12.txt', 'utf8');
    const reviewedMissingItems = parseMuseumReviewedMissingItemsCsv(
      readFileSync('data/museum_reviewed_missing_items.csv', 'utf8'),
    );
    const result = deriveMuseumCompletionFromPersonalExport(personalExport, reviewedMissingItems.entries);
    const itemsCategory = result.categories.find((category) => category.categoryKey === 'items');

    expect(result.summary.namedMissingItems).toBe(45);
    expect(result.summary.namedMissingSlots).toBe(56);
    expect(itemsCategory?.unresolvedMissingCount).toBe(0);
    expect(result.namedMissingItems.map((item) => item.itemName)).toContain('Apple Basket');
    expect(result.namedMissingItems.map((item) => item.itemName)).toContain('Baba Bobblehead');
    expect(result.namedMissingItems.map((item) => item.itemName)).not.toContain('Baba Bobble');
    expect(result.namedMissingItems.map((item) => item.itemName)).toContain('Vincent Bobblehead');
  });
});
