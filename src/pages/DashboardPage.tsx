import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { PageIntro } from '../components/PageIntro';
import { deriveMasteryDifficultyStats } from '../lib/deriveMasteryDifficultyStats';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { getRouteToolMetadata, type RouteToolId } from '../lib/routeMetadata';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

type LatestSnapshot = Awaited<ReturnType<typeof getLatestSnapshot>>;

type DashboardState = {
  isLoading: boolean;
  snapshotError: string | null;
  difficultyError: string | null;
  snapshot: LatestSnapshot;
  derivedStats: ReturnType<typeof deriveMasteryDifficultyStats> | null;
};

type CommandCenterAction = {
  to: string;
  title: string;
  description: string;
  reason: string;
};

type DataStatusItem = {
  label: string;
  value: string;
  description: string;
  action?: {
    to: string;
    label: string;
  };
};

function routeAction(routeId: RouteToolId, reason: string): CommandCenterAction {
  const metadata = getRouteToolMetadata(routeId);

  return {
    to: metadata.path,
    title: metadata.label,
    description: metadata.description,
    reason,
  };
}

function restoreBackupAction(reason: string): CommandCenterAction {
  return {
    to: '/settings#settings-restore-title',
    title: 'Restore Backup',
    description: 'Load a previously exported FarmRPG Tools backup file.',
    reason,
  };
}

function formatTierList(tiers: Array<number | 'INF'>): string {
  if (tiers.length === 0) {
    return 'None detected';
  }

  return tiers.map((tier) => (tier === 'INF' ? 'INF' : tier.toLocaleString())).join(', ');
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function clampPercent(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function getDashboardPercentCellStyle(value: number): CSSProperties & Record<'--dashboard-percent-fill', string> {
  return {
    '--dashboard-percent-fill': `${clampPercent(value)}%`,
  };
}

function getSummaryProgressPercent(value: number, itemsParsed: number): number {
  if (itemsParsed <= 0) {
    return 0;
  }

  return clampPercent((value / itemsParsed) * 100);
}

function getSummaryProgressStyle(
  value: number,
  itemsParsed: number,
): CSSProperties & Record<'--summary-progress-fill', string> {
  return {
    '--summary-progress-fill': `${getSummaryProgressPercent(value, itemsParsed)}%`,
  };
}

function getLocalDataStatus(snapshot: LatestSnapshot, isLoading: boolean): string {
  if (isLoading) {
    return 'Checking the latest local snapshot saved in this browser.';
  }

  if (!snapshot) {
    return 'No local snapshot saved yet. Import a fresh mastery export or restore a backup to get started.';
  }

  return `Latest local snapshot saved ${new Date(snapshot.createdAt).toLocaleString()} with ${snapshot.parseSummary.itemsParsed.toLocaleString()} items parsed.`;
}

function getDataStatusItems(state: DashboardState): DataStatusItem[] {
  const snapshotStatus: DataStatusItem = state.isLoading
    ? {
        label: 'Mastery snapshot',
        value: 'Checking',
        description: 'Looking for the latest mastery snapshot saved in this browser.',
      }
    : state.snapshotError
      ? {
          label: 'Mastery snapshot',
          value: 'Needs attention',
          description: 'The local snapshot store could not be read. Restore a backup or import again.',
          action: {
            to: '/settings#settings-restore-title',
            label: 'Restore backup',
          },
        }
      : state.snapshot
        ? {
            label: 'Mastery snapshot',
            value: 'Ready',
            description: `${state.snapshot.parseSummary.itemsParsed.toLocaleString()} items parsed from the latest saved snapshot.`,
            action: {
              to: '/import',
              label: 'Refresh import',
            },
          }
        : {
            label: 'Mastery snapshot',
            value: 'Needed',
            description: 'Import a mastery export or restore a backup before progress-aware views can speak clearly.',
            action: {
              to: '/import',
              label: 'Import mastery',
            },
          };

  const difficultyStatus: DataStatusItem = state.isLoading
    ? {
        label: 'Difficulty ratings',
        value: 'Waiting',
        description: 'Ratings are checked after the local snapshot status is known.',
      }
    : state.snapshot && state.derivedStats
      ? {
          label: 'Difficulty ratings',
          value: 'Ready',
          description: 'Dashboard, Sorted, and mastery summaries can use local difficulty data.',
          action: {
            to: '/sorted',
            label: 'Open Sorted',
          },
        }
      : state.snapshot && state.difficultyError
        ? {
            label: 'Difficulty ratings',
            value: 'Limited',
            description: 'Snapshot data loaded, but difficulty-based summaries are unavailable.',
          }
        : {
            label: 'Difficulty ratings',
            value: 'After import',
            description: 'Difficulty summaries become useful once a mastery snapshot is saved.',
          };

  return [
    snapshotStatus,
    difficultyStatus,
    {
      label: 'Backup and restore',
      value: 'Available',
      description: 'Settings can export or restore data saved in this browser.',
      action: {
        to: '/settings#settings-restore-title',
        label: 'Open restore',
      },
    },
  ];
}

function getNextActions(state: DashboardState): CommandCenterAction[] {
  if (state.isLoading) {
    return [
      routeAction('importMastery', 'Available while Home checks whether this browser already has local data.'),
      restoreBackupAction('Available while Home checks whether this browser already has local data.'),
    ];
  }

  if (state.snapshotError) {
    return [
      restoreBackupAction('The local snapshot store could not be read, so restore is the safest recovery path.'),
      routeAction('importMastery', 'A fresh mastery export can recreate the local snapshot if restore is not needed.'),
    ];
  }

  if (!state.snapshot) {
    return [
      routeAction('importMastery', 'No mastery snapshot is saved in this browser.'),
      restoreBackupAction('Use this if you already exported a backup from another browser or device.'),
      routeAction('importHelp', 'Import and restore expectations are useful before pasting data.'),
      routeAction('ingredientLookup', 'Limited exploration is still possible from checked-in reference data.'),
    ];
  }

  const actions = [
    routeAction('masteryGoals', 'Uses the latest mastery snapshot plus local item metadata.'),
    routeAction('towerProgress', 'Uses the latest mastery snapshot and local Tower requirement data.'),
    routeAction('compare', 'Useful after future imports create another saved snapshot to compare against.'),
  ];

  if (state.derivedStats) {
    actions.splice(2, 0, routeAction('sorted', 'Uses the latest mastery snapshot and local difficulty ratings.'));
  }

  return actions;
}

const workbenchSections: Array<{
  title: string;
  items: Array<{ routeId: RouteToolId; reason: string }>;
}> = [
  {
    title: 'Goals',
    items: [
      { routeId: 'tower', reason: 'Tower requirements stay under Goals and use local Tower data.' },
      { routeId: 'questPlanner', reason: 'Quest planning becomes sharper after quest-history import.' },
      { routeId: 'museumCompletion', reason: 'Museum progress uses reviewed local museum reference data.' },
    ],
  },
  {
    title: 'Items',
    items: [
      { routeId: 'itemsLanding', reason: 'Item profiles can open from checked-in catalog data before imports.' },
      { routeId: 'ingredientLookup', reason: 'Item lookup can run from checked-in recipe/reference data.' },
      { routeId: 'acquisitionBreakdown', reason: 'Source breakdowns show provenance for a selected item.' },
    ],
  },
  {
    title: 'Planning Data',
    items: [
      { routeId: 'importInventory', reason: 'Inventory import lets planners account for owned materials.' },
      { routeId: 'importPetItems', reason: 'Stored pet inventory improves source and supply planning.' },
      { routeId: 'importLocksmith', reason: 'Locksmith import improves availability checks for supported planners.' },
    ],
  },
];

export function DashboardPage() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    isLoading: true,
    snapshotError: null,
    difficultyError: null,
    snapshot: null,
    derivedStats: null,
  });

  useEffect(() => {
    let isMounted = true;

    void getLatestSnapshot()
      .then(async (snapshot) => {
        if (!isMounted) {
          return;
        }

        if (!snapshot) {
          setDashboardState({
            isLoading: false,
            snapshotError: null,
            difficultyError: null,
            snapshot: null,
            derivedStats: null,
          });
          return;
        }

        try {
          const masteryDifficultyData = await loadMasteryDifficulty();

          if (!isMounted) {
            return;
          }

          setDashboardState({
            isLoading: false,
            snapshotError: null,
            difficultyError: null,
            snapshot,
            derivedStats: deriveMasteryDifficultyStats(snapshot, masteryDifficultyData),
          });
        } catch (error: unknown) {
          if (!isMounted) {
            return;
          }

          setDashboardState({
            isLoading: false,
            snapshotError: null,
            difficultyError:
              error instanceof Error ? error.message : 'Unable to load local mastery difficulty data.',
            snapshot,
            derivedStats: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setDashboardState({
          isLoading: false,
          snapshotError: error instanceof Error ? error.message : 'Unable to load local snapshots.',
          difficultyError: null,
          snapshot: null,
          derivedStats: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="page-stack">
      <PageIntro
        title="Dashboard"
        description="Start from local data status, clear missing-data actions, and the next workbench entry point that has enough evidence to be useful."
        storageKey="dashboard"
      />

      <section className="page-card page-stack" aria-labelledby="command-center-title">
        <div>
          <h2 id="command-center-title">Command Center</h2>
          <p className="supporting-text">{getLocalDataStatus(dashboardState.snapshot, dashboardState.isLoading)}</p>
        </div>

        <div className="summary-grid">
          {getDataStatusItems(dashboardState).map((item) => (
            <div className="summary-grid__item" key={item.label}>
              <h3 className="section-title">{item.label}</h3>
              <p>
                <strong>{item.value}</strong>
              </p>
              <p className="subtle-text">{item.description}</p>
              {item.action ? (
                <p className="subtle-text">
                  <Link to={item.action.to}>{item.action.label}</Link>
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="page-stack page-stack--tight">
          <h3 className="section-title">Next Useful Actions</h3>
          <div className="quick-link-grid">
            {getNextActions(dashboardState).map((action) => (
              <Link className="quick-link-card" to={action.to} key={`${action.to}-${action.title}`}>
                <span className="quick-link-card__title">{action.title}</span>
                <span className="quick-link-card__description">{action.description}</span>
                <span className="quick-link-card__description">Why: {action.reason}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="page-card page-stack" aria-labelledby="workbench-entry-title">
        <div>
          <h2 id="workbench-entry-title">Workbench Entry Points</h2>
          <p className="supporting-text">Open the current goal, item, and planning-data workflows directly.</p>
        </div>

        <div className="quick-link-grid">
          {workbenchSections.flatMap((section) =>
            section.items.map((item) => {
              const metadata = getRouteToolMetadata(item.routeId);

              return (
                <Link className="quick-link-card" to={metadata.path} key={metadata.id}>
                  <span className="quick-link-card__title">
                    {section.title}: {metadata.label}
                  </span>
                  <span className="quick-link-card__description">{metadata.description}</span>
                  <span className="quick-link-card__description">Data note: {item.reason}</span>
                </Link>
              );
            }),
          )}
        </div>
      </section>

      <section className="page-card page-stack" aria-labelledby="latest-snapshot-title">
        <div>
          <h2 id="latest-snapshot-title">Latest Snapshot</h2>
          <p className="supporting-text">
            A small local-only summary so you can confirm your most recent import was saved.
          </p>
        </div>

        {dashboardState.isLoading ? <p className="empty-state">Loading local snapshot summary...</p> : null}

        {!dashboardState.isLoading && dashboardState.snapshotError ? (
          <p className="status-message status-message--error">{dashboardState.snapshotError}</p>
        ) : null}

        {!dashboardState.isLoading && !dashboardState.snapshotError && !dashboardState.snapshot ? (
          <p className="empty-state">No saved snapshots yet. Import a mastery export to create your first one.</p>
        ) : null}

        {!dashboardState.isLoading && dashboardState.snapshot ? (
          <dl className="summary-grid">
            <div className="summary-grid__item">
              <dt>Saved at</dt>
              <dd>{new Date(dashboardState.snapshot.createdAt).toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Items parsed</dt>
              <dd>{dashboardState.snapshot.parseSummary.itemsParsed.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Tiers detected</dt>
              <dd>{formatTierList(dashboardState.snapshot.parseSummary.tiersDetected)}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      {!dashboardState.isLoading && dashboardState.snapshot && dashboardState.derivedStats ? (
        <>
          {(() => {
            const parsedItemsCount = dashboardState.snapshot.parseSummary.itemsParsed;

            return (
          <section className="page-card page-stack" aria-labelledby="achieved-summary-title">
            <div>
              <h2 id="achieved-summary-title">Achieved Status Summary</h2>
              <p className="supporting-text">
                These counts describe thresholds already achieved in the latest saved snapshot.
              </p>
            </div>

            <dl className="summary-grid">
              <div
                className="summary-grid__item summary-grid__item--progress"
                style={getSummaryProgressStyle(
                  dashboardState.derivedStats.achievedStatusSummary.masteredCount,
                  parsedItemsCount,
                )}
              >
                <dt>Mastered (&gt;= 10,000)</dt>
                <dd>{dashboardState.derivedStats.achievedStatusSummary.masteredCount.toLocaleString()}</dd>
                <p className="subtle-text">
                  {formatPercent(
                    getSummaryProgressPercent(
                      dashboardState.derivedStats.achievedStatusSummary.masteredCount,
                      parsedItemsCount,
                    ),
                  )}{' '}
                  of parsed items
                </p>
              </div>
              <div
                className="summary-grid__item summary-grid__item--progress"
                style={getSummaryProgressStyle(
                  dashboardState.derivedStats.achievedStatusSummary.grandMasteredCount,
                  parsedItemsCount,
                )}
              >
                <dt>Grand Mastered (&gt;= 100,000)</dt>
                <dd>{dashboardState.derivedStats.achievedStatusSummary.grandMasteredCount.toLocaleString()}</dd>
                <p className="subtle-text">
                  {formatPercent(
                    getSummaryProgressPercent(
                      dashboardState.derivedStats.achievedStatusSummary.grandMasteredCount,
                      parsedItemsCount,
                    ),
                  )}{' '}
                  of parsed items
                </p>
              </div>
              <div
                className="summary-grid__item summary-grid__item--progress"
                style={getSummaryProgressStyle(
                  dashboardState.derivedStats.achievedStatusSummary.megaMasteredCount,
                  parsedItemsCount,
                )}
              >
                <dt>Mega Mastered (&gt;= 1,000,000)</dt>
                <dd>{dashboardState.derivedStats.achievedStatusSummary.megaMasteredCount.toLocaleString()}</dd>
                <p className="subtle-text">
                  {formatPercent(
                    getSummaryProgressPercent(
                      dashboardState.derivedStats.achievedStatusSummary.megaMasteredCount,
                      parsedItemsCount,
                    ),
                  )}{' '}
                  of parsed items
                </p>
              </div>
            </dl>
          </section>
            );
          })()}

          <section className="page-card page-stack" aria-labelledby="difficulty-summary-title">
            <div>
              <h2 id="difficulty-summary-title">Mastery Difficulty Summary</h2>
              <p className="supporting-text">
                Snapshot items grouped by mastery difficulty, including Unrated for items without a current rating.
              </p>
            </div>

            <div className="table-scroll">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th scope="col">Difficulty</th>
                    <th scope="col">Total</th>
                    <th scope="col">Mastered (&gt;= 10,000)</th>
                    <th scope="col">Grand Mastered (&gt;= 100,000)</th>
                    <th scope="col">Mega Mastered (&gt;= 1,000,000)</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardState.derivedStats.difficultySummary.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.totalItems.toLocaleString()}</td>
                      <td
                        className="dashboard-percent-cell"
                        style={getDashboardPercentCellStyle(row.masteredPercent)}
                      >
                        <span className="dashboard-percent-cell__label">
                          {row.masteredCount.toLocaleString()} ({formatPercent(row.masteredPercent)})
                        </span>
                      </td>
                      <td
                        className="dashboard-percent-cell"
                        style={getDashboardPercentCellStyle(row.grandMasteredPercent)}
                      >
                        <span className="dashboard-percent-cell__label">
                          {row.grandMasteredCount.toLocaleString()} ({formatPercent(row.grandMasteredPercent)})
                        </span>
                      </td>
                      <td
                        className="dashboard-percent-cell"
                        style={getDashboardPercentCellStyle(row.megaMasteredPercent)}
                      >
                        <span className="dashboard-percent-cell__label">
                          {row.megaMasteredCount.toLocaleString()} ({formatPercent(row.megaMasteredPercent)})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {!dashboardState.isLoading && dashboardState.snapshot && dashboardState.difficultyError ? (
        <section className="page-card page-stack" aria-labelledby="difficulty-error-title">
          <div>
            <h2 id="difficulty-error-title">Mastery Difficulty Data</h2>
            <p className="supporting-text">
              The latest snapshot loaded, but the local mastery difficulty data could not be read.
            </p>
          </div>
          <p className="status-message status-message--error">{dashboardState.difficultyError}</p>
        </section>
      ) : null}
    </div>
  );
}
