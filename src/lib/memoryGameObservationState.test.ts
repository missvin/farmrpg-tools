import { describe, expect, it } from 'vitest';

import {
  MEMORY_GAME_OBSERVATION_STORAGE_KEY,
  clearMemoryGameObservationState,
  createDefaultMemoryGameObservationState,
  createMemoryGameObservationExportFilename,
  loadMemoryGameObservationState,
  recordMemoryGameObservation,
  saveMemoryGameObservationState,
  toMemoryGameObservationCsv,
} from './memoryGameObservationState';

describe('memoryGameObservationState', () => {
  it('records local tier 4 observations and merges repeated items', () => {
    let state = createDefaultMemoryGameObservationState();

    state = recordMemoryGameObservation(state, {
      itemName: 'Board',
      canonicalKey: 'board',
      observedAt: '2026-06-07T10:00:00.000Z',
      sessionId: 'game-1',
      slotSummary: 'R1 C1',
    });
    state = recordMemoryGameObservation(state, {
      itemName: 'Board',
      canonicalKey: 'board',
      observedAt: '2026-06-07T10:01:00.000Z',
      sessionId: 'game-1',
      slotSummary: 'R1 C2',
    });

    expect(state.records).toEqual([
      {
        canonicalKey: 'board',
        itemName: 'Board',
        observedTier: '4',
        observationCount: 2,
        firstSeenAt: '2026-06-07T10:00:00.000Z',
        lastSeenAt: '2026-06-07T10:01:00.000Z',
        sampleSessionIds: ['game-1'],
        sampleSlots: ['R1 C1', 'R1 C2'],
        warningTexts: [],
      },
    ]);
  });

  it('exports review-safe CSV without implying canonical promotion', () => {
    const state = recordMemoryGameObservation(createDefaultMemoryGameObservationState(), {
      itemName: 'Mystery Token',
      canonicalKey: 'mystery token',
      observedAt: '2026-06-07T10:00:00.000Z',
      slotSummary: 'R2 C3',
      warningTexts: ['No local item reference coverage found; keep this visible as a review candidate.'],
    });

    const csv = toMemoryGameObservationCsv(state);

    expect(csv).toContain('item_name,canonical_key,observed_tier,observation_count');
    expect(csv).toContain('Mystery Token,mystery token,4,1');
    expect(csv).toContain('R2 C3');
    expect(csv).toContain('Local observation evidence only; review before promoting');
  });

  it('persists observations in an isolated localStorage key', () => {
    const storage = window.localStorage;
    let state = recordMemoryGameObservation(createDefaultMemoryGameObservationState(), {
      itemName: 'Mug of Beer',
      canonicalKey: 'mug of beer',
      observedAt: '2026-06-07T10:00:00.000Z',
    });

    state = saveMemoryGameObservationState(state, storage);

    expect(storage.getItem(MEMORY_GAME_OBSERVATION_STORAGE_KEY)).toContain('Mug of Beer');
    expect(loadMemoryGameObservationState(storage)).toEqual(state);

    clearMemoryGameObservationState(storage);
    expect(storage.getItem(MEMORY_GAME_OBSERVATION_STORAGE_KEY)).toBeNull();
  });

  it('creates stable export filenames from timestamps', () => {
    expect(createMemoryGameObservationExportFilename('2026-06-07T10:00:00.000Z')).toBe(
      'borgen-lost-and-found-observations-2026-06-07T10-00-00-000Z.csv',
    );
  });
});
