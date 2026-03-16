import { useEffect, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { deriveTowerRequirements } from '../lib/deriveTowerRequirements';
import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

function formatRequirementLabel(requiredThreshold: number): string {
  if (requiredThreshold === 10_000) {
    return 'Requires Mastered (>= 10,000)';
  }

  if (requiredThreshold === 100_000) {
    return 'Requires Grand Mastered (>= 100,000)';
  }

  return 'Requires Mega Mastered (>= 1,000,000)';
}

function getLevelKey(towerLevelRange: string, towerLevel: number): string {
  return `${towerLevelRange}:${towerLevel}`;
}

export function TowerPage() {
  const [towerState, setTowerState] = useState<{
    isLoading: boolean;
    snapshotError: string | null;
    towerError: string | null;
    snapshot: Awaited<ReturnType<typeof getLatestSnapshot>>;
    derivedTowerRequirements: ReturnType<typeof deriveTowerRequirements> | null;
  }>({
    isLoading: true,
    snapshotError: null,
    towerError: null,
    snapshot: null,
    derivedTowerRequirements: null,
  });

  useEffect(() => {
    let isMounted = true;

    void getLatestSnapshot()
      .then(async (snapshot) => {
        if (!isMounted) {
          return;
        }

        if (!snapshot) {
          setTowerState({
            isLoading: false,
            snapshotError: null,
            towerError: null,
            snapshot: null,
            derivedTowerRequirements: null,
          });
          return;
        }

        try {
          const towerRequirementsData = await loadTowerRequirements();

          if (!isMounted) {
            return;
          }

          setTowerState({
            isLoading: false,
            snapshotError: null,
            towerError: null,
            snapshot,
            derivedTowerRequirements: deriveTowerRequirements(snapshot, towerRequirementsData),
          });
        } catch (error: unknown) {
          if (!isMounted) {
            return;
          }

          setTowerState({
            isLoading: false,
            snapshotError: null,
            towerError: error instanceof Error ? error.message : 'Unable to load local tower requirements data.',
            snapshot,
            derivedTowerRequirements: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setTowerState({
          isLoading: false,
          snapshotError: error instanceof Error ? error.message : 'Unable to load local snapshots.',
          towerError: null,
          snapshot: null,
          derivedTowerRequirements: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalRequirements = towerState.derivedTowerRequirements?.rows.length ?? 0;
  const completedRequirements =
    towerState.derivedTowerRequirements?.rows.filter((row) => row.achieved).length ?? 0;
  const unmatchedSnapshotItemCount =
    towerState.derivedTowerRequirements?.rows.filter((row) => !row.matchedSnapshotRow).length ?? 0;
  const firstIncompleteLevelKey = towerState.derivedTowerRequirements?.groups
    .flatMap((rangeGroup) =>
      rangeGroup.levels.map((levelGroup) => ({
        key: getLevelKey(rangeGroup.towerLevelRange, levelGroup.towerLevel),
        isCompleted: levelGroup.rows.every((row) => row.achieved),
      })),
    )
    .find((levelGroup) => !levelGroup.isCompleted)?.key;

  return (
    <div className="page-stack">
      <PageIntro
        title="Tower Requirements"
        description="Review the latest saved snapshot against local tower requirements data in a read-only view."
      />

      {towerState.isLoading ? <p className="empty-state">Loading latest snapshot and tower requirements...</p> : null}

      {!towerState.isLoading && towerState.snapshotError ? (
        <p className="status-message status-message--error">{towerState.snapshotError}</p>
      ) : null}

      {!towerState.isLoading && !towerState.snapshotError && !towerState.snapshot ? (
        <section className="page-card page-stack">
          <h2>No Saved Snapshot</h2>
          <p className="empty-state">Import a mastery export first to view tower requirement status.</p>
        </section>
      ) : null}

      {!towerState.isLoading && towerState.snapshot && towerState.towerError ? (
        <section className="page-card page-stack">
          <h2>Tower Requirements Data</h2>
          <p className="status-message status-message--error">{towerState.towerError}</p>
        </section>
      ) : null}

      {!towerState.isLoading && towerState.snapshot && towerState.derivedTowerRequirements ? (
        <>
          <section className="page-card page-stack" aria-labelledby="tower-summary-title">
            <div>
              <h2 id="tower-summary-title">Tower Summary</h2>
              <p className="supporting-text">
                Each tower requirement row is shown independently, even when the same item appears in multiple
                levels or tiers.
              </p>
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Total requirements</dt>
                <dd>{totalRequirements.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Completed requirements</dt>
                <dd>{completedRequirements.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Remaining requirements</dt>
                <dd>{(totalRequirements - completedRequirements).toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Unmatched snapshot item count</dt>
                <dd>{unmatchedSnapshotItemCount.toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <section className="page-card page-stack" aria-labelledby="tower-results-title">
            <div>
              <h2 id="tower-results-title">Tower Requirement Status</h2>
              <p className="supporting-text">
                Requirements are grouped by tower level range and then tower level. Unmatched rows stay visible and
                are treated as current mastery `0`.
              </p>
            </div>

            {towerState.derivedTowerRequirements.groups.map((rangeGroup) => (
              <div key={rangeGroup.towerLevelRange} className="page-stack">
                <h3 className="section-title">Tower Levels {rangeGroup.towerLevelRange}</h3>

                {rangeGroup.levels.map((levelGroup) => {
                  const levelKey = getLevelKey(rangeGroup.towerLevelRange, levelGroup.towerLevel);
                  const isCompleted = levelGroup.rows.every((row) => row.achieved);
                  const nextBlockingRowIndex = levelGroup.rows.findIndex((row) => !row.achieved);
                  const remainingCount = levelGroup.rows.filter((row) => !row.achieved).length;
                  const isNextRelevantLevel = firstIncompleteLevelKey === levelKey;

                  return (
                    <details
                      key={levelGroup.towerLevel}
                      className={`tower-level-card${isNextRelevantLevel ? ' tower-level-card--next' : ''}`}
                      open={!isCompleted}
                    >
                      <summary className="tower-level-summary">
                        <div className="tower-level-summary__text">
                          <h4 className="section-title">Tower Level {levelGroup.towerLevel}</h4>
                          <p className="subtle-text">
                            {isCompleted
                              ? 'Completed level'
                              : `${remainingCount.toLocaleString()} requirement${
                                  remainingCount === 1 ? '' : 's'
                                } remaining`}
                            {isNextRelevantLevel ? ' · Next relevant level' : ''}
                          </p>
                        </div>
                        <span
                          className={`tower-level-summary__badge${
                            isCompleted ? ' tower-level-summary__badge--complete' : ''
                          }`}
                        >
                          {isCompleted ? 'Completed' : 'In Progress'}
                        </span>
                      </summary>

                      {isNextRelevantLevel && nextBlockingRowIndex >= 0 ? (
                        <p className="subtle-text">
                          Next blocking requirement: {levelGroup.rows[nextBlockingRowIndex].itemName} (
                          {formatRequirementLabel(levelGroup.rows[nextBlockingRowIndex].requiredThreshold)})
                        </p>
                      ) : null}

                      <div className="table-scroll">
                        <table className="summary-table">
                          <thead>
                            <tr>
                              <th scope="col">Level</th>
                              <th scope="col">Slot</th>
                              <th scope="col">Item</th>
                              <th scope="col">Requirement</th>
                              <th scope="col">Current mastery</th>
                              <th scope="col">Remaining</th>
                              <th scope="col">Notes</th>
                              <th scope="col">Match</th>
                            </tr>
                          </thead>
                          <tbody>
                            {levelGroup.rows.map((row, rowIndex) => (
                              <tr
                                key={`${row.towerLevel}-${row.slotIndex}-${row.canonicalKey}-${row.requiredThreshold}`}
                                className={
                                  isNextRelevantLevel && rowIndex === nextBlockingRowIndex
                                    ? 'summary-table__row--highlight'
                                    : undefined
                                }
                              >
                                <td>{row.towerLevel}</td>
                                <td>{row.slotIndex}</td>
                                <td>{row.itemName}</td>
                                <td>{formatRequirementLabel(row.requiredThreshold)}</td>
                                <td>{row.currentMastery.toLocaleString()}</td>
                                <td>{row.remainingToRequirement.toLocaleString()}</td>
                                <td>{row.notes ?? '—'}</td>
                                <td>
                                  {row.matchedSnapshotRow ? (
                                    'Matched'
                                  ) : (
                                    <span className="status-message">Unmatched in latest snapshot</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  );
                })}
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
