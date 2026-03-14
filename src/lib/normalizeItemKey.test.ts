import { describe, expect, it } from 'vitest';

import { normalizeName, toCanonicalItemKey } from './normalizeItemKey';

describe('normalizeName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeName('  Apple  ')).toBe('apple');
  });

  it('lowercases text', () => {
    expect(normalizeName('Fancy Sword')).toBe('fancy sword');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeName('Spicy   Fish\t\tSoup')).toBe('spicy fish soup');
  });

  it('normalizes smart apostrophes and quotes', () => {
    expect(normalizeName('Farmer\u2019s \u201cDelight\u201d')).toBe(`farmer's "delight"`);
  });
});

describe('toCanonicalItemKey', () => {
  it('returns the normalized name for v1 canonical keys', () => {
    expect(toCanonicalItemKey('  GOLDEN  LEAF ')).toBe('golden leaf');
  });
});
