import { toCanonicalItemKey } from './normalizeItemKey';

export type MuseumCategorySeedItem = {
  itemName: string;
  canonicalKey: string;
};

export type MuseumCategorySeed = {
  categoryName: string;
  expectedOwnedCount: number | null;
  expectedTotalCount: number | null;
  parsedItemCount: number;
  countValidation: 'matches_total' | 'matches_owned' | 'mismatch' | 'unknown';
  items: MuseumCategorySeedItem[];
};

export type MuseumSeedItem = {
  itemName: string;
  canonicalKey: string;
  categoryName: string;
};

export type MuseumParseSummary = {
  categoriesParsed: number;
  uniqueItemsParsed: number;
  duplicateArtifactsRemoved: number;
  warnings: string[];
};

export type MuseumParseResult = {
  categories: MuseumCategorySeed[];
  uniqueItems: MuseumSeedItem[];
  parseSummary: MuseumParseSummary;
};

const CATEGORY_HEADER_PATTERNS = [
  /^(?<name>.+?)\s*\(\s*(?<owned>\d+)\s*\/\s*(?<total>\d+)\s*\)$/u,
  /^(?<name>.+?)\s+(?<owned>\d+)\s*\/\s*(?<total>\d+)$/u,
  /^(?<name>.+?)\s+Count\s*=\s*(?<total>\d+)$/u,
] as const;

const KNOWN_UI_LINES = new Set([
  'farm rpg',
  'back',
  'museum',
  'donate all',
  'search',
]);

function normalizeMuseumLine(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function parseCategoryHeader(line: string): {
  categoryName: string;
  expectedOwnedCount: number | null;
  expectedTotalCount: number;
} | null {
  for (const pattern of CATEGORY_HEADER_PATTERNS) {
    const match = line.match(pattern);

    if (!match?.groups) {
      continue;
    }

    return {
      categoryName: normalizeMuseumLine(match.groups.name ?? ''),
      expectedOwnedCount: match.groups.owned ? Number(match.groups.owned) : null,
      expectedTotalCount: Number(match.groups.total),
    };
  }

  return null;
}

function tokensMatch(tokens: string[], start: number, phraseLength: number): boolean {
  for (let index = 0; index < phraseLength; index += 1) {
    if (tokens[start + index] !== tokens[start + phraseLength + index]) {
      return false;
    }
  }

  return true;
}

function parseDuplicatedItemArtifactsFromLine(line: string): string[] {
  const tokens = line.split(' ').filter(Boolean);

  function walk(start: number): string[] | null {
    if (start >= tokens.length) {
      return [];
    }

    const remainingTokens = tokens.length - start;
    const maxPhraseLength = Math.floor(remainingTokens / 2);

    for (let phraseLength = maxPhraseLength; phraseLength >= 1; phraseLength -= 1) {
      if (!tokensMatch(tokens, start, phraseLength)) {
        continue;
      }

      const remainder = walk(start + phraseLength * 2);
      if (!remainder) {
        continue;
      }

      return [tokens.slice(start, start + phraseLength).join(' '), ...remainder];
    }

    return null;
  }

  return walk(0) ?? [line];
}

function isSkippableLine(line: string): boolean {
  if (!line) {
    return true;
  }

  return KNOWN_UI_LINES.has(line.toLowerCase());
}

function createCsvSeed(uniqueItems: MuseumSeedItem[]): string {
  const rows = ['museum_category,item_name,canonical_key'];

  for (const item of uniqueItems) {
    rows.push([item.categoryName, item.itemName, item.canonicalKey].map(escapeCsvValue).join(','));
  }

  return rows.join('\n');
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

export function toMuseumSeedJson(parseResult: MuseumParseResult): string {
  return JSON.stringify(parseResult, null, 2);
}

export function toMuseumSeedCsv(parseResult: MuseumParseResult): string {
  return createCsvSeed(parseResult.uniqueItems);
}

export function parseMuseumExport(rawText: string): MuseumParseResult {
  const lines = rawText.split(/\r?\n/u).map(normalizeMuseumLine);
  const categories: MuseumCategorySeed[] = [];
  const uniqueItemsByCanonicalKey = new Map<string, MuseumSeedItem>();
  const warnings: string[] = [];
  let duplicateArtifactsRemoved = 0;
  let currentCategory: MuseumCategorySeed | null = null;
  let currentCategorySeenKeys = new Set<string>();

  function commitCurrentCategory(): void {
    if (!currentCategory) {
      return;
    }

    const { parsedItemCount, expectedOwnedCount, expectedTotalCount } = currentCategory;

    if (expectedTotalCount === null || expectedOwnedCount === null) {
      currentCategory.countValidation =
        expectedTotalCount !== null && parsedItemCount === expectedTotalCount ? 'matches_total' : 'unknown';
      if (expectedTotalCount !== null && parsedItemCount !== expectedTotalCount) {
        currentCategory.countValidation = 'mismatch';
        warnings.push(
          `${currentCategory.categoryName}: parsed ${parsedItemCount.toLocaleString()} items, but the header shows a total count of ${expectedTotalCount.toLocaleString()}.`,
        );
      }
    } else if (parsedItemCount === expectedTotalCount) {
      currentCategory.countValidation = 'matches_total';
    } else if (parsedItemCount === expectedOwnedCount) {
      currentCategory.countValidation = 'matches_owned';
      warnings.push(
        `${currentCategory.categoryName}: parsed ${parsedItemCount.toLocaleString()} items, which matches the owned count but not the total count of ${expectedTotalCount.toLocaleString()}.`,
      );
    } else {
      currentCategory.countValidation = 'mismatch';
      warnings.push(
        `${currentCategory.categoryName}: parsed ${parsedItemCount.toLocaleString()} items, but the header shows ${expectedOwnedCount.toLocaleString()} / ${expectedTotalCount.toLocaleString()}.`,
      );
    }

    categories.push(currentCategory);
    currentCategory = null;
    currentCategorySeenKeys = new Set<string>();
  }

  for (const line of lines) {
    if (isSkippableLine(line)) {
      continue;
    }

    const categoryHeader = parseCategoryHeader(line);
    if (categoryHeader) {
      commitCurrentCategory();
      currentCategory = {
        categoryName: categoryHeader.categoryName,
        expectedOwnedCount: categoryHeader.expectedOwnedCount,
        expectedTotalCount: categoryHeader.expectedTotalCount,
        parsedItemCount: 0,
        countValidation: 'unknown',
        items: [],
      };
      currentCategorySeenKeys = new Set<string>();
      continue;
    }

    if (!currentCategory) {
      continue;
    }

    const parsedItems = parseDuplicatedItemArtifactsFromLine(line);

    for (const itemName of parsedItems) {
      const canonicalKey = toCanonicalItemKey(itemName);
      if (!canonicalKey) {
        continue;
      }

      if (currentCategorySeenKeys.has(canonicalKey)) {
        duplicateArtifactsRemoved += 1;
        continue;
      }

      currentCategorySeenKeys.add(canonicalKey);
      currentCategory.items.push({
        itemName,
        canonicalKey,
      });
      currentCategory.parsedItemCount += 1;

      const existingGlobalItem = uniqueItemsByCanonicalKey.get(canonicalKey);
      if (!existingGlobalItem) {
        uniqueItemsByCanonicalKey.set(canonicalKey, {
          itemName,
          canonicalKey,
          categoryName: currentCategory.categoryName,
        });
        continue;
      }

      if (existingGlobalItem.categoryName !== currentCategory.categoryName) {
        warnings.push(
          `${itemName} appeared in both ${existingGlobalItem.categoryName} and ${currentCategory.categoryName}; keeping the first category in the global seed list.`,
        );
      }
    }
  }

  commitCurrentCategory();

  if (categories.length === 0) {
    warnings.push('No museum categories were detected in the pasted export.');
  }

  if (uniqueItemsByCanonicalKey.size === 0) {
    warnings.push('No museum items were detected in the pasted export.');
  }

  const uniqueItems = [...uniqueItemsByCanonicalKey.values()].sort((left, right) =>
    left.itemName.localeCompare(right.itemName),
  );

  return {
    categories,
    uniqueItems,
    parseSummary: {
      categoriesParsed: categories.length,
      uniqueItemsParsed: uniqueItems.length,
      duplicateArtifactsRemoved,
      warnings,
    },
  };
}
