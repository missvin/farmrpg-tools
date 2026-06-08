import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ItemProfilePage } from './ItemProfilePage';

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

    loadRecipeGraphMock.mockResolvedValue({
      recipes: [redDyeRecipe],
      byOutputCanonicalKey: {
        'red dye': redDyeRecipe,
      },
      byInputCanonicalKey: {},
      craftRecipes: [redDyeRecipe],
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

    const burdenSection = screen.getByRole('heading', { name: 'Materials Needed' }).closest('section');
    expect(burdenSection).not.toBeNull();
    expect(within(burdenSection as HTMLElement).getByText('To GM')).toBeInTheDocument();
    expect(within(burdenSection as HTMLElement).getAllByText('50,000').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Used In' })).toBeInTheDocument();

    const acquisitionSection = screen.getByRole('heading', { name: 'Acquisition' }).closest('section');
    expect(acquisitionSection).not.toBeNull();
    expect(within(acquisitionSection as HTMLElement).getByText('Needed by Material Planner')).toBeInTheDocument();
    expect(within(acquisitionSection as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(acquisitionSection as HTMLElement).getByRole('link', { name: /Open Acquisition Breakdown/ }))
      .toHaveAttribute('href', '/acquisition-breakdown?item=red+dye');

    const goalSection = screen.getByRole('heading', { name: 'Goal Calculator' }).closest('section');
    expect(goalSection).not.toBeNull();
    expect(within(goalSection as HTMLElement).getByText('Mastery remaining')).toBeInTheDocument();
    expect(within(goalSection as HTMLElement).getByText('After waiting')).toBeInTheDocument();
    expect(within(goalSection as HTMLElement).getByLabelText('Wait days')).toHaveValue(7);
    expect(within(goalSection as HTMLElement).getAllByText('50,000').length).toBeGreaterThan(0);
  });

  it('marks completed Tower targets clearly', async () => {
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

    const towerSection = (await screen.findByRole('heading', { name: 'Tower Need' })).closest('section');
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
  });
});
