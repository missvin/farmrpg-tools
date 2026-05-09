import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

const {
  getLatestSnapshot,
  loadRecipeGraph,
  loadTowerRequirements,
  loadCraftingModifierState,
  calculateRecursiveIngredientBurden,
} = vi.hoisted(() => ({
  getLatestSnapshot: vi.fn(),
  loadRecipeGraph: vi.fn(),
  loadTowerRequirements: vi.fn(),
  loadCraftingModifierState: vi.fn(),
  calculateRecursiveIngredientBurden: vi.fn(),
}));

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot,
}));

vi.mock('../lib/loadRecipeGraph', () => ({
  loadRecipeGraph,
}));

vi.mock('../lib/loadTowerRequirements', () => ({
  loadTowerRequirements,
}));

vi.mock('../lib/craftingModifierState', async () => {
  const actual = await vi.importActual('../lib/craftingModifierState');

  return {
    ...actual,
    loadCraftingModifierState,
  };
});

vi.mock('../lib/recursiveIngredientBurden', () => ({
  calculateRecursiveIngredientBurden,
}));

import { IngredientDemandListPage } from './IngredientDemandListPage';

const SNAPSHOT = {
  snapshotId: 'snapshot-1',
  createdAt: '2026-03-19T12:00:00.000Z',
  savedAt: '2026-03-19T12:00:00.000Z',
  importedAt: '2026-03-19T12:00:00.000Z',
  rawText: '',
  masteryByItem: {
    twine: 9999,
  },
  parseSummary: {
    itemsParsed: 1,
    parsedRowsCount: 1,
    tiersDetected: [],
    duplicateRowsCount: 0,
    skippedNonItemLinesCount: 0,
    skippedNonItemLineSamples: [],
    unknownItemsCount: 0,
    warnings: [],
  },
};

function createBurdenResult(options?: {
  resourceSaver1Unlocked?: boolean;
  resourceSaver2Unlocked?: boolean;
  resourceSaver3Unlocked?: boolean;
  mushroomStewActive?: boolean;
  eventMasteryBonusPercent?: number;
  eventResourceSaverBonusPercent?: number;
  ironDepotActive?: boolean;
  towerCutoff?: number | null;
}) {
  const resourceSaver1Unlocked = options?.resourceSaver1Unlocked ?? false;
  const resourceSaver2Unlocked = options?.resourceSaver2Unlocked ?? false;
  const resourceSaver3Unlocked = options?.resourceSaver3Unlocked ?? false;
  const mushroomStewActive = options?.mushroomStewActive ?? false;
  const eventMasteryBonusPercent = options?.eventMasteryBonusPercent ?? 0;
  const eventResourceSaverBonusPercent = options?.eventResourceSaverBonusPercent ?? 0;
  const ironDepotActive = options?.ironDepotActive ?? false;
  const towerCutoff = options?.towerCutoff ?? null;

  const permanentSaverBump =
    (resourceSaver1Unlocked ? 1 : 0) +
    (resourceSaver2Unlocked ? 2 : 0) +
    (resourceSaver3Unlocked ? 3 : 0);
  const twineMValue = 22 + (mushroomStewActive ? 2 : 0) + (eventMasteryBonusPercent > 0 ? 3 : 0);
  const twineTowerValue = towerCutoff === 250 ? 4 : 8;

  return {
    modifierTotals: {
      activeModifiers: [],
      resourceSaverModifiers: [],
      masteryBonusModifiers: [],
      totalResourceSaverPercent: eventResourceSaverBonusPercent,
      totalMasteryBonusPercent: (mushroomStewActive ? 0.1 : 0) + eventMasteryBonusPercent,
    },
    masteryGainPerEffectiveOutput: 1,
    scopeResults: {
      M: {
        scope: 'M',
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {},
      },
      GM: {
        scope: 'GM',
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {},
      },
      MM: {
        scope: 'MM',
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {},
      },
      Tower: {
        scope: 'Tower',
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {},
      },
    },
    ingredientBurdenByCanonicalKey: {
      fiber: {
        canonicalKey: 'fiber',
        itemName: 'Fiber',
        isCraftable: false,
        totalRequiredEffectiveOutput: 10,
        totalRequiredCraftOperations: 0,
        byScope: {
          M: {
            requiredEffectiveOutput: 10,
            requiredCraftOperations: 0,
          },
        },
      },
      ...(ironDepotActive
        ? {}
        : {
            iron: {
              canonicalKey: 'iron',
              itemName: 'Iron',
              isCraftable: false,
              totalRequiredEffectiveOutput: 5,
              totalRequiredCraftOperations: 0,
              byScope: {
                M: {
                  requiredEffectiveOutput: 5,
                  requiredCraftOperations: 0,
                },
              },
            },
          }),
      rope: {
        canonicalKey: 'rope',
        itemName: 'Rope',
        isCraftable: true,
        totalRequiredEffectiveOutput: 18,
        totalRequiredCraftOperations: 18,
        byScope: {
          M: {
            requiredEffectiveOutput: 0,
            requiredCraftOperations: 0,
          },
          Tower: {
            requiredEffectiveOutput: 2,
            requiredCraftOperations: 2,
          },
        },
      },
      twine: {
        canonicalKey: 'twine',
        itemName: 'Twine',
        isCraftable: true,
        totalRequiredEffectiveOutput: 200 + twineMValue + twineTowerValue,
        totalRequiredCraftOperations: 180 + twineMValue + twineTowerValue - permanentSaverBump,
        byScope: {
          M: {
            requiredEffectiveOutput: twineMValue,
            requiredCraftOperations: twineMValue - 1 - permanentSaverBump,
          },
          GM: {
            requiredEffectiveOutput: 200,
            requiredCraftOperations: 180,
          },
          Tower: {
            requiredEffectiveOutput: twineTowerValue,
            requiredCraftOperations: twineTowerValue,
          },
        },
      },
    },
  };
}

describe('IngredientDemandListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getLatestSnapshot.mockResolvedValue(SNAPSHOT);
    loadRecipeGraph.mockResolvedValue({
      recipes: [],
      byOutputCanonicalKey: {},
      byInputCanonicalKey: {},
      craftRecipes: [],
      cookingRecipes: [],
    });
    loadTowerRequirements.mockResolvedValue({
      entries: [],
      byCanonicalKey: {},
    });
    loadCraftingModifierState.mockReturnValue({
      schemaVersion: 1,
      persistent: {
        resourceSaver1Unlocked: false,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: false,
      },
      temporary: {
        mushroomStewActive: false,
        eventMasteryBonusPercent: 0,
        eventResourceSaverBonusPercent: 0,
      },
      planning: {
        includeExcludedRecipes: false,
        ironDepotActive: false,
      },
    });
    calculateRecursiveIngredientBurden.mockImplementation(({ modifierState, towerTarget }) =>
      createBurdenResult({
        resourceSaver1Unlocked: modifierState.persistent.resourceSaver1Unlocked,
        resourceSaver2Unlocked: modifierState.persistent.resourceSaver2Unlocked,
        resourceSaver3Unlocked: modifierState.persistent.resourceSaver3Unlocked,
        mushroomStewActive: modifierState.temporary.mushroomStewActive,
        eventMasteryBonusPercent: modifierState.temporary.eventMasteryBonusPercent,
        eventResourceSaverBonusPercent: modifierState.temporary.eventResourceSaverBonusPercent,
        ironDepotActive: modifierState.planning.ironDepotActive,
        towerCutoff: towerTarget?.maxTowerLevel ?? null,
      }),
    );
  });

  it('renders a sortable burden list from the shared recursive engine output', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <IngredientDemandListPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Ingredient Burden List' });

    const table = screen.getByRole('table');
    const initialRows = within(table).getAllByRole('row');
    expect(initialRows[1]).toHaveTextContent('Twine');
    expect(initialRows[2]).toHaveTextContent('Fiber');
    expect(initialRows[3]).toHaveTextContent('Iron');
    expect(screen.queryByText('Rope')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sort by ingredient/i }));

    const ingredientSortedRows = within(table).getAllByRole('row');
    expect(ingredientSortedRows[1]).toHaveTextContent('Fiber');
    expect(ingredientSortedRows[2]).toHaveTextContent('Iron');
    expect(ingredientSortedRows[3]).toHaveTextContent('Twine');

    expect(within(table).getAllByText('Terminal')).toHaveLength(2);
  });

  it('wires permanent saver, temporary bonuses, and Iron Depot through the existing modifier pipeline', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <IngredientDemandListPage />
      </MemoryRouter>,
    );

    await screen.findByRole('radiogroup', { name: 'Goal scope' });

    await user.click(screen.getByLabelText('Resource Saver II'));
    await user.click(screen.getByLabelText('Mushroom Stew active'));
    await user.type(screen.getByLabelText('Event mastery bonus %'), '17');
    await user.type(screen.getByLabelText('Event resource saver %'), '5');
    await user.click(screen.getByLabelText('Iron Depot active'));

    await waitFor(() => {
      const latestCall = calculateRecursiveIngredientBurden.mock.calls.at(-1)?.[0];
      expect(latestCall.modifierState.persistent.resourceSaver2Unlocked).toBe(true);
      expect(latestCall.modifierState.temporary.mushroomStewActive).toBe(true);
      expect(latestCall.modifierState.temporary.eventMasteryBonusPercent).toBeCloseTo(0.17);
      expect(latestCall.modifierState.temporary.eventResourceSaverBonusPercent).toBeCloseTo(0.05);
      expect(latestCall.modifierState.planning.ironDepotActive).toBe(true);
    });

    expect(screen.queryByText('Iron')).not.toBeInTheDocument();
  });

  it('supports Tower-specific scope and cutoff handling', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <IngredientDemandListPage />
      </MemoryRouter>,
    );

    await screen.findByRole('radiogroup', { name: 'Goal scope' });

    await user.click(screen.getByRole('radio', { name: 'Tower' }));
    await user.type(screen.getByLabelText('Tower max level'), '250');

    await waitFor(() => {
      const latestCall = calculateRecursiveIngredientBurden.mock.calls.at(-1)?.[0];
      expect(latestCall.towerTarget).toEqual({ maxTowerLevel: 250 });
    });

    expect(await screen.findByText('Scope')).toBeInTheDocument();
    expect(
      screen.getByText(/This list is scoped to Tower and includes nested crafting demand\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Twine');
    expect(screen.getByRole('table')).toHaveTextContent('4');
  });

  it('can show zero-demand ingredients when the zero filter is turned off', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <IngredientDemandListPage />
      </MemoryRouter>,
    );

    await screen.findByLabelText('Hide zero-demand ingredients');
    await user.click(screen.getByLabelText('Hide zero-demand ingredients'));

    expect(screen.getByRole('table')).toHaveTextContent('Rope');
  });
});
