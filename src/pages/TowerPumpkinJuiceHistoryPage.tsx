import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageIntro } from '../components/PageIntro';
import { TowerPumpkinJuiceHistoryChart } from '../components/TowerPumpkinJuiceHistoryChart';
import {
  deriveTowerPumpkinJuiceHistory,
  type TowerPumpkinJuiceHistory,
} from '../lib/deriveTowerPumpkinJuiceHistory';
import { loadTowerRequirements, type TowerRequirementsData } from '../lib/loadTowerRequirements';
import { listSnapshots, type MasterySnapshot } from '../lib/storage/masterySnapshots';

const TOWER_TARGET_PRESETS = [250, 300, 310, 320, 330, 340, 350];
const DEFAULT_TOWER_TARGET = 350;

type HistoryPageState = {
  isLoading: boolean;
  error: string | null;
  snapshots: MasterySnapshot[];
  towerRequirements: TowerRequirementsData | null;
};

function parseTargetLevels(value: string | null): number[] {
  const levels = (value ?? '')
    .split(',')
    .map((candidate) => Number(candidate.trim()))
    .filter((candidate) => Number.isInteger(candidate) && candidate > 0);

  return levels.length > 0
    ? [...new Set(levels)].sort((left, right) => left - right)
    : [DEFAULT_TOWER_TARGET];
}

function formatFullDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatChange(change: number): string {
  if (change === 0) {
    return 'No change';
  }

  return change < 0
    ? `${Math.abs(change).toLocaleString()} fewer`
    : `${change.toLocaleString()} more`;
}

function getSnapshotRows(history: TowerPumpkinJuiceHistory) {
  const firstSeries = history.series[0];

  if (!firstSeries) {
    return [];
  }

  return [...firstSeries.points].reverse().map((point) => ({
    snapshotId: point.snapshotId,
    savedAt: point.savedAt,
    points: history.series.map((series) => series.points.find((candidate) => candidate.snapshotId === point.snapshotId)),
  }));
}

export function TowerPumpkinJuiceHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLevels = useMemo(() => parseTargetLevels(searchParams.get('levels')), [searchParams]);
  const [customTargetInput, setCustomTargetInput] = useState('');
  const [controlError, setControlError] = useState<string | null>(null);
  const [showIncomplete, setShowIncomplete] = useState(true);
  const [startAtZero, setStartAtZero] = useState(false);
  const [pageState, setPageState] = useState<HistoryPageState>({
    isLoading: true,
    error: null,
    snapshots: [],
    towerRequirements: null,
  });

  useEffect(() => {
    let isMounted = true;

    void Promise.all([listSnapshots(), loadTowerRequirements()])
      .then(([snapshots, towerRequirements]) => {
        if (!isMounted) {
          return;
        }

        setPageState({
          isLoading: false,
          error: null,
          snapshots,
          towerRequirements,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setPageState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load Tower PJ history.',
          snapshots: [],
          towerRequirements: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const history = useMemo(
    () => pageState.towerRequirements
      ? deriveTowerPumpkinJuiceHistory(pageState.snapshots, pageState.towerRequirements, selectedLevels)
      : null,
    [pageState.snapshots, pageState.towerRequirements, selectedLevels],
  );
  const maxKnownTowerLevel = useMemo(
    () => Math.max(0, ...(pageState.towerRequirements?.entries.map((entry) => entry.towerLevel) ?? [])),
    [pageState.towerRequirements],
  );
  const focusSeries = history?.series[history.series.length - 1] ?? null;
  const firstPoint = focusSeries?.points[0] ?? null;
  const latestPoint = focusSeries?.points[focusSeries.points.length - 1] ?? null;
  const totalChange = firstPoint && latestPoint
    ? latestPoint.totalPumpkinJuicesNeeded - firstPoint.totalPumpkinJuicesNeeded
    : null;
  const snapshotRows = history ? getSnapshotRows(history) : [];

  function updateSelectedLevels(nextLevels: number[]): void {
    const normalizedLevels = [...new Set(nextLevels)].sort((left, right) => left - right);

    if (normalizedLevels.length === 0) {
      setControlError('Keep at least one Tower target selected.');
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('levels', normalizedLevels.join(','));
    setSearchParams(nextSearchParams, { replace: true });
    setControlError(null);
  }

  function toggleTargetLevel(targetLevel: number): void {
    updateSelectedLevels(
      selectedLevels.includes(targetLevel)
        ? selectedLevels.filter((level) => level !== targetLevel)
        : [...selectedLevels, targetLevel],
    );
  }

  function addCustomTarget(): void {
    const targetLevel = Number(customTargetInput.trim());

    if (!Number.isInteger(targetLevel) || targetLevel <= 0) {
      setControlError('Enter a positive whole-number Tower level.');
      return;
    }

    if (maxKnownTowerLevel > 0 && targetLevel > maxKnownTowerLevel) {
      setControlError(`Current Tower requirements only go through T${maxKnownTowerLevel}.`);
      return;
    }

    updateSelectedLevels([...selectedLevels, targetLevel]);
    setCustomTargetInput('');
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Tower PJ History"
        description="See how your estimated Pumpkin Juice needed for selected Tower targets changes across saved mastery snapshots."
        storageKey="tower-pj-history"
      />

      <div className="section-heading-row tower-pj-history__context">
        <p className="supporting-text">
          Uses today&apos;s known Tower requirements for every date. Owned Pumpkin Juice is not subtracted.
        </p>
        <Link className="button button--secondary" to="/tower-progress">
          Back to Tower Progress
        </Link>
      </div>

      <section className="page-card page-stack" aria-labelledby="tower-pj-history-targets-title">
        <div className="section-heading-row">
          <div>
            <h2 id="tower-pj-history-targets-title">Tower targets</h2>
            <p className="supporting-text">Select one or more lines to compare.</p>
          </div>
        </div>

        <div className="segmented-control" role="group" aria-label="Tower target lines">
          {TOWER_TARGET_PRESETS.map((targetLevel) => {
            const isSelected = selectedLevels.includes(targetLevel);
            return (
              <button
                key={targetLevel}
                type="button"
                className={`segmented-control__button${isSelected ? ' segmented-control__button--active' : ''}`}
                aria-pressed={isSelected}
                onClick={() => toggleTargetLevel(targetLevel)}
              >
                T{targetLevel}
              </button>
            );
          })}
          {selectedLevels.filter((level) => !TOWER_TARGET_PRESETS.includes(level)).map((targetLevel) => (
            <button
              key={targetLevel}
              type="button"
              className="segmented-control__button segmented-control__button--active"
              aria-pressed="true"
              onClick={() => toggleTargetLevel(targetLevel)}
            >
              T{targetLevel}
            </button>
          ))}
        </div>

        <div className="inline-control-row">
          <label className="field-label" htmlFor="tower-pj-history-custom-target">
            Custom Tower level
          </label>
          <input
            id="tower-pj-history-custom-target"
            className="text-input text-input--short"
            type="number"
            min="1"
            max={maxKnownTowerLevel || undefined}
            step="1"
            value={customTargetInput}
            placeholder="e.g. 345"
            onChange={(event) => setCustomTargetInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                addCustomTarget();
              }
            }}
          />
          <button type="button" className="button" onClick={addCustomTarget}>
            Add line
          </button>
        </div>
        {controlError ? <p className="status-message status-message--error" role="alert">{controlError}</p> : null}
      </section>

      {pageState.isLoading ? <p className="empty-state">Loading saved snapshots and Tower requirements...</p> : null}
      {!pageState.isLoading && pageState.error ? (
        <p className="status-message status-message--error">{pageState.error}</p>
      ) : null}

      {!pageState.isLoading && !pageState.error && history ? (
        <>
          <section className="page-card page-stack" aria-labelledby="tower-pj-history-chart-title">
            <div className="section-heading-row tower-pj-history__chart-heading">
              <div>
                <h2 id="tower-pj-history-chart-title">Pumpkin Juice needed over time</h2>
                {latestPoint ? (
                  <p className="tower-pj-history__latest" aria-live="polite">
                    <strong>
                      {latestPoint.isLowerBound ? 'At least ' : ''}
                      {latestPoint.totalPumpkinJuicesNeeded.toLocaleString()} PJ
                      {latestPoint.isLowerBound ? '*' : ''}
                    </strong>{' '}
                    for T{latestPoint.targetLevel}
                    {totalChange !== null && firstPoint ? ` · ${formatChange(totalChange)} since ${formatFullDate(firstPoint.savedAt)}` : ''}
                  </p>
                ) : (
                  <p className="supporting-text">No saved mastery snapshots yet.</p>
                )}
              </div>
              <div className="tower-pj-history__chart-controls">
                <label className="check-row" htmlFor="tower-pj-history-show-incomplete">
                  <input
                    id="tower-pj-history-show-incomplete"
                    type="checkbox"
                    checked={showIncomplete}
                    onChange={(event) => setShowIncomplete(event.target.checked)}
                  />
                  Show incomplete points
                </label>
                <div className="segmented-control" role="group" aria-label="Vertical chart scale">
                  <button
                    type="button"
                    className={`segmented-control__button${!startAtZero ? ' segmented-control__button--active' : ''}`}
                    aria-pressed={!startAtZero}
                    onClick={() => setStartAtZero(false)}
                  >
                    Zoomed
                  </button>
                  <button
                    type="button"
                    className={`segmented-control__button${startAtZero ? ' segmented-control__button--active' : ''}`}
                    aria-pressed={startAtZero}
                    onClick={() => setStartAtZero(true)}
                  >
                    Start at zero
                  </button>
                </div>
              </div>
            </div>

            <TowerPumpkinJuiceHistoryChart
              history={history}
              showIncomplete={showIncomplete}
              startAtZero={startAtZero}
            />
          </section>

          <section className="page-card page-stack" aria-labelledby="tower-pj-history-table-title">
            <div className="section-heading-row">
              <div>
                <h2 id="tower-pj-history-table-title">Exact values by snapshot</h2>
                <p className="supporting-text">Newest first.</p>
              </div>
            </div>

            {snapshotRows.length > 0 ? (
              <div className="table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Snapshot</th>
                      {history.targetLevels.map((targetLevel) => (
                        <th scope="col" key={targetLevel}>T{targetLevel}</th>
                      ))}
                      <th scope="col">Baseline status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshotRows.map((row) => {
                      const lowerBoundPoints = row.points.filter((point) => point?.isLowerBound);
                      const largestGap = Math.max(0, ...lowerBoundPoints.map((point) => point?.blockedItemCount ?? 0));

                      return (
                        <tr key={row.snapshotId}>
                          <td>{formatFullDate(row.savedAt)}</td>
                          {row.points.map((point, pointIndex) => (
                            <td key={history.targetLevels[pointIndex]}>
                              {point ? `${point.totalPumpkinJuicesNeeded.toLocaleString()}${point.isLowerBound ? '*' : ''}` : '—'}
                            </td>
                          ))}
                          <td>
                            {lowerBoundPoints.length > 0
                              ? `Lower bound · up to ${largestGap.toLocaleString()} missing baseline item${largestGap === 1 ? '' : 's'}`
                              : 'Complete'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">Save at least one mastery snapshot to see historical values.</p>
            )}

            <p className="subtle-text">
              * Lower bound: one or more required Tower items had no mastery baseline in that snapshot.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
