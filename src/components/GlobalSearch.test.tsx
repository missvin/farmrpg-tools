import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GlobalSearch } from './GlobalSearch';

const getLatestSnapshotMock = vi.fn();
const loadItemCatalogMock = vi.fn();
const loadTowerRequirementsMock = vi.fn();
const loadRecipeGraphMock = vi.fn();
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

vi.mock('../lib/itemIconManifest', () => ({
  getItemIcon: (...args: unknown[]) => getItemIconMock(...args),
}));

function LocationReadout() {
  const location = useLocation();
  return <p>{location.pathname}</p>;
}

describe('GlobalSearch', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    loadItemCatalogMock.mockReset();
    loadTowerRequirementsMock.mockReset();
    loadRecipeGraphMock.mockReset();
    getItemIconMock.mockReset();
  });

  function mockSearchResources(): void {
    getLatestSnapshotMock.mockResolvedValue(null);
    loadItemCatalogMock.mockResolvedValue({
      entries: [
        {
          itemName: 'Tin Scraps',
          canonicalKey: 'tin scraps',
        },
      ],
    });
    loadTowerRequirementsMock.mockResolvedValue({
      entries: [],
    });
    loadRecipeGraphMock.mockResolvedValue({
      recipes: [],
    });
    getItemIconMock.mockImplementation((canonicalKey: string) =>
      canonicalKey === 'tin scraps' ? { src: '/icons/tin-scraps.png' } : null,
    );
  }

  it('shows item icons and supports keyboard navigation to an item result', async () => {
    mockSearchResources();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <GlobalSearch />
        <Routes>
          <Route path="*" element={<LocationReadout />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Search pages and items'), 'scrap');

    const result = await screen.findByRole('link', { name: /Tin Scraps/ });
    expect(result.querySelector('img')).toHaveAttribute('src', '/icons/tin-scraps.png');

    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      expect(screen.getByText('/items/tin%20scraps')).toBeInTheDocument();
    });
  });
  it('matches pages by route metadata aliases', async () => {
    mockSearchResources();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <GlobalSearch />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Search pages and items'), 'pj');

    expect(await screen.findByRole('link', { name: /Tower Items by Difficulty/ })).toHaveAttribute(
      'href',
      '/tower-progress',
    );
  });

  it('shows explicit action results for command-style searches', async () => {
    mockSearchResources();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <GlobalSearch />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Search pages and items'), 'restore backup');

    expect(await screen.findByRole('heading', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Restore a local backup/ })).toHaveAttribute(
      'href',
      '/settings#settings-restore-title',
    );
  });

  it('opens the top action result from the keyboard', async () => {
    mockSearchResources();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <GlobalSearch />
        <Routes>
          <Route path="*" element={<LocationReadout />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Search pages and items'), 'compare progress');
    await screen.findByRole('link', { name: /Compare saved snapshots/ });
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('/compare')).toBeInTheDocument();
    });
  });
});
