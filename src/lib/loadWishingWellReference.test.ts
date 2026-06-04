import { describe, expect, it } from 'vitest';

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
});
