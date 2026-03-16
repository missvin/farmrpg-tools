import { describe, expect, it } from 'vitest';

import { buildMissingMasteryDifficultyCsv } from './exportMissingMasteryDifficultyCsv';

describe('buildMissingMasteryDifficultyCsv', () => {
  it('exports unmatched items using the mastery difficulty data schema and source marker', () => {
    const csvText = buildMissingMasteryDifficultyCsv([
      {
        itemName: 'Zed Item',
        canonicalKey: 'zed item',
        currentMastery: 50,
      },
      {
        itemName: 'Alpha Item',
        canonicalKey: 'alpha item',
        currentMastery: 100,
      },
    ]);

    expect(csvText).toBe(
      [
        'item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row',
        'Alpha Item,,,,,,,,,Missing from mastery_difficulty,',
        'Zed Item,,,,,,,,,Missing from mastery_difficulty,',
      ].join('\n'),
    );
  });

  it('deduplicates unmatched items before export', () => {
    const csvText = buildMissingMasteryDifficultyCsv([
      {
        itemName: 'Board',
        canonicalKey: 'board',
        currentMastery: 10,
      },
      {
        itemName: 'Board',
        canonicalKey: 'board',
        currentMastery: 20,
      },
    ]);

    expect(csvText.split('\n')).toHaveLength(2);
  });
});
