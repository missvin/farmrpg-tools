import { describe, expect, it } from 'vitest';

import { buildItemIconLookup, type ItemIconManifestEntry } from './itemIconManifest';

describe('buildItemIconLookup', () => {
  it('maps ready manifest rows to bundled local icon assets by canonical key', () => {
    const entries: ItemIconManifestEntry[] = [
      {
        itemName: 'Board',
        canonicalKey: 'board',
        manifestStatus: 'ready',
        localRelativePath: 'generated/item-icons/5885.png',
      },
    ];

    const lookup = buildItemIconLookup(entries, {
      'generated/item-icons/5885.png': '/assets/5885-hash.png',
    });

    expect(lookup.get('board')).toEqual({
      itemName: 'Board',
      canonicalKey: 'board',
      src: '/assets/5885-hash.png',
    });
  });

  it('skips missing, review-needed, and duplicate icon entries so text fallback remains safe', () => {
    const entries: ItemIconManifestEntry[] = [
      {
        itemName: 'Board',
        canonicalKey: 'board',
        manifestStatus: 'ready',
        localRelativePath: 'generated/item-icons/board.png',
      },
      {
        itemName: 'Board Duplicate',
        canonicalKey: 'board',
        manifestStatus: 'ready',
        localRelativePath: 'generated/item-icons/duplicate-board.png',
      },
      {
        itemName: 'Missing Asset',
        canonicalKey: 'missing asset',
        manifestStatus: 'ready',
        localRelativePath: 'generated/item-icons/missing.png',
      },
      {
        itemName: 'Review Item',
        canonicalKey: 'review item',
        manifestStatus: 'review_needed',
        localRelativePath: 'generated/item-icons/review.png',
      },
      {
        itemName: 'No Path',
        canonicalKey: 'no path',
        manifestStatus: 'ready',
        localRelativePath: null,
      },
    ];

    const lookup = buildItemIconLookup(entries, {
      'generated/item-icons/board.png': '/assets/board.png',
      'generated/item-icons/duplicate-board.png': '/assets/duplicate-board.png',
      'generated/item-icons/review.png': '/assets/review.png',
    });

    expect(lookup.size).toBe(1);
    expect(lookup.get('board')?.src).toBe('/assets/board.png');
    expect(lookup.has('missing asset')).toBe(false);
    expect(lookup.has('review item')).toBe(false);
    expect(lookup.has('no path')).toBe(false);
  });
});
