import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  savePersonalMasteryGoalsState,
  upsertPersonalMasteryGoal,
} from '../lib/personalMasteryGoals';
import { saveQuestHistoryState } from '../lib/questHistoryState';
import {
  addTargetOutputPlannerTarget,
  createDefaultTargetOutputPlannerState,
  saveTargetOutputPlannerState,
} from '../lib/targetOutputPlannerState';
import { GoalsOverviewPage } from './GoalsOverviewPage';

const getLatestSnapshotMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: (...args: unknown[]) => getLatestSnapshotMock(...args),
}));

function renderGoalsOverviewPage() {
  return render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <GoalsOverviewPage />
    </MemoryRouter>,
  );
}

function expectLinkMatchingNameToHaveHref(namePattern: RegExp, href: string): void {
  const matchingLink = screen.getAllByRole('link').find((link) => {
    return namePattern.test(link.textContent ?? '') && link.getAttribute('href') === href;
  });

  expect(matchingLink).toBeDefined();
}

describe('GoalsOverviewPage', () => {
  afterEach(() => {
    getLatestSnapshotMock.mockReset();
    window.localStorage.clear();
  });

  it('links all goal sources while pointing missing local data to exact imports', async () => {
    getLatestSnapshotMock.mockResolvedValue(null);

    renderGoalsOverviewPage();

    expect(await screen.findByRole('heading', { name: 'Goals' })).toBeInTheDocument();
    expect(screen.getByText('Needed')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import mastery' })).toHaveAttribute('href', '/import');
    expect(screen.getByRole('link', { name: 'restore backup' })).toHaveAttribute(
      'href',
      '/settings#settings-restore-title',
    );
    expect(screen.getByRole('link', { name: 'Import quest history' })).toHaveAttribute('href', '/quest-history');

    expectLinkMatchingNameToHaveHref(/Tower mastery/i, '/tower');
    expectLinkMatchingNameToHaveHref(/Mastery targets/i, '/mastery-goals');
    expectLinkMatchingNameToHaveHref(/Quest goals/i, '/quest-planner');
    expectLinkMatchingNameToHaveHref(/Museum goals/i, '/museum-completion');
    expectLinkMatchingNameToHaveHref(/Borgen goals/i, '/memory-helper');
    expectLinkMatchingNameToHaveHref(/Custom targets/i, '/target-planner');
    expect(screen.getByText(/not Buddy reward pages/i)).toBeInTheDocument();
  });

  it('summarizes saved goal planning without blocking partial goal sources', async () => {
    savePersonalMasteryGoalsState(
      upsertPersonalMasteryGoal(
        {
          schemaVersion: 1,
          goals: [],
        },
        {
          itemName: 'Board',
          targetTier: 'GM',
        },
      ),
    );
    saveTargetOutputPlannerState(
      addTargetOutputPlannerTarget(createDefaultTargetOutputPlannerState(), {
        itemName: 'Board',
        desiredQuantity: 100,
      }),
    );
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-03-23T00:00:00.000Z',
      rawText: '',
      masteryByItem: {
        board: 50_000,
      },
      parseSummary: {
        itemsParsed: 42,
        parsedRowsCount: 42,
        tiersDetected: [10000],
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

    renderGoalsOverviewPage();

    expect(await screen.findByRole('heading', { name: 'Planning Summary' })).toBeInTheDocument();
    expect(screen.getByText('PJs across calculable saved mastery goals.')).toBeInTheDocument();
    expect(screen.getByText(/GM target, 8 PJs, next PJ saves 5,000 mastery\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('href', '/items/board');
    expect(screen.getByRole('link', { name: 'Open target planner' })).toHaveAttribute('href', '/target-planner');
  });

  it('summarizes available local mastery and quest history without blocking partial goal sources', async () => {
    saveQuestHistoryState({
      schemaVersion: 1,
      imports: [
        {
          importId: 'quest-history-1',
          importedAt: '2026-03-23T00:00:00.000Z',
          completedRequests: [],
          activeRequests: [],
          summary: {
            reportedCompletedCount: null,
            completedRowsCount: 0,
            activeRowsCount: 0,
            warningCount: 0,
          },
          warnings: [],
        },
      ],
    });
    getLatestSnapshotMock.mockResolvedValue({
      snapshotId: 'snapshot-1',
      createdAt: '2026-03-23T00:00:00.000Z',
      rawText: '',
      masteryByItem: {},
      parseSummary: {
        itemsParsed: 42,
        parsedRowsCount: 42,
        tiersDetected: [10000],
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount: 0,
        warnings: [],
      },
      parsedRows: [],
    });

    renderGoalsOverviewPage();

    await waitFor(() => {
      expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('42 parsed items are available for progress-aware goal views.')).toBeInTheDocument();
    expect(screen.getByText('1 quest history import saved in this browser.')).toBeInTheDocument();
    expect(screen.getAllByText('Progress-aware')).toHaveLength(2);
    expect(screen.getByText('Ready with reference data')).toBeInTheDocument();
  });
});
