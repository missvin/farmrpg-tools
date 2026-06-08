import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseWishingWellReferenceCsv } from './loadWishingWellReference';

describe('parseWishingWellReferenceCsv', () => {
  it('parses Wishing Well rewards and indexes by thrown and reward item', () => {
    const data = parseWishingWellReferenceCsv(
      [
        'thrown_item_name,thrown_canonical_key,reward_item_name,reward_canonical_key,reward_chance,reward_quantity,evidence,notes',
        'Salt,salt,Spiked Shell,spiked shell,0.5,1,user_confirmed,reviewed row',
      ].join('\n'),
    );

    expect(data.entries).toHaveLength(1);
    expect(data.byThrownCanonicalKey.salt[0]).toMatchObject({
      rewardItemName: 'Spiked Shell',
      rewardChance: 0.5,
      rewardQuantity: 1,
    });
    expect(data.byRewardCanonicalKey['spiked shell'][0].thrownItemName).toBe('Salt');
  });

  it('rejects chances above one', () => {
    expect(() => parseWishingWellReferenceCsv(
      [
        'thrown_item_name,thrown_canonical_key,reward_item_name,reward_canonical_key,reward_chance,reward_quantity,evidence,notes',
        'Salt,salt,Spiked Shell,spiked shell,50,1,user_confirmed,reviewed row',
      ].join('\n'),
    )).toThrow(/chance must be between 0 and 1/);
  });

  it('parses the checked-in Wishing Well reference data', () => {
    const data = parseWishingWellReferenceCsv(
      readFileSync(join(process.cwd(), 'data', 'wishing_well_reference.csv'), 'utf8'),
    );
    const saltRewards = data.byThrownCanonicalKey.salt ?? [];

    expect(data.entries).toHaveLength(361);
    expect(saltRewards.map((entry) => entry.rewardItemName).sort()).toEqual(['Broccoli', 'Spiked Shell']);
    expect(saltRewards.every((entry) => entry.rewardQuantity === 1)).toBe(true);
    expect(
      saltRewards.every((entry) => entry.notes.some((note) => note.includes('Reward quantity defaults to 1'))),
    ).toBe(true);
  });
});
