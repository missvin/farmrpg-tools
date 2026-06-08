import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryPage } from './HistoryPage';

const listSnapshotsMock = vi.fn();
const loadTowerRequirementsMock = vi.fn();
const loadMasteryDifficultyMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  listSnapshots: (...args: unknown[]) => listSnapshotsMock(...args),
}));

vi.mock('../lib/loadTowerRequirements', () => ({
  loadTowerRequirements: (...args: unknown[]) => loadTowerRequirementsMock(...args),
}));

vi.mock('../lib/loadMasteryDifficulty', () => ({
  loadMasteryDifficulty: (...args: unknown[]) => loadMasteryDifficultyMock(...args),
}));

vi.mock('../lib/deriveTowerProgress', () => ({
  deriveTowerProgress: () => ({
    remainingItems: [{ canonicalKey: 'fast item 01' }],
  }),
}));

function toDisplayName(canonicalKey: string): string {
  return canonicalKey
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function createSnapshot(snapshotId: string, savedAt: string, masteryByItem: Record<string, number>) {
  return {
    snapshotId,
    createdAt: savedAt,
    savedAt,
    importedAt: savedAt,
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
    parsedRows: Object.entries(masteryByItem).map(([canonicalKey, count], index) => ({
      rawItemName: toDisplayName(canonicalKey),
      canonicalKey,
      count,
      targetTier: 10_000,
      sourceLineIndex: index,
    })),
  };
}

function createManyItemSnapshots() {
  const oldItems: Record<string, number> = {};
  const newItems: Record<string, number> = {};

  for (let index = 1; index <= 11; index += 1) {
    const key = `fast item ${String(index).padStart(2, '0')}`;
    oldItems[key] = 100;
    newItems[key] = 100 + index * 100;
  }

  oldItems['tiny item'] = 1;
  newItems['tiny item'] = 2;
  oldItems['threshold item'] = 9_990;
  newItems['threshold item'] = 10_010;
  oldItems['mega item'] = 1_000_000;
  newItems['mega item'] = 1_000_500;

  return [
    createSnapshot('snapshot-new', '2026-03-19T12:00:00.000Z', newItems),
    createSnapshot('snapshot-old', '2026-03-18T12:00:00.000Z', oldItems),
  ];
}

describe('HistoryPage', () => {
  beforeEach(() => {
    listSnapshotsMock.mockReset();
    loadTowerRequirementsMock.mockReset();
    loadMasteryDifficultyMock.mockReset();
    window.localStorage.clear();
    loadTowerRequirementsMock.mockResolvedValue({ entries: [], byCanonicalKey: {} });
    loadMasteryDifficultyMock.mockResolvedValue({ entries: [], byCanonicalKey: {} });
  });

  it('shows the empty snapshot state', async () => {
    listSnapshotsMock.mockResolvedValue([]);

    render(<HistoryPage />);

    expect(await screen.findByRole('heading', { name: 'No Saved Snapshots' })).toBeInTheDocument();
  });

  it('renders velocity cards, charts, suggestion badges, and picker controls', async () => {
    const user = userEvent.setup();
    listSnapshotsMock.mockResolvedValue(createManyItemSnapshots());

    render(<HistoryPage />);

    expect(await screen.findByRole('heading', { name: 'Mastery Momentum' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overall Velocity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Item Velocity' })).toBeInTheDocument();
    expect(screen.getByText('Fastest recent gainers')).toBeInTheDocument();
    expect(screen.getByText('New threshold')).toBeInTheDocument();
    expect(screen.getByText('Tower')).toBeInTheDocument();
    expect(screen.getByLabelText("Show MM'd items")).not.toBeChecked();
    expect(screen.getByText("1 MM'd item is hidden from item-level views.")).toBeInTheDocument();
    expect(screen.queryByText('Mega Item')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Chart mode'), 'gain');
    expect(screen.getByLabelText('Chart mode')).toHaveValue('gain');

    await user.type(screen.getByLabelText('Search items'), 'tiny');
    const tinyCard = screen.getByText('Tiny Item').closest('li') as HTMLElement;
    await user.click(within(tinyCard).getByRole('button', { name: 'Add' }));

    expect(within(tinyCard).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(window.localStorage.getItem('farmrpg-tools.snapshotVelocityPreferences.v1')).toContain('tiny item');

    await user.click(screen.getByLabelText("Show MM'd items"));
    expect((await screen.findAllByText('Mega Item')).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem('farmrpg-tools.snapshotVelocityPreferences.v1')).toContain(
      '"showMegaMasteredItems":true',
    );
  });

  it('restores persisted chart preferences', async () => {
    window.localStorage.setItem(
      'farmrpg-tools.snapshotVelocityPreferences.v1',
      JSON.stringify({
        selectedCanonicalKeys: ['tiny item'],
        hiddenDefaultCanonicalKeys: ['fast item 11'],
        chartMode: 'threshold',
        rangeMode: 'recent',
      }),
    );
    listSnapshotsMock.mockResolvedValue(createManyItemSnapshots());

    render(<HistoryPage />);

    expect(await screen.findByRole('heading', { name: 'Mastery Momentum' })).toBeInTheDocument();
    expect(screen.getByLabelText('Chart mode')).toHaveValue('threshold');
    expect(screen.getByLabelText('Range')).toHaveValue('recent');
    expect(screen.getAllByText('Tiny Item').length).toBeGreaterThan(0);
  });
});
