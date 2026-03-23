import { useEffect, useState, type CSSProperties } from 'react';

import { PageIntro } from '../components/PageIntro';
import { deriveMasteryDifficultyStats } from '../lib/deriveMasteryDifficultyStats';
import { downloadMissingMasteryDifficultyCsv } from '../lib/exportMissingMasteryDifficultyCsv';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

type SortedMode = 'm' | 'gm' | 'mm';
type TierBucketKey = 'no-tier' | 'mastered' | 'grand-mastered';
type TierBucket = {
  key: TierBucketKey;
  label: string;
  items: Array<ReturnType<typeof buildBucketItem>>;
};

const MASTERY_TARGET = 10_000;
const GRAND_MASTERY_TARGET = 100_000;

function formatRemainingLabel(mode: SortedMode): string {
  if (mode === 'm') {
    return 'Remaining to Mastery (10,000)';
  }

  return mode === 'gm' ? 'Remaining to Grand Mastery (100,000)' : 'Remaining to Mega Mastery (1,000,000)';
}

function formatProgressLabel(mode: SortedMode): string {
  if (mode === 'm') {
    return 'Progress to M (10k)';
  }

  return mode === 'gm' ? 'Progress to GM (100k)' : 'Progress to MM (1M)';
}

function getProgressPercent(currentMastery: number, mode: SortedMode): number {
  const target =
    mode === 'm' ? MASTERY_TARGET : mode === 'gm' ? GRAND_MASTERY_TARGET : 1_000_000;
  const percent = (currentMastery / target) * 100;

  if (Number.isNaN(percent) || !Number.isFinite(percent)) {
    return 0;
  }

  return Math.max(0, Math.min(100, percent));
}

function formatProgressPercent(currentMastery: number, mode: SortedMode): string {
  const percent = getProgressPercent(currentMastery, mode);
  return `${percent.toFixed(percent >= 100 ? 0 : 1)}%`;
}

function getSortedProgressCellStyle(
  currentMastery: number,
  mode: SortedMode,
): CSSProperties & Record<'--sorted-progress-fill', string> {
  return {
    '--sorted-progress-fill': `${getProgressPercent(currentMastery, mode)}%`,
  };
}

function buildBucketItem(group: { label: string }, item: {
  itemName: string;
  canonicalKey: string;
  currentMastery: number;
  remainingToTarget: number;
  difficultyLabel: string;
  method: string | null;
  notes: string | null;
}) {
  return {
    ...item,
    groupLabel: group.label,
  };
}

function getTierBucketMeta(currentMastery: number): { key: TierBucketKey; label: string; order: number } {
  if (currentMastery >= GRAND_MASTERY_TARGET) {
    return {
      key: 'grand-mastered',
      label: 'Grand Mastered',
      order: 0,
    };
  }

  if (currentMastery >= MASTERY_TARGET) {
    return {
      key: 'mastered',
      label: 'Mastered',
      order: 1,
    };
  }

  return {
      key: 'no-tier',
      label: 'No Tier Yet',
      order: 2,
  };
}

function buildTierBuckets(
  groups: Array<{
    label: string;
    items: Array<{
      itemName: string;
      canonicalKey: string;
      currentMastery: number;
      remainingToTarget: number;
      difficultyLabel: string;
      method: string | null;
      notes: string | null;
    }>;
  }>,
): TierBucket[] {
  const bucketMap = new Map<
    TierBucketKey,
    {
      key: TierBucketKey;
      label: string;
      order: number;
      difficultyGroups: Map<string, TierBucket['items']>;
    }
  >();

  for (const group of groups) {
    for (const item of group.items) {
      const tierBucketMeta = getTierBucketMeta(item.currentMastery);
      const tierBucket =
        bucketMap.get(tierBucketMeta.key) ??
        {
          key: tierBucketMeta.key,
          label: tierBucketMeta.label,
          order: tierBucketMeta.order,
          difficultyGroups: new Map(),
        };
      const bucketItems = tierBucket.difficultyGroups.get(group.label) ?? [];

      bucketItems.push(buildBucketItem(group, item));
      tierBucket.difficultyGroups.set(group.label, bucketItems);
      bucketMap.set(tierBucketMeta.key, tierBucket);
    }
  }

  return [...bucketMap.values()]
    .sort((left, right) => left.order - right.order)
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      items: [...bucket.difficultyGroups.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .flatMap(([, items]) =>
          [...items].sort((left, right) => {
            if (left.remainingToTarget !== right.remainingToTarget) {
              return left.remainingToTarget - right.remainingToTarget;
            }

            return left.itemName.localeCompare(right.itemName);
          }),
        ),
    }));
}

export function SortedPage() {
  const [mode, setMode] = useState<SortedMode>('m');
  const [filterText, setFilterText] = useState('');
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [sortedState, setSortedState] = useState<{
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
          setSortedState({
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

          setSortedState({
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

          setSortedState({
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

        setSortedState({
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

  const activeGroups =
    mode === 'm'
      ? sortedState.derivedStats?.mLeftGroups ?? []
      : mode === 'gm'
        ? sortedState.derivedStats?.gmLeftGroups ?? []
        : sortedState.derivedStats?.mmLeftGroups ?? [];
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredGroups = activeGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.itemName.toLowerCase().includes(normalizedFilter)),
    }))
    .filter((group) => group.items.length > 0);
  const tierBuckets = buildTierBuckets(filteredGroups);
  const unmatchedCount = sortedState.derivedStats?.unmatchedItemCount ?? 0;

  function handleExportMissingItemsCsv(): void {
    if (!sortedState.derivedStats || sortedState.derivedStats.unmatchedItems.length === 0) {
      return;
    }

    try {
      downloadMissingMasteryDifficultyCsv(sortedState.derivedStats.unmatchedItems);
      setExportError(null);
      setExportMessage('Missing-items CSV downloaded for manual review and append.');
    } catch (error) {
      setExportMessage(null);
      setExportError(error instanceof Error ? error.message : 'Unable to export missing-items CSV.');
    }
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Sorted Mastery Progress"
        description="Browse the latest saved snapshot grouped by mastery difficulty and remaining progress to the next threshold."
      />

      {sortedState.isLoading ? <p className="empty-state">Loading latest snapshot and mastery difficulty data...</p> : null}

      {!sortedState.isLoading && sortedState.snapshotError ? (
        <p className="status-message status-message--error">{sortedState.snapshotError}</p>
      ) : null}

      {!sortedState.isLoading && !sortedState.snapshotError && !sortedState.snapshot ? (
        <section className="page-card page-stack">
          <h2>No Saved Snapshot</h2>
          <p className="empty-state">Import a mastery export first to view sorted progress lists.</p>
        </section>
      ) : null}

      {!sortedState.isLoading && sortedState.snapshot && sortedState.difficultyError ? (
        <section className="page-card page-stack">
          <h2>Mastery Difficulty Data</h2>
          <p className="status-message status-message--error">{sortedState.difficultyError}</p>
        </section>
      ) : null}

      {!sortedState.isLoading && sortedState.snapshot && sortedState.derivedStats ? (
        <>
          <section className="page-card page-stack" aria-labelledby="sorted-controls-title">
            <div>
              <h2 id="sorted-controls-title">Progress-to-Threshold View</h2>
              <p className="supporting-text">
                Switch between the latest snapshot items that still need progress toward Mastery, Grand Mastery,
                or Mega Mastery.
              </p>
            </div>

            <div className="button-row">
              <button
                type="button"
                className={`button ${mode === 'm' ? 'button--active' : ''}`}
                onClick={() => setMode('m')}
              >
                M Left
              </button>
              <button
                type="button"
                className={`button ${mode === 'gm' ? 'button--active' : ''}`}
                onClick={() => setMode('gm')}
              >
                GM Left
              </button>
              <button
                type="button"
                className={`button ${mode === 'mm' ? 'button--active' : ''}`}
                onClick={() => setMode('mm')}
              >
                MM Left
              </button>
            </div>

            <div className="page-stack page-stack--tight">
              <label className="field-label" htmlFor="sorted-filter">
                Filter by item name
              </label>
              <input
                id="sorted-filter"
                className="text-input"
                type="text"
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="Search item name"
              />
            </div>
          </section>

          <section className="page-card page-stack" aria-labelledby="sorted-results-title">
            <div>
              <h2 id="sorted-results-title">{formatRemainingLabel(mode)}</h2>
              <p className="supporting-text">
                Items are grouped by mastery difficulty, with Unrated covering items missing from the mastery
                difficulty data or lacking a difficulty value.
              </p>
            </div>

            {filteredGroups.length === 0 ? (
              <p className="empty-state">No items match the current filter.</p>
            ) : (
              tierBuckets.map((bucket, bucketIndex) => {
                const difficultyGroupEntries = filteredGroups.filter((group) =>
                  group.items.some((item) => getTierBucketMeta(item.currentMastery).key === bucket.key),
                );

                return (
                  <details key={bucket.key} className="sorted-rollup-card" open={bucketIndex === 0}>
                    <summary className="sorted-rollup-summary">
                      <span className="sorted-rollup-summary__title">{bucket.label}</span>
                      <span className="sorted-rollup-summary__meta">
                        {bucket.items.length.toLocaleString()} items
                      </span>
                    </summary>

                    <div className="page-stack">
                      {difficultyGroupEntries.map((group, groupIndex) => {
                        const tierItems = group.items.filter(
                          (item) => getTierBucketMeta(item.currentMastery).key === bucket.key,
                        );

                        if (tierItems.length === 0) {
                          return null;
                        }

                        return (
                          <details
                            key={`${bucket.key}-${group.label}`}
                            className="sorted-rollup-card sorted-rollup-card--nested"
                            open={bucketIndex === 0 && groupIndex === 0}
                          >
                            <summary className="sorted-rollup-summary">
                              <span className="sorted-rollup-summary__title">{group.label}</span>
                              <span className="sorted-rollup-summary__meta">
                                {tierItems.length.toLocaleString()} items
                              </span>
                            </summary>

                            <ul className="progress-list">
                              {tierItems.map((item) => (
                                <li key={`${item.canonicalKey}-${mode}`} className="progress-list__item">
                                  <div className="progress-list__header">
                                    <strong>{item.itemName}</strong>
                                    <span>{item.currentMastery.toLocaleString()}</span>
                                  </div>
                                  <div
                                    className="sorted-progress-cell"
                                    style={getSortedProgressCellStyle(item.currentMastery, mode)}
                                  >
                                    <span className="sorted-progress-cell__label">
                                      {formatProgressLabel(mode)}: {formatProgressPercent(item.currentMastery, mode)}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                );
              })
            )}
          </section>

          <section className="page-card page-stack" aria-labelledby="unmatched-items-title">
            <div>
              <h2 id="unmatched-items-title">Items Missing From Mastery Difficulty Data</h2>
              <p className="supporting-text">
                These items were parsed from the latest snapshot but do not currently match the local mastery
                difficulty data. They stay visible as Unrated in the sorted lists, and the export downloads
                append-ready template rows for `mastery_difficulty.csv`.
              </p>
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Unmatched snapshot items</dt>
                <dd>{unmatchedCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Export-ready CSV rows</dt>
                <dd>{unmatchedCount.toLocaleString()}</dd>
              </div>
            </dl>

            <p className="subtle-text">
              Missing mastery difficulty matches are non-fatal. Review the item names below, then export the CSV if
              you want template rows for local reference-data maintenance.
            </p>

            <div className="button-row">
              <button
                type="button"
                className="button"
                onClick={handleExportMissingItemsCsv}
                disabled={sortedState.derivedStats.unmatchedItems.length === 0}
              >
                Export Missing Items CSV
              </button>
            </div>

            {exportMessage ? <p className="status-message status-message--success">{exportMessage}</p> : null}
            {exportError ? <p className="status-message status-message--error">{exportError}</p> : null}

            {sortedState.derivedStats.unmatchedItems.length === 0 ? (
              <p className="empty-state">No unmatched items in the latest snapshot.</p>
            ) : (
              <ul className="data-list">
                {sortedState.derivedStats.unmatchedItems.map((item) => (
                  <li key={item.canonicalKey}>
                    <div>
                      <strong>{item.itemName}</strong>
                      <p className="subtle-text">Canonical key: {item.canonicalKey}</p>
                    </div>
                    <strong>{item.currentMastery.toLocaleString()}</strong>
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
