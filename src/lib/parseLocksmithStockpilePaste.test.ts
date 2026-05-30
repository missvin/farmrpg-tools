import { describe, expect, it } from 'vitest';

import {
  parseLocksmithStockpilePaste,
  type ParseLocksmithStockpilePasteOptions,
} from './parseLocksmithStockpilePaste';

const options: ParseLocksmithStockpilePasteOptions = {
  resolveItem: (itemName) => {
    const knownItems: Record<string, string> = {
      'large chest': 'Large Chest',
      'small chest': 'Small Chest',
    };
    const canonicalItemKey = itemName.trim().toLowerCase();
    const displayName = knownItems[canonicalItemKey];

    return {
      canonicalItemKey,
      itemName: displayName ?? itemName.trim(),
      recognized: Boolean(displayName),
      warnings: displayName ? [] : ['No local item reference coverage found; keep this visible as a review candidate.'],
    };
  },
};

describe('parseLocksmithStockpilePaste', () => {
  it('parses Locksmith-style item count rows as owned stockpiles', () => {
    expect(
      parseLocksmithStockpilePaste(
        ['Large Chest x12', 'Small Chest, 4', 'Nope nope'].join('\n'),
        options,
      ),
    ).toEqual({
      entries: [
        {
          canonicalItemKey: 'large chest',
          itemName: 'Large Chest',
          ownedCount: 12,
        },
        {
          canonicalItemKey: 'small chest',
          itemName: 'Small Chest',
          ownedCount: 4,
        },
      ],
      warnings: ['Line 3 could not be parsed. Use "Item Name, Count" or paste alternating count/item lines.'],
    });
  });

  it('keeps unrecognized openable names with warnings', () => {
    expect(parseLocksmithStockpilePaste('Mystery Box, 2', options)).toEqual({
      entries: [
        {
          canonicalItemKey: 'mystery box',
          itemName: 'Mystery Box',
          ownedCount: 2,
        },
      ],
      warnings: [
        'Line 1 item "Mystery Box" was not found in local reference data and was kept as entered.',
        'Line 1: No local item reference coverage found; keep this visible as a review candidate.',
      ],
    });
  });
});
