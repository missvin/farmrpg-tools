import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TowerRemainingTable } from './TowerRemainingTable';
import { deriveTowerRemainingRows, sortTowerRemainingRows } from '../lib/towerRemainingRows';
import type { TowerRequirementEntry } from '../lib/loadTowerRequirements';
import type { MasterySnapshot } from '../lib/storage/masterySnapshots';

const snapshot: MasterySnapshot = {
  snapshotId: 'tower-test', createdAt: '2026-09-28', rawText: '',
  masteryByItem: { 'propeller hat': 82_000, board: 110_000 },
  parseSummary: {
    itemsParsed: 2, parsedRowsCount: 2, tiersDetected: [], duplicateRowsCount: 0,
    skippedNonItemLinesCount: 0, skippedNonItemLineSamples: [], unknownItemsCount: 0, warnings: [],
  },
};
function requirement(towerLevel: number, itemName: string, masteryLevelNeeded: 'GM' | 'MM'): TowerRequirementEntry {
  return { towerLevel, itemName, masteryLevelNeeded, canonicalKey: itemName.toLowerCase(),
    towerLevelRange: '301-350', slotIndex: 1, farmrpgItemId: null, buddySlug: null,
    notes: null, sourceSheet: null, sourceRow: null };
}
const requirements = { entries: [
  requirement(340, 'Propeller Hat', 'MM'), requirement(301, 'Propeller Hat', 'GM'),
  requirement(302, 'Board', 'GM'), requirement(303, 'Gold Flier', 'GM'),
], byCanonicalKey: {} };
const rows = deriveTowerRemainingRows(snapshot, requirements, null);

describe('Tower remaining requirements', () => {
  it('keeps row targets independent, including completed rows and unknown PJ baselines', () => {
    const gm = rows.find((row) => row.towerLevel === 301)!;
    const mm = rows.find((row) => row.towerLevel === 340)!;
    expect(gm.remainingToRequirement).toBe(18_000);
    expect(mm.remainingToRequirement).toBe(918_000);
    expect(gm.pumpkinJuices).toBe(3);
    expect(mm.pumpkinJuices).toBeGreaterThan(gm.pumpkinJuices!);
    expect(rows.find((row) => row.towerLevel === 302)?.pumpkinJuices).toBe(0);
    expect(rows.find((row) => row.towerLevel === 303)?.pumpkinJuices).toBeNull();
    expect(deriveTowerRemainingRows(snapshot, requirements, 302).map((row) => row.towerLevel)).toEqual([301, 302]);
    for (const descending of [true, false]) {
      expect(sortTowerRemainingRows(rows, 'pj', descending).at(-1)?.towerLevel).toBe(303);
    }
    expect(sortTowerRemainingRows(rows, 'tier', false).at(-1)?.masteryLevelNeeded).toBe('MM');
    expect(sortTowerRemainingRows(rows, 'item', false)[0].itemName).toBe('Board');
  });

  it('defaults to incomplete level order and supports sorting, icons, and accessible mastery details', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TowerRemainingTable rows={rows} targetItem={null} targetLevel={null} /></MemoryRouter>);
    expect(screen.getByRole('checkbox', { name: 'Incomplete only' })).toBeChecked();
    expect(screen.queryByRole('link', { name: 'Board' })).not.toBeInTheDocument();
    const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(tableRows().map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['301', '303', '340']);
    expect(screen.getAllByRole('link', { name: 'Propeller Hat' })[0]).toHaveAttribute('href', '/items/propeller%20hat');
    const detailButton = screen.getByRole('button', { name: 'Propeller Hat T301 GM mastery details' });
    expect(detailButton.closest('td')).toHaveStyle('--tower-percent-fill: 82%');
    await user.click(detailButton);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Current 82,000 · Target 100,000 · Remaining 18,000 · Complete 82.0%');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remaining' }));
    expect(within(tableRows()[0]).getByText('301')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remaining' }));
    expect(within(tableRows()[0]).getByText('340')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Remaining' })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('checkbox', { name: 'Incomplete only' }));
    expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();
  });

  it('reveals and scrolls to an explicitly linked completed requirement', async () => {
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      render(<MemoryRouter><TowerRemainingTable rows={rows} targetItem="board" targetLevel={302} /></MemoryRouter>);
      expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();
      expect(screen.getByText(/Linked completed requirement included/)).toBeInTheDocument();
      await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
    } finally { HTMLElement.prototype.scrollIntoView = original; }
  });
});
