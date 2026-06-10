import { parseHelpNeededPaste, type HelpNeededActiveRequest } from './parseHelpNeededPaste';
import { toCanonicalItemKey } from './normalizeItemKey';

export type CompletedRequestKind = 'main' | 'side' | null;

export type CompletedRequestEntry = {
  questKey: string;
  questName: string;
  npc: string | null;
  requestKind: CompletedRequestKind;
  completedAt: string | null;
  completedAtRaw: string | null;
  playerCount: number | null;
  completionPercent: number | null;
};

export type CompletedRequestsParseSummary = {
  reportedCompletedCount: number | null;
  completedRowsCount: number;
  activeRowsCount: number;
  warningCount: number;
};

export type CompletedRequestsPasteParseResult = {
  completedRequests: CompletedRequestEntry[];
  activeRequests: HelpNeededActiveRequest[];
  summary: CompletedRequestsParseSummary;
  warnings: string[];
};

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function parseOptionalPercent(value: string): number | null {
  const match = /\((\d+(?:\.\d+)?)%\)/.exec(value);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[1]);
  return Number.isFinite(parsedValue) ? Math.max(0, Math.min(100, parsedValue)) : null;
}

function parseOptionalPlayerCount(value: string): number | null {
  const match = /^([\d,]+)\s+players\b/i.exec(value.trim());

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function parseCompletedAt(value: string): { completedAt: string | null; completedAtRaw: string | null } {
  const match = /^Completed on\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/i.exec(value.trim());

  if (!match) {
    return {
      completedAt: null,
      completedAtRaw: null,
    };
  }

  return {
    completedAt: `${match[1]}T${match[2]}`,
    completedAtRaw: `${match[1]} ${match[2]}`,
  };
}

function parseReportedCompletedCount(line: string): number | null {
  const match = /^Completed Requests\s*\(([\d,]+)\)/i.exec(line);

  if (!match) {
    return null;
  }

  const parsedCount = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : null;
}

function parseRequestFromLine(value: string): { npc: string | null; requestKind: CompletedRequestKind } | null {
  const match = /^Request from\s+(.+?)(?:\s+-\s+(Main Quest|Side Request))?$/i.exec(value.trim());

  if (!match) {
    return null;
  }

  const npc = match[1].trim() || null;
  const rawKind = match[2]?.toLowerCase() ?? null;
  const requestKind = rawKind === 'main quest' ? 'main' : rawKind === 'side request' ? 'side' : null;

  return {
    npc,
    requestKind,
  };
}

function isCompletedRequestsBoundary(line: string): boolean {
  return /^(Consume a meal|Active Requests|Personal Requests|Request Totals|Community Center|Favorite Library Pages|Most Recent Update|Other Stuff)\b/i.test(line);
}

function findCompletedRequestsStart(lines: string[]): number {
  return lines.findIndex((line) => /^Completed Requests\b/i.test(line));
}

export function parseCompletedRequestsPaste(rawText: string): CompletedRequestsPasteParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  const warnings: string[] = [];
  const completedRequests: CompletedRequestEntry[] = [];
  const activeRequests = parseHelpNeededPaste(rawText).activeRequests;
  const startIndex = findCompletedRequestsStart(lines);
  const reportedCompletedCount = startIndex >= 0 ? parseReportedCompletedCount(lines[startIndex]) : null;

  if (startIndex < 0) {
    warnings.push('No Completed Requests section was found in the pasted text.');

    return {
      completedRequests,
      activeRequests,
      summary: {
        reportedCompletedCount,
        completedRowsCount: 0,
        activeRowsCount: activeRequests.length,
        warningCount: warnings.length,
      },
      warnings,
    };
  }

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (isCompletedRequestsBoundary(line)) {
      break;
    }

    const requestFrom = parseRequestFromLine(line);

    if (!requestFrom) {
      continue;
    }

    const questName = lines[index - 1] === 'check' ? '' : (lines[index - 1] ?? '');
    const completedAtLine = lines[index + 1] ?? '';
    const populationLine = lines[index + 2] ?? '';
    const completedAt = parseCompletedAt(completedAtLine);
    const playerCount = parseOptionalPlayerCount(populationLine);
    const completionPercent = parseOptionalPercent(populationLine);

    if (!questName) {
      warnings.push(`Could not identify the completed quest title before "${line}".`);
      continue;
    }

    if (!completedAt.completedAt) {
      warnings.push(`Could not parse completion timestamp for "${questName}".`);
    }

    if (playerCount === null || completionPercent === null) {
      warnings.push(`Could not parse completion population for "${questName}".`);
    }

    completedRequests.push({
      questKey: toCanonicalItemKey(questName),
      questName,
      npc: requestFrom.npc,
      requestKind: requestFrom.requestKind,
      completedAt: completedAt.completedAt,
      completedAtRaw: completedAt.completedAtRaw,
      playerCount,
      completionPercent,
    });
  }

  return {
    completedRequests,
    activeRequests,
    summary: {
      reportedCompletedCount,
      completedRowsCount: completedRequests.length,
      activeRowsCount: activeRequests.length,
      warningCount: warnings.length,
    },
    warnings,
  };
}
