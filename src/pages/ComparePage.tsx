import { useEffect, useMemo, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { deriveSnapshotComparison } from '../lib/deriveSnapshotComparison';
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

  return (
    <div className="page-stack">
      <PageIntro
        title="Snapshot Comparison"
        description="Compare two saved local snapshots to see concise mastery deltas and changed items."
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
                        <td>{row.canonicalKey}</td>
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
