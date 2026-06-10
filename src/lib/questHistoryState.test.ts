import { describe, expect, it } from 'vitest';

import {
  addQuestHistoryImport,
  createQuestHistoryImport,
  loadQuestHistoryState,
  saveQuestHistoryState,
} from './questHistoryState';

describe('questHistoryState', () => {
  it('creates a normalized quest-history import from pasted Completed Requests text', () => {
    const questImport = createQuestHistoryImport({
      importId: 'import-1',
      importedAt: '2026-06-09T12:00:00.000Z',
      rawText: `
Completed Requests (1)
Rare Quest
Request from Buddy - Side Request
Completed on 2026-06-03 11:19:14
777 players (0.07%) have completed
check
`,
    });

    expect(questImport).toMatchObject({
      importId: 'import-1',
      importedAt: '2026-06-09T12:00:00.000Z',
      summary: {
        reportedCompletedCount: 1,
        completedRowsCount: 1,
        activeRowsCount: 0,
        warningCount: 0,
      },
      completedRequests: [
        {
          questKey: 'rare quest',
          questName: 'Rare Quest',
          npc: 'Buddy',
          requestKind: 'side',
          playerCount: 777,
          completionPercent: 0.07,
        },
      ],
    });
  });

  it('persists imports in newest-first order', () => {
    const storage = window.localStorage;
    storage.clear();

    const olderImport = createQuestHistoryImport({
      importId: 'older',
      importedAt: '2026-06-08T12:00:00.000Z',
      rawText: 'Completed Requests (0)',
    });
    const newerImport = createQuestHistoryImport({
      importId: 'newer',
      importedAt: '2026-06-09T12:00:00.000Z',
      rawText: 'Completed Requests (0)',
    });
    const state = addQuestHistoryImport(addQuestHistoryImport({ schemaVersion: 1, imports: [] }, olderImport), newerImport);

    saveQuestHistoryState(state, storage);

    expect(loadQuestHistoryState(storage).imports.map((questImport) => questImport.importId)).toEqual([
      'newer',
      'older',
    ]);
  });
});
