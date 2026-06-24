import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveQuestHistoryState } from '../lib/questHistoryState';
import { listSnapshotSummaries } from '../lib/storage/masterySnapshots';
import { DataCenterPage } from './DataCenterPage';

vi.mock('../lib/storage/masterySnapshots', () => ({
  listSnapshotSummaries: vi.fn(),
}));

const listSnapshotSummariesMock = vi.mocked(listSnapshotSummaries);

function renderDataCenterPage() {
  render(
    <MemoryRouter>
      <DataCenterPage />
    </MemoryRouter>,
  );
}

describe('DataCenterPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listSnapshotSummariesMock.mockReset();
  });

  it('points missing local data states to import and restore actions', async () => {
    listSnapshotSummariesMock.mockResolvedValue([]);

    renderDataCenterPage();

    expect(screen.getByRole('heading', { name: 'Data' })).toBeInTheDocument();
    expect(await screen.findByText('No saved mastery snapshots yet.')).toBeInTheDocument();
    expect(screen.getByText('No completed quest history imports saved yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Import Mastery' })[0]).toHaveAttribute('href', '/import');
    expect(screen.getAllByRole('link', { name: 'Restore Backup' })[0]).toHaveAttribute(
      'href',
      '/settings#settings-restore-title',
    );
  });

  it('summarizes saved snapshot and quest history data without changing storage', async () => {
    listSnapshotSummariesMock.mockResolvedValue([
      {
        snapshotId: 'snapshot-2',
        createdAt: '2026-06-02T09:00:00.000Z',
        savedAt: '2026-06-02T09:00:00.000Z',
        importedAt: '2026-06-02T09:00:00.000Z',
        itemCount: 42,
        parsedRowsCount: 42,
      },
    ]);
    saveQuestHistoryState({
      schemaVersion: 1,
      imports: [
        {
          importId: 'quest-history-1',
          importedAt: '2026-06-02T10:00:00.000Z',
          completedRequests: [
            {
              questKey: 'a-quest',
              questName: 'A Quest',
              npc: null,
              requestKind: 'main',
              completedAt: null,
              completedAtRaw: null,
              playerCount: null,
              completionPercent: null,
            },
          ],
          activeRequests: [],
          summary: {
            reportedCompletedCount: null,
            completedRowsCount: 1,
            activeRowsCount: 0,
            warningCount: 0,
          },
          warnings: [],
        },
      ],
    });

    renderDataCenterPage();

    expect(await screen.findByText('1 saved snapshot.')).toBeInTheDocument();
    expect(screen.getByText(/42 parsed items/)).toBeInTheDocument();
    expect(screen.getByText('1 saved import.')).toBeInTheDocument();
    expect(screen.getByText(/1 completed requests and 0 active requests/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open History' })).toHaveAttribute('href', '/history');
    expect(screen.getAllByRole('link', { name: /Compare/ })[0]).toHaveAttribute('href', '/compare');
  });
});