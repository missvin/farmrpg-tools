const SMART_PUNCTUATION_REPLACEMENTS: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201a': "'",
  '\u201b': "'",
  '\u2032': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u201e': '"',
  '\u201f': '"',
  '\u2033': '"',
};

export type CanonicalItemKey = string;

export type CanonicalItemIdentity = {
  itemName: string;
  canonicalKey: CanonicalItemKey;
};

export function normalizeName(input: string): string {
  return input
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u201c\u201d\u201e\u201f\u2033]/g, (character) => {
      return SMART_PUNCTUATION_REPLACEMENTS[character] ?? character;
    })
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function toCanonicalItemKey(input: string): CanonicalItemKey {
  return normalizeName(input);
}

export function toCanonicalItemIdentity(itemName: string): CanonicalItemIdentity {
  const trimmedItemName = itemName.trim();

  return {
    itemName: trimmedItemName,
    canonicalKey: toCanonicalItemKey(trimmedItemName),
  };
}

export function isCanonicalItemKey(input: string): boolean {
  return input.length > 0 && input === toCanonicalItemKey(input);
}

export function canonicalItemKeysMatch(left: string, right: string): boolean {
  return toCanonicalItemKey(left) === toCanonicalItemKey(right);
}
