import type { QuestReferenceData } from './loadQuestReference';
import type { CompletedRequestEntry } from './parseCompletedRequestsPaste';
import type { QuestHistoryImport, QuestHistoryState } from './questHistoryState';

export type QuestHistoryRarityRow = CompletedRequestEntry & {
  questlineName: string | null;
};

export type QuestHistoryPopulationDelta = {
  questKey: string;
  questName: string;
  questlineName: string | null;
  previousPlayerCount: number | null;
  latestPlayerCount: number | null;
  playerCountDelta: number | null;
  previousCompletionPercent: number | null;
  latestCompletionPercent: number | null;
  completionPercentDelta: number | null;
};

export type QuestHistoryAnalytics = {
  latestImport: QuestHistoryImport | null;
  previousImport: QuestHistoryImport | null;
  rarestCompletedQuests: QuestHistoryRarityRow[];
  newlyObservedCompletions: QuestHistoryRarityRow[];
  populationDeltas: QuestHistoryPopulationDelta[];
  fastestMovingQuests: QuestHistoryPopulationDelta[];
};

function getQuestlineName(referenceData: QuestReferenceData | null | undefined, questKey: string): string | null {
  return referenceData?.questsByKey[questKey]?.questlineName ?? null;
}

function toRarityRow(
  request: CompletedRequestEntry,
  referenceData: QuestReferenceData | null | undefined,
): QuestHistoryRarityRow {
  return {
    ...request,
    questlineName: getQuestlineName(referenceData, request.questKey),
  };
}

function compareRarest(left: QuestHistoryRarityRow, right: QuestHistoryRarityRow): number {
  const leftCount = left.playerCount ?? Number.POSITIVE_INFINITY;
  const rightCount = right.playerCount ?? Number.POSITIVE_INFINITY;

  if (leftCount !== rightCount) {
    return leftCount - rightCount;
  }

  const leftPercent = left.completionPercent ?? Number.POSITIVE_INFINITY;
  const rightPercent = right.completionPercent ?? Number.POSITIVE_INFINITY;

  if (leftPercent !== rightPercent) {
    return leftPercent - rightPercent;
  }

  return left.questName.localeCompare(right.questName);
}

function buildRequestMap(questImport: QuestHistoryImport | null): Map<string, CompletedRequestEntry> {
  const lookup = new Map<string, CompletedRequestEntry>();

  for (const request of questImport?.completedRequests ?? []) {
    lookup.set(request.questKey, request);
  }

  return lookup;
}

function subtractNullableNumbers(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right;
}

export function deriveQuestHistoryAnalytics(
  state: QuestHistoryState,
  referenceData?: QuestReferenceData | null,
): QuestHistoryAnalytics {
  const latestImport = state.imports[0] ?? null;
  const previousImport = state.imports[1] ?? null;
  const previousRequestsByKey = buildRequestMap(previousImport);
  const rarestCompletedQuests = (latestImport?.completedRequests ?? [])
    .map((request) => toRarityRow(request, referenceData))
    .sort(compareRarest);
  const newlyObservedCompletions = rarestCompletedQuests.filter((request) => {
    return !previousRequestsByKey.has(request.questKey);
  });
  const populationDeltas = (latestImport?.completedRequests ?? [])
    .map((latestRequest): QuestHistoryPopulationDelta => {
      const previousRequest = previousRequestsByKey.get(latestRequest.questKey) ?? null;

      return {
        questKey: latestRequest.questKey,
        questName: latestRequest.questName,
        questlineName: getQuestlineName(referenceData, latestRequest.questKey),
        previousPlayerCount: previousRequest?.playerCount ?? null,
        latestPlayerCount: latestRequest.playerCount,
        playerCountDelta: subtractNullableNumbers(latestRequest.playerCount, previousRequest?.playerCount ?? null),
        previousCompletionPercent: previousRequest?.completionPercent ?? null,
        latestCompletionPercent: latestRequest.completionPercent,
        completionPercentDelta: subtractNullableNumbers(
          latestRequest.completionPercent,
          previousRequest?.completionPercent ?? null,
        ),
      };
    })
    .sort((left, right) => left.questName.localeCompare(right.questName));
  const fastestMovingQuests = populationDeltas
    .filter((delta) => delta.playerCountDelta !== null)
    .sort((left, right) => {
      return (right.playerCountDelta ?? 0) - (left.playerCountDelta ?? 0) || left.questName.localeCompare(right.questName);
    });

  return {
    latestImport,
    previousImport,
    rarestCompletedQuests,
    newlyObservedCompletions,
    populationDeltas,
    fastestMovingQuests,
  };
}
