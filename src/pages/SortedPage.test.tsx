import { render, screen, waitFor } from '@testing-library/react';
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
});
