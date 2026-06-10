import { toCanonicalItemKey } from './normalizeItemKey';

export type HelpNeededActiveRequest = {
  questKey: string;
  questName: string;
  npc: string | null;
  completionPercent: number | null;
};

export type HelpNeededPlayerGates = {
  farmingLevel: number | null;
  fishingLevel: number | null;
  craftingLevel: number | null;
  exploringLevel: number | null;
  cookingLevel: number | null;
  miningLevel: number | null;
  towerLevel: number | null;
};

export type HelpNeededPasteParseResult = {
  activeRequests: HelpNeededActiveRequest[];
  gates: HelpNeededPlayerGates;
  reportedActiveRequestCount: number | null;
  warnings: string[];
};

const DEFAULT_GATES: HelpNeededPlayerGates = {
  farmingLevel: null,
  fishingLevel: null,
  craftingLevel: null,
  exploringLevel: null,
  cookingLevel: null,
  miningLevel: null,
  towerLevel: null,
};

const META_LINES = new Set([
  'ACTIVE HELP REQUEST',
  'Active Requests',
  'Sort: Comp%, NPC, Title, Default',
]);

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function parsePercent(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[1]);
  return Number.isFinite(parsedValue) ? Math.max(0, Math.min(100, parsedValue)) : null;
}

function parseLevelLine(value: string): number | null {
  const match = /^Level\s+([\d,]+)$/i.exec(value.trim());

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function isRequestBoundary(line: string): boolean {
  return /^(Completed Requests|Personal Requests|Request Totals|Consume a meal|Community Center|Favorite Library Pages|Most Recent Update|Other Stuff)\b/i.test(line);
}

function findSectionIndex(lines: string[], pattern: RegExp): number {
  return lines.findIndex((line) => pattern.test(line));
}

function parseReportedActiveRequestCount(line: string): number | null {
  const match = /^Active Requests\s*\(([\d,]+)\)/i.exec(line);

  if (!match) {
    return null;
  }

  const parsedCount = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : null;
}

function parseActiveRequests(lines: string[]): {
  activeRequests: HelpNeededActiveRequest[];
  reportedActiveRequestCount: number | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const activeRequests: HelpNeededActiveRequest[] = [];
  const startIndex = findSectionIndex(lines, /^Active Requests\b/i);
  const reportedActiveRequestCount = startIndex >= 0
    ? parseReportedActiveRequestCount(lines[startIndex])
    : null;

  if (startIndex < 0) {
    return {
      activeRequests,
      reportedActiveRequestCount,
      warnings: ['No Active Requests section was found in the pasted text.'],
    };
  }

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (isRequestBoundary(line)) {
      break;
    }

    if (!/^Request from\s+/i.test(line)) {
      continue;
    }

    const questName = lines[index - 1] ?? '';
    const completionPercent = parsePercent(lines[index + 1] ?? '');

    if (!questName || META_LINES.has(questName)) {
      warnings.push(`Could not identify the quest title before "${line}".`);
      continue;
    }

    activeRequests.push({
      questKey: toCanonicalItemKey(questName),
      questName,
      npc: line.replace(/^Request from\s+/i, '').trim() || null,
      completionPercent,
    });
  }

  if (
    reportedActiveRequestCount !== null &&
    reportedActiveRequestCount !== activeRequests.length
  ) {
    warnings.push(
      `Active Requests reported ${reportedActiveRequestCount.toLocaleString()} quest${
        reportedActiveRequestCount === 1 ? '' : 's'
      }, but ${activeRequests.length.toLocaleString()} quest${
        activeRequests.length === 1 ? '' : 's'
      } could be parsed.`,
    );
  }

  return {
    activeRequests,
    reportedActiveRequestCount,
    warnings,
  };
}

function parsePlayerGates(lines: string[]): HelpNeededPlayerGates {
  const gates = { ...DEFAULT_GATES };

  lines.forEach((line, index) => {
    const nextLevel = parseLevelLine(lines[index + 1] ?? '');

    if (nextLevel === null) {
      return;
    }

    switch (line.toLowerCase()) {
      case 'farming':
        gates.farmingLevel = nextLevel;
        break;
      case 'fishing':
        gates.fishingLevel = nextLevel;
        break;
      case 'crafting':
        gates.craftingLevel = nextLevel;
        break;
      case 'exploring':
        gates.exploringLevel = nextLevel;
        break;
      case 'cooking':
        gates.cookingLevel = nextLevel;
        break;
      case 'mining':
        gates.miningLevel = nextLevel;
        break;
    }
  });

  const towerIndex = findSectionIndex(lines, /^The Tower$/i);
  if (towerIndex >= 0) {
    for (const line of lines.slice(towerIndex + 1, towerIndex + 5)) {
      const towerLevel = parseLevelLine(line);

      if (towerLevel !== null) {
        gates.towerLevel = towerLevel;
        break;
      }
    }
  }

  return gates;
}

export function parseHelpNeededPaste(rawText: string): HelpNeededPasteParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  const activeRequestResult = parseActiveRequests(lines);

  return {
    activeRequests: activeRequestResult.activeRequests,
    gates: parsePlayerGates(lines),
    reportedActiveRequestCount: activeRequestResult.reportedActiveRequestCount,
    warnings: activeRequestResult.warnings,
  };
}
