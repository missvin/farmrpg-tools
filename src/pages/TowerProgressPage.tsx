import { useEffect, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { deriveTowerProgress } from '../lib/deriveTowerProgress';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

function formatCompactMastery(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    const compactThousands = value / 1_000;
    return Number.isInteger(compactThousands) ? `${compactThousands.toFixed(0)}k` : `${compactThousands.toFixed(1)}k`;
  }

  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : 1)}%`;
}

function toCompletePercent(total: number, remaining: number): number {
  if (total <= 0) {
    return 100;
  }

  return Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
}

function formatRequirementLabel(requiredThreshold: number): string {
  if (requiredThreshold === 10_000) {
    return 'Mastery (10,000)';
  }

  if (requiredThreshold === 100_000) {
    return 'Grand Mastery (100,000)';
  }

  return 'Mega Mastery (1,000,000)';
}

export function TowerProgressPage() {
  const [progressState, setProgressState] = useState<{
    isLoading: boolean;
    snapshotError: string | null;
    towerError: string | null;
    difficultyError: string | null;
    snapshot: Awaited<ReturnType<typeof getLatestSnapshot>>;
    derivedProgress: ReturnType<typeof deriveTowerProgress> | null;
  }>({
    isLoading: true,
    snapshotError: null,
    towerError: null,
    difficultyError: null,
    snapshot: null,
    derivedProgress: null,
  });

  useEffect(() => {
    let isMounted = true;

    void getLatestSnapshot()
      .then(async (snapshot) => {
        if (!isMounted) {
          return;
        }

        if (!snapshot) {
          setProgressState({
            isLoading: false,
            snapshotError: null,
            towerError: null,
            difficultyError: null,
            snapshot: null,
            derivedProgress: null,
          });
          return;
        }

        try {
          const [towerRequirementsData, masteryDifficultyData] = await Promise.all([
            loadTowerRequirements(),
            loadMasteryDifficulty(),
          ]);

          if (!isMounted) {
            return;
          }

          setProgressState({
            isLoading: false,
            snapshotError: null,
            towerError: null,
            difficultyError: null,
            snapshot,
            derivedProgress: deriveTowerProgress(snapshot, towerRequirementsData, masteryDifficultyData),
          });
        } catch (error: unknown) {
          if (!isMounted) {
            return;
          }

          const message =
            error instanceof Error ? error.message : 'Unable to load local reference data for tower progress.';
          const towerError = message.includes('tower requirements') ? message : null;
          const difficultyError = message.includes('mastery difficulty') ? message : null;

          setProgressState({
            isLoading: false,
            snapshotError: null,
            towerError,
            difficultyError,
            snapshot,
            derivedProgress: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setProgressState({
          isLoading: false,
          snapshotError: error instanceof Error ? error.message : 'Unable to load local snapshots.',
          towerError: null,
          difficultyError: null,
          snapshot: null,
          derivedProgress: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="page-stack">
      <PageIntro
        title="Tower Progress"
        description="Plan the remaining Tower mastery grind from the latest saved snapshot using unique-item progress toward each item's highest required tower target."
      />

      {progressState.isLoading ? (
        <p className="empty-state">Loading latest snapshot, tower requirements, and mastery difficulty data...</p>
      ) : null}

      {!progressState.isLoading && progressState.snapshotError ? (
        <p className="status-message status-message--error">{progressState.snapshotError}</p>
      ) : null}

      {!progressState.isLoading && !progressState.snapshotError && !progressState.snapshot ? (
        <section className="page-card page-stack">
          <h2>No Saved Snapshot</h2>
          <p className="empty-state">Import a mastery export first to view tower progress planning data.</p>
        </section>
      ) : null}

      {!progressState.isLoading && progressState.snapshot && progressState.towerError ? (
        <section className="page-card page-stack">
          <h2>Tower Requirements Data</h2>
          <p className="status-message status-message--error">{progressState.towerError}</p>
        </section>
      ) : null}

      {!progressState.isLoading && progressState.snapshot && progressState.difficultyError ? (
        <section className="page-card page-stack">
          <h2>Mastery Difficulty Data</h2>
          <p className="status-message status-message--error">{progressState.difficultyError}</p>
        </section>
      ) : null}

      {!progressState.isLoading && progressState.snapshot && progressState.derivedProgress ? (
        <>
          <section className="page-card page-stack" aria-labelledby="tower-progress-summary-title">
            <div>
              <h2 id="tower-progress-summary-title">Planning Summary</h2>
              <p className="supporting-text">
                This planning view aggregates Tower requirements by unique item and uses the highest required tower
                target for each item. The existing Tower page still remains the row-by-row requirement view.
              </p>
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Items left to Grand Mastery</dt>
                <dd>{progressState.derivedProgress.gmItemsLeftCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Items left to Mega Mastery</dt>
                <dd>{progressState.derivedProgress.mmItemsLeftCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Total mastery remaining</dt>
                <dd>{progressState.derivedProgress.totalMasteryRemaining.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Remaining unique tower items</dt>
                <dd>{progressState.derivedProgress.remainingItems.length.toLocaleString()}</dd>
              </div>
            </dl>

            <p className="subtle-text">
              Unmatched tower items in the latest snapshot:{' '}
              {progressState.derivedProgress.unmatchedSnapshotItemCount.toLocaleString()}
              {' | '}Unrated tower items in mastery difficulty data:{' '}
              {progressState.derivedProgress.unratedItemCount.toLocaleString()}
            </p>

            <p className="subtle-text">
              These mismatches stay visible and non-fatal. Missing snapshot matches are treated as 0 mastery, while
              missing mastery difficulty matches stay in the planning view as Unrated for later reference-data
              maintenance.
            </p>
          </section>

          <section className="page-card page-stack" aria-labelledby="tower-progress-difficulty-title">
            <div>
              <h2 id="tower-progress-difficulty-title">Difficulty Breakdown</h2>
              <p className="supporting-text">
                Difficulty buckets come from local mastery difficulty data. Missing matches stay visible under
                Unrated instead of failing the planning view.
              </p>
            </div>

            <div className="table-scroll">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th scope="col">Difficulty</th>
                    <th scope="col">Items remaining</th>
                    <th scope="col">Mastery remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {progressState.derivedProgress.difficultySummary.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>
                        <strong>
                          {row.remainingItems.toLocaleString()} / {row.totalItems.toLocaleString()} items remaining
                        </strong>
                        <p className="subtle-text">
                          {formatPercent(toCompletePercent(row.totalItems, row.remainingItems))} of items complete
                        </p>
                      </td>
                      <td>
                        <strong>
                          {formatCompactMastery(row.remainingMastery)} /{' '}
                          {formatCompactMastery(row.remainingTargetMastery)} mastery remaining
                        </strong>
                        <p className="subtle-text">
                          {formatPercent(toCompletePercent(row.totalTargetMastery, row.remainingMastery))} complete
                          toward target mastery
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="subtle-text">
              BL-034 remains the follow-up for accordion-style drilldown inside each difficulty bucket.
            </p>
          </section>

          <section className="page-card page-stack" aria-labelledby="tower-progress-items-title">
            <div>
              <h2 id="tower-progress-items-title">Remaining Tower Items</h2>
              <p className="supporting-text">
                Items are shown once each using their highest required tower target, with visual progress toward that
                planning threshold.
              </p>
            </div>

            {progressState.derivedProgress.remainingItems.length === 0 ? (
              <p className="empty-state">All unique Tower planning items are complete in the latest snapshot.</p>
            ) : (
              <ul className="progress-list">
                {progressState.derivedProgress.remainingItems.map((item) => (
                  <li key={item.canonicalKey} className="progress-list__item">
                    <div className="progress-list__header">
                      <strong>{item.itemName}</strong>
                      <span>{item.currentMastery.toLocaleString()} / {item.requiredThreshold.toLocaleString()}</span>
                    </div>
                    <p className="progress-list__meta">
                      <span>{item.difficultyLabel}</span>
                      {' | '}
                      <span>Target: {formatRequirementLabel(item.requiredThreshold)}</span>
                    </p>
                    <progress
                      className="progress-meter"
                      max={100}
                      value={item.progressPercent}
                      aria-label={`${item.itemName} progress`}
                    >
                      {item.progressPercent}
                    </progress>
                    <p className="progress-list__meta">
                      <span>{formatPercent(item.progressPercent)} complete</span>
                      {' | '}
                      <span>{item.remainingToTarget.toLocaleString()} remaining</span>
                    </p>
                    {!item.matchedSnapshotRow ? (
                      <p className="progress-list__notes">Unmatched in latest snapshot; treated as 0 mastery.</p>
                    ) : null}
                    {!item.matchedDifficultyRow ? (
                      <p className="progress-list__notes">Missing from mastery difficulty data; shown as Unrated.</p>
                    ) : null}
                    {item.method ? <p className="progress-list__notes">Method: {item.method}</p> : null}
                    {item.notes ? <p className="progress-list__notes">Notes: {item.notes}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
