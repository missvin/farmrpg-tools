import { describe, expect, it } from 'vitest';

import { parseMasteryDifficultyCsv } from './loadMasteryDifficulty';

describe('parseMasteryDifficultyCsv', () => {
  it('parses item name, difficulty, and optional fields from mastery difficulty data', () => {
    const result = parseMasteryDifficultyCsv(`item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row
Gold Cucumber,7,Farming,"Quoted, note",,,,,,,
Board,1,Crafting,Passive favorite,,,,,,,`);

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
    const result = parseMasteryDifficultyCsv(`item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row
Mystery Item,,Exploring,,,,,,,,`);

    expect(result.byCanonicalKey['mystery item']).toMatchObject({
      itemName: 'Mystery Item',
      difficulty: null,
      method: 'Exploring',
    });
  });

  it('rejects rows that do not have an item name', () => {
    expect(() =>
      parseMasteryDifficultyCsv(`item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row
,5,,,,,,,,,
Valid Item,2,,,,,,,,,`),
    ).toThrow('Missing required item_name in mastery difficulty data.');
  });

  it('rejects invalid mastery difficulty headers', () => {
    expect(() =>
      parseMasteryDifficultyCsv(`item_name,difficulty,method
Board,1,Crafting`),
    ).toThrow('Invalid mastery difficulty data schema');
  });

  it('rejects non-numeric non-blank difficulty values', () => {
    expect(() =>
      parseMasteryDifficultyCsv(`item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row
Board,hard,Crafting,,,,,,,,`),
    ).toThrow('Invalid difficulty "hard" in mastery difficulty data.');
  });
});
