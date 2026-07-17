import { useEffect, useMemo, useState } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  deriveSnapshotComparison,
  deriveSnapshotComparisonNarrative,
} from '../lib/deriveSnapshotComparison';
import {
  getSnapshot,
  listSnapshotSummaries,
  type MasterySnapshot,
  type MasterySnapshotSummary,
} from '../lib/storage/masterySnapshots';

function formatCompactDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

function formatSnapshotLabel(snapshot: MasterySnapshotSummary): string {
  return `${new Date(snapshot.savedAt).toLocaleString()} • ${snapshot.itemCount.toLocaleString()} items`;
}

function formatChangeType(changeType: 'increased' | 'decreased' | 'added' | 'removed'): string {
  if (changeType === 'increased') {
    return 'Increased';
  }

  if (changeType === 'decreased') {
    return 'Decreased';
  }

  if (changeType === 'added') {
    return 'Added';
  }

  return 'Removed';
}

export function ComparePage() {
  const [compareState, setCompareState] = useState<{
    isLoading: boolean;
    loadError: string | null;
    snapshots: MasterySnapshotSummary[];
    fromSnapshotId: string;
    toSnapshotId: string;
    fromSnapshot: MasterySnapshot | null;
    toSnapshot: MasterySnapshot | null;
    compareError: string | null;
  }>({
    isLoading: true,
    loadError: null,
    snapshots: [],
    fromSnapshotId: '',
    toSnapshotId: '',
    fromSnapshot: null,
    toSnapshot: null,
    compareError: null,
  });

  useEffect(() => {
    let isMounted = true;

    void listSnapshotSummaries()
      .then((snapshots) => {
        if (!isMounted) {
          return;
        }

        setCompareState((current) => ({
          ...current,
          isLoading: false,
          loadError: null,
          snapshots,
          fromSnapshotId: snapshots[1]?.snapshotId ?? snapshots[0]?.snapshotId ?? '',
          toSnapshotId: snapshots[0]?.snapshotId ?? '',
        }));
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setCompareState((current) => ({
          ...current,
          isLoading: false,
          loadError: error instanceof Error ? error.message : 'Unable to load local snapshots.',
        }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!compareState.fromSnapshotId || !compareState.toSnapshotId) {
      setCompareState((current) => ({
        ...current,
        fromSnapshot: null,
        toSnapshot: null,
        compareError: null,
      }));
      return () => {
        isMounted = false;
      };
    }

    void Promise.all([getSnapshot(compareState.fromSnapshotId), getSnapshot(compareState.toSnapshotId)])
      .then(([fromSnapshot, toSnapshot]) => {
        if (!isMounted) {
          return;
        }

        if (!fromSnapshot || !toSnapshot) {
          setCompareState((current) => ({
            ...current,
            fromSnapshot,
            toSnapshot,
            compareError: 'One or both selected snapshots could not be loaded from local storage.',
          }));
          return;
        }

        setCompareState((current) => ({
          ...current,
          fromSnapshot,
          toSnapshot,
          compareError: null,
        }));
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setCompareState((current) => ({
          ...current,
          fromSnapshot: null,
          toSnapshot: null,
          compareError: error instanceof Error ? error.message : 'Unable to compare the selected snapshots.',
        }));
      });

    return () => {
      isMounted = false;
    };
  }, [compareState.fromSnapshotId, compareState.toSnapshotId]);

  const comparison = useMemo(() => {
    if (!compareState.fromSnapshot || !compareState.toSnapshot) {
      return null;
    }

    return deriveSnapshotComparison(compareState.fromSnapshot, compareState.toSnapshot);
  }, [compareState.fromSnapshot, compareState.toSnapshot]);
  const narrative = useMemo(
    () => comparison ? deriveSnapshotComparisonNarrative(comparison) : null,
    [comparison],
  );

  return (
    <div className="page-stack">
      <PageIntro
        title="Snapshot Comparison"
        description="Choose two local snapshots to see which item mastery values changed between imports."
        storageKey="compare"
      />

      <section className="page-card page-stack" aria-labelledby="compare-selection-title">
        <div>
          <h2 id="compare-selection-title">Choose Snapshots</h2>
          <p className="supporting-text">
            Select a baseline snapshot and a later snapshot. This stays read-only and local to your browser.
          </p>
        </div>

        {compareState.isLoading ? <p className="empty-state">Loading saved snapshot history...</p> : null}
        {!compareState.isLoading && compareState.loadError ? (
          <p className="status-message status-message--error">{compareState.loadError}</p>
        ) : null}
        {!compareState.isLoading && !compareState.loadError && compareState.snapshots.length === 0 ? (
          <p className="empty-state">No saved snapshots yet. Import a mastery export to create your first one.</p>
        ) : null}
        {!compareState.isLoading && !compareState.loadError && compareState.snapshots.length === 1 ? (
          <p className="empty-state">
            One saved snapshot found. Save at least one more snapshot to compare changes over time.
          </p>
        ) : null}

        {compareState.snapshots.length >= 2 ? (
          <div className="summary-grid">
            <div className="page-stack page-stack--tight">
              <label className="field-label" htmlFor="compare-from-snapshot">
                From snapshot
              </label>
              <select
                id="compare-from-snapshot"
                className="text-input"
                value={compareState.fromSnapshotId}
                onChange={(event) =>
                  setCompareState((current) => ({
                    ...current,
                    fromSnapshotId: event.target.value,
                  }))
                }
              >
                {compareState.snapshots.map((snapshot) => (
                  <option key={snapshot.snapshotId} value={snapshot.snapshotId}>
                    {formatSnapshotLabel(snapshot)}
                  </option>
                ))}
              </select>
            </div>

            <div className="page-stack page-stack--tight">
              <label className="field-label" htmlFor="compare-to-snapshot">
                To snapshot
              </label>
              <select
                id="compare-to-snapshot"
                className="text-input"
                value={compareState.toSnapshotId}
                onChange={(event) =>
                  setCompareState((current) => ({
                    ...current,
                    toSnapshotId: event.target.value,
                  }))
                }
              >
                {compareState.snapshots.map((snapshot) => (
                  <option key={snapshot.snapshotId} value={snapshot.snapshotId}>
                    {formatSnapshotLabel(snapshot)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {compareState.compareError ? (
          <p className="status-message status-message--error">{compareState.compareError}</p>
        ) : null}
      </section>

      {comparison ? (
        <>
          <section className="page-card page-stack" aria-labelledby="compare-summary-title">
            <div>
              <h2 id="compare-summary-title">Comparison Summary</h2>
              <p className="supporting-text">
                Comparing {new Date(compareState.fromSnapshot?.savedAt ?? compareState.fromSnapshot?.createdAt ?? '').toLocaleString()} to{' '}
                {new Date(compareState.toSnapshot?.savedAt ?? compareState.toSnapshot?.createdAt ?? '').toLocaleString()}.
              </p>
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Total mastery delta</dt>
                <dd>{formatCompactDelta(comparison.totalMasteryDelta)}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Changed items</dt>
                <dd>{comparison.totalChangedItems.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Increased items</dt>
                <dd>{comparison.increasedItems.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Decreased or removed items</dt>
                <dd>{(comparison.decreasedItems + comparison.removedItems).toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          {narrative ? (
            <section className="page-card page-stack" aria-labelledby="compare-notable-title">
              <div>
                <h2 id="compare-notable-title">Notable Changes</h2>
                <p className="supporting-text">
                  A short readout of the movements most useful to inspect before the full table.
                </p>
              </div>

              {narrative.biggestGain || narrative.thresholdCrossings.length > 0 || narrative.recheckRows.length > 0 ? (
                <ul className="history-callout-list">
                  {narrative.biggestGain ? (
                    <li className="history-callout-card">
                      <span className="history-callout-card__title">Biggest gain</span>
                      <ItemProfileLink
                        canonicalKey={narrative.biggestGain.canonicalKey}
                        itemName={narrative.biggestGain.itemName}
                      />
                      <strong>{formatCompactDelta(narrative.biggestGain.delta)}</strong>
                      <span>
                        {narrative.biggestGain.fromValue.toLocaleString()} to{' '}
                        {narrative.biggestGain.toValue.toLocaleString()}
                      </span>
                    </li>
                  ) : null}

                  {narrative.thresholdCrossings.length > 0 ? (
                    <li className="history-callout-card">
                      <span className="history-callout-card__title">Thresholds reached</span>
                      <strong>{narrative.thresholdCrossings.length.toLocaleString()}</strong>
                      <ul className="compare-notable-list">
                        {narrative.thresholdCrossings.map((crossing) => (
                          <li key={`${crossing.canonicalKey}-${crossing.threshold}`}>
                            <ItemProfileLink
                              canonicalKey={crossing.canonicalKey}
                              itemName={crossing.itemName}
                            />
                            <span>{crossing.label} at {crossing.threshold.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : null}

                  {narrative.recheckRows.length > 0 ? (
                    <li className="history-callout-card">
                      <span className="history-callout-card__title">Worth rechecking</span>
                      <strong>{narrative.recheckRows.length.toLocaleString()}</strong>
                      <span>These counts decreased or disappeared between snapshots.</span>
                      <ul className="compare-notable-list">
                        {narrative.recheckRows.map((row) => (
                          <li key={row.canonicalKey}>
                            <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} />
                            <span>{formatCompactDelta(row.delta)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="empty-state">No notable item movement between these snapshots.</p>
              )}
            </section>
          ) : null}

          <section className="page-card page-stack" aria-labelledby="compare-changed-items-title">
            <div>
              <h2 id="compare-changed-items-title">Changed Items</h2>
              <p className="supporting-text">
                Items with non-zero mastery changes between the two selected snapshots.
              </p>
            </div>

            {comparison.changedRows.length === 0 ? (
              <p className="empty-state">No item counts changed between these snapshots.</p>
            ) : (
              <div className="table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">From</th>
                      <th scope="col">To</th>
                      <th scope="col">Delta</th>
                      <th scope="col">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.changedRows.map((row) => (
                      <tr key={row.canonicalKey}>
                        <td>
                          <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} />
                        </td>
                        <td>{row.fromValue.toLocaleString()}</td>
                        <td>{row.toValue.toLocaleString()}</td>
                        <td>{formatCompactDelta(row.delta)}</td>
                        <td>{formatChangeType(row.changeType)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
