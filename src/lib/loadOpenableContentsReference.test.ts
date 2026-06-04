import { describe, expect, it } from 'vitest';

import { parseOpenableContentsReferenceCsv } from './loadOpenableContentsReference';

describe('parseOpenableContentsReferenceCsv', () => {
  it('parses reviewed openable contents and indexes them both ways', () => {
    const data = parseOpenableContentsReferenceCsv(
      [
        'openable_item_name,openable_canonical_key,content_item_name,content_canonical_key,quantity_per_open,quantity_kind,evidence,notes',
        'Large Chest 03,large chest 03,Salt,salt,10,fixed,user_confirmed,reviewed row',
      ].join('\n'),
    );

    expect(data.entries).toHaveLength(1);
    expect(data.byOpenableCanonicalKey['large chest 03'][0]).toMatchObject({
      openableItemName: 'Large Chest 03',
      contentItemName: 'Salt',
      quantityPerOpen: 10,
      quantityKind: 'fixed',
    });
    expect(data.byContentCanonicalKey.salt[0].openableCanonicalKey).toBe('large chest 03');
  });

  it('rejects canonical key mismatches', () => {
    expect(() => parseOpenableContentsReferenceCsv(
      [
        'openable_item_name,openable_canonical_key,content_item_name,content_canonical_key,quantity_per_open,quantity_kind,evidence,notes',
        'Large Chest 03,large-chest-03,Salt,salt,10,fixed,user_confirmed,reviewed row',
      ].join('\n'),
    )).toThrow(/Canonical key mismatch/);
  });
});
