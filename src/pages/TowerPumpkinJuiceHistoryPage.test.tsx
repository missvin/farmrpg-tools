import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import { listSnapshots, type MasterySnapshot } from '../lib/storage/masterySnapshots';
import { TowerPumpkinJuiceHistoryPage } from './TowerPumpkinJuiceHistoryPage';

vi.mock('../lib/loadTowerRequirements', () => ({
  loadTowerRequirements: vi.fn(),
}));

vi.mock('../lib/storage/masterySnapshots', () => ({
  listSnapshots: vi.fn(),
}));

const listSnapshotsMock = vi.mocked(listSnapshots);
const loadTowerRequirementsMock = vi.mocked(loadTowerRequirements);

function createSnapshot(snapshotId: string, savedAt: string, masteryByItem: Record<string, number>): MasterySnapshot {
  return {
    snapshotId,
    createdAt: savedAt,
    savedAt,
    importedAt: savedAt,
    rawText: '',
    masteryByItem,
    parseSummary: {
      itemsParsed: Object.keys(masteryByItem).length,
      parsedRowsCount: 0,
      tiersDetected: [],
      duplicateRowsCount: 0,
      skippedNonItemLinesCount: 0,
      skippedNonItemLineSamples: [],
      unknownItemsCount: 0,
      warnings: [],
    },
  };
}

const towerRequirements = {
  entries: [
    {
      towerLevel: 340,
      towerLevelRange: '321-340',
      slotIndex: 1,
      itemName: 'Gold Pea',
      canonicalKey: 'gold pea',
      masteryLevelNeeded: 'GM' as const,
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
    {
      towerLevel: 350,
      towerLevelRange: '341-360',
      slotIndex: 1,
      itemName: 'Steel Plate',
      canonicalKey: 'steel plate',
      masteryLevelNeeded: 'MM' as const,
      farmrpgItemId: null,
      buddySlug: null,
      notes: null,
      sourceSheet: null,
      sourceRow: null,
    },
  ],
  byCanonicalKey: {},
};

function LocationDisplay() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(initialEntry = '/tower-pj-history') {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <TowerPumpkinJuiceHistoryPage />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

describe('TowerPumpkinJuiceHistoryPage', () => {
  beforeEach(() => {
    listSnapshotsMock.mockResolvedValue([
      createSnapshot('newer', '2026-09-09T00:00:00.000Z', {
        'gold pea': 45_000,
        'steel plate': 250_000,
      }),
      createSnapshot('older', '2026-08-01T00:00:00.000Z', {
        'gold pea': 10_000,
      }),
    ]);
    loadTowerRequirementsMock.mockResolvedValue(towerRequirements);
  });

  it('defaults to T350 and explains lower-bound historical points', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Tower PJ History' })).toBeInTheDocument();
    const chartHeading = await screen.findByRole('heading', { name: 'Pumpkin Juice needed over time' });
    const chartSection = chartHeading.closest('section') as HTMLElement;
    expect(screen.getByRole('button', { name: 'T350' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Owned Pumpkin Juice is not subtracted/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'T350' })).toBeInTheDocument();

    const lowerBoundPoint = screen.getByRole('button', { name: /Tower 350, .* lower bound/i });
    await user.click(lowerBoundPoint);
    expect(within(chartSection).getByRole('status')).toHaveTextContent('At least');
    expect(within(chartSection).getByRole('status')).toHaveTextContent('no baseline');

    await user.click(screen.getByLabelText('Show incomplete points'));
    expect(screen.queryByRole('button', { name: /lower bound/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Lower bound · up to 1 missing baseline item/)).toBeInTheDocument();
  });

  it('loads multiple URL targets and persists a custom target selection', async () => {
    const user = userEvent.setup();
    renderPage('/tower-pj-history?levels=340,350');

    await screen.findByRole('heading', { name: 'Pumpkin Juice needed over time' });
    expect(screen.getByRole('button', { name: 'T340' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'T350' })).toHaveAttribute('aria-pressed', 'true');

    await user.type(screen.getByLabelText('Custom Tower level'), '345');
    await user.click(screen.getByRole('button', { name: 'Add line' }));

    expect(screen.getByRole('button', { name: 'T345' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location')).toHaveTextContent('?levels=340%2C345%2C350');
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'T345' })).toBeInTheDocument();
  });

  it('keeps one selected target and reports an empty history safely', async () => {
    const user = userEvent.setup();
    listSnapshotsMock.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Save at least one mastery snapshot to draw Tower PJ history.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'T350' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Keep at least one Tower target selected.');
    expect(screen.getByText('Save at least one mastery snapshot to see historical values.')).toBeInTheDocument();
  });
});
