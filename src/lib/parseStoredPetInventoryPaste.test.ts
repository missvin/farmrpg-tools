import { describe, expect, it } from 'vitest';

import { parseStoredPetInventoryPaste } from './parseStoredPetInventoryPaste';

describe('parseStoredPetInventoryPaste', () => {
  it('parses a practical first paste format using item-name and count pairs', () => {
    expect(
      parseStoredPetInventoryPaste(`Honey, 12
3, Large Chest
Apple\t25`),
    ).toEqual({
      entries: [
        {
          canonicalItemKey: 'apple',
          itemName: 'Apple',
          storedCount: 25,
        },
        {
          canonicalItemKey: 'honey',
          itemName: 'Honey',
          storedCount: 12,
        },
        {
          canonicalItemKey: 'large chest',
          itemName: 'Large Chest',
          storedCount: 3,
        },
      ],
      warnings: [],
    });
  });

  it('keeps malformed or unknown lines warning-safe and aggregates duplicates', () => {
    const result = parseStoredPetInventoryPaste(
      `Honey, 10
Honey, 5
Badly formatted line
Mystery Relic, 7`,
      {
        knownCanonicalKeys: new Set(['honey']),
      },
    );

    expect(result.entries).toEqual([
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        storedCount: 15,
      },
      {
        canonicalItemKey: 'mystery relic',
        itemName: 'Mystery Relic',
        storedCount: 7,
      },
    ]);
    expect(result.warnings).toEqual([
      'Line 2 duplicated "Honey". Counts were combined.',
      'Line 3 could not be parsed. Use "Item Name, Count" or "Count, Item Name".',
      'Line 4 item "Mystery Relic" was not found in local reference data and was kept as entered.',
    ]);
  });
});
