import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseQuestSourceHintsCsv } from './loadQuestReference';

describe('parseQuestSourceHintsCsv', () => {
  it('parses the checked-in local source-hint reference file', () => {
    const result = parseQuestSourceHintsCsv(
      readFileSync(join(process.cwd(), 'data', 'quest_item_source_hints.csv'), 'utf8'),
    );

    expect(result.length).toBeGreaterThan(1200);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemName: 'Salt Rock',
        canonicalKey: 'salt rock',
        sourceName: 'Black Rock Canyon',
        sourceType: 'exploring',
      }),
      expect.objectContaining({
        itemName: 'Large Net',
        canonicalKey: 'large net',
        sourceName: 'Bag of Presents 02',
        sourceType: 'openable',
        preferredUnit: 'openable',
      }),
      expect.objectContaining({
        itemName: 'Spiked Shell',
        canonicalKey: 'spiked shell',
        sourceName: 'Salt',
        sourceType: 'wishing_well',
        preferredUnit: 'Wishing Well throw',
      }),
    ]));
  });
});
