import { describe, expect, it } from 'vitest';

import {
  clearMuseumKnownBaseline,
  loadMuseumKnownBaseline,
  saveMuseumKnownBaseline,
} from './museumKnownBaselineStorage';

describe('museumKnownBaselineStorage', () => {
  it('saves, loads, and clears the museum baseline payload', () => {
    const storage = window.localStorage;
    storage.clear();

    saveMuseumKnownBaseline(
      {
        savedAt: '2026-03-22T12:00:00.000Z',
        items: [
          {
            museumCategory: 'Items',
            category: 'Item',
            itemName: 'Bamboo Trellis',
            canonicalKey: 'bamboo trellis',
            obtainable: true,
            generatedBuddySlug: 'bamboo-trellis',
            alternateBuddySlug: null,
          },
        ],
      },
      storage,
    );

    expect(loadMuseumKnownBaseline(storage)).toEqual({
      savedAt: '2026-03-22T12:00:00.000Z',
      items: [
        {
          museumCategory: 'Items',
          category: 'Item',
          itemName: 'Bamboo Trellis',
          canonicalKey: 'bamboo trellis',
          obtainable: true,
          generatedBuddySlug: 'bamboo-trellis',
          alternateBuddySlug: null,
        },
      ],
    });

    clearMuseumKnownBaseline(storage);
    expect(loadMuseumKnownBaseline(storage)).toBeNull();
  });

  it('treats malformed saved payloads as absent', () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem('farmrpg-tools.museum-known-baseline.v1', '{"savedAt":123,"items":"nope"}');

    expect(loadMuseumKnownBaseline(storage)).toBeNull();
  });
});
