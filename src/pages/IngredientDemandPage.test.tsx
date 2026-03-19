import { render, screen, waitFor } from '@testing-library/react';
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

import { IngredientDemandPage } from './IngredientDemandPage';

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
  mushroomStewActive?: boolean;
  eventMasteryBonusPercent?: number;
  eventResourceSaverBonusPercent?: number;
  towerCutoff?: number | null;
}) {
  const mushroomStewActive = options?.mushroomStewActive ?? false;
  const eventMasteryBonusPercent = options?.eventMasteryBonusPercent ?? 0;
  const eventResourceSaverBonusPercent = options?.eventResourceSaverBonusPercent ?? 0;
  const towerCutoff = options?.towerCutoff ?? null;

  const masteryBonusBump = mushroomStewActive ? 2 : 0;
  const eventMasteryBump = eventMasteryBonusPercent > 0 ? 3 : 0;
  const resourceSaverBump = eventResourceSaverBonusPercent > 0 ? 1 : 0;
  const mValue = 22 + masteryBonusBump + eventMasteryBump;
  const gmValue = 90_003 + masteryBonusBump + resourceSaverBump;
  const mmValue = 2_299_999 + eventMasteryBump + resourceSaverBump;
  const towerValue = towerCutoff === 250 ? 4 : 8;

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
        ingredientBurdenByCanonicalKey: {
          twine: {
            canonicalKey: 'twine',
            itemName: 'Twine',
            isCraftable: true,
            totalRequiredEffectiveOutput: mValue,
            totalRequiredCraftOperations: mValue - 1,
            contributions: [
              {
                scope: 'M',
                rootGoalId: 'M:rope',
                rootOutputCanonicalKey: 'rope',
                rootOutputItemName: 'Rope',
                requiredEffectiveOutput: 12,
              },
            ],
          },
        },
      },
      GM: {
        scope: 'GM',
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {
          twine: {
            canonicalKey: 'twine',
            itemName: 'Twine',
            isCraftable: true,
            totalRequiredEffectiveOutput: gmValue,
            totalRequiredCraftOperations: gmValue - 10,
            contributions: [
              {
                scope: 'GM',
                rootGoalId: 'GM:fishing net',
                rootOutputCanonicalKey: 'fishing net',
                rootOutputItemName: 'Fishing Net',
                requiredEffectiveOutput: 77,
              },
            ],
          },
        },
      },
      MM: {
        scope: 'MM',
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {
          twine: {
            canonicalKey: 'twine',
            itemName: 'Twine',
            isCraftable: true,
            totalRequiredEffectiveOutput: mmValue,
            totalRequiredCraftOperations: mmValue - 100,
            contributions: [
              {
                scope: 'MM',
                rootGoalId: 'MM:large net',
                rootOutputCanonicalKey: 'large net',
                rootOutputItemName: 'Large Net',
                requiredEffectiveOutput: 144,
              },
            ],
          },
        },
      },
      Tower: {
        scope: 'Tower',
        rootGoals: [],
        unresolvedGoals: [],
        ingredientBurdenByCanonicalKey: {
          twine: {
            canonicalKey: 'twine',
            itemName: 'Twine',
            isCraftable: true,
            totalRequiredEffectiveOutput: towerValue,
            totalRequiredCraftOperations: towerValue,
            contributions: [
              {
                scope: 'Tower',
                rootGoalId: 'Tower:320:twine',
                rootOutputCanonicalKey: 'twine',
                rootOutputItemName: towerCutoff === 250 ? 'Twine cutoff' : 'Twine tower',
                requiredEffectiveOutput: towerValue,
              },
            ],
          },
        },
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
      twine: {
        canonicalKey: 'twine',
        itemName: 'Twine',
        isCraftable: true,
        totalRequiredEffectiveOutput: mValue + gmValue + mmValue + towerValue,
        totalRequiredCraftOperations: mValue + gmValue + mmValue + towerValue - 111,
        byScope: {
          M: {
            requiredEffectiveOutput: mValue,
            requiredCraftOperations: mValue - 1,
          },
          GM: {
            requiredEffectiveOutput: gmValue,
            requiredCraftOperations: gmValue - 10,
          },
          MM: {
            requiredEffectiveOutput: mmValue,
            requiredCraftOperations: mmValue - 100,
          },
          Tower: {
            requiredEffectiveOutput: towerValue,
            requiredCraftOperations: towerValue,
          },
        },
      },
    },
  };
}

describe('IngredientDemandPage', () => {
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
    });
    calculateRecursiveIngredientBurden.mockImplementation(({ modifierState, towerTarget }) =>
      createBurdenResult({
        mushroomStewActive: modifierState.temporary.mushroomStewActive,
        eventMasteryBonusPercent: modifierState.temporary.eventMasteryBonusPercent,
        eventResourceSaverBonusPercent: modifierState.temporary.eventResourceSaverBonusPercent,
        towerCutoff: towerTarget?.maxTowerLevel ?? null,
      }),
    );
  });

  it('supports ingredient search and renders recursive burden grouped by scope', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <IngredientDemandPage />
      </MemoryRouter>,
    );

    const ingredientInput = await screen.findByLabelText('Ingredient');
    await user.clear(ingredientInput);
    await user.type(ingredientInput, 'Twine');

    expect(await screen.findByText('Selected ingredient')).toBeInTheDocument();
    expect(screen.getByText('Twine')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('90,003')).toBeInTheDocument();
    expect(screen.getByText('2,299,999')).toBeInTheDocument();
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);
    expect(screen.getByText('Rope')).toBeInTheDocument();
    expect(screen.getByText('Fishing Net')).toBeInTheDocument();
    expect(screen.getByText('Large Net')).toBeInTheDocument();
  });

  it('wires assumption controls through the existing modifier pipeline', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <IngredientDemandPage />
      </MemoryRouter>,
    );

    await screen.findByLabelText('Ingredient');

    await user.selectOptions(screen.getByLabelText('Mushroom Stew active'), 'yes');
    await user.type(screen.getByLabelText('Event mastery bonus %'), '17');
    await user.type(screen.getByLabelText('Event resource saver %'), '5');

    await waitFor(() => {
      const latestCall = calculateRecursiveIngredientBurden.mock.calls.at(-1)?.[0];
      expect(latestCall.modifierState.temporary.mushroomStewActive).toBe(true);
      expect(latestCall.modifierState.temporary.eventMasteryBonusPercent).toBeCloseTo(0.17);
      expect(latestCall.modifierState.temporary.eventResourceSaverBonusPercent).toBeCloseTo(0.05);
    });
  });

  it('passes Tower cutoff selection through to the burden engine and updates Tower results', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <IngredientDemandPage />
      </MemoryRouter>,
    );

    const ingredientInput = await screen.findByLabelText('Ingredient');
    await user.clear(ingredientInput);
    await user.type(ingredientInput, 'Twine');
    await user.type(screen.getByLabelText('Tower max level'), '250');

    await waitFor(() => {
      const latestCall = calculateRecursiveIngredientBurden.mock.calls.at(-1)?.[0];
      expect(latestCall.towerTarget).toEqual({ maxTowerLevel: 250 });
    });

    expect(await screen.findByText('Twine cutoff')).toBeInTheDocument();
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
  });
});
