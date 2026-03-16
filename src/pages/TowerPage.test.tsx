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

  it('collapses completed levels by default and keeps the first incomplete level open', async () => {
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
        tiersDetected: [10_000, 1_000_000],
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

    const completedLevel = screen.getByText('Tower Level 201').closest('details');
    const incompleteLevel = screen.getByText('Tower Level 202').closest('details');

    expect(completedLevel).not.toBeNull();
    expect(incompleteLevel).not.toBeNull();
    expect((completedLevel as HTMLDetailsElement).open).toBe(false);
    expect((incompleteLevel as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText(/Next relevant level/)).toBeInTheDocument();
    expect(
      screen.getByText('Next blocking requirement: Red Diamond Fish (Requires Mastered (>= 10,000))'),
    ).toBeInTheDocument();
  });

  it('highlights the next blocking requirement within the first incomplete level', async () => {
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
        tiersDetected: [100_000, 1_000_000],
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

    const incompleteLevel = screen.getByText('Tower Level 202').closest('details');
    expect(incompleteLevel).not.toBeNull();

    const row = within(incompleteLevel as HTMLElement)
      .getByText('Gold Cucumber')
      .closest('tr');

    expect(row).toHaveClass('summary-table__row--highlight');
  });
});
