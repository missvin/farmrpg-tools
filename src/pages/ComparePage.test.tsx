import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComparePage } from './ComparePage';
import { notifyPlayerDataChanged } from '../lib/playerDataNotifications';

const listSnapshotSummariesMock = vi.fn();
const getSnapshotMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  listSnapshotSummaries: (...args: unknown[]) => listSnapshotSummariesMock(...args),
  getSnapshot: (...args: unknown[]) => getSnapshotMock(...args),
}));

function createSnapshot(snapshotId: string, createdAt: string, masteryByItem: Record<string, number>) {
  const parsedRows = Object.entries(masteryByItem).map(([itemName, count], index) => ({
    rawItemName: itemName
      .split(' ')
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' '),
    canonicalKey: itemName,
    count,
    targetTier: 10_000,
    sourceLineIndex: index,
  }));

  return {
    snapshotId,
    createdAt,
    savedAt: createdAt,
    importedAt: createdAt,
    rawText: 'raw export',
    masteryByItem,
    parseSummary: {
      itemsParsed: Object.keys(masteryByItem).length,
      parsedRowsCount: Object.keys(masteryByItem).length,
      tiersDetected: [],
      duplicateRowsCount: 0,
      skippedNonItemLinesCount: 0,
      skippedNonItemLineSamples: [],
      unknownItemsCount: 0,
      warnings: [],
    },
    parsedRows,
  };
}

describe('ComparePage', () => {
  beforeEach(() => {
    listSnapshotSummariesMock.mockReset();
    getSnapshotMock.mockReset();
  });

  it('reloads updated daily values and labels without changing selected snapshot IDs', async () => {
    const old = createSnapshot('manual-old', '2026-10-13T12:00:00.000Z', {apple: 10});
    let latest = createSnapshot('capture-history-2026-10-14', '2026-10-14T08:00:00.000Z', {apple: 14});
    listSnapshotSummariesMock.mockImplementation(async () => [latest, old].map(snapshot => ({snapshotId: snapshot.snapshotId, createdAt: snapshot.createdAt, savedAt: snapshot.savedAt, importedAt: snapshot.importedAt, itemCount: 1, parsedRowsCount: 1})));
    getSnapshotMock.mockImplementation(async (id: string) => id === old.snapshotId ? old : latest);
    render(<ComparePage />);
    expect((await screen.findAllByText('+4')).length).toBeGreaterThan(0);
    const selections = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const selected = selections.map(select => select.value);
    latest = createSnapshot(latest.snapshotId, '2026-10-14T15:00:00.000Z', {apple: 25});
    act(() => notifyPlayerDataChanged());
    expect((await screen.findAllByText('+15')).length).toBeGreaterThan(0);
    await waitFor(() => expect(selections[1].selectedOptions[0].textContent).toContain(new Date(latest.savedAt).toLocaleString()));
    expect(selections.map(select => select.value)).toEqual(selected);
    expect(screen.queryAllByText('+4')).toHaveLength(0);
  });

  it('shows an empty state when there are fewer than two saved snapshots', async () => {
    listSnapshotSummariesMock.mockResolvedValue([
      {
        snapshotId: 'snapshot-1',
        createdAt: '2026-03-18T12:00:00.000Z',
        savedAt: '2026-03-18T12:00:00.000Z',
        importedAt: '2026-03-18T12:00:00.000Z',
        itemCount: 2,
        parsedRowsCount: 2,
      },
    ]);

    render(<ComparePage />);

    expect(await screen.findByText(/One saved snapshot found/)).toBeInTheDocument();
  });

  it('loads two selected snapshots and shows summary deltas plus changed items', async () => {
    listSnapshotSummariesMock.mockResolvedValue([
      {
        snapshotId: 'snapshot-new',
        createdAt: '2026-03-18T12:00:00.000Z',
        savedAt: '2026-03-18T12:00:00.000Z',
        importedAt: '2026-03-18T12:00:00.000Z',
        itemCount: 3,
        parsedRowsCount: 3,
      },
      {
        snapshotId: 'snapshot-old',
        createdAt: '2026-03-17T12:00:00.000Z',
        savedAt: '2026-03-17T12:00:00.000Z',
        importedAt: '2026-03-17T12:00:00.000Z',
        itemCount: 2,
        parsedRowsCount: 2,
      },
    ]);
    getSnapshotMock.mockImplementation(async (snapshotId: string) => {
      if (snapshotId === 'snapshot-old') {
        return createSnapshot('snapshot-old', '2026-03-17T12:00:00.000Z', {
          apple: 10,
          banana: 5,
        });
      }

      if (snapshotId === 'snapshot-new') {
        return createSnapshot('snapshot-new', '2026-03-18T12:00:00.000Z', {
          apple: 14,
          carrot: 7,
        });
      }

      return null;
    });

    render(<ComparePage />);

    expect(await screen.findByRole('heading', { name: 'Comparison Summary' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notable Changes' })).toBeInTheDocument();
    expect(screen.getByText('+6')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Changed Items' })).toBeInTheDocument();
    const biggestGainCard = screen.getByText('Biggest gain').closest('li') as HTMLElement;
    expect(within(biggestGainCard).getByText('Carrot')).toBeInTheDocument();
    expect(within(biggestGainCard).getByText('+7')).toBeInTheDocument();
    expect(screen.getByText('Worth rechecking')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getAllByText('Banana').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carrot').length).toBeGreaterThan(0);
  });

  it('displays item names and compares the known legacy piñata mojibake key as the same item', async () => {
    listSnapshotSummariesMock.mockResolvedValue([
      {
        snapshotId: 'snapshot-new',
        createdAt: '2026-03-18T12:00:00.000Z',
        savedAt: '2026-03-18T12:00:00.000Z',
        importedAt: '2026-03-18T12:00:00.000Z',
        itemCount: 1,
        parsedRowsCount: 1,
      },
      {
        snapshotId: 'snapshot-old',
        createdAt: '2026-03-17T12:00:00.000Z',
        savedAt: '2026-03-17T12:00:00.000Z',
        importedAt: '2026-03-17T12:00:00.000Z',
        itemCount: 1,
        parsedRowsCount: 1,
      },
    ]);
    getSnapshotMock.mockImplementation(async (snapshotId: string) => {
      if (snapshotId === 'snapshot-old') {
        return createSnapshot('snapshot-old', '2026-03-17T12:00:00.000Z', {
          'piÃ±ata whop stick': 11_970,
        });
      }

      return createSnapshot('snapshot-new', '2026-03-18T12:00:00.000Z', {
        'piñata whop stick': 12_674,
      });
    });

    render(<ComparePage />);

    expect(await screen.findByRole('heading', { name: 'Comparison Summary' })).toBeInTheDocument();
    expect(screen.getAllByText('Piñata Whop Stick').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+704').length).toBeGreaterThan(0);
    expect(screen.queryByText('PiÃ±ata Whop Stick')).not.toBeInTheDocument();
    expect(screen.queryByText('Removed')).not.toBeInTheDocument();
  });

  it('lets the user switch snapshot selection', async () => {
    const user = userEvent.setup();

    listSnapshotSummariesMock.mockResolvedValue([
      {
        snapshotId: 'snapshot-3',
        createdAt: '2026-03-18T12:00:00.000Z',
        savedAt: '2026-03-18T12:00:00.000Z',
        importedAt: '2026-03-18T12:00:00.000Z',
        itemCount: 2,
        parsedRowsCount: 2,
      },
      {
        snapshotId: 'snapshot-2',
        createdAt: '2026-03-17T12:00:00.000Z',
        savedAt: '2026-03-17T12:00:00.000Z',
        importedAt: '2026-03-17T12:00:00.000Z',
        itemCount: 2,
        parsedRowsCount: 2,
      },
      {
        snapshotId: 'snapshot-1',
        createdAt: '2026-03-16T12:00:00.000Z',
        savedAt: '2026-03-16T12:00:00.000Z',
        importedAt: '2026-03-16T12:00:00.000Z',
        itemCount: 1,
        parsedRowsCount: 1,
      },
    ]);
    getSnapshotMock.mockImplementation(async (snapshotId: string) => {
      if (snapshotId === 'snapshot-1') {
        return createSnapshot('snapshot-1', '2026-03-16T12:00:00.000Z', { apple: 1 });
      }

      if (snapshotId === 'snapshot-2') {
        return createSnapshot('snapshot-2', '2026-03-17T12:00:00.000Z', { apple: 2 });
      }

      return createSnapshot('snapshot-3', '2026-03-18T12:00:00.000Z', { apple: 3 });
    });

    render(<ComparePage />);

    const summarySection = await screen.findByRole('heading', { name: 'Comparison Summary' });
    expect(within(summarySection.closest('section') as HTMLElement).getByText('+1')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('From snapshot'), 'snapshot-1');

    await waitFor(() => {
      expect(within(summarySection.closest('section') as HTMLElement).getByText('+2')).toBeInTheDocument();
    });
  });
});
