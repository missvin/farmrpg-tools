import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ItemProfilePage } from './ItemProfilePage';

const getLatestSnapshotMock = vi.fn();
const loadItemCatalogMock = vi.fn();
const loadTowerRequirementsMock = vi.fn();
const loadRecipeGraphMock = vi.fn();

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

vi.mock('../lib/itemIconManifest', () => ({
  getItemIcon: vi.fn().mockReturnValue(null),
}));

describe('ItemProfilePage', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    loadItemCatalogMock.mockReset();
    loadTowerRequirementsMock.mockReset();
    loadRecipeGraphMock.mockReset();
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

    loadRecipeGraphMock.mockResolvedValue({
      recipes: [],
      byOutputCanonicalKey: {
        'red dye': {
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
        },
      },
      byInputCanonicalKey: {},
      craftRecipes: [],
      cookingRecipes: [],
    });
  }

  it('shows item mastery, Tower, PJ, and direct recipe context', async () => {
    mockResources();

    render(
      <MemoryRouter initialEntries={['/items/red%20dye']}>
        <Routes>
          <Route path="/items/:canonicalKey" element={<ItemProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Red Dye' })).toBeInTheDocument();

    const masterySection = screen.getByRole('heading', { name: 'Mastery Status' }).closest('section');
    expect(masterySection).not.toBeNull();
    expect(within(masterySection as HTMLElement).getByText('50,000')).toBeInTheDocument();
    expect(within(masterySection as HTMLElement).getByText(/PJs: 8/)).toBeInTheDocument();

    const towerSection = screen.getByRole('heading', { name: 'Tower Need' }).closest('section');
    expect(towerSection).not.toBeNull();
    expect(within(towerSection as HTMLElement).getByText('Tower Level 304')).toBeInTheDocument();

    const recipeSection = screen.getByRole('heading', { name: 'Direct Recipe Inputs' }).closest('section');
    expect(recipeSection).not.toBeNull();
    expect(within(recipeSection as HTMLElement).getByRole('link', { name: 'Glass Orb' })).toHaveAttribute(
      'href',
      '/items/glass%20orb',
    );
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
