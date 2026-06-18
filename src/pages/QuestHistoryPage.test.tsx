import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { QuestReferenceData } from '../lib/loadQuestReference';
import { QUEST_HISTORY_STATE_STORAGE_KEY } from '../lib/questHistoryState';
import { QuestHistoryPage } from './QuestHistoryPage';

const loadQuestReferenceMock = vi.fn();

vi.mock('../lib/loadQuestReference', async () => {
  const actual = await vi.importActual<typeof import('../lib/loadQuestReference')>('../lib/loadQuestReference');

  return {
    ...actual,
    loadQuestReference: (...args: unknown[]) => loadQuestReferenceMock(...args),
  };
});

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
  },
  rewardsByQuestKey: {},
  sourceHintsByCanonicalKey: {},
} as QuestReferenceData;

describe('QuestHistoryPage', () => {
  afterEach(() => {
    window.localStorage.removeItem(QUEST_HISTORY_STATE_STORAGE_KEY);
    loadQuestReferenceMock.mockReset();
  });

  it('renders saved quest history, questline progress, and future demand', async () => {
    loadQuestReferenceMock.mockResolvedValue(referenceData);
    window.localStorage.setItem(
      QUEST_HISTORY_STATE_STORAGE_KEY,
      JSON.stringify({
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
      }),
    );

    render(
      <MemoryRouter>
        <QuestHistoryPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadQuestReferenceMock).toHaveBeenCalled());

    expect(await screen.findByRole('heading', { name: 'Quest History Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByText('Frost Snapper Shell').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Distant Illusions XIII').length).toBeGreaterThan(0);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });
});
