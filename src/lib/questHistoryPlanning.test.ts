import { describe, expect, it } from 'vitest';

import type { QuestReferenceData } from './loadQuestReference';
import { deriveQuestHistoryPlanningAnalytics, getQuestFutureDemandScopeLabel } from './questHistoryPlanning';
import type { QuestHistoryState } from './questHistoryState';
import type { QuestPlannerState } from './questPlannerState';

const referenceData = {
  quests: [
    {
      questKey: 'distant illusions xii',
      questName: 'Distant Illusions XII',
      questlineKey: 'distant illusions',
      questlineName: 'Distant Illusions',
      questlineAliases: ['DI'],
      stageLabel: 'XII',
      npc: 'Buddy',
      farmingLevel: null,
      fishingLevel: null,
      craftingLevel: null,
      exploringLevel: null,
      towerLevel: null,
      previousQuestKey: null,
      nextQuestKeys: ['distant illusions xiii'],
      sourceUrl: '',
      coverageStatus: 'reviewed',
      notes: [],
    },
    {
      questKey: 'distant illusions xiii',
      questName: 'Distant Illusions XIII',
      questlineKey: 'distant illusions',
      questlineName: 'Distant Illusions',
      questlineAliases: ['DI'],
      stageLabel: 'XIII',
      npc: 'Buddy',
      farmingLevel: null,
      fishingLevel: null,
      craftingLevel: null,
      exploringLevel: null,
      towerLevel: null,
      previousQuestKey: 'distant illusions xii',
      nextQuestKeys: [],
      sourceUrl: '',
      coverageStatus: 'reviewed',
      notes: [],
    },
    {
      questKey: 'green initiative i',
      questName: 'Green Initiative I',
      questlineKey: 'green initiative',
      questlineName: 'Green Initiative',
      questlineAliases: [],
      stageLabel: 'I',
      npc: 'Buddy',
      farmingLevel: null,
      fishingLevel: null,
      craftingLevel: null,
      exploringLevel: null,
      towerLevel: null,
      previousQuestKey: null,
      nextQuestKeys: [],
      sourceUrl: '',
      coverageStatus: 'reviewed',
      notes: ['Quest end date: 2026-03-17T04:59:59+00:00'],
    },
  ],
  questsByKey: {},
  requirementsByQuestKey: {
    'distant illusions xiii': [
      {
        questKey: 'distant illusions xiii',
        requirementType: 'item',
        itemName: 'Frost Snapper Shell',
        canonicalKey: 'frost snapper shell',
        quantity: 15000,
        sourceUrl: '',
        notes: '',
      },
    ],
    'green initiative i': [
      {
        questKey: 'green initiative i',
        requirementType: 'item',
        itemName: 'Green Dye',
        canonicalKey: 'green dye',
        quantity: 50,
        sourceUrl: '',
        notes: '',
      },
    ],
  },
  rewardsByQuestKey: {},
  sourceHintsByCanonicalKey: {
    'frost snapper shell': [
      {
        itemName: 'Frost Snapper Shell',
        canonicalKey: 'frost snapper shell',
        sourceName: 'Large Net',
        sourceCanonicalKey: 'large net',
        sourceType: 'fishing',
        preferredUnit: 'large_net',
        sourceUrl: '',
        notes: '',
      },
    ],
  },
} as QuestReferenceData;

const historyState: QuestHistoryState = {
  schemaVersion: 1,
  imports: [
    {
      importId: 'latest',
      importedAt: '2026-06-09T12:00:00.000Z',
      activeRequests: [],
      warnings: [],
      summary: {
        reportedCompletedCount: 1,
        completedRowsCount: 1,
        activeRowsCount: 0,
        warningCount: 0,
      },
      completedRequests: [
        {
          questKey: 'distant illusions xii',
          questName: 'Distant Illusions XII',
          npc: 'Buddy',
          requestKind: null,
          completedAt: '2026-06-09T11:00:00',
          completedAtRaw: '2026-06-09 11:00:00',
          playerCount: 1200,
          completionPercent: 1.2,
        },
      ],
    },
  ],
};

describe('deriveQuestHistoryPlanningAnalytics', () => {
  it('derives questline progress and future chain item demand from completed history', () => {
    const analytics = deriveQuestHistoryPlanningAnalytics({
      state: historyState,
      referenceData,
    });

    expect(analytics.partialQuestlines.map((row) => row.questlineName)).toContain('Distant Illusions');
    expect(analytics.questlineSummaries.find((row) => row.questlineName === 'Distant Illusions')).toMatchObject({
      completedQuests: 1,
      totalQuests: 2,
      futureQuestCount: 1,
      nextQuest: expect.objectContaining({ questName: 'Distant Illusions XIII' }),
    });
    expect(analytics.futureDemandByCanonicalKey.get('frost snapper shell')).toMatchObject({
      itemName: 'Frost Snapper Shell',
      totalQuantity: 15000,
      questCount: 1,
      requirements: [
        expect.objectContaining({
          questName: 'Distant Illusions XIII',
          scope: 'future_chain',
        }),
      ],
      sourceHints: [
        expect.objectContaining({
          sourceName: 'Large Net',
        }),
      ],
    });
  });

  it('includes manual active and watched quest states in demand scopes', () => {
    const questPlannerState: QuestPlannerState = {
      schemaVersion: 1,
      questStates: [
        {
          questKey: 'green initiative i',
          status: 'watched',
          hidden: false,
          observedNpc: null,
          observedCompletionPercent: null,
          lastObservedAt: null,
        },
      ],
    };

    const analytics = deriveQuestHistoryPlanningAnalytics({
      state: historyState,
      questPlannerState,
      referenceData,
    });

    expect(analytics.watchedQuestKeys.has('green initiative i')).toBe(true);
    expect(analytics.futureDemandByCanonicalKey.get('green dye')?.requirements[0]).toMatchObject({
      questName: 'Green Initiative I',
      scope: 'watched',
    });
  });

  it('supports explicit seasonal/event metadata without title guessing', () => {
    const analytics = deriveQuestHistoryPlanningAnalytics({
      state: { schemaVersion: 1, imports: [] },
      referenceData,
    });

    expect(analytics.seasonalQuestlines.map((row) => row.questlineName)).toContain('Green Initiative');
    expect(getQuestFutureDemandScopeLabel('seasonal')).toBe('Seasonal/event');
  });
});
