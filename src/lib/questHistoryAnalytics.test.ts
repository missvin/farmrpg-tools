import { describe, expect, it } from 'vitest';

import type { QuestReferenceData } from './loadQuestReference';
import { deriveQuestHistoryAnalytics } from './questHistoryAnalytics';
import type { QuestHistoryState } from './questHistoryState';

const referenceData = {
  questsByKey: {
    'rare quest': {
      questlineName: 'Rare Line',
    },
    'moving quest': {
      questlineName: 'Mover Line',
    },
  },
} as QuestReferenceData;

const state: QuestHistoryState = {
  schemaVersion: 1,
  imports: [
    {
      importId: 'latest',
      importedAt: '2026-06-09T12:00:00.000Z',
      activeRequests: [],
      warnings: [],
      summary: {
        reportedCompletedCount: 2,
        completedRowsCount: 2,
        activeRowsCount: 0,
        warningCount: 0,
      },
      completedRequests: [
        {
          questKey: 'moving quest',
          questName: 'Moving Quest',
          npc: 'Buddy',
          requestKind: null,
          completedAt: '2026-06-09T11:00:00',
          completedAtRaw: '2026-06-09 11:00:00',
          playerCount: 1500,
          completionPercent: 1.5,
        },
        {
          questKey: 'rare quest',
          questName: 'Rare Quest',
          npc: 'Buddy',
          requestKind: null,
          completedAt: '2026-06-08T11:00:00',
          completedAtRaw: '2026-06-08 11:00:00',
          playerCount: 900,
          completionPercent: 0.08,
        },
      ],
    },
    {
      importId: 'previous',
      importedAt: '2026-06-08T12:00:00.000Z',
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
          questKey: 'moving quest',
          questName: 'Moving Quest',
          npc: 'Buddy',
          requestKind: null,
          completedAt: '2026-06-08T11:00:00',
          completedAtRaw: '2026-06-08 11:00:00',
          playerCount: 1200,
          completionPercent: 1.2,
        },
      ],
    },
  ],
};

describe('deriveQuestHistoryAnalytics', () => {
  it('derives rarest completions, newly observed completions, and population movement', () => {
    const analytics = deriveQuestHistoryAnalytics(state, referenceData);

    expect(analytics.rarestCompletedQuests.map((row) => row.questName)).toEqual([
      'Rare Quest',
      'Moving Quest',
    ]);
    expect(analytics.rarestCompletedQuests[0]).toMatchObject({
      questlineName: 'Rare Line',
      playerCount: 900,
    });
    expect(analytics.newlyObservedCompletions.map((row) => row.questName)).toEqual(['Rare Quest']);
    expect(analytics.fastestMovingQuests).toEqual([
      expect.objectContaining({
        questName: 'Moving Quest',
        previousPlayerCount: 1200,
        latestPlayerCount: 1500,
        playerCountDelta: 300,
        completionPercentDelta: 0.30000000000000004,
      }),
    ]);
  });
});
