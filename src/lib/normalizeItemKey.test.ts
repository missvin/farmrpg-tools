import { describe, expect, it } from 'vitest';

import {
  canonicalItemKeysMatch,
  isCanonicalItemKey,
  normalizeName,
  toCanonicalItemIdentity,
  toCanonicalItemKey,
} from './normalizeItemKey';

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

describe('toCanonicalItemIdentity', () => {
  it('keeps display name and canonical key separate', () => {
    expect(toCanonicalItemIdentity('  Golden  Leaf ')).toEqual({
      itemName: 'Golden  Leaf',
      canonicalKey: 'golden leaf',
    });
  });
});

describe('isCanonicalItemKey', () => {
  it('accepts normalized non-empty keys', () => {
    expect(isCanonicalItemKey('golden leaf')).toBe(true);
  });

  it('rejects display names, whitespace, and empty keys', () => {
    expect(isCanonicalItemKey('Golden Leaf')).toBe(false);
    expect(isCanonicalItemKey('golden  leaf')).toBe(false);
    expect(isCanonicalItemKey('')).toBe(false);
  });
});

describe('canonicalItemKeysMatch', () => {
  it('compares item identities through the canonical key rules', () => {
    expect(canonicalItemKeysMatch('Golden Leaf', '  golden   leaf ')).toBe(true);
    expect(canonicalItemKeysMatch('Golden Leaf', 'Gold Leaf')).toBe(false);
  });
});
