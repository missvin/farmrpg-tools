import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import { TowerPumpkinJuiceTargetPlanner } from '../components/TowerPumpkinJuiceTargetPlanner';
import { deriveTowerProgress } from '../lib/deriveTowerProgress';
import { getItemIcon } from '../lib/itemIconManifest';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import {
  createDefaultPumpkinJuicePlannerState,
  loadPumpkinJuicePlannerState,
  savePumpkinJuicePlannerState,
} from '../lib/pumpkinJuicePlannerState';
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
    return 'M (10k)';
  }

  if (requiredThreshold === 100_000) {
    return 'GM (100k)';
  }

  return 'MM (1M)';
}

function formatPumpkinJuiceEstimate(totalPumpkinJuices: number | null): string {
  return totalPumpkinJuices === null ? 'Needs baseline mastery first' : totalPumpkinJuices.toLocaleString();
}

function buildItemTooltip(notes: string | null): string | null {
  const parts: string[] = [];

  if (notes) {
    parts.push(`Notes: ${notes}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

function TowerProgressItemName({ canonicalKey, itemName }: { canonicalKey: string; itemName: string }) {
  const icon = getItemIcon(canonicalKey);

  return (
    <span className="tower-item-cell">
      <ItemProfileLink canonicalKey={canonicalKey} itemName={itemName} iconSrc={icon?.src ?? null} />
    </span>
  );
}

function getTowerProgressItemElementId(canonicalKey: string): string {
  return `tower-progress-item-${canonicalKey.replace(/[^a-z0-9]+/gi, '-')}`;
}

function parseTowerTargetLevelInput(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

export function TowerProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetCanonicalKey = searchParams.get('item')?.trim().toLowerCase() ?? null;
  const [targetLevelInput, setTargetLevelInput] = useState(() => searchParams.get('through') ?? '');
  const towerTargetLevel = useMemo(() => parseTowerTargetLevelInput(targetLevelInput), [targetLevelInput]);
  const [pumpkinJuicePlannerState, setPumpkinJuicePlannerState] = useState(() => {
    try {
      return loadPumpkinJuicePlannerState();
    } catch {
      return createDefaultPumpkinJuicePlannerState();
    }
  });
  const [ownedPumpkinJuiceInput, setOwnedPumpkinJuiceInput] = useState(
    String(pumpkinJuicePlannerState.ownedPumpkinJuiceCount),
  );
  const [pumpkinJuiceMessage, setPumpkinJuiceMessage] = useState<string | null>(null);
  const [pumpkinJuiceError, setPumpkinJuiceError] = useState<string | null>(null);
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

  function updateTowerTargetSearchParam(value: string): void {
    const nextParams = new URLSearchParams(searchParams);
    const parsedTargetLevel = parseTowerTargetLevelInput(value);

    if (parsedTargetLevel) {
      nextParams.set('through', String(parsedTargetLevel));
    } else {
      nextParams.delete('through');
    }

    setSearchParams(nextParams, { replace: true });
  }

  function handleSelectAllKnownTowerLevels(): void {
    setTargetLevelInput('');
    updateTowerTargetSearchParam('');
  }

  function handleSelectTowerPreset(level: number): void {
    const value = String(level);
    setTargetLevelInput(value);
    updateTowerTargetSearchParam(value);
  }

  function handleTargetLevelInputChange(value: string): void {
    setTargetLevelInput(value);
    updateTowerTargetSearchParam(value);
  }

  function handleSaveOwnedPumpkinJuiceCount(): void {
    const normalizedCount = Number(ownedPumpkinJuiceInput);

    if (!Number.isFinite(normalizedCount) || normalizedCount < 0) {
      setPumpkinJuiceMessage(null);
      setPumpkinJuiceError('Enter a non-negative Pumpkin Juice count.');
      return;
    }

    try {
      const savedState = savePumpkinJuicePlannerState({
        ...pumpkinJuicePlannerState,
        ownedPumpkinJuiceCount: Math.floor(normalizedCount),
      });

      setPumpkinJuicePlannerState(savedState);
      setOwnedPumpkinJuiceInput(String(savedState.ownedPumpkinJuiceCount));
      setPumpkinJuiceError(null);
      setPumpkinJuiceMessage('Saved Pumpkin Juice count on this device.');
    } catch (error) {
      setPumpkinJuiceMessage(null);
      setPumpkinJuiceError(
        error instanceof Error ? error.message : 'Unable to save Pumpkin Juice count.',
      );
    }
  }

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
            derivedProgress: deriveTowerProgress(snapshot, towerRequirementsData, masteryDifficultyData, {
              maxTowerLevel: towerTargetLevel,
            }),
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
  }, [towerTargetLevel]);

  useEffect(() => {
    if (!targetCanonicalKey || !progressState.derivedProgress) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      document
        .getElementById(getTowerProgressItemElementId(targetCanonicalKey))
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [progressState.derivedProgress, targetCanonicalKey]);

  return (
    <div className="page-stack">
      <PageIntro
        title="Tower Items by Difficulty"
        description="See the unique Tower items still left to GM or MM from your latest saved snapshot, using each item's highest required target."
        storageKey="tower-progress"
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
          {(() => {
            const derivedProgress = progressState.derivedProgress;

            return (
              <>
          <TowerPumpkinJuiceTargetPlanner
            derivedProgress={derivedProgress}
            targetLevel={towerTargetLevel}
            targetLevelInput={targetLevelInput}
            ownedPumpkinJuiceCount={pumpkinJuicePlannerState.ownedPumpkinJuiceCount}
            ownedPumpkinJuiceInput={ownedPumpkinJuiceInput}
            message={pumpkinJuiceMessage}
            error={pumpkinJuiceError}
            onSelectAllKnown={handleSelectAllKnownTowerLevels}
            onSelectPreset={handleSelectTowerPreset}
            onTargetLevelInputChange={handleTargetLevelInputChange}
            onOwnedPumpkinJuiceInputChange={setOwnedPumpkinJuiceInput}
            onSaveOwnedPumpkinJuiceCount={handleSaveOwnedPumpkinJuiceCount}
          />

          <section className="page-card page-stack" aria-labelledby="tower-progress-difficulty-title">
            <div>
              <h2 id="tower-progress-difficulty-title">Difficulty Breakdown</h2>
              <p className="supporting-text">
                Group remaining Tower items by difficulty so rare or slower goals are easier to scan.
              </p>
            </div>

            <div className="page-stack">
              {derivedProgress.difficultySummary.map((row) => {
                const drilldownGroup = derivedProgress.difficultyDrilldown.find(
                  (group) => group.label === row.label,
                );
                const hasDrilldownRows = (drilldownGroup?.rows.length ?? 0) > 0;

                return (
                  <details
                    key={row.label}
                    className="tower-range-card"
                    open={row.remainingItems > 0 && row.remainingItems <= 2}
                  >
                    <summary className="tower-range-summary">
                      <div className="tower-range-summary__text">
                        <h3 className="section-title">{row.label}</h3>
                        <p className="subtle-text">
                          {row.remainingItems.toLocaleString()} / {row.totalItems.toLocaleString()} items remaining
                        </p>
                      </div>
                      <div className="tower-range-summary__text">
                        <strong>
                          {formatCompactMastery(row.remainingMastery)} /{' '}
                          {formatCompactMastery(row.remainingTargetMastery)} mastery remaining
                        </strong>
                        <p className="subtle-text">
                          {formatPercent(toCompletePercent(row.totalTargetMastery, row.remainingMastery))} complete
                          toward target mastery
                        </p>
                      </div>
                    </summary>

                    <p className="subtle-text">
                      {formatPercent(toCompletePercent(row.totalItems, row.remainingItems))} of items complete
                    </p>

                    {hasDrilldownRows ? (
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
                              <th scope="col">PJs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drilldownGroup?.rows.map((detailRow) => (
                              <tr
                                key={`${detailRow.towerLevel}-${detailRow.slotIndex}-${detailRow.canonicalKey}-${detailRow.requiredThreshold}`}
                              >
                                <td>{detailRow.towerLevel}</td>
                                <td>
                                  <TowerProgressItemName
                                    canonicalKey={detailRow.canonicalKey}
                                    itemName={detailRow.itemName}
                                  />
                                  {!detailRow.matchedSnapshotRow ? (
                                    <p className="subtle-text">
                                      Not in your latest import yet. Get at least 1 mastery and import again to estimate
                                      Pumpkin Juice.
                                    </p>
                                  ) : null}
                                </td>
                                <td>{detailRow.masteryLevelLabel}</td>
                                <td>{formatPercent(detailRow.progressPercent)}</td>
                                <td>{detailRow.currentMastery.toLocaleString()}</td>
                                <td>{detailRow.remainingToRequirement.toLocaleString()}</td>
                                <td>{formatPumpkinJuiceEstimate(detailRow.pumpkinJuiceEstimate.totalPumpkinJuices)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="empty-state">
                        No outstanding tower rows remain in this difficulty bucket.
                      </p>
                    )}
                  </details>
                );
              })}
            </div>
          </section>

          <section className="page-card page-stack" aria-labelledby="tower-progress-items-title">
            <div>
              <h2 id="tower-progress-items-title">Remaining Tower Items</h2>
              <p className="supporting-text">
                Each item appears once at the highest Tower mastery tier it still needs.
              </p>
            </div>

            {progressState.derivedProgress.remainingItems.length === 0 ? (
              <p className="empty-state">All unique Tower planning items are complete in the latest snapshot.</p>
            ) : (
              <ul className="progress-list">
                {progressState.derivedProgress.remainingItems.map((item) => (
                  <li
                    key={item.canonicalKey}
                    id={getTowerProgressItemElementId(item.canonicalKey)}
                    className={`progress-list__item${
                      item.canonicalKey === targetCanonicalKey ? ' progress-list__item--highlight' : ''
                    }`}
                  >
                    {(() => {
                      const tooltipText = buildItemTooltip(item.notes);

                      return (
                        <>
                    <div className="progress-list__header">
                      <div className="progress-list__title-row">
                        <TowerProgressItemName canonicalKey={item.canonicalKey} itemName={item.itemName} />
                        {tooltipText ? (
                          <span
                            className="progress-list__tooltip"
                            title={tooltipText}
                            aria-label={`Details for ${item.itemName}`}
                          >
                            Details
                          </span>
                        ) : null}
                      </div>
                      <span>{item.currentMastery.toLocaleString()} / {item.requiredThreshold.toLocaleString()}</span>
                    </div>
                    <p className="progress-list__meta">
                      <span>{item.difficultyLabel}</span>
                      {' | '}
                      <span>Target: {formatRequirementLabel(item.requiredThreshold)}</span>
                      {' | '}
                      <span>
                        PJs: {formatPumpkinJuiceEstimate(item.pumpkinJuiceEstimate.totalPumpkinJuices)}
                      </span>
                      {item.pumpkinJuiceEstimate.nextPumpkinJuiceGain ? (
                        <>
                          {' | '}
                          <span>Next PJ: +{item.pumpkinJuiceEstimate.nextPumpkinJuiceGain.toLocaleString()}</span>
                        </>
                      ) : null}
                    </p>
                    <div
                      className="progress-list__progress-cell"
                      style={
                        {
                          '--progress-list-fill': `${Math.max(0, Math.min(100, item.progressPercent))}%`,
                        } as CSSProperties
                      }
                      aria-label={`${item.itemName} progress`}
                    >
                      <span className="progress-list__progress-label">
                        {formatPercent(item.progressPercent)} complete | {item.remainingToTarget.toLocaleString()} remaining
                      </span>
                    </div>
                    {!item.matchedSnapshotRow ? (
                      <p className="progress-list__notes">
                        Not in your latest import yet. Get at least 1 mastery and import again to estimate Pumpkin
                        Juice.
                      </p>
                    ) : null}
                        </>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </section>
              </>
            );
          })()}
        </>
      ) : null}
    </div>
  );
}
