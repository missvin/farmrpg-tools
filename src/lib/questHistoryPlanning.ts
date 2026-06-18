import type {
  QuestCatalogEntry,
  QuestItemSourceHintEntry,
  QuestReferenceData,
  QuestRequirementEntry,
} from './loadQuestReference';
import { toCanonicalItemKey } from './normalizeItemKey';
import type { CompletedRequestEntry } from './parseCompletedRequestsPaste';
import type { QuestHistoryState } from './questHistoryState';
import type { QuestPlannerState } from './questPlannerState';

export type QuestFutureDemandScope =
  | 'active'
  | 'watched'
  | 'future_chain'
  | 'seasonal'
  | 'all_known_unfinished';

export type QuestlineProgressStatus = 'completed' | 'in_progress' | 'not_started';

export type QuestlineProgressSummary = {
  questlineKey: string;
  questlineName: string;
  aliases: string[];
  totalQuests: number;
  completedQuests: number;
  activeQuests: number;
  watchedQuests: number;
  hiddenQuests: number;
  seasonalQuestCount: number;
  futureQuestCount: number;
  completionPercent: number;
  status: QuestlineProgressStatus;
  nextQuest: QuestCatalogEntry | null;
  rarestCompletedQuest: CompletedRequestEntry | null;
  topFutureDemandRows: QuestFutureDemandRow[];
};

export type QuestFutureDemandRequirement = {
  questKey: string;
  questName: string;
  questlineKey: string;
  questlineName: string;
  quantity: number;
  scope: QuestFutureDemandScope;
};

export type QuestFutureDemandRow = {
  canonicalKey: string;
  itemName: string;
  totalQuantity: number;
  questCount: number;
  requirements: QuestFutureDemandRequirement[];
  scopes: {
    scope: QuestFutureDemandScope;
    quantity: number;
  }[];
  sourceHints: QuestItemSourceHintEntry[];
};

export type QuestlineHeatmapRow = {
  questlineKey: string;
  questlineName: string;
  status: QuestlineProgressStatus;
  completionPercent: number;
  completedQuests: number;
  totalQuests: number;
  nextQuestName: string | null;
  rarestCompletedQuestName: string | null;
  rarestCompletedPercent: number | null;
  topDemandItems: QuestFutureDemandRow[];
};

export type QuestHistoryPlanningAnalytics = {
  completedQuestKeys: Set<string>;
  activeQuestKeys: Set<string>;
  watchedQuestKeys: Set<string>;
  questlineSummaries: QuestlineProgressSummary[];
  completedQuestlines: QuestlineProgressSummary[];
  partialQuestlines: QuestlineProgressSummary[];
  unstartedQuestlines: QuestlineProgressSummary[];
  seasonalQuestlines: QuestlineProgressSummary[];
  futureDemandRows: QuestFutureDemandRow[];
  futureDemandByCanonicalKey: Map<string, QuestFutureDemandRow>;
  heatmapRows: QuestlineHeatmapRow[];
  warnings: string[];
};

type QuestlineGroup = {
  questlineKey: string;
  questlineName: string;
  aliases: string[];
  quests: QuestCatalogEntry[];
};

type QuestStatusIndex = {
  completedQuestKeys: Set<string>;
  activeQuestKeys: Set<string>;
  watchedQuestKeys: Set<string>;
  hiddenQuestKeys: Set<string>;
  latestCompletedByQuestKey: Map<string, CompletedRequestEntry>;
};

function getLatestImport(state: QuestHistoryState) {
  return state.imports[0] ?? null;
}

function isExplicitSeasonalOrEventQuest(quest: QuestCatalogEntry): boolean {
  return /\b(seasonal|holiday|event|quest end date)\b/i.test(quest.notes.join(' '));
}

function compareRarity(left: CompletedRequestEntry, right: CompletedRequestEntry): number {
  const leftPercent = left.completionPercent ?? Number.POSITIVE_INFINITY;
  const rightPercent = right.completionPercent ?? Number.POSITIVE_INFINITY;

  if (leftPercent !== rightPercent) {
    return leftPercent - rightPercent;
  }

  const leftPlayers = left.playerCount ?? Number.POSITIVE_INFINITY;
  const rightPlayers = right.playerCount ?? Number.POSITIVE_INFINITY;

  if (leftPlayers !== rightPlayers) {
    return leftPlayers - rightPlayers;
  }

  return left.questName.localeCompare(right.questName);
}

function buildQuestStatusIndex(
  state: QuestHistoryState,
  questPlannerState: QuestPlannerState | null,
): QuestStatusIndex {
  const latestImport = getLatestImport(state);
  const completedQuestKeys = new Set<string>();
  const activeQuestKeys = new Set<string>();
  const watchedQuestKeys = new Set<string>();
  const hiddenQuestKeys = new Set<string>();
  const latestCompletedByQuestKey = new Map<string, CompletedRequestEntry>();

  for (const completedRequest of latestImport?.completedRequests ?? []) {
    const questKey = toCanonicalItemKey(completedRequest.questKey);
    completedQuestKeys.add(questKey);
    latestCompletedByQuestKey.set(questKey, completedRequest);
  }

  for (const questState of questPlannerState?.questStates ?? []) {
    if (questState.hidden) {
      hiddenQuestKeys.add(questState.questKey);
    }

    if (questState.status === 'completed') {
      completedQuestKeys.add(questState.questKey);
    } else if (questState.status === 'active') {
      activeQuestKeys.add(questState.questKey);
    } else if (questState.status === 'watched') {
      watchedQuestKeys.add(questState.questKey);
    }
  }

  return {
    completedQuestKeys,
    activeQuestKeys,
    watchedQuestKeys,
    hiddenQuestKeys,
    latestCompletedByQuestKey,
  };
}

function groupQuestsByQuestline(referenceData: QuestReferenceData): QuestlineGroup[] {
  const groupsByQuestlineKey = new Map<string, QuestlineGroup>();

  for (const quest of referenceData.quests) {
    const group = groupsByQuestlineKey.get(quest.questlineKey) ?? {
      questlineKey: quest.questlineKey,
      questlineName: quest.questlineName,
      aliases: quest.questlineAliases,
      quests: [],
    };

    group.quests.push(quest);
    groupsByQuestlineKey.set(quest.questlineKey, group);
  }

  return Array.from(groupsByQuestlineKey.values()).sort((left, right) => {
    return left.questlineName.localeCompare(right.questlineName);
  });
}

function getRequirementScope(
  quest: QuestCatalogEntry,
  statusIndex: QuestStatusIndex,
  lineHasProgress: boolean,
): QuestFutureDemandScope {
  if (statusIndex.activeQuestKeys.has(quest.questKey)) {
    return 'active';
  }

  if (statusIndex.watchedQuestKeys.has(quest.questKey)) {
    return 'watched';
  }

  if (isExplicitSeasonalOrEventQuest(quest)) {
    return 'seasonal';
  }

  if (lineHasProgress) {
    return 'future_chain';
  }

  return 'all_known_unfinished';
}

function mergeDemandRow(
  rowsByCanonicalKey: Map<string, QuestFutureDemandRow>,
  requirement: QuestRequirementEntry,
  quest: QuestCatalogEntry,
  scope: QuestFutureDemandScope,
  referenceData: QuestReferenceData,
): void {
  const canonicalKey = toCanonicalItemKey(requirement.canonicalKey);

  if (!canonicalKey || requirement.quantity <= 0) {
    return;
  }

  const currentRow = rowsByCanonicalKey.get(canonicalKey) ?? {
    canonicalKey,
    itemName: requirement.itemName,
    totalQuantity: 0,
    questCount: 0,
    requirements: [],
    scopes: [],
    sourceHints: referenceData.sourceHintsByCanonicalKey[canonicalKey] ?? [],
  };

  currentRow.requirements.push({
    questKey: quest.questKey,
    questName: quest.questName,
    questlineKey: quest.questlineKey,
    questlineName: quest.questlineName,
    quantity: requirement.quantity,
    scope,
  });
  currentRow.totalQuantity += requirement.quantity;
  currentRow.questCount = new Set(currentRow.requirements.map((row) => row.questKey)).size;

  const currentScope = currentRow.scopes.find((row) => row.scope === scope);

  if (currentScope) {
    currentScope.quantity += requirement.quantity;
  } else {
    currentRow.scopes.push({
      scope,
      quantity: requirement.quantity,
    });
  }

  currentRow.scopes.sort((left, right) => {
    return right.quantity - left.quantity || left.scope.localeCompare(right.scope);
  });
  currentRow.requirements.sort((left, right) => {
    return right.quantity - left.quantity || left.questName.localeCompare(right.questName);
  });

  rowsByCanonicalKey.set(canonicalKey, currentRow);
}

function buildFutureDemandRows(
  referenceData: QuestReferenceData,
  statusIndex: QuestStatusIndex,
  groups: QuestlineGroup[],
): QuestFutureDemandRow[] {
  const rowsByCanonicalKey = new Map<string, QuestFutureDemandRow>();

  for (const group of groups) {
    const lineHasProgress = group.quests.some((quest) => {
      return (
        statusIndex.completedQuestKeys.has(quest.questKey) ||
        statusIndex.activeQuestKeys.has(quest.questKey) ||
        statusIndex.watchedQuestKeys.has(quest.questKey)
      );
    });

    for (const quest of group.quests) {
      if (statusIndex.completedQuestKeys.has(quest.questKey)) {
        continue;
      }

      const scope = getRequirementScope(quest, statusIndex, lineHasProgress);

      for (const requirement of referenceData.requirementsByQuestKey[quest.questKey] ?? []) {
        mergeDemandRow(rowsByCanonicalKey, requirement, quest, scope, referenceData);
      }
    }
  }

  return Array.from(rowsByCanonicalKey.values()).sort((left, right) => {
    return right.totalQuantity - left.totalQuantity || left.itemName.localeCompare(right.itemName);
  });
}

function buildQuestlineSummaries(
  groups: QuestlineGroup[],
  statusIndex: QuestStatusIndex,
  futureDemandRows: QuestFutureDemandRow[],
): QuestlineProgressSummary[] {
  return groups
    .map((group) => {
      const completedQuests = group.quests.filter((quest) => statusIndex.completedQuestKeys.has(quest.questKey));
      const activeQuests = group.quests.filter((quest) => statusIndex.activeQuestKeys.has(quest.questKey));
      const watchedQuests = group.quests.filter((quest) => statusIndex.watchedQuestKeys.has(quest.questKey));
      const hiddenQuests = group.quests.filter((quest) => statusIndex.hiddenQuestKeys.has(quest.questKey));
      const seasonalQuestCount = group.quests.filter(isExplicitSeasonalOrEventQuest).length;
      const nextQuest = group.quests.find((quest) => !statusIndex.completedQuestKeys.has(quest.questKey)) ?? null;
      const rarestCompletedQuest =
        completedQuests
          .map((quest) => statusIndex.latestCompletedByQuestKey.get(quest.questKey))
          .filter((quest): quest is CompletedRequestEntry => Boolean(quest))
          .sort(compareRarity)[0] ?? null;
      const topFutureDemandRows = futureDemandRows
        .map((row) => {
          const requirements = row.requirements.filter((requirement) => requirement.questlineKey === group.questlineKey);
          const totalQuantity = requirements.reduce((sum, requirement) => sum + requirement.quantity, 0);
          const scopeQuantities = new Map<QuestFutureDemandScope, number>();

          for (const requirement of requirements) {
            scopeQuantities.set(requirement.scope, (scopeQuantities.get(requirement.scope) ?? 0) + requirement.quantity);
          }

          return {
            ...row,
            totalQuantity,
            questCount: new Set(requirements.map((requirement) => requirement.questKey)).size,
            requirements,
            scopes: Array.from(scopeQuantities.entries())
              .map(([scope, quantity]) => ({ scope, quantity }))
              .sort((left, right) => right.quantity - left.quantity || left.scope.localeCompare(right.scope)),
          };
        })
        .filter((row) => row.totalQuantity > 0)
        .sort((left, right) => right.totalQuantity - left.totalQuantity || left.itemName.localeCompare(right.itemName))
        .slice(0, 3);
      const progressCount = completedQuests.length + activeQuests.length + watchedQuests.length;
      const status: QuestlineProgressStatus =
        completedQuests.length === group.quests.length
          ? 'completed'
          : progressCount > 0
            ? 'in_progress'
            : 'not_started';

      return {
        questlineKey: group.questlineKey,
        questlineName: group.questlineName,
        aliases: group.aliases,
        totalQuests: group.quests.length,
        completedQuests: completedQuests.length,
        activeQuests: activeQuests.length,
        watchedQuests: watchedQuests.length,
        hiddenQuests: hiddenQuests.length,
        seasonalQuestCount,
        futureQuestCount: Math.max(0, group.quests.length - completedQuests.length),
        completionPercent: group.quests.length > 0 ? (completedQuests.length / group.quests.length) * 100 : 0,
        status,
        nextQuest,
        rarestCompletedQuest,
        topFutureDemandRows,
      };
    })
    .sort((left, right) => {
      if (left.status !== right.status) {
        const statusRank: Record<QuestlineProgressStatus, number> = {
          in_progress: 0,
          not_started: 1,
          completed: 2,
        };
        return statusRank[left.status] - statusRank[right.status];
      }

      return right.completionPercent - left.completionPercent || left.questlineName.localeCompare(right.questlineName);
    });
}

function buildHeatmapRows(summaries: QuestlineProgressSummary[]): QuestlineHeatmapRow[] {
  return summaries.map((summary) => ({
    questlineKey: summary.questlineKey,
    questlineName: summary.questlineName,
    status: summary.status,
    completionPercent: summary.completionPercent,
    completedQuests: summary.completedQuests,
    totalQuests: summary.totalQuests,
    nextQuestName: summary.nextQuest?.questName ?? null,
    rarestCompletedQuestName: summary.rarestCompletedQuest?.questName ?? null,
    rarestCompletedPercent: summary.rarestCompletedQuest?.completionPercent ?? null,
    topDemandItems: summary.topFutureDemandRows,
  }));
}

export function getQuestFutureDemandScopeLabel(scope: QuestFutureDemandScope): string {
  switch (scope) {
    case 'active':
      return 'Active';
    case 'watched':
      return 'Watched';
    case 'future_chain':
      return 'Future chain';
    case 'seasonal':
      return 'Seasonal/event';
    case 'all_known_unfinished':
      return 'All known unfinished';
  }
}

export function deriveQuestHistoryPlanningAnalytics({
  state,
  questPlannerState = null,
  referenceData,
}: {
  state: QuestHistoryState;
  questPlannerState?: QuestPlannerState | null;
  referenceData: QuestReferenceData;
}): QuestHistoryPlanningAnalytics {
  const statusIndex = buildQuestStatusIndex(state, questPlannerState);
  const groups = groupQuestsByQuestline(referenceData);
  const futureDemandRows = buildFutureDemandRows(referenceData, statusIndex, groups);
  const futureDemandByCanonicalKey = new Map(
    futureDemandRows.map((row) => [row.canonicalKey, row]),
  );
  const questlineSummaries = buildQuestlineSummaries(groups, statusIndex, futureDemandRows);
  const completedQuestlines = questlineSummaries.filter((summary) => summary.status === 'completed');
  const partialQuestlines = questlineSummaries.filter((summary) => summary.status === 'in_progress');
  const unstartedQuestlines = questlineSummaries.filter((summary) => summary.status === 'not_started');
  const seasonalQuestlines = questlineSummaries.filter((summary) => summary.seasonalQuestCount > 0);
  const warnings: string[] = [];

  if (state.imports.length === 0 && (questPlannerState?.questStates.length ?? 0) === 0) {
    warnings.push('Import completed quests or mark quests complete in Quest Planner to personalize questline progress.');
  }

  if (seasonalQuestlines.length === 0) {
    warnings.push('No reviewed seasonal/event quest metadata is available in the local quest catalog yet.');
  }

  return {
    completedQuestKeys: statusIndex.completedQuestKeys,
    activeQuestKeys: statusIndex.activeQuestKeys,
    watchedQuestKeys: statusIndex.watchedQuestKeys,
    questlineSummaries,
    completedQuestlines,
    partialQuestlines,
    unstartedQuestlines,
    seasonalQuestlines,
    futureDemandRows,
    futureDemandByCanonicalKey,
    heatmapRows: buildHeatmapRows(questlineSummaries),
    warnings,
  };
}
