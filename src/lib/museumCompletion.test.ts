import { describe, expect, it } from 'vitest';

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
});
