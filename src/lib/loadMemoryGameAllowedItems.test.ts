import { describe, expect, it } from 'vitest';

import { parseMemoryGameAllowedItemsCsv } from './loadMemoryGameAllowedItems';

describe('memory game allowed items loader', () => {
  it('parses observed allowed items without applying tier behavior', () => {
    const data = parseMemoryGameAllowedItemsCsv(
      `item_name,canonical_key,observed_tiers,observed_sources,notes
Mug of Beer,mug of beer,4,Queen Shay tier 4; Hoff86 tier 4,Tier metadata is informational only.
Borgen Buck,borgen buck,3,Purple Monkey tier 3,Observed as a memory-game reward.`,
    );

    expect(data.entries).toHaveLength(2);
    expect(data.byCanonicalKey['mug of beer']).toMatchObject({
      itemName: 'Mug of Beer',
      canonicalKey: 'mug of beer',
      observedTiers: ['4'],
      observedSources: ['Queen Shay tier 4', 'Hoff86 tier 4'],
    });
    expect(data.byCanonicalKey['borgen buck'].observedTiers).toEqual(['3']);
  });

  it('rejects canonical key mismatches', () => {
    expect(() =>
      parseMemoryGameAllowedItemsCsv(
        `item_name,canonical_key,observed_tiers,observed_sources,notes
Mug of Beer,beer,4,Queen Shay tier 4,`,
      ),
    ).toThrow('Canonical key mismatch');
  });

  it('rejects duplicate rows', () => {
    expect(() =>
      parseMemoryGameAllowedItemsCsv(
        `item_name,canonical_key,observed_tiers,observed_sources,notes
Board,board,4,Rebecca tier 4,
Board,board,4,catsincapes observed screenshot,`,
      ),
    ).toThrow('Duplicate memory game allowed item row');
  });
});
