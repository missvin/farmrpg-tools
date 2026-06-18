import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  parseLocksmithStockpilePaste,
  type ParseLocksmithStockpilePasteOptions,
} from './parseLocksmithStockpilePaste';

const options: ParseLocksmithStockpilePasteOptions = {
  resolveItem: (itemName) => {
    const knownItems: Record<string, string> = {
      'birthday surprise box 05': 'Birthday Surprise Box 05',
      'grab bag 01': 'Grab Bag 01',
      'grab bag 02': 'Grab Bag 02',
      'large chest': 'Large Chest',
      'large chest 01': 'Large Chest 01',
      'large chest 02': 'Large Chest 02',
      'large chest 03': 'Large Chest 03',
      'medium chest 01': 'Medium Chest 01',
      'pot of gold (large)': 'Pot of Gold (Large)',
      'small chest': 'Small Chest',
      'small chest 01': 'Small Chest 01',
      'traveler\'s bag 01': 'Traveler\'s Bag 01',
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

const locksmithWithMaxButtonsSample = readFileSync(
  'src/lib/fixtures/locksmith.with-max-buttons.sample.txt',
  'utf8',
);

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

  it('parses full Locksmith page rows without importing page chrome', () => {
    expect(
      parseLocksmithStockpilePaste(
        [
          'Town',
          'Locksmith',
          '228,742',
          'Community Center',
          'Favorite Items',
          'heart_fill Grab Bag 01 (5,196)',
          'Random selection of early resources',
          'heart_fill Large Chest 01 (1,115)',
          'Requires:',
          '25,840 / 1 Treasure Key',
          'Items you can open',
          'heart_fill Birthday Surprise Box 05 (1)',
          'heart_fill Birthday Surprise Box 05 (1)',
          'Open to receive a random Starter Pack from the past',
          'heart_fill Pot of Gold (Large) (3)',
          'Consume a meal',
          '565',
          'Cabbage Stew',
        ].join('\n'),
        options,
      ),
    ).toEqual({
      entries: [
        {
          canonicalItemKey: 'birthday surprise box 05',
          itemName: 'Birthday Surprise Box 05',
          ownedCount: 1,
        },
        {
          canonicalItemKey: 'grab bag 01',
          itemName: 'Grab Bag 01',
          ownedCount: 5196,
        },
        {
          canonicalItemKey: 'large chest 01',
          itemName: 'Large Chest 01',
          ownedCount: 1115,
        },
        {
          canonicalItemKey: 'pot of gold (large)',
          itemName: 'Pot of Gold (Large)',
          ownedCount: 3,
        },
      ],
      warnings: [],
    });
  });

  it('parses current Locksmith page exports with +MAX controls without importing controls', () => {
    const result = parseLocksmithStockpilePaste(locksmithWithMaxButtonsSample, options);

    expect(result.entries).toEqual(
      expect.arrayContaining([
        {
          canonicalItemKey: 'traveler\'s bag 01',
          itemName: 'Traveler\'s Bag 01',
          ownedCount: 1,
        },
        {
          canonicalItemKey: 'grab bag 01',
          itemName: 'Grab Bag 01',
          ownedCount: 4942,
        },
        {
          canonicalItemKey: 'grab bag 02',
          itemName: 'Grab Bag 02',
          ownedCount: 23660,
        },
        {
          canonicalItemKey: 'large chest 03',
          itemName: 'Large Chest 03',
          ownedCount: 2169,
        },
      ]),
    );
    expect(result.entries.length).toBeGreaterThan(20);
    expect(result.entries.some((entry) => entry.itemName.includes('+MAX') || entry.canonicalItemKey.includes('max'))).toBe(
      false,
    );
    expect(result.warnings.some((warning) => warning.includes('+MAX'))).toBe(false);
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
