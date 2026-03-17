import { describe, expect, it } from 'vitest';

import { parseTowerRequirementsCsv } from './loadTowerRequirements';

describe('parseTowerRequirementsCsv', () => {
  it('parses tower requirement headers and normalizes item names into canonical keys', () => {
    const result = parseTowerRequirementsCsv(`tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
201,201-210,1,Farmer\u2019s Hat,,MM,,Auto-craft,Tower MMs,15`);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      towerLevel: 201,
      towerLevelRange: '201-210',
      slotIndex: 1,
      itemName: 'Farmer’s Hat',
      canonicalKey: "farmer's hat",
      masteryLevelNeeded: 'MM',
      notes: 'Auto-craft',
      sourceSheet: 'Tower MMs',
      sourceRow: '15',
    });
    expect(result.byCanonicalKey["farmer's hat"]).toHaveLength(1);
  });

  it('supports M, GM, and MM mastery requirement tiers', () => {
    const result = parseTowerRequirementsCsv(`tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
301,301-310,1,Acorn,,M,,,, 
302,301-310,1,Board,,GM,,,, 
303,301-310,1,Twine,,MM,,,,`);

    expect(result.entries.map((entry) => entry.masteryLevelNeeded)).toEqual(['M', 'GM', 'MM']);
  });

  it('treats blank optional metadata fields as non-fatal', () => {
    const result = parseTowerRequirementsCsv(`tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
221,221-230,2,Green Jellyfish,,MM,,,,`);

    expect(result.entries[0]).toMatchObject({
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    });
  });

  it('rejects invalid mastery_level_needed values', () => {
    expect(() =>
      parseTowerRequirementsCsv(`tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
401,401-410,1,Board,,BAD,,,,`),
    ).toThrow('Invalid mastery_level_needed "BAD" for tower requirement "Board".');
  });

  it('rejects invalid tower requirements headers', () => {
    expect(() =>
      parseTowerRequirementsCsv(`tower_level,slot_index,item_name,mastery_level_needed
201,1,Board,MM`),
    ).toThrow('Invalid tower requirements data schema');
  });
});
