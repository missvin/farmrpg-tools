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
        tiersDetected: [10_000, 100_000, 1_000_000],
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

    expect(screen.getByText('Items left to Grand Mastery')).toBeInTheDocument();
    expect(screen.getByText('Items left to Mega Mastery')).toBeInTheDocument();
    expect(screen.getByText('Total mastery remaining')).toBeInTheDocument();
    const difficultySection = screen.getByRole('heading', { name: 'Difficulty Breakdown' }).closest('section');
    const difficultyNineRow = within(difficultySection as HTMLElement).getAllByText('Difficulty 9')[0].closest('tr');
    const unratedRow = within(difficultySection as HTMLElement).getAllByText('Unrated')[0].closest('tr');

    expect(difficultyNineRow).not.toBeNull();
    expect(unratedRow).not.toBeNull();
    expect(within(difficultyNineRow as HTMLElement).getByText('1 / 1 items remaining')).toBeInTheDocument();
    expect(within(difficultyNineRow as HTMLElement).getByText('50k / 100k mastery remaining')).toBeInTheDocument();
    expect(within(unratedRow as HTMLElement).getByText('5k / 10k mastery remaining')).toBeInTheDocument();
    expect(screen.getByText('BL-034 remains the follow-up for accordion-style drilldown inside each difficulty bucket.')).toBeInTheDocument();

    const boardItem = screen.getByText('Board').closest('li');
    expect(boardItem).not.toBeNull();
    expect(within(boardItem as HTMLElement).getByText('150,000 / 1,000,000')).toBeInTheDocument();
    expect(within(boardItem as HTMLElement).getByText('Target: Mega Mastery (1,000,000)')).toBeInTheDocument();
    expect(screen.getByLabelText('Board progress')).toBeInTheDocument();
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
        tiersDetected: [1_000_000],
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
    expect(screen.getByText('Gold Flier')).toBeInTheDocument();
    expect(screen.getByText('Missing from mastery difficulty data; shown as Unrated.')).toBeInTheDocument();
    expect(screen.getByText('Unmatched in latest snapshot; treated as 0 mastery.')).toBeInTheDocument();
  });
});
