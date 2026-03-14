import { useEffect, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { deriveMasteryDifficultyStats } from '../lib/deriveMasteryDifficultyStats';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

type SortedMode = 'gm' | 'mm';

function formatRemainingLabel(mode: SortedMode): string {
  return mode === 'gm'
    ? 'Remaining to Grand Mastery (100,000)'
    : 'Remaining to Mega Mastery (1,000,000)';
}

export function SortedPage() {
  const [mode, setMode] = useState<SortedMode>('gm');
  const [filterText, setFilterText] = useState('');
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
    mode === 'gm' ? sortedState.derivedStats?.gmLeftGroups ?? [] : sortedState.derivedStats?.mmLeftGroups ?? [];
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredGroups = activeGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.itemName.toLowerCase().includes(normalizedFilter)),
    }))
    .filter((group) => group.items.length > 0);

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
                Switch between the latest snapshot items that still need progress toward Grand Mastery or Mega
                Mastery.
              </p>
            </div>

            <div className="button-row">
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
              filteredGroups.map((group) => (
                <div key={group.label} className="page-stack">
                  <h3 className="section-title">
                    {group.label} ({group.items.length.toLocaleString()})
                  </h3>
                  <ul className="progress-list">
                    {group.items.map((item) => (
                      <li key={`${item.canonicalKey}-${mode}`} className="progress-list__item">
                        <div className="progress-list__header">
                          <strong>{item.itemName}</strong>
                          <span>{item.currentMastery.toLocaleString()}</span>
                        </div>
                        <p className="progress-list__meta">
                          <span>{formatRemainingLabel(mode)}: {item.remainingToTarget.toLocaleString()}</span>
                          <span>{item.difficultyLabel}</span>
                        </p>
                        {item.method ? <p className="progress-list__meta">Method: {item.method}</p> : null}
                        {item.notes ? <p className="progress-list__notes">Notes: {item.notes}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          <section className="page-card page-stack" aria-labelledby="unmatched-items-title">
            <div>
              <h2 id="unmatched-items-title">Items Missing From Mastery Difficulty Data</h2>
              <p className="supporting-text">
                These items were parsed from the latest snapshot but do not currently match the local mastery
                difficulty data.
              </p>
            </div>

            <p className="status-message">
              Items missing from mastery difficulty data:{' '}
              {sortedState.derivedStats.unmatchedItemCount.toLocaleString()}
            </p>

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
