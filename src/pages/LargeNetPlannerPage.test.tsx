import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LargeNetPlannerPage } from './LargeNetPlannerPage';

const loadItemCatalogMock = vi.fn();
const loadDropRateReferenceMock = vi.fn();
const loadPetSourceReferenceMock = vi.fn();

vi.mock('../lib/loadItemCatalog', () => ({
  loadItemCatalog: (...args: unknown[]) => loadItemCatalogMock(...args),
}));

vi.mock('../lib/loadDropRateReference', () => ({
  loadDropRateReference: (...args: unknown[]) => loadDropRateReferenceMock(...args),
}));

vi.mock('../lib/loadPetSourceReference', () => ({
  loadPetSourceReference: (...args: unknown[]) => loadPetSourceReferenceMock(...args),
}));

vi.mock('../lib/itemIconManifest', () => ({
  getItemIcon: () => null,
}));

describe('LargeNetPlannerPage', () => {
  afterEach(() => {
    loadItemCatalogMock.mockReset();
    loadDropRateReferenceMock.mockReset();
    loadPetSourceReferenceMock.mockReset();
    window.localStorage.clear();
  });

  function mockResources(): void {
    loadItemCatalogMock.mockResolvedValue({
      entries: [],
      byCanonicalKey: {},
    });
    loadDropRateReferenceMock.mockResolvedValue({
      entries: [],
      byTargetCanonicalKey: {},
      bySourceCanonicalKey: {},
    });
    loadPetSourceReferenceMock.mockResolvedValue({
      entries: [],
      byItemCanonicalKey: {},
      byPetCanonicalKey: {},
      byPetAndItemKey: {},
    });
  }

  it('labels target timeline estimates as Days and explains the formula', async () => {
    mockResources();

    render(
      <MemoryRouter>
        <LargeNetPlannerPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Large Net Planner' });
    await waitFor(() => expect(loadDropRateReferenceMock).toHaveBeenCalled());

    expect(screen.getByText('Days')).toBeInTheDocument();
    expect(screen.queryByText('Solo days')).not.toBeInTheDocument();
    expect(screen.getByRole('note', {
      name: /Days estimates this target by itself/i,
    })).toHaveAttribute(
      'title',
      expect.stringContaining('target minus regular inventory and effective stored pet inventory'),
    );
  });

  it('shows the wait-days control and after-wait result columns', async () => {
    mockResources();

    render(
      <MemoryRouter>
        <LargeNetPlannerPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Large Net Planner' });
    await waitFor(() => expect(loadDropRateReferenceMock).toHaveBeenCalled());

    expect(screen.getByLabelText('Wait days')).toHaveValue(7);
    expect(screen.getByText('Remaining after wait')).toBeInTheDocument();
    expect(screen.getByText('LN after wait')).toBeInTheDocument();
  });
});
