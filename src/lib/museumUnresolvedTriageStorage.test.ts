import { describe, expect, it } from 'vitest';

import {
  clearMuseumUnresolvedTriagedMark,
  clearMuseumUnresolvedTriageMarks,
  loadMuseumUnresolvedTriageMarks,
  markMuseumUnresolvedTriaged,
} from './museumUnresolvedTriageStorage';

describe('museumUnresolvedTriageStorage', () => {
  it('saves, loads, removes, and clears unresolved triage marks', () => {
    const storage = window.localStorage;
    storage.clear();

    markMuseumUnresolvedTriaged(
      {
        triageKey: 'mystery goo|mystery-goo||missing_local_reference||',
        canonicalKey: 'mystery goo',
        itemName: 'Mystery Goo',
        unresolvedCaseType: 'missing_local_reference',
        generatedBuddySlug: 'mystery-goo',
        alternateBuddySlug: null,
        reviewedAt: '2026-03-22T12:00:00.000Z',
      },
      storage,
    );

    expect(loadMuseumUnresolvedTriageMarks(storage)).toEqual([
      {
        triageKey: 'mystery goo|mystery-goo||missing_local_reference||',
        canonicalKey: 'mystery goo',
        itemName: 'Mystery Goo',
        unresolvedCaseType: 'missing_local_reference',
        generatedBuddySlug: 'mystery-goo',
        alternateBuddySlug: null,
        reviewedAt: '2026-03-22T12:00:00.000Z',
      },
    ]);

    clearMuseumUnresolvedTriagedMark('mystery goo|mystery-goo||missing_local_reference||', storage);
    expect(loadMuseumUnresolvedTriageMarks(storage)).toEqual([]);

    markMuseumUnresolvedTriaged(
      {
        triageKey: 'pot of gold (large)|pot-of-gold-large-||collision_or_ambiguity||slug_collision',
        canonicalKey: 'pot of gold (large)',
        itemName: 'Pot of Gold (Large)',
        unresolvedCaseType: 'collision_or_ambiguity',
        generatedBuddySlug: 'pot-of-gold-large-',
        alternateBuddySlug: null,
        reviewedAt: '2026-03-22T13:00:00.000Z',
      },
      storage,
    );

    clearMuseumUnresolvedTriageMarks(storage);
    expect(loadMuseumUnresolvedTriageMarks(storage)).toEqual([]);
  });

  it('treats malformed saved unresolved triage payloads as absent', () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem('farmrpg-tools.museum-unresolved-triage-marks.v1', '{"nope":true}');

    expect(loadMuseumUnresolvedTriageMarks(storage)).toEqual([]);
  });
});
