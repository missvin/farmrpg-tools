import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MEMORY_HELPER_STORAGE_KEY } from '../lib/memoryHelperState';
import { MemoryHelperPage } from './MemoryHelperPage';

const getItemIconMock = vi.fn();
const loadLocalItemReferenceLookupMock = vi.fn();

vi.mock('../lib/itemIconManifest', () => ({
  getItemIcon: (...args: unknown[]) => getItemIconMock(...args),
}));

vi.mock('../lib/localItemReferenceLookup', async () => {
  const actual = await vi.importActual<typeof import('../lib/localItemReferenceLookup')>(
    '../lib/localItemReferenceLookup',
  );

  return {
    ...actual,
    loadLocalItemReferenceLookup: (...args: unknown[]) => loadLocalItemReferenceLookupMock(...args),
  };
});

function mockLookup(): void {
  loadLocalItemReferenceLookupMock.mockResolvedValue({
    itemCatalog: {
      entries: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          masteryPossible: 'yes',
          farmrpgItemId: null,
          buddySlug: null,
          sourceDatasets: ['test'],
          notes: null,
        },
        {
          itemName: 'Gold Cucumber',
          canonicalKey: 'gold cucumber',
          masteryPossible: 'yes',
          farmrpgItemId: null,
          buddySlug: null,
          sourceDatasets: ['test'],
          notes: null,
        },
      ],
      byCanonicalKey: {
        board: {
          itemName: 'Board',
          canonicalKey: 'board',
          masteryPossible: 'yes',
          farmrpgItemId: null,
          buddySlug: null,
          sourceDatasets: ['test'],
          notes: null,
        },
        'gold cucumber': {
          itemName: 'Gold Cucumber',
          canonicalKey: 'gold cucumber',
          masteryPossible: 'yes',
          farmrpgItemId: null,
          buddySlug: null,
          sourceDatasets: ['test'],
          notes: null,
        },
      },
    },
    aliases: {
      entries: [],
      byAliasKey: {},
      approvedByAliasKey: {},
    },
    museumCoverage: {
      entries: [],
      byCanonicalKey: {},
    },
  });

  getItemIconMock.mockImplementation((canonicalKey: string) =>
    canonicalKey === 'board'
      ? {
          itemName: 'Board',
          canonicalKey: 'board',
          src: '/icons/board.png',
        }
      : null,
  );
}

describe('MemoryHelperPage', () => {
  afterEach(() => {
    window.localStorage.clear();
    getItemIconMock.mockReset();
    loadLocalItemReferenceLookupMock.mockReset();
  });

  it('records revealed items, detects a pair, marks it matched, and persists the board', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: 'Memory Helper' });
    await waitFor(() => expect(loadLocalItemReferenceLookupMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));
    await user.type(screen.getByLabelText('Item'), 'Board');
    await user.click(screen.getByRole('button', { name: 'Save Slot' }));

    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 2 empty' }));
    await user.type(screen.getByLabelText('Item'), 'Board');
    await user.click(screen.getByRole('button', { name: 'Save Slot' }));

    const pairsSection = screen.getByRole('heading', { name: 'Pairs' }).closest('section');
    expect(pairsSection).not.toBeNull();
    expect(within(pairsSection as HTMLElement).getByText('R1 C1, R1 C2')).toBeInTheDocument();
    expect(screen.getAllByText('Pair found')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Mark Board matched' }));

    expect(screen.getByRole('button', { name: 'Slot row 1 column 1 Board' })).toHaveClass(
      'memory-helper-cell--matched',
    );
    expect(screen.getByRole('button', { name: 'Slot row 1 column 2 Board' })).toHaveClass(
      'memory-helper-cell--matched',
    );
    expect(window.localStorage.getItem(MEMORY_HELPER_STORAGE_KEY)).toContain('"canonicalKey":"board"');
  });

  it('supports reset and one-step undo from the page controls', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: 'Memory Helper' });
    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));
    await user.type(screen.getByLabelText('Item'), 'Gold Cucumber');
    await user.click(screen.getByRole('button', { name: 'Save Slot' }));

    expect(screen.getByRole('button', { name: 'Slot row 1 column 1 Gold Cucumber' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Slot row 1 column 1 Gold Cucumber' })).toBeInTheDocument();
  });

  it('keeps unknown item entries visible with a warning', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: 'Memory Helper' });
    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));
    await user.type(screen.getByLabelText('Item'), 'Mystery Token');
    await user.click(screen.getByRole('button', { name: 'Save Slot' }));

    expect(screen.getByRole('button', { name: 'Slot row 1 column 1 Mystery Token' })).toBeInTheDocument();
    expect(screen.getByText('No local item reference coverage found; keep this visible as a review candidate.')).toBeInTheDocument();
  });
});
