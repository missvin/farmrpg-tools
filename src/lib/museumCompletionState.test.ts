import { describe, expect, it } from 'vitest';

import {
  clearMuseumCompletionState,
  createDefaultMuseumCompletionState,
  loadMuseumCompletionState,
  MUSEUM_COMPLETION_STATE_STORAGE_KEY,
  normalizeMuseumCompletionState,
  saveMuseumCompletionState,
} from './museumCompletionState';

describe('museumCompletionState', () => {
  it('normalizes missing or malformed values to the default state', () => {
    expect(normalizeMuseumCompletionState(null)).toEqual(createDefaultMuseumCompletionState());
    expect(
      normalizeMuseumCompletionState({
        schemaVersion: 99,
        savedAt: '',
        fullMuseumText: 123,
        personalMuseumText: null,
        manualMissingItems: [{ id: '', itemName: 'Board' }],
      }),
    ).toEqual(createDefaultMuseumCompletionState());
  });

  it('saves, loads, and clears museum completion progress state', () => {
    const storage = window.localStorage;
    storage.clear();

    const savedState = saveMuseumCompletionState(
      {
        fullMuseumText: 'Crops Count = 1\nBeet Beet',
        personalMuseumText: 'Crops (0 / 1)\n-',
        manualMissingItems: [
          {
            id: 'manual-board',
            categoryKey: 'items',
            categoryName: 'Items',
            itemName: 'Board',
            canonicalKey: 'board',
            slotCount: 1,
            note: 'manual review',
          },
        ],
        savedAt: '2026-05-12T12:00:00.000Z',
      },
      storage,
    );

    expect(savedState).toEqual({
      schemaVersion: 1,
      savedAt: '2026-05-12T12:00:00.000Z',
      fullMuseumText: 'Crops Count = 1\nBeet Beet',
      personalMuseumText: 'Crops (0 / 1)\n-',
      manualMissingItems: [
        {
          id: 'manual-board',
          categoryKey: 'items',
          categoryName: 'Items',
          itemName: 'Board',
          canonicalKey: 'board',
          slotCount: 1,
          note: 'manual review',
        },
      ],
    });
    expect(loadMuseumCompletionState(storage)).toEqual(savedState);

    clearMuseumCompletionState(storage);

    expect(storage.getItem(MUSEUM_COMPLETION_STATE_STORAGE_KEY)).toBeNull();
    expect(loadMuseumCompletionState(storage)).toEqual(createDefaultMuseumCompletionState());
  });
});
