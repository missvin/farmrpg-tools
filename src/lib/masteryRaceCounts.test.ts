import { describe, expect, it } from 'vitest';

import {
  buildMasteryRaceCountLookup,
  loadMasteryRaceCountsState,
  normalizeMasteryRaceCountsState,
  saveMasteryRaceCountsState,
  upsertMasteryRaceCount,
} from './masteryRaceCounts';

describe('masteryRaceCounts', () => {
  it('normalizes optional M/GM/MM counts safely', () => {
    expect(
      normalizeMasteryRaceCountsState({
        entries: [
          {
            itemName: 'Board',
            masteredCount: '10',
            grandMasteredCount: '',
            megaMasteredCount: -1,
            updatedAt: '2026-05-08T00:00:00.000Z',
          },
        ],
      }).entries[0],
    ).toMatchObject({
      canonicalKey: 'board',
      masteredCount: 10,
      grandMasteredCount: null,
      megaMasteredCount: null,
    });
  });

  it('upserts and looks up race-count entries by canonical item key', () => {
    const state = upsertMasteryRaceCount(
      { schemaVersion: 1, entries: [] },
      {
        itemName: 'Gold Cucumber',
        masteredCount: 100,
        grandMasteredCount: 20,
        megaMasteredCount: 3,
        now: '2026-05-08T00:00:00.000Z',
      },
    );

    expect(buildMasteryRaceCountLookup(state)['gold cucumber']).toMatchObject({
      itemName: 'Gold Cucumber',
      megaMasteredCount: 3,
    });
  });

  it('saves and loads local race-count context', () => {
    const storage = window.localStorage;
    storage.clear();

    const savedState = saveMasteryRaceCountsState(
      upsertMasteryRaceCount(
        { schemaVersion: 1, entries: [] },
        {
          itemName: 'Spoon',
          megaMasteredCount: 8,
          now: '2026-05-08T00:00:00.000Z',
        },
      ),
      storage,
    );

    expect(loadMasteryRaceCountsState(storage)).toEqual(savedState);
  });
});
