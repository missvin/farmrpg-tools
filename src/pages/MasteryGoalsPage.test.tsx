import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MASTERY_RACE_COUNTS_STORAGE_KEY } from '../lib/masteryRaceCounts';
import { PERSONAL_MASTERY_GOALS_STORAGE_KEY } from '../lib/personalMasteryGoals';
import { PUMPKIN_JUICE_PLANNER_STATE_STORAGE_KEY } from '../lib/pumpkinJuicePlannerState';
import { MasteryGoalsPage } from './MasteryGoalsPage';

const getLatestSnapshotMock = vi.fn();
const loadMasteryDifficultyMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

vi.mock('../lib/loadMasteryDifficulty', () => ({
  loadMasteryDifficulty: (...args: unknown[]) => loadMasteryDifficultyMock(...args),
}));

describe('MasteryGoalsPage', () => {
  afterEach(() => {
    window.localStorage.clear();
    getLatestSnapshotMock.mockReset();
    loadMasteryDifficultyMock.mockReset();
  });

  function mockResources(): void {
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-05-08T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 50_000,
      },
      parseSummary: {
        itemsParsed: 1,
        parsedRowsCount: 1,
        tiersDetected: [100_000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [
        {
          rawItemName: 'Board',
          canonicalKey: 'board',
          count: 50_000,
          targetTier: 100_000,
          sourceLineIndex: 0,
        },
      ],
    });

    loadMasteryDifficultyMock.mockResolvedValue({
      entries: [
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
      byCanonicalKey: {},
    });
  }

  it('saves personal goals and shows Pumpkin Juice estimates from the latest snapshot', async () => {
    const user = userEvent.setup();
    mockResources();

    render(<MasteryGoalsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mastery Goals' })).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText('Item', { selector: '#personal-goal-item' }));
    await user.type(screen.getByLabelText('Item', { selector: '#personal-goal-item' }), 'Board');
    await user.selectOptions(screen.getByLabelText('Target'), 'GM');
    await user.click(screen.getByRole('button', { name: 'Save Goal' }));

    const savedGoalsSection = screen.getByRole('heading', { name: 'Saved Goals' }).closest('section');
    expect(savedGoalsSection).not.toBeNull();
    expect(within(savedGoalsSection as HTMLElement).getByText('Board')).toBeInTheDocument();
    expect(within(savedGoalsSection as HTMLElement).getAllByText('50,000')).toHaveLength(2);
    expect(within(savedGoalsSection as HTMLElement).getByText('8')).toBeInTheDocument();
    expect(within(savedGoalsSection as HTMLElement).getByText('+5,000')).toBeInTheDocument();
    expect(window.localStorage.getItem(PERSONAL_MASTERY_GOALS_STORAGE_KEY)).toContain('board');
  });

  it('saves owned Pumpkin Juice locally', async () => {
    const user = userEvent.setup();
    mockResources();

    render(<MasteryGoalsPage />);

    await screen.findByRole('heading', { name: 'Mastery Goals' });
    await user.clear(screen.getByLabelText('Owned Pumpkin Juice'));
    await user.type(screen.getByLabelText('Owned Pumpkin Juice'), '12');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    expect(window.localStorage.getItem(PUMPKIN_JUICE_PLANNER_STATE_STORAGE_KEY)).toContain(
      '"ownedPumpkinJuiceCount":12',
    );
  });

  it('saves local race-count context and shows it on matching goals', async () => {
    const user = userEvent.setup();
    mockResources();

    render(<MasteryGoalsPage />);

    await screen.findByRole('heading', { name: 'Mastery Goals' });
    await user.type(screen.getByLabelText('Item', { selector: '#personal-goal-item' }), 'Board');
    await user.selectOptions(screen.getByLabelText('Target'), 'GM');
    await user.click(screen.getByRole('button', { name: 'Save Goal' }));

    await user.type(screen.getByLabelText('Item', { selector: '#race-count-item' }), 'Board');
    await user.type(screen.getByLabelText('Public GM count'), '42');
    await user.click(screen.getByRole('button', { name: 'Save Race Counts' }));

    const savedGoalsSection = screen.getByRole('heading', { name: 'Saved Goals' }).closest('section');
    expect(within(savedGoalsSection as HTMLElement).getByText('42')).toBeInTheDocument();
    expect(window.localStorage.getItem(MASTERY_RACE_COUNTS_STORAGE_KEY)).toContain('"grandMasteredCount":42');
  });
});
