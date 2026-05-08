import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  it('accepts explicit TBD placeholder rows for partially known future tower levels', () => {
    const result = parseTowerRequirementsCsv(`tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
311,311-320,3,TBD,,GM,,TBD placeholder - requirement not yet confirmed,Community discovery 311-320,311-3`);

    expect(result.entries[0]).toMatchObject({
      towerLevel: 311,
      towerLevelRange: '311-320',
      slotIndex: 3,
      itemName: 'TBD',
      canonicalKey: 'tbd',
      masteryLevelNeeded: 'GM',
      notes: 'TBD placeholder - requirement not yet confirmed',
      sourceSheet: 'Community discovery 311-320',
      sourceRow: '311-3',
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

  it('rejects duplicate tower level and slot combinations', () => {
    expect(() =>
      parseTowerRequirementsCsv(`tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
201,201-210,1,Board,,MM,,,Tower MMs,15
201,201-210,1,Twine,,MM,,,Tower MMs,16`),
    ).toThrow('Duplicate tower requirement slot detected for tower level 201 slot 1 in range 201-210.');
  });

  it('includes the known 311-330 ranges in the canonical tower data file', () => {
    const csvText = readFileSync(resolve(process.cwd(), 'data/tower_requirements.csv'), 'utf8');
    const result = parseTowerRequirementsCsv(csvText);
    const rows311to320 = result.entries.filter((entry) => entry.towerLevel >= 311 && entry.towerLevel <= 320);
    const rows321to330 = result.entries.filter((entry) => entry.towerLevel >= 321 && entry.towerLevel <= 330);
    const byLevel = rows311to320.reduce<Record<number, string[]>>((accumulator, entry) => {
      accumulator[entry.towerLevel] = [...(accumulator[entry.towerLevel] ?? []), entry.itemName];
      return accumulator;
    }, {});
    const byLevel321to330 = rows321to330.reduce<Record<number, string[]>>((accumulator, entry) => {
      accumulator[entry.towerLevel] = [...(accumulator[entry.towerLevel] ?? []), entry.itemName];
      return accumulator;
    }, {});

    expect(rows311to320).toHaveLength(22);
    expect(rows321to330).toHaveLength(22);
    expect(Object.keys(byLevel).map(Number)).toEqual([311, 312, 313, 314, 315, 316, 317, 318, 319, 320]);
    expect(Object.keys(byLevel321to330).map(Number)).toEqual([321, 322, 323, 324, 325, 326, 327, 328, 329, 330]);
    expect(byLevel[311]).toEqual(['Bamboo Chair', 'Barbed Wire']);
    expect(byLevel[312]).toEqual(['Yellow Scarf', 'Fire Ant Farm']);
    expect(byLevel[313]).toEqual(['Step Ladder', 'Orange Shirt']);
    expect(byLevel[318]).toEqual(['Yellow Butterfly', 'Acorn Butter']);
    expect(byLevel[314]).toEqual(['Energy Coil', 'Black Dye']);
    expect(byLevel[315]).toEqual(['Reinforced Helmet', 'Gold Lemon Quartz Ring', 'Steel Vise']);
    expect(byLevel[316]).toEqual(['Yellow Bag', 'Leather Helmet']);
    expect(byLevel[317]).toEqual(['Gold Aquamarine Ring', 'Handsaw']);
    expect(byLevel[319]).toEqual(['Strong Paste', 'Spoon']);
    expect(byLevel[320]).toEqual(['Corn Husk Doll', 'Blubberfish', 'Reaver Claw']);
    expect(byLevel321to330[321]).toEqual(['Green Diary', 'Sturdy Bow']);
    expect(byLevel321to330[322]).toEqual(['Power Monitor', 'Bamboo Fence']);
    expect(byLevel321to330[323]).toEqual(['Spiked Shell', 'Black Scarf']);
    expect(byLevel321to330[324]).toEqual(['Spool of Copper', 'Red Twine']);
    expect(byLevel321to330[325]).toEqual(['Cloth', 'Gold Ring', 'Tin Scraps']);
    expect(byLevel321to330[326]).toEqual(['Red Shirt', 'Black Shirt']);
    expect(byLevel321to330[327]).toEqual(['Propeller Hat', 'Blue Twine']);
    expect(byLevel321to330[328]).toEqual(['Wine', 'Sunflower']);
    expect(byLevel321to330[329]).toEqual(['Pair of Boots', 'Black Twine']);
    expect(byLevel321to330[330]).toEqual(['Red Diary', 'White Twine', 'Magus Hat']);
  });
});
