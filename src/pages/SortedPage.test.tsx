import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SortedPage } from './SortedPage';

const getLatestSnapshotMock = vi.fn();
const loadMasteryDifficultyMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

vi.mock('../lib/loadMasteryDifficulty', () => ({
  loadMasteryDifficulty: (...args: unknown[]) => loadMasteryDifficultyMock(...args),
}));

describe('SortedPage', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    loadMasteryDifficultyMock.mockReset();
  });

  it('explains unmatched mastery rows and the existing CSV export affordance', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-03-18T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 150000,
        'mystery item': 9000,
      },
      parseSummary: {
        itemsParsed: 2,
        parsedRowsCount: 2,
        tiersDetected: [10000, 100000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [
        {
          rawItemName: 'Board',
          canonicalKey: 'board',
          count: 150000,
          targetTier: 100000,
          sourceLineIndex: 1,
        },
        {
          rawItemName: 'Mystery Item',
          canonicalKey: 'mystery item',
          count: 9000,
          targetTier: 10000,
          sourceLineIndex: 4,
        },
      ],
    });

    loadMasteryDifficultyMock.mockResolvedValue({
      entries: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          difficulty: 1,
          method: 'Crafting',
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
      ],
      byCanonicalKey: {
        board: {
          itemName: 'Board',
          canonicalKey: 'board',
          difficulty: 1,
          method: 'Crafting',
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
      },
    });

    render(<SortedPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Items Missing From Mastery Difficulty Data' })).toBeInTheDocument();
    });

    expect(screen.getByText(/They stay visible as Unrated in the sorted lists/)).toBeInTheDocument();
    expect(screen.getByText('Unmatched snapshot items')).toBeInTheDocument();
    expect(screen.getByText('Export-ready CSV rows')).toBeInTheDocument();
    expect(screen.getByText(/Missing mastery difficulty matches are non-fatal/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Missing Items CSV' })).toBeEnabled();
    expect(screen.getAllByText('Mystery Item').length).toBeGreaterThan(0);
  });

  it('supports M, GM, and MM progress modes with most-progress-first tier buckets and progress-complete item cards', async () => {
    const user = userEvent.setup();

    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-03-18T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        straw: 2500,
        twine: 25000,
        'mystery item': 9000,
        board: 150000,
      },
      parseSummary: {
        itemsParsed: 3,
        parsedRowsCount: 3,
        tiersDetected: [10000, 100000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [
        {
          rawItemName: 'Straw',
          canonicalKey: 'straw',
          count: 2500,
          targetTier: 10000,
          sourceLineIndex: 0,
        },
        {
          rawItemName: 'Twine',
          canonicalKey: 'twine',
          count: 25000,
          targetTier: 100000,
          sourceLineIndex: 1,
        },
        {
          rawItemName: 'Mystery Item',
          canonicalKey: 'mystery item',
          count: 9000,
          targetTier: 10000,
          sourceLineIndex: 2,
        },
        {
          rawItemName: 'Board',
          canonicalKey: 'board',
          count: 150000,
          targetTier: 1000000,
          sourceLineIndex: 3,
        },
      ],
    });

    loadMasteryDifficultyMock.mockResolvedValue({
      entries: [
        {
          itemName: 'Straw',
          canonicalKey: 'straw',
          difficulty: 2,
          method: 'Farming',
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          itemName: 'Twine',
          canonicalKey: 'twine',
          difficulty: 3,
          method: 'Crafting',
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          itemName: 'Board',
          canonicalKey: 'board',
          difficulty: 1,
          method: 'Crafting',
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
      ],
      byCanonicalKey: {
        straw: {
          itemName: 'Straw',
          canonicalKey: 'straw',
          difficulty: 2,
          method: 'Farming',
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        twine: {
          itemName: 'Twine',
          canonicalKey: 'twine',
          difficulty: 3,
          method: 'Crafting',
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        board: {
          itemName: 'Board',
          canonicalKey: 'board',
          difficulty: 1,
          method: 'Crafting',
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
      },
    });

    render(<SortedPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Remaining to Mastery (10,000)' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'M Left' })).toHaveClass('button--active');
    expect(screen.getByText('Straw')).toBeInTheDocument();
    expect(screen.getByText('Progress to M (10k): 25.0%')).toBeInTheDocument();

    const strawItem = screen.getByText('Straw').closest('li');
    const strawProgress = within(strawItem as HTMLElement).getByText('Progress to M (10k): 25.0%').closest('div');

    expect(strawProgress).toHaveClass('sorted-progress-cell');
    expect(strawProgress).toHaveStyle('--sorted-progress-fill: 25%');

    await user.click(screen.getByRole('button', { name: 'GM Left' }));

    expect(await screen.findByRole('heading', { name: 'Remaining to Grand Mastery (100,000)' })).toBeInTheDocument();

    const masteredSummary = screen.getByText('Mastered');
    const noTierSummary = screen.getByText('No Tier Yet');

    expect(masteredSummary.closest('details')).toHaveAttribute('open');
    expect(noTierSummary.closest('details')).not.toHaveAttribute('open');
    expect(screen.getAllByText('Unrated').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Difficulty 3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mystery Item').length).toBeGreaterThan(0);
    expect(screen.getByText('Twine')).toBeInTheDocument();
    expect(screen.getByText('Progress to GM (100k): 25.0%')).toBeInTheDocument();
    expect(screen.queryByText(/Remaining to Grand Mastery \(100,000\):/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Method:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Notes:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Difficulty 3$/, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('Board')).not.toBeInTheDocument();

    const twineItem = screen.getByText('Twine').closest('li');
    const twineProgress = within(twineItem as HTMLElement).getByText('Progress to GM (100k): 25.0%').closest('div');

    expect(twineProgress).toHaveClass('sorted-progress-cell');
    expect(twineProgress).toHaveStyle('--sorted-progress-fill: 25%');

    await user.click(screen.getByRole('button', { name: 'MM Left' }));

    expect(await screen.findByText('Grand Mastered')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
    expect(screen.getByText('Progress to MM (1M): 15.0%')).toBeInTheDocument();
  });
});
