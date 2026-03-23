import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardPage } from './DashboardPage';

const getLatestSnapshotMock = vi.fn();
const loadMasteryDifficultyMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

vi.mock('../lib/loadMasteryDifficulty', () => ({
  loadMasteryDifficulty: (...args: unknown[]) => loadMasteryDifficultyMock(...args),
}));

describe('DashboardPage', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    loadMasteryDifficultyMock.mockReset();
  });

  it('renders soft percent fills in the mastery difficulty summary table', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-03-23T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 150000,
        twine: 25000,
        straw: 2500,
        mystery: 500,
      },
      parseSummary: {
        itemsParsed: 4,
        parsedRowsCount: 4,
        tiersDetected: [10000, 100000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [],
    });

    loadMasteryDifficultyMock.mockResolvedValue({
      entries: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          difficulty: 1,
          method: null,
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
          difficulty: 1,
          method: null,
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
          itemName: 'Straw',
          canonicalKey: 'straw',
          difficulty: 1,
          method: null,
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
          itemName: 'Mystery',
          canonicalKey: 'mystery',
          difficulty: 1,
          method: null,
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
          method: null,
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
          difficulty: 1,
          method: null,
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        straw: {
          itemName: 'Straw',
          canonicalKey: 'straw',
          difficulty: 1,
          method: null,
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        mystery: {
          itemName: 'Mystery',
          canonicalKey: 'mystery',
          difficulty: 1,
          method: null,
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

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mastery Difficulty Summary' })).toBeInTheDocument();
    });

    const difficultyRow = screen.getByRole('row', { name: /difficulty 1/i });
    const percentCells = within(difficultyRow)
      .getAllByText(/\(\d+\.\d%?\)/)
      .map((cellText) => cellText.closest('td'));

    expect(percentCells[0]).toHaveClass('dashboard-percent-cell');
    expect(percentCells[0]).toHaveStyle('--dashboard-percent-fill: 50%');
    expect(percentCells[1]).toHaveStyle('--dashboard-percent-fill: 25%');
    expect(percentCells[2]).toHaveStyle('--dashboard-percent-fill: 0%');
  });

  it('renders achieved status summary fills based on items parsed', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-2',
      createdAt: '2026-03-23T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 150000,
        twine: 25000,
        straw: 2500,
        mystery: 500,
      },
      parseSummary: {
        itemsParsed: 4,
        parsedRowsCount: 4,
        tiersDetected: [10000, 100000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [],
    });

    loadMasteryDifficultyMock.mockResolvedValue({
      entries: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          difficulty: 1,
          method: null,
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
          difficulty: 1,
          method: null,
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
          itemName: 'Straw',
          canonicalKey: 'straw',
          difficulty: 1,
          method: null,
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
          method: null,
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
          difficulty: 1,
          method: null,
          notes: null,
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        straw: {
          itemName: 'Straw',
          canonicalKey: 'straw',
          difficulty: 1,
          method: null,
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

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Achieved Status Summary' })).toBeInTheDocument();
    });

    const achievedSection = screen.getByRole('heading', { name: 'Achieved Status Summary' }).closest('section');
    const achievedSectionQueries = within(achievedSection as HTMLElement);
    const masteredCard = achievedSectionQueries.getByText('Mastered (>= 10,000)').closest('div');
    const grandMasteredCard = achievedSectionQueries.getByText('Grand Mastered (>= 100,000)').closest('div');
    const megaMasteredCard = achievedSectionQueries.getByText('Mega Mastered (>= 1,000,000)').closest('div');
    const unmatchedCard = achievedSectionQueries.getByText('Unmatched snapshot items').closest('div');

    expect(masteredCard).toHaveClass('summary-grid__item', 'summary-grid__item--progress');
    expect(masteredCard).toHaveStyle('--summary-progress-fill: 50%');
    expect(grandMasteredCard).toHaveStyle('--summary-progress-fill: 25%');
    expect(megaMasteredCard).toHaveStyle('--summary-progress-fill: 0%');
    expect(unmatchedCard).toHaveStyle('--summary-progress-fill: 25%');
    expect(achievedSectionQueries.getByText('50.0% of parsed items')).toBeInTheDocument();
  });
});
