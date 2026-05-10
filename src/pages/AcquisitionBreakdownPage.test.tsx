import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

const {
  getLatestSnapshot,
  loadRecipeGraph,
  loadTowerRequirements,
  loadCraftingModifierState,
  loadAcquisitionPlannerInputState,
  loadDropRateAcquisitionSettings,
  loadDropRateReference,
  calculateRecursiveIngredientBurden,
} = vi.hoisted(() => ({
  getLatestSnapshot: vi.fn(),
  loadRecipeGraph: vi.fn(),
  loadTowerRequirements: vi.fn(),
  loadCraftingModifierState: vi.fn(),
  loadAcquisitionPlannerInputState: vi.fn(),
  loadDropRateAcquisitionSettings: vi.fn(),
  loadDropRateReference: vi.fn(),
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

vi.mock('../lib/acquisitionPlannerState', async () => {
  const actual = await vi.importActual('../lib/acquisitionPlannerState');

  return {
    ...actual,
    loadAcquisitionPlannerInputState,
  };
});

vi.mock('../lib/dropRateAcquisitionSettings', async () => {
  const actual = await vi.importActual('../lib/dropRateAcquisitionSettings');

  return {
    ...actual,
    loadDropRateAcquisitionSettings,
  };
});

vi.mock('../lib/loadDropRateReference', () => ({
  loadDropRateReference,
}));

vi.mock('../lib/recursiveIngredientBurden', () => ({
  calculateRecursiveIngredientBurden,
}));

import { createDefaultAcquisitionPlannerInputState } from '../lib/acquisitionPlannerState';
import { createDefaultDropRateAcquisitionSettings } from '../lib/dropRateAcquisitionSettings';
import { AcquisitionBreakdownPage } from './AcquisitionBreakdownPage';

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

function createBurdenResult() {
  return {
    modifierTotals: {
      activeModifiers: [],
      resourceSaverModifiers: [],
      masteryBonusModifiers: [],
      totalResourceSaverPercent: 0,
      totalMasteryBonusPercent: 0,
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
      twine: {
        canonicalKey: 'twine',
        itemName: 'Twine',
        isCraftable: true,
        totalRequiredEffectiveOutput: 100,
        totalRequiredCraftOperations: 25,
        byScope: {
          Tower: {
            requiredEffectiveOutput: 100,
            requiredCraftOperations: 25,
          },
        },
      },
    },
  };
}

describe('AcquisitionBreakdownPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const acquisitionState = createDefaultAcquisitionPlannerInputState();
    acquisitionState.explore.availableStamina = 224;
    acquisitionState.explore.wandererPercent = 20;
    acquisitionState.consumables.lemonade = {
      ownedCount: 1,
      craftableNowCount: 0,
      futureCraftableCount: 0,
      lemonSqueezerActive: true,
      quandaryChowderActive: false,
    };
    acquisitionState.ownedNow.entries = [
      {
        canonicalItemKey: 'twine',
        itemName: 'Twine',
        sourceCategory: 'stockpile',
        ownedCount: 15,
      },
      {
        canonicalItemKey: 'twine',
        itemName: 'Twine',
        sourceCategory: 'container',
        ownedCount: 5,
      },
    ];
    acquisitionState.pets.storedInventoryEntries = [
      {
        canonicalItemKey: 'twine',
        itemName: 'Twine',
        storedCount: 10,
      },
    ];

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
    loadDropRateReference.mockResolvedValue({
      entries: [],
      byTargetCanonicalKey: {},
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
    loadAcquisitionPlannerInputState.mockReturnValue(acquisitionState);
    loadDropRateAcquisitionSettings.mockReturnValue(createDefaultDropRateAcquisitionSettings());
    calculateRecursiveIngredientBurden.mockReturnValue(createBurdenResult());
  });

  it('shows known coverage and compares temporary source assumptions for one item', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AcquisitionBreakdownPage />
      </MemoryRouter>,
    );

    const itemInput = await screen.findByLabelText('Item');
    fireEvent.change(itemInput, { target: { value: 'Twine' } });

    expect(screen.getByText('Total needed')).toBeInTheDocument();
    expect(screen.getByText('Covered by saved sources')).toBeInTheDocument();
    expect(screen.getAllByText('30').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Drop rate %'), '25');

    await waitFor(() => {
      expect(screen.getByText('Estimated stamina: 224')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Lemonade'));

    expect(screen.getByText('Still unplanned')).toBeInTheDocument();
    expect(screen.getByText('Use known stockpiles, containers, and stored pet inventory first: 30 item(s).')).toBeInTheDocument();
    expect(screen.getByText('Manual Explore needs about 224 stamina for the current remainder.')).toBeInTheDocument();
    expect(screen.getByText('Selected consumables can cover up to 20 item(s) if this item is eligible for those drops.')).toBeInTheDocument();
  });

  it('shows imported Buddy source coverage filtered by saved drop-rate settings', async () => {
    loadDropRateReference.mockResolvedValue({
      entries: [
        {
          targetItemName: 'Twine',
          targetCanonicalKey: 'twine',
          sourceName: 'Small Cave',
          sourceCanonicalKey: 'small cave',
          sourceType: 'explore',
          sourceKind: 'location',
          rowKind: 'location_item',
          rawRate: 25,
          baseDropRate: 0.4,
          sourcePageType: 'location',
          sourcePageName: 'Small Cave',
          sourcePageUrl: 'https://buddy.farm/l/small-cave/',
          pageDataUrl: 'https://buddy.farm/page-data/l/small-cave/page-data.json',
          targetItemId: null,
          targetItemImage: null,
          sourceImage: null,
          ironDepot: true,
          manualFishing: null,
          runecube: true,
          flags: [],
          notes: [],
        },
        {
          targetItemName: 'Twine',
          targetCanonicalKey: 'twine',
          sourceName: 'Small Cave',
          sourceCanonicalKey: 'small cave',
          sourceType: 'explore',
          sourceKind: 'location',
          rowKind: 'location_item',
          rawRate: 20,
          baseDropRate: 0.4,
          sourcePageType: 'location',
          sourcePageName: 'Small Cave',
          sourcePageUrl: 'https://buddy.farm/l/small-cave/',
          pageDataUrl: 'https://buddy.farm/page-data/l/small-cave/page-data.json',
          targetItemId: null,
          targetItemImage: null,
          sourceImage: null,
          ironDepot: false,
          manualFishing: null,
          runecube: true,
          flags: [],
          notes: [],
        },
      ],
      byTargetCanonicalKey: {
        twine: [
          {
            targetItemName: 'Twine',
            targetCanonicalKey: 'twine',
            sourceName: 'Small Cave',
            sourceCanonicalKey: 'small cave',
            sourceType: 'explore',
            sourceKind: 'location',
            rowKind: 'location_item',
            rawRate: 25,
            baseDropRate: 0.4,
            sourcePageType: 'location',
            sourcePageName: 'Small Cave',
            sourcePageUrl: 'https://buddy.farm/l/small-cave/',
            pageDataUrl: 'https://buddy.farm/page-data/l/small-cave/page-data.json',
            targetItemId: null,
            targetItemImage: null,
            sourceImage: null,
            ironDepot: true,
            manualFishing: null,
            runecube: true,
            flags: [],
            notes: [],
          },
          {
            targetItemName: 'Twine',
            targetCanonicalKey: 'twine',
            sourceName: 'Small Cave',
            sourceCanonicalKey: 'small cave',
            sourceType: 'explore',
            sourceKind: 'location',
            rowKind: 'location_item',
            rawRate: 20,
            baseDropRate: 0.4,
            sourcePageType: 'location',
            sourcePageName: 'Small Cave',
            sourcePageUrl: 'https://buddy.farm/l/small-cave/',
            pageDataUrl: 'https://buddy.farm/page-data/l/small-cave/page-data.json',
            targetItemId: null,
            targetItemImage: null,
            sourceImage: null,
            ironDepot: false,
            manualFishing: null,
            runecube: true,
            flags: [],
            notes: [],
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <AcquisitionBreakdownPage />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Item'), { target: { value: 'Twine' } });

    expect(await screen.findByText('Imported source coverage')).toBeInTheDocument();
    expect(screen.getByText('Small Cave')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Iron Depot on, Runecube on')).toBeInTheDocument();
    expect(screen.getByText('1 row hidden by current Settings.')).toBeInTheDocument();
    expect(screen.getByText('1 imported Buddy source available for this item.')).toBeInTheDocument();
  });
});
