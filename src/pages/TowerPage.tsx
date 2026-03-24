import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { PageIntro } from '../components/PageIntro';
import { deriveTowerRequirements } from '../lib/deriveTowerRequirements';
import { downloadTowerReferenceReviewCsv, deriveTowerReferenceReviewRows } from '../lib/exportTowerReferenceReviewCsv';
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

function formatCompactRequirementLabel(requiredThreshold: number): 'M' | 'GM' | 'MM' {
  if (requiredThreshold === 10_000) {
    return 'M';
  }

  if (requiredThreshold === 100_000) {
    return 'GM';
  }

  return 'MM';
}

function getLevelKey(towerLevelRange: string, towerLevel: number): string {
  return `${towerLevelRange}:${towerLevel}`;
}

function formatLevelSummary(remainingCount: number, totalCount: number): string {
  return `${remainingCount.toLocaleString()}/${totalCount.toLocaleString()} items remaining`;
}

function getPercentComplete(currentMastery: number, requiredThreshold: number): number {
  const percent = (currentMastery / requiredThreshold) * 100;

  if (Number.isNaN(percent) || !Number.isFinite(percent)) {
    return 0;
  }

  return Math.max(0, Math.min(100, percent));
}

function formatPercentComplete(currentMastery: number, requiredThreshold: number): string {
  const percent = getPercentComplete(currentMastery, requiredThreshold);

  return `${percent.toFixed(percent >= 100 ? 0 : 1)}%`;
}

function formatBlockingSummary(
  blockingRows: Array<{
    itemName: string;
    requiredThreshold: number;
  }>,
): string | null {
  if (blockingRows.length === 0) {
    return null;
  }

  const [closestBlockingRow] = blockingRows;

  if (blockingRows.length === 1) {
    return `Blocking requirement: ${closestBlockingRow.itemName} (${formatRequirementLabel(closestBlockingRow.requiredThreshold)})`;
  }

  return `Blocking requirements: ${blockingRows.length.toLocaleString()} items remain. Closest blocker: ${closestBlockingRow.itemName} (${formatRequirementLabel(closestBlockingRow.requiredThreshold)})`;
}

function shouldShowTowerNote(note: string | null): boolean {
  if (!note) {
    return false;
  }

  return !/manual transcription from screenshot/i.test(note);
}

function getPercentCellStyle(
  currentMastery: number,
  requiredThreshold: number,
): CSSProperties & Record<'--tower-percent-fill', string> {
  return {
    '--tower-percent-fill': `${getPercentComplete(currentMastery, requiredThreshold)}%`,
  };
}

type TowerRowStateFilter = 'all' | 'blocking' | 'completed' | 'tbd';
type TowerTierFilter = 'all' | 'M' | 'GM' | 'MM';

function isTbdTowerRow(itemName: string): boolean {
  return itemName.trim().toUpperCase() === 'TBD';
}

export function TowerPage() {
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>('all');
  const [rowStateFilter, setRowStateFilter] = useState<TowerRowStateFilter>('all');
  const [tierFilter, setTierFilter] = useState<TowerTierFilter>('all');
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
  const availableRanges = towerState.derivedTowerRequirements?.groups.map((group) => group.towerLevelRange) ?? [];
  const filteredGroups = useMemo(() => {
    if (!towerState.derivedTowerRequirements) {
      return [];
    }

    return towerState.derivedTowerRequirements.groups
      .filter((rangeGroup) => selectedRange === 'all' || rangeGroup.towerLevelRange === selectedRange)
      .map((rangeGroup) => ({
        ...rangeGroup,
        levels: rangeGroup.levels
          .map((levelGroup) => ({
            ...levelGroup,
            rows: levelGroup.rows.filter((row) => {
              if (tierFilter !== 'all' && formatCompactRequirementLabel(row.requiredThreshold) !== tierFilter) {
                return false;
              }

              if (rowStateFilter === 'blocking' && row.achieved) {
                return false;
              }

              if (rowStateFilter === 'completed' && !row.achieved) {
                return false;
              }

              if (rowStateFilter === 'tbd' && !isTbdTowerRow(row.itemName)) {
                return false;
              }

              return true;
            }),
          }))
          .filter((levelGroup) => levelGroup.rows.length > 0),
      }))
      .filter((rangeGroup) => rangeGroup.levels.length > 0);
  }, [rowStateFilter, selectedRange, tierFilter, towerState.derivedTowerRequirements]);
  const firstIncompleteLevelKey = filteredGroups
    .flatMap((rangeGroup) =>
      rangeGroup.levels.map((levelGroup) => ({
        key: getLevelKey(rangeGroup.towerLevelRange, levelGroup.towerLevel),
        isCompleted: levelGroup.rows.every((row) => row.achieved),
      })),
    )
    .find((levelGroup) => !levelGroup.isCompleted)?.key;
  const incompleteRangeGroups = filteredGroups.filter((rangeGroup) =>
    rangeGroup.levels.some((levelGroup) => levelGroup.rows.some((row) => !row.achieved)),
  );
  const completedRangeGroups = filteredGroups.filter((rangeGroup) =>
    rangeGroup.levels.every((levelGroup) => levelGroup.rows.every((row) => row.achieved)),
  );
  const referenceReviewRows = towerState.derivedTowerRequirements
    ? deriveTowerReferenceReviewRows(towerState.derivedTowerRequirements.rows)
    : [];
  const tbdPlaceholderCount = referenceReviewRows.filter((row) =>
    row.reviewReasons.includes('tbd_placeholder'),
  ).length;
  const unmatchedReviewCount = referenceReviewRows.filter((row) =>
    row.reviewReasons.includes('unmatched_snapshot'),
  ).length;
  const visibleRows = filteredGroups.flatMap((rangeGroup) =>
    rangeGroup.levels.flatMap((levelGroup) => levelGroup.rows),
  );
  const visibleBlockingRows = visibleRows.filter((row) => !row.achieved);
  const visibleCompletedRows = visibleRows.filter((row) => row.achieved);
  const visibleTbdRows = visibleRows.filter((row) => isTbdTowerRow(row.itemName));
  const visibleLevelCount = filteredGroups.reduce((count, rangeGroup) => count + rangeGroup.levels.length, 0);
  const visibleClosestBlocker = visibleBlockingRows[0] ?? null;

  function handleExportTowerReferenceReviewCsv(): void {
    if (!towerState.derivedTowerRequirements || referenceReviewRows.length === 0) {
      return;
    }

    try {
      downloadTowerReferenceReviewCsv(towerState.derivedTowerRequirements.rows);
      setExportError(null);
      setExportMessage('Tower reference review CSV downloaded for local maintenance.');
    } catch (error) {
      setExportMessage(null);
      setExportError(error instanceof Error ? error.message : 'Unable to export tower reference review CSV.');
    }
  }

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
                levels or tiers. Rows that do not match the latest snapshot stay visible and are treated as 0
                mastery instead of failing the page.
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
                <dt>Requirement rows missing from latest snapshot</dt>
                <dd>{unmatchedSnapshotItemCount.toLocaleString()}</dd>
              </div>
            </dl>

            <p className="subtle-text">
              Missing latest-snapshot matches are non-fatal. Keep these rows visible so naming drift, import coverage,
              or tower-reference maintenance issues are easier to spot and review.
            </p>
          </section>

          <section className="page-card page-stack" aria-labelledby="tower-filters-title">
            <div>
              <h2 id="tower-filters-title">Tower Filters</h2>
              <p className="supporting-text">
                Narrow dense tower data by range, row state, or requirement tier without leaving the main Tower page.
              </p>
            </div>

            <div className="filter-grid">
              <label className="page-stack page-stack--tight">
                <span className="field-label">Tower range</span>
                <select
                  className="text-input"
                  value={selectedRange}
                  onChange={(event) => setSelectedRange(event.target.value)}
                >
                  <option value="all">All ranges</option>
                  {availableRanges.map((towerLevelRange) => (
                    <option key={towerLevelRange} value={towerLevelRange}>
                      {towerLevelRange}
                    </option>
                  ))}
                </select>
              </label>

              <label className="page-stack page-stack--tight">
                <span className="field-label">Row state</span>
                <select
                  className="text-input"
                  value={rowStateFilter}
                  onChange={(event) => setRowStateFilter(event.target.value as TowerRowStateFilter)}
                >
                  <option value="all">All rows</option>
                  <option value="blocking">Blocking only</option>
                  <option value="completed">Completed only</option>
                  <option value="tbd">TBD only</option>
                </select>
              </label>

              <label className="page-stack page-stack--tight">
                <span className="field-label">Requirement tier</span>
                <select
                  className="text-input"
                  value={tierFilter}
                  onChange={(event) => setTierFilter(event.target.value as TowerTierFilter)}
                >
                  <option value="all">All tiers</option>
                  <option value="M">M only</option>
                  <option value="GM">GM only</option>
                  <option value="MM">MM only</option>
                </select>
              </label>
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Visible ranges</dt>
                <dd>{filteredGroups.length.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Visible levels</dt>
                <dd>{visibleLevelCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Visible blocker rows</dt>
                <dd>{visibleBlockingRows.length.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Visible TBD rows</dt>
                <dd>{visibleTbdRows.length.toLocaleString()}</dd>
              </div>
            </dl>

            {visibleClosestBlocker ? (
              <p className="subtle-text">
                Closest visible blocker: Tower Level {visibleClosestBlocker.towerLevel} {visibleClosestBlocker.itemName}{' '}
                ({formatCompactRequirementLabel(visibleClosestBlocker.requiredThreshold)})
              </p>
            ) : (
              <p className="subtle-text">
                {visibleRows.length === 0
                  ? 'No tower rows match the current filters.'
                  : `Visible completed rows: ${visibleCompletedRows.length.toLocaleString()}`}
              </p>
            )}
          </section>

          <section className="page-card page-stack" aria-labelledby="tower-reference-review-title">
            <div>
              <h2 id="tower-reference-review-title">Tower Reference Maintenance</h2>
              <p className="supporting-text">
                Review rows that still need reference-data follow-up. The export includes per-row review reasons plus
                tower provenance fields so future manual corrections are easier to compare over time.
              </p>
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Review rows</dt>
                <dd>{referenceReviewRows.length.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Unmatched snapshot rows</dt>
                <dd>{unmatchedReviewCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>TBD placeholder rows</dt>
                <dd>{tbdPlaceholderCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Export-ready review rows</dt>
                <dd>{referenceReviewRows.length.toLocaleString()}</dd>
              </div>
            </dl>

            <p className="subtle-text">
              This export is dev-facing maintenance output only. It keeps placeholder and unmatched tower rows visible
              for review without changing the normal tower status flow or exposing provenance details in the main table.
            </p>

            <div className="button-row">
              <button
                type="button"
                className="button"
                onClick={handleExportTowerReferenceReviewCsv}
                disabled={referenceReviewRows.length === 0}
              >
                Export Tower Reference Review CSV
              </button>
            </div>

            {exportMessage ? <p className="status-message status-message--success">{exportMessage}</p> : null}
            {exportError ? <p className="status-message status-message--error">{exportError}</p> : null}

            {referenceReviewRows.length === 0 ? (
              <p className="empty-state">No tower reference review rows are currently surfaced.</p>
            ) : (
              <ul className="data-list">
                {referenceReviewRows.map((row) => (
                  <li key={`${row.towerLevel}-${row.slotIndex}-${row.canonicalKey}`}>
                    <div>
                      <strong>
                        Tower Level {row.towerLevel} Slot {row.slotIndex}: {row.itemName}
                      </strong>
                      <p className="subtle-text">Review reasons: {row.reviewReasons.join(', ')}</p>
                    </div>
                    <strong>{row.masteryLevelNeeded}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="page-card page-stack" aria-labelledby="tower-results-title">
            <div>
              <h2 id="tower-results-title">Tower Requirement Status</h2>
            </div>

            {filteredGroups.length === 0 ? (
              <p className="empty-state">No tower rows match the current filters.</p>
            ) : null}

            {filteredGroups.length > 0 && incompleteRangeGroups.length > 0 ? (
              <div className="page-stack">
                <h3 className="section-title">In-progress ranges</h3>

                {incompleteRangeGroups.map((rangeGroup) => {
                  const remainingLevels = rangeGroup.levels.filter((levelGroup) =>
                    levelGroup.rows.some((row) => !row.achieved),
                  ).length;

                  return (
                    <details key={rangeGroup.towerLevelRange} className="tower-range-card" open>
                      <summary className="tower-range-summary">
                        <div className="tower-range-summary__text">
                          <h4 className="section-title">Tower Levels {rangeGroup.towerLevelRange}</h4>
                          <p className="subtle-text">
                            {remainingLevels.toLocaleString()} level{remainingLevels === 1 ? '' : 's'} remaining
                          </p>
                        </div>
                        <span className="tower-level-summary__badge">In Progress</span>
                      </summary>

                      <div className="page-stack">
                        {rangeGroup.levels.map((levelGroup) => {
                          const levelKey = getLevelKey(rangeGroup.towerLevelRange, levelGroup.towerLevel);
                          const isCompleted = levelGroup.rows.every((row) => row.achieved);
                          const blockingRows = levelGroup.rows.filter((row) => !row.achieved);
                          const remainingCount = blockingRows.length;
                          const isNextRelevantLevel = firstIncompleteLevelKey === levelKey;
                          const blockingSummary = formatBlockingSummary(blockingRows);

                          return (
                            <details
                              key={levelGroup.towerLevel}
                              className={`tower-level-card${isNextRelevantLevel ? ' tower-level-card--next' : ''}`}
                              open={!isCompleted}
                            >
                              <summary className="tower-level-summary">
                                <div className="tower-level-summary__text">
                                  <h4 className="section-title">
                                    Tower Level {levelGroup.towerLevel} -{' '}
                                    {formatLevelSummary(remainingCount, levelGroup.rows.length)}
                                  </h4>
                                  {isNextRelevantLevel ? <p className="subtle-text">Next relevant level</p> : null}
                                </div>
                                <span
                                  className={`tower-level-summary__badge${
                                    isCompleted ? ' tower-level-summary__badge--complete' : ''
                                  }`}
                                >
                                  {isCompleted ? 'Completed' : 'In Progress'}
                                </span>
                              </summary>

                              {isNextRelevantLevel && blockingSummary ? (
                                <p className="subtle-text">{blockingSummary}</p>
                              ) : null}

                              <div className="table-scroll">
                                <table className="summary-table">
                                  <thead>
                                    <tr>
                                      <th scope="col">Level</th>
                                      <th scope="col">Item</th>
                                      <th scope="col">Requirement</th>
                                      <th scope="col">% complete</th>
                                      <th scope="col">Current mastery</th>
                                      <th scope="col">Remaining</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {levelGroup.rows.map((row) => (
                                      <tr
                                        key={`${row.towerLevel}-${row.slotIndex}-${row.canonicalKey}-${row.requiredThreshold}`}
                                        className={[
                                          row.achieved ? 'summary-table__row--complete' : '',
                                          isNextRelevantLevel && !row.achieved
                                            ? 'summary-table__row--highlight'
                                            : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' ')}
                                      >
                                        <td>{row.towerLevel}</td>
                                        <td>
                                          <strong>{row.itemName}</strong>
                                          {shouldShowTowerNote(row.notes) ? (
                                            <p className="subtle-text">Note: {row.notes}</p>
                                          ) : null}
                                          {!row.matchedSnapshotRow ? (
                                            <p className="subtle-text">Unmatched in latest snapshot</p>
                                          ) : null}
                                        </td>
                                        <td>{formatCompactRequirementLabel(row.requiredThreshold)}</td>
                                        <td
                                          className={`tower-percent-cell${
                                            row.achieved ? ' tower-percent-cell--complete' : ''
                                          }`}
                                          style={getPercentCellStyle(
                                            row.currentMastery,
                                            row.requiredThreshold,
                                          )}
                                        >
                                          <span className="tower-percent-cell__label">
                                            {formatPercentComplete(row.currentMastery, row.requiredThreshold)}
                                          </span>
                                        </td>
                                        <td>{row.currentMastery.toLocaleString()}</td>
                                        <td>{row.remainingToRequirement.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : null}

            {filteredGroups.length > 0 && completedRangeGroups.length > 0 ? (
              <details className="tower-range-group-card">
                <summary className="tower-range-summary">
                  <div className="tower-range-summary__text">
                    <h3 className="section-title">Completed ranges</h3>
                    <p className="subtle-text">
                      {completedRangeGroups.length.toLocaleString()} completed range
                      {completedRangeGroups.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="tower-level-summary__badge tower-level-summary__badge--complete">Completed</span>
                </summary>

                <div className="page-stack">
                  {completedRangeGroups.map((rangeGroup) => (
                    <details key={rangeGroup.towerLevelRange} className="tower-range-card">
                      <summary className="tower-range-summary">
                        <div className="tower-range-summary__text">
                          <h4 className="section-title">Tower Levels {rangeGroup.towerLevelRange}</h4>
                        </div>
                        <span className="tower-level-summary__badge tower-level-summary__badge--complete">
                          Completed
                        </span>
                      </summary>

                      <div className="page-stack">
                        {rangeGroup.levels.map((levelGroup) => (
                          <details key={levelGroup.towerLevel} className="tower-level-card">
                            <summary className="tower-level-summary">
                              <div className="tower-level-summary__text">
                                <h4 className="section-title">
                                  Tower Level {levelGroup.towerLevel} -{' '}
                                  {formatLevelSummary(0, levelGroup.rows.length)}
                                </h4>
                              </div>
                              <span className="tower-level-summary__badge tower-level-summary__badge--complete">
                                Completed
                              </span>
                            </summary>

                            <div className="table-scroll">
                              <table className="summary-table">
                                <thead>
                                  <tr>
                                    <th scope="col">Level</th>
                                    <th scope="col">Item</th>
                                    <th scope="col">Requirement</th>
                                    <th scope="col">% complete</th>
                                    <th scope="col">Current mastery</th>
                                    <th scope="col">Remaining</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {levelGroup.rows.map((row) => (
                                    <tr
                                      key={`${row.towerLevel}-${row.slotIndex}-${row.canonicalKey}-${row.requiredThreshold}`}
                                      className={row.achieved ? 'summary-table__row--complete' : undefined}
                                    >
                                      <td>{row.towerLevel}</td>
                                      <td>
                                        <strong>{row.itemName}</strong>
                                        {shouldShowTowerNote(row.notes) ? (
                                          <p className="subtle-text">Note: {row.notes}</p>
                                        ) : null}
                                        {!row.matchedSnapshotRow ? (
                                          <p className="subtle-text">Unmatched in latest snapshot</p>
                                        ) : null}
                                      </td>
                                      <td>{formatCompactRequirementLabel(row.requiredThreshold)}</td>
                                      <td
                                        className={`tower-percent-cell${
                                          row.achieved ? ' tower-percent-cell--complete' : ''
                                        }`}
                                        style={getPercentCellStyle(
                                          row.currentMastery,
                                          row.requiredThreshold,
                                        )}
                                      >
                                        <span className="tower-percent-cell__label">
                                          {formatPercentComplete(row.currentMastery, row.requiredThreshold)}
                                        </span>
                                      </td>
                                      <td>{row.currentMastery.toLocaleString()}</td>
                                      <td>{row.remainingToRequirement.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
