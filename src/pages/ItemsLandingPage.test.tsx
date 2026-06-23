import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ItemsLandingPage } from './ItemsLandingPage';

const getLatestSnapshotMock = vi.fn();
const loadItemCatalogMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

vi.mock('../lib/loadItemCatalog', () => ({
  loadItemCatalog: (...args: unknown[]) => loadItemCatalogMock(...args),
}));

vi.mock('../lib/itemIconManifest', () => ({
  getItemIcon: vi.fn().mockReturnValue(null),
}));

function renderItemsLandingPage() {
  return render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ItemsLandingPage />
    </MemoryRouter>,
  );
}

function catalogEntry(itemName: string, canonicalKey: string, masteryPossible: 'yes' | 'no' | 'unknown' = 'yes') {
  return {
    itemName,
    canonicalKey,
    masteryPossible,
    farmrpgItemId: null,
    buddySlug: null,
    sourceDatasets: ['test'],
    notes: null,
  };
}

describe('ItemsLandingPage', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    loadItemCatalogMock.mockReset();
    window.localStorage.clear();
  });

  it('lists local item profiles and points missing data states to import or restore actions', async () => {
    const user = userEvent.setup();

    loadItemCatalogMock.mockResolvedValue({
      entries: [
        catalogEntry('Red Dye', 'red dye'),
        catalogEntry('Large Net', 'large net'),
        catalogEntry('Wooden Box', 'wooden box', 'no'),
      ],
      byCanonicalKey: {},
    });
    getLatestSnapshotMock.mockResolvedValue(null);

    renderItemsLandingPage();

    expect(await screen.findByRole('heading', { name: 'Items' })).toBeInTheDocument();
    expect(screen.getByText('3 known local items are available.')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import mastery' })).toHaveAttribute('href', '/import');
    expect(screen.getByRole('link', { name: 'restore backup' })).toHaveAttribute(
      'href',
      '/settings#settings-restore-title',
    );

    expect(screen.getByRole('link', { name: /Red Dye/ })).toHaveAttribute('href', '/items/red%20dye');

    await user.type(screen.getByLabelText('Item search'), 'large');

    expect(screen.getByRole('link', { name: /Large Net/ })).toHaveAttribute('href', '/items/large%20net');
    expect(screen.queryByRole('link', { name: /Red Dye/ })).not.toBeInTheDocument();
  });

  it('keeps the page usable when the local item catalog cannot be read', async () => {
    loadItemCatalogMock.mockRejectedValue(new Error('Unable to load local item catalog data.'));
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-03-23T00:00:00.000Z',
      rawText: '',
      masteryByItem: {},
      parseSummary: {
        itemsParsed: 0,
        parsedRowsCount: 0,
        tiersDetected: [],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [],
    });

    renderItemsLandingPage();

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Unable to load local item catalog data.')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByLabelText('Item search')).toBeInTheDocument();
  });
});