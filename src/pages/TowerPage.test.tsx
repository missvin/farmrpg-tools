import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TowerPage } from './TowerPage';

const getLatestSnapshotMock = vi.fn();
const loadTowerRequirementsMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

vi.mock('../lib/loadTowerRequirements', () => ({
  loadTowerRequirements: (...args: unknown[]) => loadTowerRequirementsMock(...args),
}));

describe('TowerPage', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    loadTowerRequirementsMock.mockReset();
  });

  it('groups completed ranges separately while keeping incomplete ranges visible by default', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 1_500_000,
        'gold cucumber': 1_500_000,
        'red diamond fish': 5_000,
      },
      parseSummary: {
        itemsParsed: 3,
        parsedRowsCount: 0,
        tiersDetected: [10_000, 1_000_000],
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
          masteryLevelNeeded: 'MM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 201,
          towerLevelRange: '201-220',
          slotIndex: 2,
          itemName: 'Gold Cucumber',
          canonicalKey: 'gold cucumber',
          masteryLevelNeeded: 'MM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 202,
          towerLevelRange: '201-220',
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
        {
          towerLevel: 221,
          towerLevelRange: '221-240',
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
      ],
      byCanonicalKey: {
        board: [],
        'gold cucumber': [],
        'red diamond fish': [],
      },
    });

    render(<TowerPage />);

    await waitFor(() => {
      expect(screen.getByText('Tower Requirement Status')).toBeInTheDocument();
    });

    const completedRanges = screen.getByText('Completed ranges').closest('details');
    const incompleteRange = screen.getByText('Tower Levels 201-220').closest('details');
    const completedRange = screen.getByText('Tower Levels 221-240').closest('details');
    const completedLevel = screen.getByText('Tower Level 201 - 0/2 items remaining').closest('details');
    const incompleteLevel = screen.getByText('Tower Level 202 - 1/1 items remaining').closest('details');

    expect(completedRanges).not.toBeNull();
    expect(incompleteRange).not.toBeNull();
    expect(completedRange).not.toBeNull();
    expect(completedLevel).not.toBeNull();
    expect(incompleteLevel).not.toBeNull();
    expect((completedRanges as HTMLDetailsElement).open).toBe(false);
    expect((incompleteRange as HTMLDetailsElement).open).toBe(true);
    expect((completedRange as HTMLDetailsElement).open).toBe(false);
    expect((completedLevel as HTMLDetailsElement).open).toBe(false);
    expect((incompleteLevel as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText(/Next relevant level/)).toBeInTheDocument();
    expect(screen.getByText(/Missing latest-snapshot matches are non-fatal/)).toBeInTheDocument();
    expect(
      screen.getByText('Next blocking requirement: Red Diamond Fish (Requires Mastered (>= 10,000))'),
    ).toBeInTheDocument();
  });

  it('keeps the next blocking requirement visible and highlighted inside the first incomplete range', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-2',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 1_500_000,
        'gold cucumber': 50_000,
      },
      parseSummary: {
        itemsParsed: 2,
        parsedRowsCount: 0,
        tiersDetected: [100_000, 1_000_000],
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
          towerLevel: 202,
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
          towerLevel: 202,
          towerLevelRange: '201-220',
          slotIndex: 2,
          itemName: 'Gold Cucumber',
          canonicalKey: 'gold cucumber',
          masteryLevelNeeded: 'MM',
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
      },
    });

    render(<TowerPage />);

    await waitFor(() => {
      expect(screen.getByText('Tower Requirement Status')).toBeInTheDocument();
    });

    const incompleteRange = screen.getByText('Tower Levels 201-220').closest('details');
    expect(incompleteRange).not.toBeNull();
    expect((incompleteRange as HTMLDetailsElement).open).toBe(true);

    const incompleteLevel = screen.getByText('Tower Level 202 - 1/2 items remaining').closest('details');
    expect(incompleteLevel).not.toBeNull();

    const row = within(incompleteLevel as HTMLElement)
      .getByText('Gold Cucumber')
      .closest('tr');

    expect(row).toHaveClass('summary-table__row--highlight');
    expect(
      screen.getByText('Next blocking requirement: Gold Cucumber (Requires Mega Mastered (>= 1,000,000))'),
    ).toBeInTheDocument();
  });

  it('uses compact default requirement labels and planning-oriented columns in the detail table', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-3',
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
          towerLevel: 202,
          towerLevelRange: '201-220',
          slotIndex: 1,
          itemName: 'Board',
          canonicalKey: 'board',
          masteryLevelNeeded: 'MM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: 'Passive source',
          sourceSheet: null,
          sourceRow: null,
        },
      ],
      byCanonicalKey: {
        board: [],
      },
    });

    render(<TowerPage />);

    await waitFor(() => {
      expect(screen.getByText('Tower Requirement Status')).toBeInTheDocument();
    });

    expect(screen.getAllByText('MM').length).toBeGreaterThan(0);
    expect(screen.getByText('% complete')).toBeInTheDocument();
    expect(screen.queryByText('Match')).not.toBeInTheDocument();
    expect(screen.queryByText('Slot')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    expect(screen.getByText('Slot 1')).toBeInTheDocument();
    expect(screen.getByText('Note: Passive source')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByText('Requires Mega Mastered (>= 1,000,000)')).not.toBeInTheDocument();
  });
});
