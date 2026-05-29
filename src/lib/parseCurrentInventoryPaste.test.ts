import { describe, expect, it } from 'vitest';

import { parseCurrentInventoryPaste, type CurrentInventoryResolvedItem } from './parseCurrentInventoryPaste';

function resolveKnownItem(itemName: string): CurrentInventoryResolvedItem {
  const knownItems: Record<string, string> = {
    'frost snapper shell': 'Frost Snapper Shell',
    'large net': 'Large Net',
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
});
