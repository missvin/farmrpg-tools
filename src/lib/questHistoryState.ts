import {
  parseCompletedRequestsPaste,
  type CompletedRequestEntry,
  type CompletedRequestsParseSummary,
} from './parseCompletedRequestsPaste';
import type { HelpNeededActiveRequest } from './parseHelpNeededPaste';

export const QUEST_HISTORY_STATE_STORAGE_KEY = 'farmrpg-tools.questHistoryState.v1';

export type QuestHistoryImport = {
  importId: string;
  importedAt: string;
  completedRequests: CompletedRequestEntry[];
  activeRequests: HelpNeededActiveRequest[];
  summary: CompletedRequestsParseSummary;
  warnings: string[];
};

export type QuestHistoryState = {
  schemaVersion: 1;
  imports: QuestHistoryImport[];
};

export const DEFAULT_QUEST_HISTORY_STATE: QuestHistoryState = {
  schemaVersion: 1,
  imports: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
}

function normalizeCompletedRequestEntry(value: unknown): CompletedRequestEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const questKey = normalizeString(value.questKey);
  const questName = normalizeString(value.questName);

  if (!questKey || !questName) {
    return null;
  }

  const rawRequestKind = value.requestKind;
  const requestKind = rawRequestKind === 'main' || rawRequestKind === 'side' ? rawRequestKind : null;

  return {
    questKey,
    questName,
    npc: normalizeNullableString(value.npc),
    requestKind,
    completedAt: normalizeNullableString(value.completedAt),
    completedAtRaw: normalizeNullableString(value.completedAtRaw),
    playerCount: normalizeNullableNumber(value.playerCount),
    completionPercent: normalizeNullableNumber(value.completionPercent),
  };
}

function normalizeActiveRequest(value: unknown): HelpNeededActiveRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const questKey = normalizeString(value.questKey);
  const questName = normalizeString(value.questName);

  if (!questKey || !questName) {
    return null;
  }

  return {
    questKey,
    questName,
    npc: normalizeNullableString(value.npc),
    completionPercent: normalizeNullableNumber(value.completionPercent),
  };
}

function normalizeParseSummary(value: unknown, completedRowsCount: number, activeRowsCount: number, warningCount: number): CompletedRequestsParseSummary {
  if (!isRecord(value)) {
    return {
      reportedCompletedCount: null,
      completedRowsCount,
      activeRowsCount,
      warningCount,
    };
  }

  return {
    reportedCompletedCount: normalizeNullableNumber(value.reportedCompletedCount),
    completedRowsCount: isFiniteNonNegativeNumber(value.completedRowsCount) ? value.completedRowsCount : completedRowsCount,
    activeRowsCount: isFiniteNonNegativeNumber(value.activeRowsCount) ? value.activeRowsCount : activeRowsCount,
    warningCount: isFiniteNonNegativeNumber(value.warningCount) ? value.warningCount : warningCount,
  };
}

function normalizeQuestHistoryImport(value: unknown): QuestHistoryImport | null {
  if (!isRecord(value)) {
    return null;
  }

  const importId = normalizeString(value.importId);
  const importedAt = normalizeString(value.importedAt);

  if (!importId || !importedAt) {
    return null;
  }

  const completedRequests = Array.isArray(value.completedRequests)
    ? value.completedRequests
      .map(normalizeCompletedRequestEntry)
      .filter((entry): entry is CompletedRequestEntry => entry !== null)
    : [];
  const activeRequests = Array.isArray(value.activeRequests)
    ? value.activeRequests
      .map(normalizeActiveRequest)
      .filter((entry): entry is HelpNeededActiveRequest => entry !== null)
    : [];
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((warning): warning is string => typeof warning === 'string')
    : [];

  return {
    importId,
    importedAt,
    completedRequests,
    activeRequests,
    summary: normalizeParseSummary(value.summary, completedRequests.length, activeRequests.length, warnings.length),
    warnings,
  };
}

export function normalizeQuestHistoryState(value: unknown): QuestHistoryState {
  if (!isRecord(value)) {
    return DEFAULT_QUEST_HISTORY_STATE;
  }

  const imports = Array.isArray(value.imports)
    ? value.imports
      .map(normalizeQuestHistoryImport)
      .filter((entry): entry is QuestHistoryImport => entry !== null)
    : [];
  const importsById = new Map<string, QuestHistoryImport>();

  for (const questImport of imports) {
    importsById.set(questImport.importId, questImport);
  }

  return {
    schemaVersion: 1,
    imports: Array.from(importsById.values()).sort((left, right) => {
      return right.importedAt.localeCompare(left.importedAt) || right.importId.localeCompare(left.importId);
    }),
  };
}

export function isValidQuestHistoryState(value: unknown): value is QuestHistoryState {
  if (!isRecord(value)) {
    return false;
  }

  return value.schemaVersion === 1 &&
    Array.isArray(value.imports) &&
    normalizeQuestHistoryState(value).imports.length === value.imports.length;
}

export function createQuestHistoryImport(input: {
  rawText: string;
  importedAt?: string;
  importId?: string;
}): QuestHistoryImport {
  const importedAt = input.importedAt ?? new Date().toISOString();
  const parsedResult = parseCompletedRequestsPaste(input.rawText);

  return {
    importId: input.importId ?? `quest-history-${importedAt}`,
    importedAt,
    completedRequests: parsedResult.completedRequests,
    activeRequests: parsedResult.activeRequests,
    summary: parsedResult.summary,
    warnings: parsedResult.warnings,
  };
}

export function addQuestHistoryImport(state: QuestHistoryState, questImport: QuestHistoryImport): QuestHistoryState {
  return normalizeQuestHistoryState({
    schemaVersion: 1,
    imports: [questImport, ...state.imports.filter((existingImport) => existingImport.importId !== questImport.importId)],
  });
}

export function loadQuestHistoryState(storage: Storage | undefined = globalThis.localStorage): QuestHistoryState {
  if (!storage) {
    return DEFAULT_QUEST_HISTORY_STATE;
  }

  try {
    const rawValue = storage.getItem(QUEST_HISTORY_STATE_STORAGE_KEY);
    return normalizeQuestHistoryState(rawValue ? JSON.parse(rawValue) : null);
  } catch {
    return DEFAULT_QUEST_HISTORY_STATE;
  }
}

export function saveQuestHistoryState(
  state: QuestHistoryState,
  storage: Storage | undefined = globalThis.localStorage,
): QuestHistoryState {
  const normalizedState = normalizeQuestHistoryState(state);

  if (storage) {
    storage.setItem(QUEST_HISTORY_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  }

  return normalizedState;
}

export function clearQuestHistoryState(storage: Storage | undefined = globalThis.localStorage): void {
  storage?.removeItem(QUEST_HISTORY_STATE_STORAGE_KEY);
}
