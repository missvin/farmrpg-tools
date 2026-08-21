import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACQUISITION_PLANNER_STATE_STORAGE_KEY,
  createDefaultAcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import type { QuestReferenceData } from '../lib/loadQuestReference';
import { QUEST_HISTORY_STATE_STORAGE_KEY } from '../lib/questHistoryState';
import { QuestHistoryPage } from './QuestHistoryPage';

const loadQuestReferenceMock = vi.fn();
const loadRecipeGraphMock = vi.fn();

vi.mock('../lib/loadQuestReference', async () => {
  const actual = await vi.importActual<typeof import('../lib/loadQuestReference')>('../lib/loadQuestReference');

  return {
    ...actual,
    loadQuestReference: (...args: unknown[]) => loadQuestReferenceMock(...args),
  };
});

vi.mock('../lib/loadRecipeGraph', async () => {
  const actual = await vi.importActual<typeof import('../lib/loadRecipeGraph')>('../lib/loadRecipeGraph');

  return {
    ...actual,
    loadRecipeGraph: (...args: unknown[]) => loadRecipeGraphMock(...args),
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
  beforeEach(() => {
    loadRecipeGraphMock.mockResolvedValue({
      recipes: [],
      byOutputCanonicalKey: {},
      byInputCanonicalKey: {},
      craftRecipes: [],
      cookingRecipes: [],
    });
  });

  afterEach(() => {
    window.localStorage.removeItem(QUEST_HISTORY_STATE_STORAGE_KEY);
    window.localStorage.removeItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY);
    loadQuestReferenceMock.mockReset();
    loadRecipeGraphMock.mockReset();
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

  it('shows unfinished meal demand and expands ingredients after current inventory is applied', async () => {
    const user = userEvent.setup();
    const mealReferenceData = {
      quests: [
        {
          questKey: 'meal quest',
          questName: 'Meal Quest',
          questlineKey: 'meal line',
          questlineName: 'Meal Line',
          questlineAliases: [],
          stageLabel: null,
          npc: 'Mariya',
          farmingLevel: null,
          fishingLevel: null,
          craftingLevel: null,
          exploringLevel: null,
          towerLevel: null,
          previousQuestKey: null,
          nextQuestKeys: [],
          sourceUrl: '',
          coverageStatus: 'reviewed',
          notes: [],
        },
      ],
      questsByKey: {},
      requirementsByQuestKey: {
        'meal quest': [
          {
            questKey: 'meal quest',
            requirementType: 'item',
            itemName: 'Breakfast Boost',
            canonicalKey: 'breakfast boost',
            quantity: 10,
            sourceUrl: '',
            notes: [],
          },
        ],
      },
      rewardsByQuestKey: {},
      sourceHintsByCanonicalKey: {},
    } as QuestReferenceData;
    const acquisitionState = createDefaultAcquisitionPlannerInputState();
    acquisitionState.inventory.entries = [
      { canonicalItemKey: 'breakfast boost', itemName: 'Breakfast Boost', inventoryCount: 4 },
      { canonicalItemKey: 'corn', itemName: 'Corn', inventoryCount: 3 },
    ];

    loadQuestReferenceMock.mockResolvedValue(mealReferenceData);
    loadRecipeGraphMock.mockResolvedValue({
      recipes: [
        {
          outputItemName: 'Breakfast Boost',
          outputCanonicalKey: 'breakfast boost',
          recipeType: 'cooking',
          recipeBookItemName: "Lorn's Breakfast Boost",
          recipeBookCanonicalKey: "lorn's breakfast boost",
          cookingLevel: '40',
          baseTime: '2h',
          sourceBuddyUrl: '',
          inputs: [{ inputOrder: 1, itemName: 'Corn', canonicalKey: 'corn', quantity: 2 }],
        },
      ],
      byOutputCanonicalKey: {
        'breakfast boost': {
          outputItemName: 'Breakfast Boost',
          outputCanonicalKey: 'breakfast boost',
          recipeType: 'cooking',
          recipeBookItemName: "Lorn's Breakfast Boost",
          recipeBookCanonicalKey: "lorn's breakfast boost",
          cookingLevel: '40',
          baseTime: '2h',
          sourceBuddyUrl: '',
          inputs: [{ inputOrder: 1, itemName: 'Corn', canonicalKey: 'corn', quantity: 2 }],
        },
      },
      byInputCanonicalKey: {},
      craftRecipes: [],
      cookingRecipes: [],
    });
    window.localStorage.setItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY, JSON.stringify(acquisitionState));
    window.localStorage.setItem(
      QUEST_HISTORY_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        imports: [
          {
            importId: 'meal-import',
            importedAt: '2026-08-21T12:00:00.000Z',
            activeRequests: [],
            warnings: [],
            summary: {
              reportedCompletedCount: 0,
              completedRowsCount: 0,
              activeRowsCount: 0,
              warningCount: 0,
            },
            completedRequests: [],
          },
        ],
      }),
    );

    render(
      <MemoryRouter>
        <QuestHistoryPage />
      </MemoryRouter>,
    );

    const mealSection = (await screen.findByRole('heading', { name: 'Meals for Unfinished Quests' })).closest('section');
    expect(mealSection).not.toBeNull();
    const mealRow = within(mealSection as HTMLElement)
      .getByRole('link', { name: 'Breakfast Boost' })
      .closest('tr');
    expect(mealRow).not.toBeNull();
    expect(within(mealRow as HTMLElement).getByText('10')).toBeInTheDocument();
    expect(within(mealRow as HTMLElement).getByText('4')).toBeInTheDocument();
    expect(within(mealRow as HTMLElement).getByText('6')).toBeInTheDocument();

    await user.click(within(mealSection as HTMLElement).getByText('Ingredients for missing meals'));
    const ingredientRow = within(mealSection as HTMLElement).getByText('Corn').closest('tr');
    expect(ingredientRow).not.toBeNull();
    expect(within(ingredientRow as HTMLElement).getByText('12')).toBeInTheDocument();
    expect(within(ingredientRow as HTMLElement).getByText('3')).toBeInTheDocument();
    expect(within(ingredientRow as HTMLElement).getByText('9')).toBeInTheDocument();
  });
});
