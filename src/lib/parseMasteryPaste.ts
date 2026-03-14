import { toCanonicalItemKey } from './normalizeItemKey';

export type ParseSummary = {
  itemsParsed: number;
  tiersDetected: Array<number | 'INF'>;
  unknownItemsCount: number;
  warnings: string[];
};

export type ParseResult = {
  masteryByItem: Record<string, number>;
  parseSummary: ParseSummary;
};

const INFINITY_TARGET_RE = /^(?:∞|infinity)$/i;
const MASTERY_ROW_RE =
  /^(?<itemName>.+?)\s+(?<count>\d[\d,]*)\s*\/\s*(?<target>(?:\d[\d,]*|∞|infinity))(?=\s|$)(?<rest>.*)$/i;

function parseCount(value: string): number {
  return Number.parseInt(value.replace(/,/g, ''), 10);
}

function parseTierTarget(value: string): number | 'INF' {
  if (INFINITY_TARGET_RE.test(value)) {
    return 'INF';
  }

  return parseCount(value);
}

export function parseMasteryPaste(rawText: string): ParseResult {
  const masteryByItem: Record<string, number> = {};
  const warnings: string[] = [];
  const tiersDetected = new Set<number | 'INF'>();

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    // FarmRPG mastery rows are assumed to contain a count/target pair.
    // We intentionally skip anything that does not fit that shape.
    const match = line.match(MASTERY_ROW_RE);

    if (!match?.groups) {
      continue;
    }

    const itemName = match.groups.itemName.trim();
    const count = parseCount(match.groups.count);
    const targetTier = parseTierTarget(match.groups.target);
    const canonicalKey = toCanonicalItemKey(itemName);

    if (!canonicalKey) {
      continue;
    }

    tiersDetected.add(targetTier);

    const existingCount = masteryByItem[canonicalKey];
    if (existingCount !== undefined) {
      masteryByItem[canonicalKey] = Math.max(existingCount, count);
      warnings.push(
        `Duplicate mastery row for "${itemName}" resolved using max count (${Math.max(existingCount, count)}).`,
      );
      continue;
    }

    masteryByItem[canonicalKey] = count;
  }

  return {
    masteryByItem,
    parseSummary: {
      itemsParsed: Object.keys(masteryByItem).length,
      tiersDetected: [...tiersDetected],
      unknownItemsCount: 0,
      warnings,
    },
  };
}
