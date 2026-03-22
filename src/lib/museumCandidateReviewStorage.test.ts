import { describe, expect, it } from 'vitest';

import {
  clearMuseumCandidateReviewedMark,
  clearMuseumCandidateReviewMarks,
  loadMuseumCandidateReviewMarks,
  markMuseumCandidateReviewed,
} from './museumCandidateReviewStorage';

describe('museumCandidateReviewStorage', () => {
  it('saves, loads, removes, and clears reviewed candidate marks', () => {
    const storage = window.localStorage;
    storage.clear();

    markMuseumCandidateReviewed(
      {
        reviewKey: 'bamboo trellis|bamboo-trellis||',
        canonicalKey: 'bamboo trellis',
        itemName: 'Bamboo Trellis',
        generatedBuddySlug: 'bamboo-trellis',
        alternateBuddySlug: null,
        flags: [],
        reviewedAt: '2026-03-22T12:00:00.000Z',
      },
      storage,
    );

    expect(loadMuseumCandidateReviewMarks(storage)).toEqual([
      {
        reviewKey: 'bamboo trellis|bamboo-trellis||',
        canonicalKey: 'bamboo trellis',
        itemName: 'Bamboo Trellis',
        generatedBuddySlug: 'bamboo-trellis',
        alternateBuddySlug: null,
        flags: [],
        reviewedAt: '2026-03-22T12:00:00.000Z',
      },
    ]);

    clearMuseumCandidateReviewedMark('bamboo trellis|bamboo-trellis||', storage);
    expect(loadMuseumCandidateReviewMarks(storage)).toEqual([]);

    markMuseumCandidateReviewed(
      {
        reviewKey: 'fancy pipe|fancy-pipe||symbol_cleanup',
        canonicalKey: 'fancy pipe',
        itemName: 'Fancy Pipe',
        generatedBuddySlug: 'fancy-pipe',
        alternateBuddySlug: null,
        flags: ['symbol_cleanup'],
        reviewedAt: '2026-03-22T13:00:00.000Z',
      },
      storage,
    );

    clearMuseumCandidateReviewMarks(storage);
    expect(loadMuseumCandidateReviewMarks(storage)).toEqual([]);
  });

  it('treats malformed saved review marks as absent', () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem('farmrpg-tools.museum-candidate-review-marks.v1', '{"nope":true}');

    expect(loadMuseumCandidateReviewMarks(storage)).toEqual([]);
  });
});
