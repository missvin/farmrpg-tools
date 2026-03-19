import { toCanonicalItemKey } from './normalizeItemKey';

export type ParseSummary = {
  itemsParsed: number;
  parsedRowsCount: number;
  tiersDetected: Array<number | 'INF'>;
  duplicateRowsCount: number;
  skippedNonItemLinesCount: number;
  skippedNonItemLineSamples: Array<{
    lineNumber: number;
    text: string;
  }>;
  unknownItemsCount: number;
  warnings: string[];
};

export type ParsedRow = {
  rawItemName: string;
  canonicalKey: string;
  count: number;
  targetTier: number | 'INF';
  sourceLineIndex: number;
};

export type ParseResult = {
  masteryByItem: Record<string, number>;
  parseSummary: ParseSummary;
  parsedRows: ParsedRow[];
};

type AddParsedItemResult = {
  canonicalKey: string | null;
  wasDuplicate: boolean;
};

const INFINITY_TARGET_RE = /^(?:\u221e|infinity)$/i;
const PROGRESS_LINE_RE =
  /^(?<count>\d[\d,]*)\s*\/\s*(?<target>(?:\d[\d,]*|\u221e|infinity))\s+progress\b.*$/i;
const PERCENT_LINE_RE = /^\d+(?:\.\d+)?%$/;

function parseCount(value: string): number {
  return Number.parseInt(value.replace(/,/g, ''), 10);
}

function parseTierTarget(value: string): number | 'INF' {
  if (INFINITY_TARGET_RE.test(value)) {
    return 'INF';
  }

  return parseCount(value);
}

function isStandalonePercentLine(line: string): boolean {
  return PERCENT_LINE_RE.test(line);
}

function findNextNonEmptyLine(lines: string[], startIndex: number): number {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index]) {
      return index;
    }
  }

  return -1;
}

function addParsedItem(
  masteryByItem: Record<string, number>,
  warnings: string[],
  itemName: string,
  count: number,
): AddParsedItemResult {
  const canonicalKey = toCanonicalItemKey(itemName);

  if (!canonicalKey) {
    return { canonicalKey: null, wasDuplicate: false };
  }

  const existingCount = masteryByItem[canonicalKey];
  if (existingCount !== undefined) {
    const resolvedCount = Math.max(existingCount, count);
    masteryByItem[canonicalKey] = resolvedCount;
    warnings.push(`Duplicate mastery row for "${itemName}" resolved using max count (${resolvedCount}).`);
    return { canonicalKey, wasDuplicate: true };
  }

  masteryByItem[canonicalKey] = count;
  return { canonicalKey, wasDuplicate: false };
}

function sortDetectedTiers(tiers: Set<number | 'INF'>): Array<number | 'INF'> {
  return [...tiers].sort((left, right) => {
    if (left === 'INF') {
      return 1;
    }

    if (right === 'INF') {
      return -1;
    }

    return left - right;
  });
}

export function parseMasteryPaste(rawText: string): ParseResult {
  const masteryByItem: Record<string, number> = {};
  const warnings: string[] = [];
  const tiersDetected = new Set<number | 'INF'>();
  const parsedRows: ParsedRow[] = [];
  const consumedLineIndexes = new Set<number>();
  const lines = rawText.split(/\r?\n/).map((line) => line.trim());
  let duplicateRowsCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line || PROGRESS_LINE_RE.test(line) || isStandalonePercentLine(line)) {
      continue;
    }

    // Real FarmRPG exports use a multi-line block:
    // item name, then progress, then optionally a standalone percent line.
    // We only treat a line as an item if the next non-empty line is a progress row.
    const progressLineIndex = findNextNonEmptyLine(lines, index + 1);
    if (progressLineIndex === -1) {
      continue;
    }

    const progressLine = lines[progressLineIndex];
    const match = progressLine.match(PROGRESS_LINE_RE);
    if (!match?.groups) {
      continue;
    }

    const count = parseCount(match.groups.count);
    const targetTier = parseTierTarget(match.groups.target);
    const { canonicalKey, wasDuplicate } = addParsedItem(masteryByItem, warnings, line, count);

    if (!canonicalKey) {
      continue;
    }

    if (wasDuplicate) {
      duplicateRowsCount += 1;
    }

    parsedRows.push({
      rawItemName: line,
      canonicalKey,
      count,
      targetTier,
      sourceLineIndex: index,
    });
    tiersDetected.add(targetTier);
    consumedLineIndexes.add(index);
    consumedLineIndexes.add(progressLineIndex);

    const percentLineIndex = findNextNonEmptyLine(lines, progressLineIndex + 1);
    index = progressLineIndex;

    if (percentLineIndex !== -1 && isStandalonePercentLine(lines[percentLineIndex])) {
      consumedLineIndexes.add(percentLineIndex);
      index = percentLineIndex;
    }
  }

  const skippedNonItemLineSamples = lines.reduce<Array<{ lineNumber: number; text: string }>>((samples, line, index) => {
    if (!line || consumedLineIndexes.has(index)) {
      return samples;
    }

    if (samples.length < 5) {
      samples.push({
        lineNumber: index + 1,
        text: line,
      });
    }

    return samples;
  }, []);
  const skippedNonItemLinesCount = lines.reduce((count, line, index) => {
    if (!line || consumedLineIndexes.has(index)) {
      return count;
    }

    return count + 1;
  }, 0);

  return {
    masteryByItem,
    parseSummary: {
      itemsParsed: Object.keys(masteryByItem).length,
      parsedRowsCount: parsedRows.length,
      tiersDetected: sortDetectedTiers(tiersDetected),
      duplicateRowsCount,
      skippedNonItemLinesCount,
      skippedNonItemLineSamples,
      unknownItemsCount: 0,
      warnings,
    },
    parsedRows,
  };
}
