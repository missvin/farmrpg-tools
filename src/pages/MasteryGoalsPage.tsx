import { useEffect, useMemo, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { derivePersonalMasteryGoalPlanning } from '../lib/derivePersonalMasteryGoalPlanning';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import {
  buildMasteryRaceCountLookup,
  loadMasteryRaceCountsState,
  removeMasteryRaceCount,
  saveMasteryRaceCountsState,
  upsertMasteryRaceCount,
} from '../lib/masteryRaceCounts';
import {
  loadPersonalMasteryGoalsState,
  removePersonalMasteryGoal,
  savePersonalMasteryGoalsState,
  upsertPersonalMasteryGoal,
  type PersonalMasteryGoalsState,
} from '../lib/personalMasteryGoals';
import type { MasteryTargetTier, PumpkinJuiceEstimateStatus } from '../lib/pumpkinJuiceEstimator';
import {
  createDefaultPumpkinJuicePlannerState,
  loadPumpkinJuicePlannerState,
  savePumpkinJuicePlannerState,
} from '../lib/pumpkinJuicePlannerState';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';

type ItemOption = {
  canonicalKey: string;
  itemName: string;
};

type GoalTierFilter = 'all' | MasteryTargetTier;
type GoalStatusFilter = 'all' | PumpkinJuiceEstimateStatus;
type GoalSortMode = 'fewest_pj' | 'most_pj' | 'item_name' | 'remaining_mastery' | 'race_count';

function formatPjCount(value: number | null): string {
  return value === null ? 'Needs baseline mastery' : value.toLocaleString();
}

function getStatusLabel(status: PumpkinJuiceEstimateStatus): string {
  if (status === 'complete') {
    return 'Complete';
  }

  if (status === 'needs_baseline') {
    return 'Needs baseline mastery';
  }

  return 'Calculable';
}

function buildItemOptions(snapshot: MasterySnapshot | null, referenceOptions: ItemOption[]): ItemOption[] {
  const byCanonicalKey = new Map<string, ItemOption>();

  for (const option of referenceOptions) {
    byCanonicalKey.set(option.canonicalKey, option);
  }

  for (const row of snapshot?.parsedRows ?? []) {
    byCanonicalKey.set(row.canonicalKey, {
      canonicalKey: row.canonicalKey,
      itemName: row.rawItemName,
    });
  }

  for (const canonicalKey of Object.keys(snapshot?.masteryByItem ?? {})) {
    if (!byCanonicalKey.has(canonicalKey)) {
      byCanonicalKey.set(canonicalKey, {
        canonicalKey,
        itemName: canonicalKey,
      });
    }
  }

  return [...byCanonicalKey.values()].sort((left, right) => {
    return left.itemName.localeCompare(right.itemName) || left.canonicalKey.localeCompare(right.canonicalKey);
  });
}

function matchesStatusFilter(rowStatus: PumpkinJuiceEstimateStatus, filter: GoalStatusFilter): boolean {
  return filter === 'all' || rowStatus === filter;
}

function compareNullablePjCount(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function loadGoalStateSafely(): PersonalMasteryGoalsState {
  try {
    return loadPersonalMasteryGoalsState();
  } catch {
    return {
      schemaVersion: 1,
      goals: [],
    };
  }
}

export function MasteryGoalsPage() {
  const [goalsState, setGoalsState] = useState(loadGoalStateSafely);
  const [raceCountsState, setRaceCountsState] = useState(() => {
    try {
      return loadMasteryRaceCountsState();
    } catch {
      return {
        schemaVersion: 1 as const,
        entries: [],
      };
    }
  });
  const [pumpkinJuicePlannerState, setPumpkinJuicePlannerState] = useState(() => {
    try {
      return loadPumpkinJuicePlannerState();
    } catch {
      return createDefaultPumpkinJuicePlannerState();
    }
  });
  const [resourcesState, setResourcesState] = useState<{
    isLoading: boolean;
    snapshot: MasterySnapshot | null;
    referenceOptions: ItemOption[];
    error: string | null;
  }>({
    isLoading: true,
    snapshot: null,
    referenceOptions: [],
    error: null,
  });
  const [goalItemName, setGoalItemName] = useState('');
  const [goalTargetTier, setGoalTargetTier] = useState<MasteryTargetTier>('MM');
  const [raceCountItemName, setRaceCountItemName] = useState('');
  const [masteredCountInput, setMasteredCountInput] = useState('');
  const [grandMasteredCountInput, setGrandMasteredCountInput] = useState('');
  const [megaMasteredCountInput, setMegaMasteredCountInput] = useState('');
  const [ownedPumpkinJuiceInput, setOwnedPumpkinJuiceInput] = useState(
    String(pumpkinJuicePlannerState.ownedPumpkinJuiceCount),
  );
  const [goalMessage, setGoalMessage] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [raceCountMessage, setRaceCountMessage] = useState<string | null>(null);
  const [raceCountError, setRaceCountError] = useState<string | null>(null);
  const [pumpkinJuiceMessage, setPumpkinJuiceMessage] = useState<string | null>(null);
  const [pumpkinJuiceError, setPumpkinJuiceError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<GoalTierFilter>('all');
  const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>('all');
  const [sortMode, setSortMode] = useState<GoalSortMode>('fewest_pj');

  useEffect(() => {
    let isMounted = true;

    void Promise.all([getLatestSnapshot(), loadMasteryDifficulty()])
      .then(([snapshot, masteryDifficultyData]) => {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          snapshot,
          referenceOptions: masteryDifficultyData.entries.map((entry) => ({
            canonicalKey: entry.canonicalKey,
            itemName: entry.itemName,
          })),
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          snapshot: null,
          referenceOptions: [],
          error: error instanceof Error ? error.message : 'Unable to load local mastery goal inputs.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const itemOptions = useMemo(
    () => buildItemOptions(resourcesState.snapshot, resourcesState.referenceOptions),
    [resourcesState.referenceOptions, resourcesState.snapshot],
  );
  const raceCountByCanonicalKey = useMemo(
    () => buildMasteryRaceCountLookup(raceCountsState),
    [raceCountsState],
  );
  const goalRows = useMemo(
    () => derivePersonalMasteryGoalPlanning(goalsState.goals, resourcesState.snapshot, raceCountByCanonicalKey),
    [goalsState.goals, raceCountByCanonicalKey, resourcesState.snapshot],
  );
  const visibleGoalRows = useMemo(() => {
    return goalRows
      .filter((row) => tierFilter === 'all' || row.targetTier === tierFilter)
      .filter((row) => matchesStatusFilter(row.pumpkinJuiceEstimate.status, statusFilter))
      .sort((left, right) => {
        if (sortMode === 'item_name') {
          return left.itemName.localeCompare(right.itemName);
        }

        if (sortMode === 'remaining_mastery') {
          return right.remainingMastery - left.remainingMastery || left.itemName.localeCompare(right.itemName);
        }

        if (sortMode === 'race_count') {
          const raceCountComparison = compareNullablePjCount(left.targetTierPublicCount, right.targetTierPublicCount);

          if (raceCountComparison !== 0) {
            return raceCountComparison;
          }

          return left.itemName.localeCompare(right.itemName);
        }

        const pjComparison = compareNullablePjCount(
          left.pumpkinJuiceEstimate.totalPumpkinJuices,
          right.pumpkinJuiceEstimate.totalPumpkinJuices,
        );

        if (pjComparison !== 0) {
          return sortMode === 'most_pj' ? pjComparison * -1 : pjComparison;
        }

        return left.itemName.localeCompare(right.itemName);
      });
  }, [goalRows, sortMode, statusFilter, tierFilter]);
  const calculablePjTotal = goalRows.reduce((total, row) => {
    return total + (row.pumpkinJuiceEstimate.totalPumpkinJuices ?? 0);
  }, 0);
  const blockedGoalCount = goalRows.filter((row) => row.pumpkinJuiceEstimate.status === 'needs_baseline').length;
  const completeGoalCount = goalRows.filter((row) => row.pumpkinJuiceEstimate.status === 'complete').length;

  function parseOptionalCount(value: string): number | null {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const numericValue = Number(trimmedValue);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return null;
    }

    return Math.floor(numericValue);
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

  function handleSaveGoal(): void {
    if (goalItemName.trim().length === 0) {
      setGoalMessage(null);
      setGoalError('Enter an item name to save a mastery goal.');
      return;
    }

    try {
      const savedState = savePersonalMasteryGoalsState(
        upsertPersonalMasteryGoal(goalsState, {
          itemName: goalItemName,
          targetTier: goalTargetTier,
        }),
      );

      setGoalsState(savedState);
      setGoalError(null);
      setGoalMessage(`Saved ${goalItemName.trim()} ${goalTargetTier} goal.`);
      setGoalItemName('');
      setGoalTargetTier('MM');
    } catch (error) {
      setGoalMessage(null);
      setGoalError(error instanceof Error ? error.message : 'Unable to save mastery goal.');
    }
  }

  function handleUpdateGoalTarget(goalId: string, itemName: string, targetTier: MasteryTargetTier): void {
    const savedState = savePersonalMasteryGoalsState(
      upsertPersonalMasteryGoal(goalsState, {
        goalId,
        itemName,
        targetTier,
      }),
    );

    setGoalsState(savedState);
    setGoalError(null);
    setGoalMessage(`Updated ${itemName} target to ${targetTier}.`);
  }

  function handleRemoveGoal(goalId: string): void {
    const savedState = savePersonalMasteryGoalsState(removePersonalMasteryGoal(goalsState, goalId));

    setGoalsState(savedState);
    setGoalError(null);
    setGoalMessage('Removed saved mastery goal.');
  }

  function handleSaveRaceCount(): void {
    if (raceCountItemName.trim().length === 0) {
      setRaceCountMessage(null);
      setRaceCountError('Enter an item name to save public mastery counts.');
      return;
    }

    try {
      const savedState = saveMasteryRaceCountsState(
        upsertMasteryRaceCount(raceCountsState, {
          itemName: raceCountItemName,
          masteredCount: parseOptionalCount(masteredCountInput),
          grandMasteredCount: parseOptionalCount(grandMasteredCountInput),
          megaMasteredCount: parseOptionalCount(megaMasteredCountInput),
        }),
      );

      setRaceCountsState(savedState);
      setRaceCountError(null);
      setRaceCountMessage(`Saved public mastery counts for ${raceCountItemName.trim()}.`);
      setRaceCountItemName('');
      setMasteredCountInput('');
      setGrandMasteredCountInput('');
      setMegaMasteredCountInput('');
    } catch (error) {
      setRaceCountMessage(null);
      setRaceCountError(error instanceof Error ? error.message : 'Unable to save public mastery counts.');
    }
  }

  function handleRemoveRaceCount(canonicalKey: string): void {
    const savedState = saveMasteryRaceCountsState(removeMasteryRaceCount(raceCountsState, canonicalKey));

    setRaceCountsState(savedState);
    setRaceCountError(null);
    setRaceCountMessage('Removed public mastery counts.');
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Mastery Goals"
        description="Save personal item goals and estimate how many Pumpkin Juices would get each one to M, GM, or MM from your latest snapshot."
        storageKey="mastery-goals"
      />

      {resourcesState.error ? (
        <p className="status-message status-message--error">{resourcesState.error}</p>
      ) : null}

      <section className="page-card page-stack" aria-labelledby="personal-goals-summary-title">
        <div>
          <h2 id="personal-goals-summary-title">Goal Summary</h2>
          <p className="supporting-text">
            Estimates use your latest saved mastery snapshot. Pumpkin Juice adds 10% of current mastery each use,
            rounded to the nearest whole number.
          </p>
        </div>

        <dl className="summary-grid">
          <div className="summary-grid__item">
            <dt>Saved goals</dt>
            <dd>{goalRows.length.toLocaleString()}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Complete</dt>
            <dd>{completeGoalCount.toLocaleString()}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Pumpkin Juice needed</dt>
            <dd>{calculablePjTotal.toLocaleString()}</dd>
            {blockedGoalCount > 0 ? (
              <p className="subtle-text">
                {blockedGoalCount.toLocaleString()} goal{blockedGoalCount === 1 ? '' : 's'} need baseline mastery first
              </p>
            ) : null}
          </div>
          <div className="summary-grid__item">
            <dt>Owned Pumpkin Juice</dt>
            <dd>{pumpkinJuicePlannerState.ownedPumpkinJuiceCount.toLocaleString()}</dd>
            <p className="subtle-text">
              {pumpkinJuicePlannerState.ownedPumpkinJuiceCount >= calculablePjTotal
                ? `${(pumpkinJuicePlannerState.ownedPumpkinJuiceCount - calculablePjTotal).toLocaleString()} extra after calculable goals`
                : `${(calculablePjTotal - pumpkinJuicePlannerState.ownedPumpkinJuiceCount).toLocaleString()} short for calculable goals`}
            </p>
          </div>
        </dl>

        <div className="inline-control-row" aria-label="Pumpkin Juice planner assumptions">
          <label className="field-label" htmlFor="goals-owned-pumpkin-juice">
            Owned Pumpkin Juice
          </label>
          <input
            id="goals-owned-pumpkin-juice"
            className="text-input text-input--short"
            type="number"
            min="0"
            step="1"
            value={ownedPumpkinJuiceInput}
            onChange={(event) => {
              setOwnedPumpkinJuiceInput(event.target.value);
            }}
          />
          <button type="button" className="button" onClick={handleSaveOwnedPumpkinJuiceCount}>
            Save
          </button>
        </div>
        {pumpkinJuiceMessage ? <p className="status-message status-message--success">{pumpkinJuiceMessage}</p> : null}
        {pumpkinJuiceError ? <p className="status-message status-message--error">{pumpkinJuiceError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="personal-goals-form-title">
        <div>
          <h2 id="personal-goals-form-title">Save a Goal</h2>
          <p className="supporting-text">
            Use any item name. Known items from your latest import and local reference data are suggested when available.
          </p>
        </div>

        <div className="filter-grid">
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="personal-goal-item">
              Item
            </label>
            <input
              id="personal-goal-item"
              className="text-input"
              type="text"
              list="personal-goal-item-options"
              value={goalItemName}
              onChange={(event) => {
                setGoalItemName(event.target.value);
              }}
              placeholder="Gold Cucumber"
            />
            <datalist id="personal-goal-item-options">
              {itemOptions.map((option) => (
                <option key={option.canonicalKey} value={option.itemName} />
              ))}
            </datalist>
          </div>

          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="personal-goal-target">
              Target
            </label>
            <select
              id="personal-goal-target"
              className="text-input"
              value={goalTargetTier}
              onChange={(event) => {
                setGoalTargetTier(event.target.value as MasteryTargetTier);
              }}
            >
              <option value="M">M</option>
              <option value="GM">GM</option>
              <option value="MM">MM</option>
            </select>
          </div>
        </div>

        <div className="button-row">
          <button type="button" className="button button--primary" onClick={handleSaveGoal}>
            Save Goal
          </button>
        </div>

        {goalMessage ? <p className="status-message status-message--success">{goalMessage}</p> : null}
        {goalError ? <p className="status-message status-message--error">{goalError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="personal-goals-list-title">
        <div>
          <h2 id="personal-goals-list-title">Saved Goals</h2>
        </div>

        <div className="filter-grid">
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="personal-goal-tier-filter">
              Target tier
            </label>
            <select
              id="personal-goal-tier-filter"
              className="text-input"
              value={tierFilter}
              onChange={(event) => {
                setTierFilter(event.target.value as GoalTierFilter);
              }}
            >
              <option value="all">All</option>
              <option value="M">M</option>
              <option value="GM">GM</option>
              <option value="MM">MM</option>
            </select>
          </div>

          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="personal-goal-status-filter">
              Status
            </label>
            <select
              id="personal-goal-status-filter"
              className="text-input"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as GoalStatusFilter);
              }}
            >
              <option value="all">All</option>
              <option value="calculable">Calculable</option>
              <option value="needs_baseline">Needs baseline mastery</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="personal-goal-sort">
              Sort
            </label>
            <select
              id="personal-goal-sort"
              className="text-input"
              value={sortMode}
              onChange={(event) => {
                setSortMode(event.target.value as GoalSortMode);
              }}
            >
              <option value="fewest_pj">Fewest PJs</option>
              <option value="most_pj">Most PJs</option>
              <option value="remaining_mastery">Most mastery remaining</option>
              <option value="race_count">Fewest public completions</option>
              <option value="item_name">Item name</option>
            </select>
          </div>
        </div>

        {resourcesState.isLoading ? <p className="empty-state">Loading local mastery goals...</p> : null}

        {!resourcesState.isLoading && visibleGoalRows.length === 0 ? (
          <p className="empty-state">
            {goalRows.length === 0 ? 'No personal mastery goals saved yet.' : 'No saved goals match these filters.'}
          </p>
        ) : null}

        {visibleGoalRows.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Target</th>
                  <th scope="col">Current mastery</th>
                  <th scope="col">Remaining</th>
                  <th scope="col">PJs</th>
                  <th scope="col">Next PJ</th>
                  <th scope="col">Public count</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleGoalRows.map((row) => (
                  <tr key={row.goalId}>
                    <td>
                      <strong>{row.itemName}</strong>
                      {!row.matchedSnapshotRow ? (
                        <p className="subtle-text">Not in your latest import; counted from 0 mastery.</p>
                      ) : null}
                    </td>
                    <td>
                      <select
                        className="text-input"
                        aria-label={`Target for ${row.itemName}`}
                        value={row.targetTier}
                        onChange={(event) => {
                          handleUpdateGoalTarget(row.goalId, row.itemName, event.target.value as MasteryTargetTier);
                        }}
                      >
                        <option value="M">M</option>
                        <option value="GM">GM</option>
                        <option value="MM">MM</option>
                      </select>
                    </td>
                    <td>{row.currentMastery.toLocaleString()}</td>
                    <td>{row.remainingMastery.toLocaleString()}</td>
                    <td>{formatPjCount(row.pumpkinJuiceEstimate.totalPumpkinJuices)}</td>
                    <td>
                      {row.pumpkinJuiceEstimate.nextPumpkinJuiceGain === null
                        ? '-'
                        : `+${row.pumpkinJuiceEstimate.nextPumpkinJuiceGain.toLocaleString()}`}
                    </td>
                    <td>{row.targetTierPublicCount === null ? '-' : row.targetTierPublicCount.toLocaleString()}</td>
                    <td>{getStatusLabel(row.pumpkinJuiceEstimate.status)}</td>
                    <td>
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          handleRemoveGoal(row.goalId);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="race-count-context-title">
        <div>
          <h2 id="race-count-context-title">Race Count Context</h2>
          <p className="supporting-text">
            Optional local notes for public M, GM, and MM counts. These do not affect Pumpkin Juice math.
          </p>
        </div>

        <div className="filter-grid">
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="race-count-item">
              Item
            </label>
            <input
              id="race-count-item"
              className="text-input"
              type="text"
              list="personal-goal-item-options"
              value={raceCountItemName}
              onChange={(event) => {
                setRaceCountItemName(event.target.value);
              }}
              placeholder="Gold Cucumber"
            />
          </div>
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="race-count-m">
              Public M count
            </label>
            <input
              id="race-count-m"
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={masteredCountInput}
              onChange={(event) => {
                setMasteredCountInput(event.target.value);
              }}
            />
          </div>
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="race-count-gm">
              Public GM count
            </label>
            <input
              id="race-count-gm"
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={grandMasteredCountInput}
              onChange={(event) => {
                setGrandMasteredCountInput(event.target.value);
              }}
            />
          </div>
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="race-count-mm">
              Public MM count
            </label>
            <input
              id="race-count-mm"
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={megaMasteredCountInput}
              onChange={(event) => {
                setMegaMasteredCountInput(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="button-row">
          <button type="button" className="button button--primary" onClick={handleSaveRaceCount}>
            Save Race Counts
          </button>
        </div>

        {raceCountMessage ? <p className="status-message status-message--success">{raceCountMessage}</p> : null}
        {raceCountError ? <p className="status-message status-message--error">{raceCountError}</p> : null}

        {raceCountsState.entries.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">M</th>
                  <th scope="col">GM</th>
                  <th scope="col">MM</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {raceCountsState.entries.map((entry) => (
                  <tr key={entry.canonicalKey}>
                    <td>{entry.itemName}</td>
                    <td>{entry.masteredCount === null ? '-' : entry.masteredCount.toLocaleString()}</td>
                    <td>{entry.grandMasteredCount === null ? '-' : entry.grandMasteredCount.toLocaleString()}</td>
                    <td>{entry.megaMasteredCount === null ? '-' : entry.megaMasteredCount.toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          handleRemoveRaceCount(entry.canonicalKey);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="supporting-text">No race-count context saved yet.</p>
        )}
      </section>
    </div>
  );
}
