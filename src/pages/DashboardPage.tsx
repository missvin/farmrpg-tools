import { useEffect, useState } from 'react';

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
        description="View a quick summary of your FarmRPG mastery progress and recent snapshots."
      />

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
          <section className="page-card page-stack" aria-labelledby="achieved-summary-title">
            <div>
              <h2 id="achieved-summary-title">Achieved Status Summary</h2>
              <p className="supporting-text">
                These counts describe thresholds already achieved in the latest saved snapshot.
              </p>
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Mastered (&gt;= 10,000)</dt>
                <dd>{dashboardState.derivedStats.achievedStatusSummary.masteredCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Grand Mastered (&gt;= 100,000)</dt>
                <dd>{dashboardState.derivedStats.achievedStatusSummary.grandMasteredCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Mega Mastered (&gt;= 1,000,000)</dt>
                <dd>{dashboardState.derivedStats.achievedStatusSummary.megaMasteredCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Items missing from mastery difficulty data</dt>
                <dd>{dashboardState.derivedStats.unmatchedItemCount.toLocaleString()}</dd>
              </div>
            </dl>
          </section>

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
                      <td>
                        {row.masteredCount.toLocaleString()} ({formatPercent(row.masteredPercent)})
                      </td>
                      <td>
                        {row.grandMasteredCount.toLocaleString()} ({formatPercent(row.grandMasteredPercent)})
                      </td>
                      <td>
                        {row.megaMasteredCount.toLocaleString()} ({formatPercent(row.megaMasteredPercent)})
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
