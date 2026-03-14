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

export function normalizeName(input: string): string {
  return input
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u201c\u201d\u201e\u201f\u2033]/g, (character) => {
      return SMART_PUNCTUATION_REPLACEMENTS[character] ?? character;
    })
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function toCanonicalItemKey(input: string): string {
  return normalizeName(input);
}
