import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ItemProfilePage } from './ItemProfilePage';
import { createDefaultAcquisitionPlannerInputState, saveAcquisitionPlannerInputState } from '../lib/acquisitionPlannerState';

const getLatestSnapshotMock = vi.fn();
const loadItemCatalogMock = vi.fn();
const loadTowerRequirementsMock = vi.fn();
const loadRecipeGraphMock = vi.fn();
const loadDropRateReferenceMock = vi.fn();
const loadPetSourceReferenceMock = vi.fn();
const loadOpenableContentsReferenceMock = vi.fn();
const loadWishingWellReferenceMock = vi.fn();
const getItemIconMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

vi.mock('../lib/loadItemCatalog', () => ({
  loadItemCatalog: (...args: unknown[]) => loadItemCatalogMock(...args),
}));

vi.mock('../lib/loadTowerRequirements', () => ({
  loadTowerRequirements: (...args: unknown[]) => loadTowerRequirementsMock(...args),
}));

vi.mock('../lib/loadRecipeGraph', () => ({
  loadRecipeGraph: (...args: unknown[]) => loadRecipeGraphMock(...args),
}));

vi.mock('../lib/loadDropRateReference', () => ({
  loadDropRateReference: (...args: unknown[]) => loadDropRateReferenceMock(...args),
}));

vi.mock('../lib/loadPetSourceReference', () => ({
  loadPetSourceReference: (...args: unknown[]) => loadPetSourceReferenceMock(...args),
}));

vi.mock('../lib/loadOpenableContentsReference', () => ({
  loadOpenableContentsReference: (...args: unknown[]) => loadOpenableContentsReferenceMock(...args),
}));

vi.mock('../lib/loadWishingWellReference', () => ({
  loadWishingWellReference: (...args: unknown[]) => loadWishingWellReferenceMock(...args),
}));

vi.mock('../lib/itemIconManifest', () => ({
  getItemIcon: (...args: unknown[]) => getItemIconMock(...args),
}));

describe('ItemProfilePage', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    loadItemCatalogMock.mockReset();
    loadTowerRequirementsMock.mockReset();
    loadRecipeGraphMock.mockReset();
    loadDropRateReferenceMock.mockReset();
    loadPetSourceReferenceMock.mockReset();
    loadOpenableContentsReferenceMock.mockReset();
    loadWishingWellReferenceMock.mockReset();
    getItemIconMock.mockReset();
    window.localStorage.clear();
  });

  function mockResources(): void {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-05-08T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        'red dye': 50_000,
      },
      parseSummary: {
        itemsParsed: 1,
        parsedRowsCount: 1,
        tiersDetected: [100_000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [
        {
          rawItemName: 'Red Dye',
          canonicalKey: 'red dye',
          count: 50_000,
          targetTier: 100_000,
          sourceLineIndex: 0,
        },
      ],
    });

    loadItemCatalogMock.mockResolvedValue({
      entries: [],
      byCanonicalKey: {},
    });

    loadTowerRequirementsMock.mockResolvedValue({
      entries: [
        {
          towerLevel: 304,
          towerLevelRange: '301-310',
          slotIndex: 1,
          itemName: 'Red Dye',
          canonicalKey: 'red dye',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 305,
          towerLevelRange: '301-310',
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
          towerLevel: 306,
          towerLevelRange: '301-310',
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
      byCanonicalKey: {
        'red dye': [
          {
            towerLevel: 304,
            towerLevelRange: '301-310',
            slotIndex: 1,
            itemName: 'Red Dye',
            canonicalKey: 'red dye',
            masteryLevelNeeded: 'GM',
            farmrpgItemId: null,
            buddySlug: null,
            notes: null,
            sourceSheet: null,
            sourceRow: null,
          },
        ],
        'red shirt': [
          {
            towerLevel: 305,
            towerLevelRange: '301-310',
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
        ],
        'red cloak': [
          {
            towerLevel: 306,
            towerLevelRange: '301-310',
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
      },
    });

    const redDyeRecipe = {
      outputItemName: 'Red Dye',
      outputCanonicalKey: 'red dye',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: 'https://buddy.farm/i/red-dye/',
      inputs: [
        {
          inputOrder: 1,
          itemName: 'Glass Orb',
          canonicalKey: 'glass orb',
          quantity: 2,
        },
      ],
    };
    const redShirtRecipe = {
      outputItemName: 'Red Shirt',
      outputCanonicalKey: 'red shirt',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: 'https://buddy.farm/i/red-shirt/',
      inputs: [
        {
          inputOrder: 1,
          itemName: 'Red Dye',
          canonicalKey: 'red dye',
          quantity: 2,
        },
      ],
    };
    const redCloakRecipe = {
      outputItemName: 'Red Cloak',
      outputCanonicalKey: 'red cloak',
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: 'https://buddy.farm/i/red-cloak/',
      inputs: [
        {
          inputOrder: 1,
          itemName: 'Red Shirt',
          canonicalKey: 'red shirt',
          quantity: 1,
        },
      ],
    };

    loadRecipeGraphMock.mockResolvedValue({
      recipes: [redDyeRecipe, redShirtRecipe, redCloakRecipe],
      byOutputCanonicalKey: {
        'red dye': redDyeRecipe,
        'red shirt': redShirtRecipe,
        'red cloak': redCloakRecipe,
      },
      byInputCanonicalKey: {
        'glass orb': [redDyeRecipe],
        'red dye': [redShirtRecipe],
        'red shirt': [redCloakRecipe],
      },
      craftRecipes: [redDyeRecipe, redShirtRecipe, redCloakRecipe],
      cookingRecipes: [],
    });

    loadDropRateReferenceMock.mockResolvedValue({
      entries: [],
      byTargetCanonicalKey: {
        'red dye': [
          {
            targetItemName: 'Red Dye',
            targetCanonicalKey: 'red dye',
            sourceName: 'Small Cave',
            sourceCanonicalKey: 'small cave',
            sourceType: 'explore',
            sourceKind: 'location',
            rowKind: 'item_source',
            rawRate: 20,
            baseDropRate: 0.25,
            sourcePageType: 'item',
            sourcePageName: 'Red Dye',
            sourcePageUrl: 'https://buddy.farm/i/red-dye/',
            pageDataUrl: 'https://buddy.farm/page-data/i/red-dye/page-data.json',
            targetItemId: null,
            targetItemImage: null,
            sourceImage: null,
            ironDepot: null,
            manualFishing: null,
            runecube: null,
            flags: [],
            notes: [],
          },
        ],
      },
    });

    loadPetSourceReferenceMock.mockResolvedValue({
      entries: [],
      byItemCanonicalKey: {},
      byPetCanonicalKey: {},
      byPetAndItemKey: {},
    });

    loadOpenableContentsReferenceMock.mockResolvedValue({
      entries: [],
      byOpenableCanonicalKey: {},
      byContentCanonicalKey: {},
    });

    loadWishingWellReferenceMock.mockResolvedValue({
      entries: [],
      byThrownCanonicalKey: {},
      byRewardCanonicalKey: {},
    });

    getItemIconMock.mockImplementation((canonicalKey: string) =>
      canonicalKey === 'glass orb' ? { src: '/icons/glass-orb.png' } : null,
    );
  }

  it('shows item mastery, Tower, PJ, and recipe context', async () => {
    const user = userEvent.setup();
    mockResources();

    render(
      <MemoryRouter initialEntries={['/items/red%20dye']}>
        <Routes>
          <Route path="/items/:canonicalKey" element={<ItemProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Red Dye' })).toBeInTheDocument();

    expect(screen.getByText('50,000 / 1,000,000')).toBeInTheDocument();
    expect(screen.getByText('50.0% to GM')).toBeInTheDocument();
    const nextTower = screen.getByLabelText('Next Tower need');
    expect(within(nextTower).getByText('50,000 mastery left')).toBeInTheDocument();
    expect(within(nextTower).getByText('PJ: 8')).toBeInTheDocument();
    expect(within(nextTower).getByRole('link', { name: 'GM at Tower 304' })).toHaveAttribute('href', '/tower-progress?through=304&item=red%20dye&level=304');
    const towerDetails = screen.getByText('All Tower targets (1)').closest('details');
    expect(towerDetails).not.toHaveAttribute('open');
    await user.click(screen.getByText('All Tower targets (1)'));

    const towerSection = screen.getByRole('heading', { name: 'Tower Need' }).closest('section');
    expect(towerSection).not.toBeNull();
    expect(within(towerSection as HTMLElement).getByText('GM at Tower Level 304')).toBeInTheDocument();
    expect(within(towerSection as HTMLElement).getByText('Pumpkin Juice needed to finish tower')).toBeInTheDocument();
    expect(within(towerSection as HTMLElement).getByText('8')).toBeInTheDocument();

    const recipeSection = screen.getByRole('heading', { name: 'Made From' }).closest('section');
    expect(recipeSection).not.toBeNull();
    expect(within(recipeSection as HTMLElement).getByRole('link', { name: /Glass Orb/ })).toHaveAttribute(
      'href',
      '/items/glass%20orb',
    );
    expect((recipeSection as HTMLElement).querySelector('img')).toHaveAttribute(
      'src',
      '/icons/glass-orb.png',
    );

    expect(screen.queryByRole('heading', { name: 'Plan materials' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Get more' }));
    const materialTable = screen.getByRole('table', { name: 'Material plan' });
    expect(within(materialTable).getByRole('link', { name: /Glass Orb/ })).toHaveAttribute('href', '/items/glass%20orb');
    expect(screen.queryByRole('heading', { name: 'Materials Needed' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Planning target' })).toHaveValue('tower-100000');
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    await user.click(screen.getByRole('button', { name: 'Use it' }));
    expect(screen.queryByRole('heading', { name: 'Made From' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Red Dye' })).toBeInTheDocument();
    const uses = screen.getByRole('heading', { name: 'Use Red Dye' }).closest('section')!;
    expect(within(uses).getByRole('button', { name: 'Tower', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(within(uses).getByRole('link', { name: /Red Shirt/ })).toHaveAttribute('href', '/items/red%20shirt');
    await user.click(within(uses).getByRole('button', { name: 'Quests', exact: true }));
    expect(within(uses).getByText(/No unfinished quest demand recorded/)).toBeInTheDocument();
    await user.click(within(uses).getByRole('button', { name: 'All recipes' }));
    expect(within(uses).getByRole('link', { name: /Red Shirt/ })).toBeInTheDocument();
    await user.click(within(uses).getByRole('button', { name: 'Tower', exact: true }));
    await user.click(within(uses).getByLabelText('Include completed targets'));
    await user.click(screen.getByRole('button', { name: 'Get more' }));
    const goalSection = screen.getByRole('heading', { name: 'Plan materials' }).closest('section');
    expect(goalSection).not.toBeNull();
    expect(within(goalSection as HTMLElement).getByText(/Mastery remaining:/)).toBeInTheDocument();
    expect(within(goalSection as HTMLElement).getByText(/After waiting 7 days/)).toBeInTheDocument();
    expect(within(goalSection as HTMLElement).getByLabelText('Wait days')).toHaveValue(7);
    await user.clear(within(goalSection as HTMLElement).getByLabelText('Wait days'));
    await user.type(within(goalSection as HTMLElement).getByLabelText('Wait days'), '12');
    await user.click(screen.getByRole('button', { name: 'Overview' }));
    await user.click(screen.getByRole('button', { name: 'Get more' }));
    expect(within(goalSection as HTMLElement).getByLabelText('Wait days')).toHaveValue(12);
    expect(within(goalSection as HTMLElement).getAllByText('50,000').length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Planning target' }), 'custom-quantity');
    await user.clear(within(goalSection as HTMLElement).getByLabelText('Total quantity'));
    await user.type(within(goalSection as HTMLElement).getByLabelText('Total quantity'), '12');
    expect(screen.getByText(/Quantity target:/)).toBeInTheDocument();
  });

  it('hands the Overview target to the material planner', async () => {
    mockResources(); const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/items/red%20dye']}><Routes><Route path="/items/:canonicalKey" element={<ItemProfilePage />} /></Routes></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Red Dye' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Planning target' }), 'mastery-1000000');
    await user.click(screen.getByRole('button', { name: 'Plan materials' }));
    expect(screen.getByRole('combobox', { name: 'Planning target' })).toHaveValue('mastery-1000000');
    expect(screen.getByRole('table', { name: 'Material plan' })).toBeInTheDocument();
  });

  it('defaults to quantity without mastery evidence or with explicit non-masterable metadata', async () => {
    mockResources(); getLatestSnapshotMock.mockResolvedValue(null);
    loadItemCatalogMock.mockResolvedValue({ entries: [], byCanonicalKey: { 'red dye': { canonicalKey: 'red dye', itemName: 'Red Dye', masteryPossible: 'no' } } });
    render(<MemoryRouter initialEntries={['/items/red%20dye']}><Routes><Route path="/items/:canonicalKey" element={<ItemProfilePage />} /></Routes></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Red Dye' });
    expect(screen.getByRole('combobox', { name: 'Planning target' })).toHaveValue('custom-quantity');
    expect(screen.getByText('Not masterable')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Custom mastery' })).not.toBeInTheDocument();
  });

  it('marks completed Tower targets clearly', async () => {
    const user = userEvent.setup();
    mockResources();
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-05-08T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        'red dye': 100_000,
      },
      parseSummary: {
        itemsParsed: 1,
        parsedRowsCount: 1,
        tiersDetected: [100_000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [
        {
          rawItemName: 'Red Dye',
          canonicalKey: 'red dye',
          count: 100_000,
          targetTier: 100_000,
          sourceLineIndex: 0,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/items/red%20dye']}>
        <Routes>
          <Route path="/items/:canonicalKey" element={<ItemProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Red Dye' });
    expect(screen.getByText('All Tower targets complete')).toBeInTheDocument();
    await user.click(screen.getByText('All Tower targets (1)'));
    const towerSection = screen.getByRole('heading', { name: 'Tower Need' }).closest('section');
    expect(towerSection).not.toBeNull();
    expect(within(towerSection as HTMLElement).getByText('Complete')).toBeInTheDocument();
    expect(within(towerSection as HTMLElement).getAllByText('0')).toHaveLength(2);
  });

  it('shows a safe unknown-item state', async () => {
    mockResources();

    render(
      <MemoryRouter initialEntries={['/items/mystery%20item']}>
        <Routes>
          <Route path="/items/:canonicalKey" element={<ItemProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mystery Item' })).toBeInTheDocument();
    });
    expect(screen.getByText(/not in the current local reference data/i)).toBeInTheDocument();
    expect(screen.getByText('Saved inventory: Not recorded')).toBeInTheDocument();
    expect(screen.getByText('Eligibility not recorded')).toBeInTheDocument();
  });

  it('shows saved inventory and chooses the earliest unfinished Tower target over a later MM target', async () => {
    mockResources();
    const state = createDefaultAcquisitionPlannerInputState();
    state.inventory.entries = [{ canonicalItemKey: 'red dye', itemName: 'Red Dye', inventoryCount: 123 }];
    saveAcquisitionPlannerInputState(state);
    const requirements = await loadTowerRequirementsMock();
    requirements.byCanonicalKey['red dye'].push({ ...requirements.byCanonicalKey['red dye'][0], towerLevel: 350, masteryLevelNeeded: 'MM' });
    render(<MemoryRouter initialEntries={['/items/red%20dye']}><Routes><Route path="/items/:canonicalKey" element={<ItemProfilePage />} /></Routes></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Red Dye' });
    expect(screen.getByText('Saved inventory: 123')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Next Tower need')).getByRole('link', { name: 'GM at Tower 304' })).toBeInTheDocument();
    expect(screen.getByText('All Tower targets (2)')).toBeInTheDocument();
    expect(screen.getByText(/Mastery snapshot:/)).toBeInTheDocument();
  });
});
