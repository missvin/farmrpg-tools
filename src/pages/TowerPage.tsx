import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { PageIntro } from '../components/PageIntro';
import { deriveTowerRequirements } from '../lib/deriveTowerRequirements';
import { getItemIcon } from '../lib/itemIconManifest';
import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

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

function formatRequirementCompletionSummary(completedRequirements: number, totalRequirements: number): string {
  const remainingRequirements = totalRequirements - completedRequirements;
  const completionPercent = totalRequirements > 0 ? Math.round((completedRequirements / totalRequirements) * 100) : 0;

  return `Completed ${completedRequirements.toLocaleString()}/${totalRequirements.toLocaleString()} tower mastery requirements (${completionPercent}%), with ${remainingRequirements.toLocaleString()} remaining.`;
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

function TowerItemCell({
  canonicalKey,
  itemName,
  matchedSnapshotRow,
  notes,
}: {
  canonicalKey: string;
  itemName: string;
  matchedSnapshotRow: boolean;
  notes: string | null;
}) {
  const icon = getItemIcon(canonicalKey);

  return (
    <div className="tower-item-cell">
      {icon ? <img className="item-icon" src={icon.src} alt="" aria-hidden="true" loading="lazy" /> : null}
      <div>
        <strong>{itemName}</strong>
        {shouldShowTowerNote(notes) ? <p className="subtle-text">Note: {notes}</p> : null}
        {!matchedSnapshotRow ? <p className="subtle-text">Unmatched in latest snapshot</p> : null}
      </div>
    </div>
  );
}

export function TowerPage() {
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
  return (
    <div className="page-stack">
      <PageIntro
        title="Tower Requirements"
        description="Check your latest saved snapshot against the local Tower requirement list, level by level."
        storageKey="tower"
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
          <section className="page-card page-stack" aria-label="Tower requirement status">
            <p className="supporting-text">
              {formatRequirementCompletionSummary(completedRequirements, totalRequirements)}
            </p>

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
                  <option value="blocking">Remaining only</option>
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
                                          <TowerItemCell
                                            canonicalKey={row.canonicalKey}
                                            itemName={row.itemName}
                                            matchedSnapshotRow={row.matchedSnapshotRow}
                                            notes={row.notes}
                                          />
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
                                        <TowerItemCell
                                          canonicalKey={row.canonicalKey}
                                          itemName={row.itemName}
                                          matchedSnapshotRow={row.matchedSnapshotRow}
                                          notes={null}
                                        />
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
