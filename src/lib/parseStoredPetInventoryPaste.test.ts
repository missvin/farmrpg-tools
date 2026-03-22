import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseStoredPetInventoryPaste } from './parseStoredPetInventoryPaste';

describe('parseStoredPetInventoryPaste', () => {
  it('parses the real pet inventory export sample, aggregates repeated items, and ignores the meals panel', () => {
    const sampleText = readFileSync('data/pet_inventory_import_sample', 'utf8');
    const result = parseStoredPetInventoryPaste(sampleText);

    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBeGreaterThan(100);
    expect(result.entries.find((entry) => entry.canonicalItemKey === '3-leaf clover')).toEqual({
      canonicalItemKey: '3-leaf clover',
      itemName: '3-leaf Clover',
      storedCount: 5885,
    });
    expect(result.entries.find((entry) => entry.canonicalItemKey === 'honey')).toEqual({
      canonicalItemKey: 'honey',
      itemName: 'Honey',
      storedCount: 5307,
    });
    expect(result.entries.find((entry) => entry.canonicalItemKey === 'orange juice')).toEqual({
      canonicalItemKey: 'orange juice',
      itemName: 'Orange Juice',
      storedCount: 5191,
    });
    expect(result.entries.find((entry) => entry.canonicalItemKey === 'runestone 05')).toEqual({
      canonicalItemKey: 'runestone 05',
      itemName: 'Runestone 05',
      storedCount: 19885,
    });
    expect(result.entries.find((entry) => entry.canonicalItemKey === 'steel')).toEqual({
      canonicalItemKey: 'steel',
      itemName: 'Steel',
      storedCount: 18135,
    });
    expect(result.entries.find((entry) => entry.canonicalItemKey === 'cabbage stew')).toBeUndefined();
  });

  it('keeps the simpler line-pair fallback and warning-safe behavior for malformed or unknown lines', () => {
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
      'Line 3 could not be parsed. Use the Pets collected-items export format or "Item Name, Count".',
      'Line 4 item "Mystery Relic" was not found in local reference data and was kept as entered.',
    ]);
  });
});
