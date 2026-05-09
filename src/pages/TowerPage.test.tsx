import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TowerPage } from './TowerPage';
import { TowerReferenceMaintenancePage } from './TowerReferenceMaintenancePage';

const getLatestSnapshotMock = vi.fn();
const loadTowerRequirementsMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

vi.mock('../lib/loadTowerRequirements', () => ({
  loadTowerRequirements: (...args: unknown[]) => loadTowerRequirementsMock(...args),
}));

function renderTowerPage(initialEntries = ['/tower']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <TowerPage />
    </MemoryRouter>,
  );
}

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
          notes: 'Auto-craft',
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

    const { container } = renderTowerPage();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Tower requirement status' })).toBeInTheDocument();
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
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Collapsed')).not.toBeInTheDocument();
    expect(screen.getByText(/Next relevant level/)).toBeInTheDocument();
    expect(screen.queryByText('Needs progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed level')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed range')).not.toBeInTheDocument();
    expect(screen.queryByText('Tower Summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/Missing latest-snapshot matches are non-fatal/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tower Reference Maintenance')).not.toBeInTheDocument();
    expect(screen.queryByText('Note: Auto-craft')).not.toBeInTheDocument();
    expect(screen.queryByText(/Blocking requirement/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('.item-icon').length).toBeGreaterThan(0);
  });

  it('keeps multiple blocking requirements visible and highlights all blockers inside the first incomplete range', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-2',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 500_000,
        'gold cucumber': 900_000,
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

    renderTowerPage();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Tower requirement status' })).toBeInTheDocument();
    });

    const incompleteRange = screen.getByText('Tower Levels 201-220').closest('details');
    expect(incompleteRange).not.toBeNull();
    expect((incompleteRange as HTMLDetailsElement).open).toBe(true);

    const incompleteLevel = screen.getByText('Tower Level 202 - 2/2 items remaining').closest('details');
    expect(incompleteLevel).not.toBeNull();

    const goldCucumberRow = within(incompleteLevel as HTMLElement)
      .getByText('Gold Cucumber')
      .closest('tr');
    const boardRow = within(incompleteLevel as HTMLElement).getByText('Board').closest('tr');

    expect(goldCucumberRow).toHaveClass('summary-table__row--highlight');
    expect(boardRow).toHaveClass('summary-table__row--highlight');
    expect(screen.queryByText(/Blocking requirements/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Closest blocker/)).not.toBeInTheDocument();

    const goldCucumberPercentCell = within(goldCucumberRow as HTMLElement).getByText('90.0%').closest('td');
    const boardPercentCell = within(boardRow as HTMLElement).getByText('50.0%').closest('td');

    expect(goldCucumberPercentCell).toHaveClass('tower-percent-cell');
    expect(goldCucumberPercentCell).toHaveStyle('--tower-percent-fill: 90%');
    expect(boardPercentCell).toHaveStyle('--tower-percent-fill: 50%');
  });

  it('supports compact range, row-state, and requirement-tier filters for dense tower inspection', async () => {
    const user = userEvent.setup();

    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-5',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 1_500_000,
        twine: 50_000,
      },
      parseSummary: {
        itemsParsed: 2,
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
          itemName: 'Twine',
          canonicalKey: 'twine',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 311,
          towerLevelRange: '311-320',
          slotIndex: 1,
          itemName: 'TBD',
          canonicalKey: 'tbd',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: 'TBD placeholder - requirement not yet confirmed',
          sourceSheet: 'Community discovery 311-320',
          sourceRow: '311-1',
        },
      ],
      byCanonicalKey: {
        board: [],
        twine: [],
        tbd: [],
      },
    });

    renderTowerPage();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Tower requirement status' })).toBeInTheDocument();
    });

    expect(screen.getByText('Completed 1/3 tower mastery requirements (33%), with 2 remaining.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tower Requirement Status' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tower Filters')).not.toBeInTheDocument();
    expect(screen.queryByText('Visible ranges')).not.toBeInTheDocument();
    expect(screen.queryByText(/Closest visible blocker/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Tower range'), '311-320');

    expect(await screen.findByText('Tower Level 311 - 1/1 items remaining')).toBeInTheDocument();
    expect(screen.queryByText('Board')).not.toBeInTheDocument();

    expect(screen.queryByText('Visible TBD rows')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'TBD only' })).not.toBeInTheDocument();
    expect(screen.getByText('Tower Level 311 - 1/1 items remaining')).toBeInTheDocument();
    expect(screen.getByText('TBD').closest('td')?.querySelector('.item-icon')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Requirement tier'), 'MM');

    expect((await screen.findAllByText('No tower rows match the current filters.')).length).toBeGreaterThan(0);
  });

  it('surfaces tower reference review rows for unmatched entries and TBD placeholders', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-4',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 500_000,
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
          towerLevel: 311,
          towerLevelRange: '311-320',
          slotIndex: 1,
          itemName: 'Board',
          canonicalKey: 'board',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: 'Community discovery 311-320',
          sourceRow: '311-1',
        },
        {
          towerLevel: 311,
          towerLevelRange: '311-320',
          slotIndex: 2,
          itemName: 'TBD',
          canonicalKey: 'tbd',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: 'TBD placeholder - requirement not yet confirmed',
          sourceSheet: 'Community discovery 311-320',
          sourceRow: '311-2',
        },
        {
          towerLevel: 312,
          towerLevelRange: '311-320',
          slotIndex: 1,
          itemName: 'Mystery Item',
          canonicalKey: 'mystery item',
          masteryLevelNeeded: 'MM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: null,
          sourceSheet: 'Community discovery 311-320',
          sourceRow: '312-1',
        },
      ],
      byCanonicalKey: {
        board: [],
        tbd: [],
        'mystery item': [],
      },
    });

    render(<TowerReferenceMaintenancePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tower Reference Review' })).toBeInTheDocument();
    });

    expect(screen.getByText('Review rows')).toBeInTheDocument();
    expect(screen.getByText('TBD placeholder rows')).toBeInTheDocument();
    expect(screen.getByText('Tower Level 311 Slot 2: TBD')).toBeInTheDocument();
    expect(screen.getByText('Review reasons: tbd_placeholder, unmatched_snapshot')).toBeInTheDocument();
    expect(screen.getByText('Tower Level 312 Slot 1: Mystery Item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Tower Reference Review CSV' })).toBeEnabled();
  });

  it('uses compact default requirement labels, hides internal provenance notes, and keeps completed rows de-emphasized', async () => {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-3',
      createdAt: '2026-03-16T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 1_500_000,
        'gold cucumber': 25_000,
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
          notes: 'Passive source',
          sourceSheet: null,
          sourceRow: null,
        },
        {
          towerLevel: 202,
          towerLevelRange: '201-220',
          slotIndex: 2,
          itemName: 'Gold Cucumber',
          canonicalKey: 'gold cucumber',
          masteryLevelNeeded: 'GM',
          farmrpgItemId: null,
          buddySlug: null,
          notes: 'Manual transcription from screenshot',
          sourceSheet: null,
          sourceRow: null,
        },
      ],
      byCanonicalKey: {
        board: [],
        'gold cucumber': [],
      },
    });

    renderTowerPage();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Tower requirement status' })).toBeInTheDocument();
    });

    expect(screen.getAllByText('MM').length).toBeGreaterThan(0);
    expect(screen.getByText('% complete')).toBeInTheDocument();
    expect(screen.queryByText('Match')).not.toBeInTheDocument();
    expect(screen.queryByText('Slot')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Slot 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Slot 2')).not.toBeInTheDocument();
    expect(screen.getByText('Note: Passive source')).toBeInTheDocument();
    expect(screen.queryByText('Note: Manual transcription from screenshot')).not.toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByText('Requires Mega Mastered (>= 1,000,000)')).not.toBeInTheDocument();

    const completedRow = screen.getByText('Board').closest('tr');
    expect(completedRow).toHaveClass('summary-table__row--complete');

    const completedPercentCell = within(completedRow as HTMLElement).getByText('100%').closest('td');
    const incompleteRow = screen.getByText('Gold Cucumber').closest('tr');
    const incompletePercentCell = within(incompleteRow as HTMLElement).getByText('25.0%').closest('td');

    expect(completedPercentCell).toHaveClass('tower-percent-cell', 'tower-percent-cell--complete');
    expect(completedPercentCell).toHaveStyle('--tower-percent-fill: 100%');
    expect(incompletePercentCell).toHaveClass('tower-percent-cell');
    expect(incompletePercentCell).toHaveStyle('--tower-percent-fill: 25%');
  });
});
