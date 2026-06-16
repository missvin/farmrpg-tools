import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

const { getLatestSnapshot, getItemIcon, loadRecipeGraph, loadTowerRequirements } = vi.hoisted(() => ({
  getLatestSnapshot: vi.fn(),
  getItemIcon: vi.fn(),
  loadRecipeGraph: vi.fn(),
  loadTowerRequirements: vi.fn(),
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

vi.mock('../lib/itemIconManifest', () => ({
  getItemIcon,
}));

import { CraftMaterialMatrixPage } from './CraftMaterialMatrixPage';

const RECIPE_GRAPH = {
  recipes: [
    {
      outputItemName: 'Red Shirt',
      outputCanonicalKey: 'red shirt',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: '',
      inputs: [
        { inputOrder: 1, itemName: 'Red Dye', canonicalKey: 'red dye', quantity: 2 },
        { inputOrder: 2, itemName: 'Cotton', canonicalKey: 'cotton', quantity: 1 },
      ],
    },
    {
      outputItemName: 'Red Cloak',
      outputCanonicalKey: 'red cloak',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: '',
      inputs: [
        { inputOrder: 1, itemName: 'Red Shirt', canonicalKey: 'red shirt', quantity: 1 },
        { inputOrder: 2, itemName: 'Black Twine', canonicalKey: 'black twine', quantity: 1 },
      ],
    },
    {
      outputItemName: 'Rope',
      outputCanonicalKey: 'rope',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: '',
      inputs: [{ inputOrder: 1, itemName: 'Twine', canonicalKey: 'twine', quantity: 4 }],
    },
  ],
  byOutputCanonicalKey: {},
  byInputCanonicalKey: {},
  craftRecipes: [],
  cookingRecipes: [],
};

RECIPE_GRAPH.byOutputCanonicalKey = Object.fromEntries(
  RECIPE_GRAPH.recipes.map((recipe) => [recipe.outputCanonicalKey, recipe]),
);
RECIPE_GRAPH.byInputCanonicalKey = RECIPE_GRAPH.recipes.reduce<Record<string, typeof RECIPE_GRAPH.recipes>>(
  (lookup, recipe) => {
    for (const input of recipe.inputs) {
      lookup[input.canonicalKey] = [...(lookup[input.canonicalKey] ?? []), recipe];
    }

    return lookup;
  },
  {},
);
RECIPE_GRAPH.craftRecipes = RECIPE_GRAPH.recipes;

const TOWER_REQUIREMENTS = {
  entries: [
    {
      towerLevel: 120,
      towerLevelRange: '101-200',
      slotIndex: 1,
      itemName: 'Red Shirt',
      canonicalKey: 'red shirt',
      masteryLevelNeeded: 'GM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 330,
      towerLevelRange: '301-400',
      slotIndex: 1,
      itemName: 'Red Cloak',
      canonicalKey: 'red cloak',
      masteryLevelNeeded: 'MM',
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
  ],
  byCanonicalKey: {},
};

TOWER_REQUIREMENTS.byCanonicalKey = TOWER_REQUIREMENTS.entries.reduce<Record<string, typeof TOWER_REQUIREMENTS.entries>>(
  (lookup, entry) => {
    lookup[entry.canonicalKey] = [...(lookup[entry.canonicalKey] ?? []), entry];
    return lookup;
  },
  {},
);

const SNAPSHOT = {
  snapshotId: 'snapshot-1',
  createdAt: '2026-06-15T12:00:00.000Z',
  savedAt: '2026-06-15T12:00:00.000Z',
  importedAt: '2026-06-15T12:00:00.000Z',
  rawText: '',
  masteryByItem: {
    'red shirt': 95000,
    'red cloak': 900000,
    rope: 100,
  },
  parseSummary: {
    itemsParsed: 3,
    parsedRowsCount: 3,
    tiersDetected: [],
    duplicateRowsCount: 0,
    skippedNonItemLinesCount: 0,
    skippedNonItemLineSamples: [],
    unknownItemsCount: 0,
    warnings: [],
  },
};

describe('CraftMaterialMatrixPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    loadRecipeGraph.mockResolvedValue(RECIPE_GRAPH);
    loadTowerRequirements.mockResolvedValue(TOWER_REQUIREMENTS);
    getLatestSnapshot.mockResolvedValue(SNAPSHOT);
    getItemIcon.mockImplementation((canonicalKey: string) => ({ src: `/icons/${canonicalKey}.png` }));
  });

  it('renders unfinished Tower craft uses for the default material preset', async () => {
    render(
      <MemoryRouter>
        <CraftMaterialMatrixPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Craft Material Matrix' });

    expect(await screen.findByRole('link', { name: 'Red Shirt' })).toHaveAttribute('href', '/items/red%20shirt');
    expect(screen.getByRole('link', { name: 'Red Cloak' })).toHaveAttribute('href', '/items/red%20cloak');
    expect(screen.getByText('GM L120 · 5,000 left')).toBeInTheDocument();
    expect(screen.getByText('MM L330 · 100,000 left')).toBeInTheDocument();
    expect(screen.getAllByText(/Red Dye x2 -> Red Shirt/)).toHaveLength(2);
    expect(screen.getByText(/Red Shirt x1 -> Red Cloak/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rope' })).not.toBeInTheDocument();
  });

  it('adds searched materials and can show non-Tower craft uses', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CraftMaterialMatrixPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Craft Material Matrix' });

    await user.type(screen.getByLabelText('Add material'), 'twine');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));
    await user.selectOptions(screen.getByLabelText('Tower'), 'all');

    expect(await screen.findByRole('link', { name: 'Rope' })).toBeInTheDocument();

    const row = screen.getByRole('link', { name: 'Rope' }).closest('article');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('No Tower target')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/Twine x4 -> Rope/)).toBeInTheDocument();
  });
});
