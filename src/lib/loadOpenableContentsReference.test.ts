import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  it('parses reviewed expected-value rows when their assumptions are explicit', () => {
    const data = parseOpenableContentsReferenceCsv(
      [
        'openable_item_name,openable_canonical_key,content_item_name,content_canonical_key,quantity_per_open,quantity_kind,evidence,notes',
        'Borgen Bag 01,borgen bag 01,Borgen Buck,borgen buck,0.46,expected,reviewed_expected_value,quantity_range=1-10; outcome_count=12; outcome_model=equal_outcome_pool; ev_formula=((max-min)/2+min)/outcome_count',
      ].join('\n'),
    );

    expect(data.entries[0]).toMatchObject({
      openableItemName: 'Borgen Bag 01',
      contentItemName: 'Borgen Buck',
      quantityPerOpen: 0.46,
      quantityKind: 'expected',
    });
  });

  it('rejects expected-value rows without explicit review assumptions', () => {
    expect(() => parseOpenableContentsReferenceCsv(
      [
        'openable_item_name,openable_canonical_key,content_item_name,content_canonical_key,quantity_per_open,quantity_kind,evidence,notes',
        'Borgen Bag 01,borgen bag 01,Borgen Buck,borgen buck,0.46,expected,reviewed_expected_value,reviewed row',
      ].join('\n'),
    )).toThrow(/Expected-value openable row/);
  });

  it('rejects copied raw Buddy openable candidate evidence', () => {
    expect(() => parseOpenableContentsReferenceCsv(
      [
        'openable_item_name,openable_canonical_key,content_item_name,content_canonical_key,quantity_per_open,quantity_kind,evidence,notes',
        'Apple Basket,apple basket,Apple,apple,200,fixed,container_to_content,Candidate from cached Buddy page-data',
      ].join('\n'),
    )).toThrow(/copying raw Buddy candidate rows/);
  });

  it('rejects fractional fixed quantities', () => {
    expect(() => parseOpenableContentsReferenceCsv(
      [
        'openable_item_name,openable_canonical_key,content_item_name,content_canonical_key,quantity_per_open,quantity_kind,evidence,notes',
        'Borgen Bag 01,borgen bag 01,Borgen Buck,borgen buck,0.46,fixed,reviewed_expected_value,reviewed row',
      ].join('\n'),
    )).toThrow(/Fixed openable quantity must be a whole number/);
  });

  it('parses checked-in openable contents data with promoted Salt sources', () => {
    const data = parseOpenableContentsReferenceCsv(
      readFileSync(join(process.cwd(), 'data', 'openable_contents.csv'), 'utf8'),
    );
    const saltOpenables = data.byContentCanonicalKey.salt.map((entry) => entry.openableItemName);
    const fixedRows = data.entries.filter((entry) => entry.quantityKind === 'fixed');
    const expectedRows = data.entries.filter((entry) => entry.quantityKind === 'expected');
    const lornKitContents = data.byOpenableCanonicalKey["lorn's expedition kit"];
    const borgenBuckFromBag = data.byContentCanonicalKey['borgen buck'].find(
      (entry) => entry.openableCanonicalKey === 'borgen bag 01',
    );

    expect(data.entries).toHaveLength(921);
    expect(fixedRows).toHaveLength(658);
    expect(expectedRows).toHaveLength(263);
    expect(lornKitContents).toHaveLength(11);
    expect(lornKitContents).toEqual(expect.arrayContaining([
      expect.objectContaining({ contentCanonicalKey: 'glyph sphere', quantityPerOpen: 2 }),
      expect.objectContaining({ contentCanonicalKey: 'temple voucher', quantityPerOpen: 3 }),
    ]));
    expect(saltOpenables).toEqual(expect.arrayContaining(['Corn Prize Bag', 'Large Chest 03']));
    expect(data.entries.some((entry) => entry.evidence === 'container_to_content')).toBe(false);
    expect(borgenBuckFromBag).toMatchObject({
      quantityKind: 'expected',
      evidence: 'reviewed_expected_value',
      quantityPerOpen: 0.458333,
    });
    expect(borgenBuckFromBag?.notes).toEqual(expect.arrayContaining([
      'quantity_range=1-10',
      'outcome_count=12',
      'outcome_model=equal_outcome_pool',
      'ev_formula=((max-min)/2+min)/outcome_count',
    ]));
  });
});
