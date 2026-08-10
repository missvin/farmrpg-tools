import { describe, expect, it } from 'vitest';

import {
  assertT300StoryPrivacy,
  buildT300RaceStoryData,
  parseTowerRequirementsCsv,
} from './t300RaceStoryGenerator.mjs';

const towerCsv = [
  'tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row',
  '201,201-210,1,Board,,MM,,,,',
  '299,291-300,1,Red Trunk,,MM,,,,',
  '300,291-300,1,Water Lily,,MM,,,,',
  '300,291-300,2,Wizard Hat,,MM,,,,',
  '301,301-310,1,Not Included,,GM,,,,',
].join('\n');

const supplement = {
  schemaVersion: 1,
  profileLabel: '@blackberry',
  trackingStartedAt: '2026-03-14T22:00:00.000Z',
  deadlineAt: '2026-08-31T06:59:59.000Z',
  finalistCheckpoints: [{
    observedAt: '2026-08-08T18:00:00.000Z',
    approximate: true,
    values: { 'red trunk': 850000, 'water lily': 760000, 'wizard hat': 573000 },
  }],
};

const backup = {
  kind: 'farmrpg-tools-backup',
  exportedAt: '2026-08-08T23:20:00.000Z',
  profileId: 'must-not-ship',
  state: {
    preferences: { theme: 'dark' },
    snapshots: [
      {
        createdAt: '2026-03-14T22:00:00.000Z',
        rawText: 'private',
        masteryByItem: { Board: 1000000, 'Red Trunk': 70000, 'Water Lily': 280000, 'Wizard Hat': 170000 },
      },
      {
        createdAt: '2026-08-08T23:00:00.000Z',
        rawText: 'private',
        masteryByItem: { Board: 1000000, 'Red Trunk': 860000, 'Water Lily': 767000, 'Wizard Hat': 602000 },
      },
    ],
  },
};

describe('T300 race story generation', () => {
  it('filters requirements to the T201-T300 MM story set', () => {
    expect(parseTowerRequirementsCsv(towerCsv).map((row) => row.itemName)).toEqual([
      'Board',
      'Red Trunk',
      'Water Lily',
      'Wizard Hat',
    ]);
  });

  it('publishes only derived story fields and preserves partial chat checkpoints', () => {
    const story = buildT300RaceStoryData({ backup, towerRequirementsCsv: towerCsv, supplement });

    expect(story.summary).toMatchObject({
      requirementCount: 4,
      startMmCount: 1,
      startingGapCount: 3,
      latestMmCount: 1,
      remainingCount: 3,
    });
    expect(story.finalistSeries).toHaveLength(3);
    expect(story.finalistSeries[1]).toMatchObject({ source: 'chat', approximate: true });
    expect(JSON.stringify(story)).not.toContain('must-not-ship');
    expect(JSON.stringify(story)).not.toContain('private');
    expect(assertT300StoryPrivacy(story)).toBe(true);
  });

  it('rejects forbidden public keys recursively', () => {
    expect(() => assertT300StoryPrivacy({ nested: { rawText: 'nope' } })).toThrow(/privacy audit/u);
  });

  it('surfaces non-monotonic mastery as a warning without failing generation', () => {
    const changed = structuredClone(backup);
    changed.state.snapshots[1].masteryByItem.Board = 900000;
    const story = buildT300RaceStoryData({ backup: changed, towerRequirementsCsv: towerCsv, supplement });

    expect(story.warnings).toContain('Board decreased between saved snapshots.');
  });
});
