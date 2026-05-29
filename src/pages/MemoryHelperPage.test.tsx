import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MEMORY_HELPER_STORAGE_KEY } from '../lib/memoryHelperState';
import { MemoryHelperPage } from './MemoryHelperPage';

const getItemIconMock = vi.fn();
const loadLocalItemReferenceLookupMock = vi.fn();
const loadMemoryGameAllowedItemsMock = vi.fn();

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

vi.mock('../lib/loadMemoryGameAllowedItems', async () => {
  const actual = await vi.importActual<typeof import('../lib/loadMemoryGameAllowedItems')>(
    '../lib/loadMemoryGameAllowedItems',
  );

  return {
    ...actual,
    loadMemoryGameAllowedItems: (...args: unknown[]) => loadMemoryGameAllowedItemsMock(...args),
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
    museumCanon: {
      entries: [
        {
          museumCategory: 'Items',
          categoryKey: 'items',
          slotIndex: 543,
          itemName: 'Mug of Beer',
          canonicalKey: 'mug of beer',
          obtainable: true,
          reviewStatus: 'source_parsed',
          source: 'test',
          notes: null,
        },
      ],
      byCategoryKey: {
        items: [
          {
            museumCategory: 'Items',
            categoryKey: 'items',
            slotIndex: 543,
            itemName: 'Mug of Beer',
            canonicalKey: 'mug of beer',
            obtainable: true,
            reviewStatus: 'source_parsed',
            source: 'test',
            notes: null,
          },
        ],
      },
    },
  });
  loadMemoryGameAllowedItemsMock.mockResolvedValue({
    entries: [
      {
        itemName: 'Board',
        canonicalKey: 'board',
        observedTiers: ['4'],
        observedSources: ['Rebecca tier 4 board'],
        notes: null,
      },
      {
        itemName: 'Mug of Beer',
        canonicalKey: 'mug of beer',
        observedTiers: ['4'],
        observedSources: ['Queen Shay tier 4', 'Hoff86 tier 4'],
        notes: null,
      },
    ],
    byCanonicalKey: {
      board: {
        itemName: 'Board',
        canonicalKey: 'board',
        observedTiers: ['4'],
        observedSources: ['Rebecca tier 4 board'],
        notes: null,
      },
      'mug of beer': {
        itemName: 'Mug of Beer',
        canonicalKey: 'mug of beer',
        observedTiers: ['4'],
        observedSources: ['Queen Shay tier 4', 'Hoff86 tier 4'],
        notes: null,
      },
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
    loadMemoryGameAllowedItemsMock.mockReset();
  });

  it('records revealed items, detects a pair, marks it matched, and persists the board', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: "Borgen's Lost and Found" });
    await waitFor(() => expect(loadLocalItemReferenceLookupMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));
    await user.type(screen.getByLabelText('Item'), 'Board');
    await user.click(screen.getByRole('button', { name: 'Save Slot' }));

    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 2 empty' }));
    await user.click(screen.getByRole('button', { name: 'Use Board from R1 C1' }));

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

  it('suggests substring item matches and saves the selected suggestion', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: "Borgen's Lost and Found" });
    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));
    await user.type(screen.getByLabelText('Item'), 'beer');

    const option = screen.getByRole('option', { name: /Mug of Beer/ });
    expect(option).toBeInTheDocument();
    expect(within(option).getByText("Borgen's Lost and Found")).toBeInTheDocument();

    await user.click(within(option).getByRole('button', { name: /Mug of Beer/ }));

    expect(screen.getByRole('button', { name: 'Slot row 1 column 1 Mug of Beer' })).toBeInTheDocument();
    expect(screen.queryByText('Recognized from museum completion canon only; do not infer mastery eligibility.')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(MEMORY_HELPER_STORAGE_KEY)).toContain('"canonicalKey":"mug of beer"');
  });

  it('offers observed memory game items as quick picks', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: "Borgen's Lost and Found" });
    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));

    const itemInput = screen.getByLabelText('Item');
    const observedHeading = screen.getByRole('heading', { name: 'Observed Items' });
    const observedSection = screen.getByRole('heading', { name: 'Observed Items' }).closest('section');
    expect(itemInput.compareDocumentPosition(observedHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(observedSection).not.toBeNull();
    expect(within(observedSection as HTMLElement).getByRole('button', { name: 'Use observed Mug of Beer' })).toBeInTheDocument();

    await user.click(within(observedSection as HTMLElement).getByRole('button', { name: 'Use observed Mug of Beer' }));

    expect(screen.getByRole('button', { name: 'Slot row 1 column 1 Mug of Beer' })).toBeInTheDocument();
  });

  it('keeps seen-once items out of observed quick picks', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: "Borgen's Lost and Found" });
    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'Use observed Board' }));
    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 2 empty' }));

    const seenOnceSection = screen.getByRole('heading', { name: 'Seen Once' }).closest('section');
    const observedSection = screen.getByRole('heading', { name: 'Observed Items' }).closest('section');
    const itemInput = screen.getByLabelText('Item');
    const seenOnceHeading = screen.getByRole('heading', { name: 'Seen Once' });

    expect(itemInput.compareDocumentPosition(seenOnceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(seenOnceSection).not.toBeNull();
    expect(observedSection).not.toBeNull();
    expect(within(seenOnceSection as HTMLElement).getByRole('button', { name: 'Use Board from R1 C1' })).toBeInTheDocument();
    expect(within(observedSection as HTMLElement).queryByRole('button', { name: 'Use observed Board' })).not.toBeInTheDocument();
    expect(within(observedSection as HTMLElement).getByRole('button', { name: 'Use observed Mug of Beer' })).toBeInTheDocument();
  });

  it('focuses the item search input when a slot is selected', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: "Borgen's Lost and Found" });
    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));

    expect(screen.getByLabelText('Item')).toHaveFocus();
  });

  it('supports reset and one-step undo from the page controls', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<MemoryHelperPage />);

    await screen.findByRole('heading', { name: "Borgen's Lost and Found" });
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

    await screen.findByRole('heading', { name: "Borgen's Lost and Found" });
    await user.click(screen.getByRole('button', { name: 'Slot row 1 column 1 empty' }));
    await user.type(screen.getByLabelText('Item'), 'Mystery Token');
    await user.click(screen.getByRole('button', { name: 'Save Slot' }));

    expect(screen.getByRole('button', { name: 'Slot row 1 column 1 Mystery Token' })).toBeInTheDocument();
    expect(screen.getByText('No local item reference coverage found; keep this visible as a review candidate.')).toBeInTheDocument();
  });
});
