import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { PageIntro } from '../components/PageIntro';
import { deriveMasteryDifficultyStats } from '../lib/deriveMasteryDifficultyStats';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

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

function getLocalDataStatus(snapshot: Awaited<ReturnType<typeof getLatestSnapshot>>, isLoading: boolean): string {
  if (isLoading) {
    return 'Checking the latest local snapshot saved in this browser.';
  }

  if (!snapshot) {
    return 'No local snapshot saved yet. Import a fresh mastery export or restore a backup to get started.';
  }

  return `Latest local snapshot saved ${new Date(snapshot.createdAt).toLocaleString()} with ${snapshot.parseSummary.itemsParsed.toLocaleString()} items parsed.`;
}

export function DashboardPage() {
  const [dashboardState, setDashboardState] = useState<{
    isLoading: boolean;
    snapshotError: string | null;
    difficultyError: string | null;
    snapshot: Awaited<ReturnType<typeof getLatestSnapshot>>;
    derivedStats: ReturnType<typeof deriveMasteryDifficultyStats> | null;
  }>({
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
        description="Start from your latest local mastery snapshot, confirm what data is saved, then jump to the planning view that matches what you want to check next."
        storageKey="dashboard"
      />

      <section className="page-card page-stack" aria-labelledby="getting-started-title">
        <div>
          <h2 id="getting-started-title">Start Here</h2>
          <p className="supporting-text">{getLocalDataStatus(dashboardState.snapshot, dashboardState.isLoading)}</p>
        </div>

        <div className="quick-link-grid">
          <Link className="quick-link-card" to="/import">
            <span className="quick-link-card__title">Import snapshot</span>
            <span className="quick-link-card__description">Paste a FarmRPG mastery export and save it locally.</span>
          </Link>
          <Link className="quick-link-card" to="/settings#settings-restore-title">
            <span className="quick-link-card__title">Restore backup</span>
            <span className="quick-link-card__description">Load a previously exported FarmRPG Tools backup file.</span>
          </Link>
          <Link className="quick-link-card" to="/tower-progress">
            <span className="quick-link-card__title">Tower Progress</span>
            <span className="quick-link-card__description">See the unique Tower items still left to GM or MM.</span>
          </Link>
          <Link className="quick-link-card" to="/tower">
            <span className="quick-link-card__title">Tower</span>
            <span className="quick-link-card__description">Review level-by-level Tower requirement status.</span>
          </Link>
          <Link className="quick-link-card" to="/sorted">
            <span className="quick-link-card__title">Sorted</span>
            <span className="quick-link-card__description">Browse mastery progress grouped by difficulty and remaining work.</span>
          </Link>
          <Link className="quick-link-card" to="/compare">
            <span className="quick-link-card__title">Compare</span>
            <span className="quick-link-card__description">Compare two saved snapshots to see what changed.</span>
          </Link>
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
              <div
                className="summary-grid__item summary-grid__item--progress"
                style={getSummaryProgressStyle(dashboardState.derivedStats.unmatchedItemCount, parsedItemsCount)}
              >
                <dt>Unmatched snapshot items</dt>
                <dd>{dashboardState.derivedStats.unmatchedItemCount.toLocaleString()}</dd>
                <p className="subtle-text">
                  {formatPercent(
                    getSummaryProgressPercent(dashboardState.derivedStats.unmatchedItemCount, parsedItemsCount),
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
                Snapshot items grouped by mastery difficulty data, including an Unrated bucket for unmatched or
                unrated entries.
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
