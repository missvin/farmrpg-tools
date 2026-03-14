import { describe, expect, it } from 'vitest';

import { parseMasteryDifficultyCsv } from './loadMasteryDifficulty';

describe('parseMasteryDifficultyCsv', () => {
  it('parses item name, difficulty, and optional fields from mastery difficulty data', () => {
    const result = parseMasteryDifficultyCsv(`item_name,difficulty,method,notes
Gold Cucumber,7,Farming,"Quoted, note"
Board,1,Crafting,Passive favorite`);

    expect(result.entries).toHaveLength(2);
    expect(result.byCanonicalKey['gold cucumber']).toMatchObject({
      itemName: 'Gold Cucumber',
      canonicalKey: 'gold cucumber',
      difficulty: 7,
      method: 'Farming',
      notes: 'Quoted, note',
    });
  });

  it('treats blank difficulty values as unrated instead of failing', () => {
    const result = parseMasteryDifficultyCsv(`item_name,difficulty,method
Mystery Item,,Exploring`);

    expect(result.byCanonicalKey['mystery item']).toMatchObject({
      itemName: 'Mystery Item',
      difficulty: null,
      method: 'Exploring',
    });
  });

  it('skips rows that do not have an item name', () => {
    const result = parseMasteryDifficultyCsv(`item_name,difficulty
,5
Valid Item,2`);

    expect(result.entries).toHaveLength(1);
    expect(result.byCanonicalKey).toHaveProperty('valid item');
  });
});
