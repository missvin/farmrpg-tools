import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TowerProgressPage } from './TowerProgressPage';

const getLatestSnapshotMock = vi.fn();
const loadTowerRequirementsMock = vi.fn();
const loadMasteryDifficultyMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

vi.mock('../lib/loadTowerRequirements', () => ({
  loadTowerRequirements: (...args: unknown[]) => loadTowerRequirementsMock(...args),
}));

vi.mock('../lib/loadMasteryDifficulty', () => ({
  loadMasteryDifficulty: (...args: unknown[]) => loadMasteryDifficultyMock(...args),
}));

describe('TowerProgressPage', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    loadTowerRequirementsMock.mockReset();
    loadMasteryDifficultyMock.mockReset();
  });

  it('renders planning summaries, difficulty breakdown, and progress bars from unique tower items', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 150_000,
        'gold cucumber': 50_000,
        'red diamond fish': 5_000,
      },
      parseSummary: {
        itemsParsed: 3,
        parsedRowsCount: 0,
        tiersDetected: [10_000, 100_000, 1_000_000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [],
    });

    loadTowerRequirementsMock.mockResolvedValue({
      entries: [
        {
          towerLevel: 201,
          towerLevelRange: '201-220',
          slotIndex: 1,
          itemName: 'Board',
          canonicalKey: 'board',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 205,
          towerLevelRange: '201-220',
          slotIndex: 1,
          itemName: 'Board',
          canonicalKey: 'board',
          masteryLevelNeeded: 'MM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 301,
          towerLevelRange: '301-320',
          slotIndex: 1,
          itemName: 'Gold Cucumber',
          canonicalKey: 'gold cucumber',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 302,
          towerLevelRange: '301-320',
          slotIndex: 1,
          itemName: 'Red Diamond Fish',
          canonicalKey: 'red diamond fish',
          masteryLevelNeeded: 'M',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
      ],
      byCanonicalKey: {
        board: [],
        'gold cucumber': [],
        'red diamond fish': [],
      },
    });

    loadMasteryDifficultyMock.mockResolvedValue({
      entries: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          difficulty: 1,
          method: 'Crafting',
          notes: 'Passive',
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          itemName: 'Gold Cucumber',
          canonicalKey: 'gold cucumber',
          difficulty: 9,
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
      ],
      byCanonicalKey: {
        board: {
          itemName: 'Board',
          canonicalKey: 'board',
          difficulty: 1,
          method: 'Crafting',
          notes: 'Passive',
          tags: null,
          passiveCraftworksInfo: null,
          farmrpgItemId: null,
          buddyItemId: null,
          buddySlug: null,
          sourceSheet: null,
          sourceRow: null,
        },
        'gold cucumber': {
          itemName: 'Gold Cucumber',
          canonicalKey: 'gold cucumber',
          difficulty: 9,
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
      },
    });

    render(<TowerProgressPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tower Progress' })).toBeInTheDocument();
    });

    expect(screen.getByText('Items left to GM')).toBeInTheDocument();
    expect(screen.getByText('Items left to MM')).toBeInTheDocument();
    expect(screen.getByText('Total mastery remaining')).toBeInTheDocument();
    const difficultySection = screen.getByRole('heading', { name: 'Difficulty Breakdown' }).closest('section');
    const difficultyNineBucket = within(difficultySection as HTMLElement).getByRole('heading', { name: 'Difficulty 9' }).closest('details');
    const unratedBucket = within(difficultySection as HTMLElement).getByRole('heading', { name: 'Unrated' }).closest('details');

    expect(difficultyNineBucket).not.toBeNull();
    expect(unratedBucket).not.toBeNull();
    expect(within(difficultyNineBucket as HTMLElement).getByText('1 / 1 items remaining')).toBeInTheDocument();
    expect(within(difficultyNineBucket as HTMLElement).getByText('50k / 100k mastery remaining')).toBeInTheDocument();
    expect(within(difficultyNineBucket as HTMLElement).getByText('0.0% of items complete')).toBeInTheDocument();
    expect(within(difficultyNineBucket as HTMLElement).getByText('50.0% complete toward target mastery')).toBeInTheDocument();
    expect(within(unratedBucket as HTMLElement).getByText('5k / 10k mastery remaining')).toBeInTheDocument();
    expect(within(difficultyNineBucket as HTMLElement).getByText('Gold Cucumber')).toBeInTheDocument();
    expect(within(difficultyNineBucket as HTMLElement).getByText('Range 301-320 | Slot 1')).toBeInTheDocument();
    expect(within(difficultyNineBucket as HTMLElement).getByText('GM')).toBeInTheDocument();

    const remainingItemsSection = screen.getByRole('heading', { name: 'Remaining Tower Items' }).closest('section');
    const boardItem = within(remainingItemsSection as HTMLElement).getByText('Board').closest('li');
    expect(boardItem).not.toBeNull();
    expect(within(boardItem as HTMLElement).getByText('150,000 / 1,000,000')).toBeInTheDocument();
    expect(within(boardItem as HTMLElement).getByText('Target: MM (1M)')).toBeInTheDocument();
    expect(screen.getByLabelText('Board progress')).toBeInTheDocument();
    expect(within(boardItem as HTMLElement).getByLabelText('Extra reference details for Board')).toHaveAttribute(
      'title',
      'Method: Crafting\nNotes: Passive',
    );
    expect(within(boardItem as HTMLElement).queryByText('Method: Crafting')).not.toBeInTheDocument();
    expect(within(boardItem as HTMLElement).queryByText('Notes: Passive')).not.toBeInTheDocument();
  });

  it('surfaces unmatched snapshot items and missing mastery difficulty rows without failing', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-2',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 1_500_000,
      },
      parseSummary: {
        itemsParsed: 1,
        parsedRowsCount: 0,
        tiersDetected: [1_000_000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [],
    });

    loadTowerRequirementsMock.mockResolvedValue({
      entries: [
        {
          towerLevel: 205,
          towerLevelRange: '201-220',
          slotIndex: 1,
          itemName: 'Board',
          canonicalKey: 'board',
          masteryLevelNeeded: 'MM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 301,
          towerLevelRange: '301-320',
          slotIndex: 1,
          itemName: 'Gold Flier',
          canonicalKey: 'gold flier',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
      ],
      byCanonicalKey: {
        board: [],
        'gold flier': [],
      },
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

    render(<TowerProgressPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tower Progress' })).toBeInTheDocument();
    });

    expect(screen.getByText(/Unmatched tower items in the latest snapshot: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Unrated tower items in mastery difficulty data: 1/)).toBeInTheDocument();
    expect(screen.getByText(/These mismatches stay visible and non-fatal/)).toBeInTheDocument();
    const remainingItemsSection = screen.getByRole('heading', { name: 'Remaining Tower Items' }).closest('section');
    expect(within(remainingItemsSection as HTMLElement).getByText('Gold Flier')).toBeInTheDocument();
    expect(within(remainingItemsSection as HTMLElement).getByText('Missing from mastery difficulty data; shown as Unrated.')).toBeInTheDocument();
    expect(within(remainingItemsSection as HTMLElement).getByText('Unmatched in latest snapshot; treated as 0 mastery.')).toBeInTheDocument();
  });

  it('keeps repeated tower requirement rows independent inside the difficulty drilldown', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-3',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 150_000,
      },
      parseSummary: {
        itemsParsed: 1,
        parsedRowsCount: 0,
        tiersDetected: [100_000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [],
    });

    loadTowerRequirementsMock.mockResolvedValue({
      entries: [
        {
          towerLevel: 205,
          towerLevelRange: '201-220',
          slotIndex: 1,
          itemName: 'Board',
          canonicalKey: 'board',
          masteryLevelNeeded: 'MM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 312,
          towerLevelRange: '301-320',
          slotIndex: 2,
          itemName: 'Board',
          canonicalKey: 'board',
          masteryLevelNeeded: 'MM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: 'Repeat row',
          sourceSheet: null,
          sourceRow: null,
        },
      ],
      byCanonicalKey: {
        board: [],
      },
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

    render(<TowerProgressPage />);

    const difficultySection = await screen.findByRole('heading', { name: 'Difficulty Breakdown' });
    const difficultyOneBucket = within(difficultySection.closest('section') as HTMLElement)
      .getByRole('heading', { name: 'Difficulty 1' })
      .closest('details');

    expect(difficultyOneBucket).not.toBeNull();
    expect(within(difficultyOneBucket as HTMLElement).getAllByText('Board')).toHaveLength(2);
    expect(within(difficultyOneBucket as HTMLElement).getByText('Range 201-220 | Slot 1')).toBeInTheDocument();
    expect(within(difficultyOneBucket as HTMLElement).getByText('Range 301-320 | Slot 2')).toBeInTheDocument();
  });
});
