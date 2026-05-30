import { describe, expect, it } from 'vitest';

import { parseCurrentInventoryPaste, type CurrentInventoryResolvedItem } from './parseCurrentInventoryPaste';

function resolveKnownItem(itemName: string): CurrentInventoryResolvedItem {
  const knownItems: Record<string, string> = {
    'board': 'Board',
    'bone broth': 'Bone Broth',
    'frost snapper shell': 'Frost Snapper Shell',
    'large net': 'Large Net',
    'mushroom stew': 'Mushroom Stew',
    'strange ring': 'Strange Ring',
  };
  const canonicalItemKey = itemName.trim().toLowerCase();
  const displayName = knownItems[canonicalItemKey];

  return {
    canonicalItemKey,
    itemName: displayName ?? itemName.trim(),
    recognized: Boolean(displayName),
    warnings: displayName ? [] : ['No local item reference coverage found; keep this visible as a review candidate.'],
  };
}

describe('parseCurrentInventoryPaste', () => {
  it('parses alternating FarmRPG count and item lines while ignoring surrounding page chrome', () => {
    expect(
      parseCurrentInventoryPaste(
        [
          'My Inventory',
          '1,000',
          'Strange Ring',
          '5,614',
          'Frost Snapper Shell',
          'Close Panel',
        ].join('\n'),
        {
          resolveItem: resolveKnownItem,
        },
      ),
    ).toEqual({
      entries: [
        {
          canonicalItemKey: 'frost snapper shell',
          itemName: 'Frost Snapper Shell',
          inventoryCount: 5614,
        },
        {
          canonicalItemKey: 'strange ring',
          itemName: 'Strange Ring',
          inventoryCount: 1000,
        },
      ],
      warnings: [],
    });
  });

  it('parses simple one-line item count formats and combines duplicates', () => {
    const result = parseCurrentInventoryPaste(
      [
        'Large Net, 5',
        '3 Large Net',
        'Frost Snapper Shell x12',
        'Nope nope',
      ].join('\n'),
      {
        resolveItem: resolveKnownItem,
      },
    );

    expect(result.entries).toEqual([
      {
        canonicalItemKey: 'frost snapper shell',
        itemName: 'Frost Snapper Shell',
        inventoryCount: 12,
      },
      {
        canonicalItemKey: 'large net',
        itemName: 'Large Net',
        inventoryCount: 8,
      },
    ]);
    expect(result.warnings).toEqual([
      'Line 2 duplicated "Large Net". Counts were combined.',
      'Line 4 could not be parsed. Use "Item Name, Count" or paste alternating count/item lines.',
    ]);
  });

  it('keeps unrecognized items with a visible warning', () => {
    expect(
      parseCurrentInventoryPaste('Mystery Relic, 2', {
        resolveItem: resolveKnownItem,
      }),
    ).toEqual({
      entries: [
        {
          canonicalItemKey: 'mystery relic',
          itemName: 'Mystery Relic',
          inventoryCount: 2,
        },
      ],
      warnings: [
        'Line 1 item "Mystery Relic" was not found in local reference data and was kept as entered.',
        'Line 1: No local item reference coverage found; keep this visible as a review candidate.',
      ],
    });
  });

  it('parses the FarmRPG inventory page section without importing page chrome or the meal panel', () => {
    const result = parseCurrentInventoryPaste(
      [
        'Farm RPG',
        'Back',
        'My Inventory',
        'Favorite Library Pages',
        'Farming',
        'Level 99',
        'Currently, you cannot have more than 25,840 of any single thing.',
        'Sort Options:',
        'Item Name, Quantity (ASC), Quantity (DESC)',
        'Meals chevron_down',
        'Bone Broth',
        'Reduces exploring effectiveness timer by 5 minutes',
        '1,775',
        'Mushroom Stew',
        'Increases exploring item find rate',
        'Mastered',
        '1,075',
        'Items chevron_down',
        'Board',
        'Used for crafting',
        'MAX ON HAND',
        '25,840',
        "Thomas's Red Velvet Cake",
        'A new event reward that is not in local reference data yet.',
        '1',
        'Inventory Stats',
        'Your inventory contains 1,218 unique items and 8,525,763 items in total.',
        'Consume a meal',
        '566',
        'Cabbage Stew',
        '1,075',
        'Mushroom Stew',
        'Close Panel',
      ].join('\n'),
      {
        resolveItem: resolveKnownItem,
      },
    );

    expect(result.entries).toEqual([
      {
        canonicalItemKey: 'board',
        itemName: 'Board',
        inventoryCount: 25840,
      },
      {
        canonicalItemKey: 'bone broth',
        itemName: 'Bone Broth',
        inventoryCount: 1775,
      },
      {
        canonicalItemKey: 'mushroom stew',
        itemName: 'Mushroom Stew',
        inventoryCount: 1075,
      },
      {
        canonicalItemKey: "thomas's red velvet cake",
        itemName: "Thomas's Red Velvet Cake",
        inventoryCount: 1,
      },
    ]);
    expect(result.warnings).toEqual([
      'Line 23 item "Thomas\'s Red Velvet Cake" was not found in local reference data and was kept as entered.',
      'Line 23: No local item reference coverage found; keep this visible as a review candidate.',
    ]);
  });
});
