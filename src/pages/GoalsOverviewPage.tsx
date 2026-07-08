import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import { derivePersonalMasteryGoalPlanning } from '../lib/derivePersonalMasteryGoalPlanning';
import {
  buildMasteryRaceCountLookup,
  loadMasteryRaceCountsState,
} from '../lib/masteryRaceCounts';
import { loadPersonalMasteryGoalsState } from '../lib/personalMasteryGoals';
import { loadQuestHistoryState } from '../lib/questHistoryState';
import { getRouteToolMetadata, type RouteToolId } from '../lib/routeMetadata';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';
import { loadTargetOutputPlannerState } from '../lib/targetOutputPlannerState';

type GoalPlanningNextAction = {
  itemName: string;
  canonicalKey: string;
  targetTier: string;
  totalPumpkinJuices: number | null;
  nextItemsSaved: number | null;
};

type GoalPlanningSummary = {
  personalGoalCount: number;
  completeGoalCount: number;
  calculablePumpkinJuiceTotal: number;
  blockedGoalCount: number;
  nextAction: GoalPlanningNextAction | null;
  targetPlannerTargetCount: number;
  error: string | null;
};

type GoalsOverviewState = {
  isLoading: boolean;
  snapshotError: string | null;
  hasSnapshot: boolean | null;
  parsedItemCount: number | null;
  questHistoryImportCount: number | null;
  planningSummary: GoalPlanningSummary;
};

type GoalSource = {
  title: string;
  routeId: RouteToolId;
  status: string;
  description: string;
  reason: string;
  secondaryRouteIds?: RouteToolId[];
  action?: {
    to: string;
    label: string;
  };
};

function routePath(routeId: RouteToolId): string {
  return getRouteToolMetadata(routeId).path;
}

function createEmptyPlanningSummary(error: string | null = null): GoalPlanningSummary {
  return {
    personalGoalCount: 0,
    completeGoalCount: 0,
    calculablePumpkinJuiceTotal: 0,
    blockedGoalCount: 0,
    nextAction: null,
    targetPlannerTargetCount: 0,
    error,
  };
}

function loadGoalPlanningSummary(snapshot: MasterySnapshot | null): GoalPlanningSummary {
  try {
    const personalGoalsState = loadPersonalMasteryGoalsState();
    const raceCountByCanonicalKey = buildMasteryRaceCountLookup(loadMasteryRaceCountsState());
    const targetPlannerState = loadTargetOutputPlannerState();
    const rows = derivePersonalMasteryGoalPlanning(
      personalGoalsState.goals,
      snapshot,
      raceCountByCanonicalKey,
    );
    const incompleteCalculableRows = rows
      .filter((row) => row.pumpkinJuiceEstimate.status === 'calculable')
      .sort((left, right) => {
        const pjComparison = (left.pumpkinJuiceEstimate.totalPumpkinJuices ?? 0) -
          (right.pumpkinJuiceEstimate.totalPumpkinJuices ?? 0);

        return pjComparison || left.itemName.localeCompare(right.itemName);
      });
    const nextRow = incompleteCalculableRows[0] ?? null;

    return {
      personalGoalCount: rows.length,
      completeGoalCount: rows.filter((row) => row.pumpkinJuiceEstimate.status === 'complete').length,
      calculablePumpkinJuiceTotal: rows.reduce((total, row) => {
        return total + (row.pumpkinJuiceEstimate.totalPumpkinJuices ?? 0);
      }, 0),
      blockedGoalCount: rows.filter((row) => row.pumpkinJuiceEstimate.status === 'needs_baseline').length,
      nextAction: nextRow
        ? {
          itemName: nextRow.itemName,
          canonicalKey: nextRow.canonicalKey,
          targetTier: nextRow.targetTier,
          totalPumpkinJuices: nextRow.pumpkinJuiceEstimate.totalPumpkinJuices,
          nextItemsSaved: nextRow.pumpkinJuiceValueEstimate.nextItemsSaved,
        }
        : null,
      targetPlannerTargetCount: targetPlannerState.targets.length,
      error: null,
    };
  } catch (error) {
    return createEmptyPlanningSummary(
      error instanceof Error ? error.message : 'Unable to load saved goal planning state.',
    );
  }
}

function getSnapshotStatus(state: GoalsOverviewState): string {
  if (state.isLoading) {
    return 'Checking';
  }

  if (state.snapshotError) {
    return 'Needs attention';
  }

  return state.hasSnapshot ? 'Ready' : 'Needed';
}

function getSnapshotDescription(state: GoalsOverviewState): string {
  if (state.isLoading) {
    return 'Looking for the latest mastery snapshot saved in this browser.';
  }

  if (state.snapshotError) {
    return 'The local snapshot store could not be read. Restore a backup or import again.';
  }

  if (state.hasSnapshot && state.parsedItemCount !== null) {
    return `${state.parsedItemCount.toLocaleString()} parsed items are available for progress-aware goal views.`;
  }

  return 'Import mastery or restore a backup before Tower and mastery progress views can show local status.';
}

function getQuestHistoryStatus(state: GoalsOverviewState): string {
  if (state.questHistoryImportCount === null) {
    return 'Unavailable';
  }

  return state.questHistoryImportCount > 0 ? 'Ready' : 'Optional';
}

function getQuestHistoryDescription(state: GoalsOverviewState): string {
  if (state.questHistoryImportCount === null) {
    return 'Quest history status could not be checked, but quest planning pages still open.';
  }

  if (state.questHistoryImportCount > 0) {
    return `${state.questHistoryImportCount.toLocaleString()} quest history import${state.questHistoryImportCount === 1 ? '' : 's'} saved in this browser.`;
  }

  return 'Quest goals still open; import completed quest history when you want future-demand context.';
}

function getGoalSources(state: GoalsOverviewState): GoalSource[] {
  const snapshotNeeded = !state.isLoading && !state.hasSnapshot;
  const questHistoryNeeded = state.questHistoryImportCount === 0;

  return [
    {
      title: 'Tower mastery',
      routeId: 'tower',
      status: state.hasSnapshot ? 'Progress-aware' : 'Needs mastery snapshot',
      description: 'Tower is treated as a mastery requirement system from local Tower requirement data.',
      reason: 'Uses the project Tower requirements data and saved mastery progress, not Buddy reward pages.',
      secondaryRouteIds: ['towerProgress'],
      action: snapshotNeeded ? { to: '/import', label: 'Import mastery snapshot' } : undefined,
    },
    {
      title: 'Mastery targets',
      routeId: 'masteryGoals',
      status: state.hasSnapshot ? 'Progress-aware' : 'Needs mastery snapshot',
      description: 'Plan personal mastery targets and acceleration opportunities from local item data.',
      reason: 'Best once a saved mastery snapshot can identify current gaps.',
      secondaryRouteIds: ['sorted'],
      action: snapshotNeeded ? { to: '/import', label: 'Import mastery snapshot' } : undefined,
    },
    {
      title: 'Quest goals',
      routeId: 'questPlanner',
      status: questHistoryNeeded ? 'Import improves this' : 'Ready',
      description: 'Review questline requirements, future demand, and source burden.',
      reason: 'Sharper after completed quest history import; still reachable with partial data.',
      action: questHistoryNeeded ? { to: routePath('questHistory'), label: 'Import quest history' } : undefined,
    },
    {
      title: 'Museum goals',
      routeId: 'museumCompletion',
      status: 'Ready with reference data',
      description: 'Track museum completion gaps from reviewed local museum data.',
      reason: 'Missing or partial reviewed coverage remains non-fatal instead of guessed.',
    },
    {
      title: 'Borgen goals',
      routeId: 'borgenHelper',
      status: 'Ready with item data',
      description: "Plan Borgen's Lost and Found memory items from local item data.",
      reason: 'A goal source that can stay useful without pretending every data source is complete.',
    },
    {
      title: 'Custom targets',
      routeId: 'targetPlanner',
      status: 'Planning workspace',
      description: 'Use target planning when a goal is a chosen output or hoard target instead of a fixed game system.',
      reason: 'Inventory and pet imports improve the shared supply pool, but the planner remains local-only.',
      action: { to: routePath('importInventory'), label: 'Import inventory' },
    },
  ];
}

function getUniqueActionSources(goalSources: GoalSource[]): GoalSource[] {
  const seenActions = new Set<string>();

  return goalSources.filter((source) => {
    if (!source.action) {
      return true;
    }

    const actionKey = `${source.action.to}-${source.action.label}`;
    if (seenActions.has(actionKey)) {
      return false;
    }

    seenActions.add(actionKey);
    return true;
  });
}

export function GoalsOverviewPage() {
  const [state, setState] = useState<GoalsOverviewState>({
    isLoading: true,
    snapshotError: null,
    hasSnapshot: null,
    parsedItemCount: null,
    questHistoryImportCount: null,
    planningSummary: createEmptyPlanningSummary(),
  });

  useEffect(() => {
    let isMounted = true;

    let questHistoryImportCount: number | null = null;
    try {
      questHistoryImportCount = loadQuestHistoryState().imports.length;
    } catch {
      questHistoryImportCount = null;
    }

    void getLatestSnapshot()
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }

        setState({
          isLoading: false,
          snapshotError: null,
          hasSnapshot: snapshot !== null,
          parsedItemCount: snapshot?.parseSummary.itemsParsed ?? null,
          questHistoryImportCount,
          planningSummary: loadGoalPlanningSummary(snapshot),
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setState({
          isLoading: false,
          snapshotError: error instanceof Error ? error.message : 'Unable to load local snapshots.',
          hasSnapshot: null,
          parsedItemCount: null,
          questHistoryImportCount,
          planningSummary: createEmptyPlanningSummary(),
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const goalSources = getGoalSources(state);

  return (
    <div className="page-stack">
      <PageIntro
        title="Goals"
        description="Start from the goal source, then open the current Tower, mastery, quest, museum, Borgen, or custom target workflow that already owns the details."
        storageKey="goals-overview"
      />

      <section className="page-card page-stack" aria-labelledby="goals-data-title">
        <div>
          <h2 id="goals-data-title">Goal Data Status</h2>
          <p className="supporting-text">
            Goal pages stay reachable with partial local data; missing imports change status and suggested actions, not routing.
          </p>
        </div>

        <div className="summary-grid">
          <div className="summary-grid__item">
            <h3 className="section-title">Mastery snapshot</h3>
            <p>
              <strong>{getSnapshotStatus(state)}</strong>
            </p>
            <p className="subtle-text">{getSnapshotDescription(state)}</p>
            {!state.isLoading && !state.hasSnapshot ? (
              <p className="subtle-text">
                <Link to="/import">Import mastery</Link> or{' '}
                <Link to="/settings#settings-restore-title">restore backup</Link>
              </p>
            ) : null}
          </div>

          <div className="summary-grid__item">
            <h3 className="section-title">Quest history</h3>
            <p>
              <strong>{getQuestHistoryStatus(state)}</strong>
            </p>
            <p className="subtle-text">{getQuestHistoryDescription(state)}</p>
            {state.questHistoryImportCount === 0 ? (
              <p className="subtle-text">
                <Link to={routePath('questHistory')}>Import quest history</Link>
              </p>
            ) : null}
          </div>

          <div className="summary-grid__item">
            <h3 className="section-title">Reference data</h3>
            <p>
              <strong>Local</strong>
            </p>
            <p className="subtle-text">
              Tower, museum, item, and Borgen goal entries use checked-in local reference data and keep gaps non-fatal.
            </p>
          </div>
        </div>

        {state.snapshotError ? <p className="status-message status-message--error">{state.snapshotError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="goal-planning-summary-title">
        <div>
          <h2 id="goal-planning-summary-title">Planning Summary</h2>
          <p className="supporting-text">
            Saved goal planning stays attached to the workflow that owns the detail; this view summarizes the local next step.
          </p>
        </div>

        <div className="summary-grid">
          <div className="summary-grid__item">
            <h3 className="section-title">Personal mastery goals</h3>
            <p>
              <strong>{state.planningSummary.personalGoalCount.toLocaleString()}</strong>
            </p>
            <p className="subtle-text">
              {state.planningSummary.completeGoalCount.toLocaleString()} complete, {state.planningSummary.blockedGoalCount.toLocaleString()} waiting on baseline mastery.
            </p>
            <p className="subtle-text">
              <Link to={routePath('masteryGoals')}>Open mastery goals</Link>
            </p>
          </div>

          <div className="summary-grid__item">
            <h3 className="section-title">Pumpkin Juice plan</h3>
            <p>
              <strong>{state.planningSummary.calculablePumpkinJuiceTotal.toLocaleString()}</strong>
            </p>
            <p className="subtle-text">PJs across calculable saved mastery goals.</p>
          </div>

          <div className="summary-grid__item">
            <h3 className="section-title">Custom targets</h3>
            <p>
              <strong>{state.planningSummary.targetPlannerTargetCount.toLocaleString()}</strong>
            </p>
            <p className="subtle-text">
              <Link to={routePath('targetPlanner')}>Open target planner</Link>
            </p>
          </div>

          <div className="summary-grid__item">
            <h3 className="section-title">Next useful action</h3>
            {state.planningSummary.nextAction ? (
              <>
                <p>
                  <strong>
                    <ItemProfileLink
                      canonicalKey={state.planningSummary.nextAction.canonicalKey}
                      itemName={state.planningSummary.nextAction.itemName}
                    />
                  </strong>
                </p>
                <p className="subtle-text">
                  {state.planningSummary.nextAction.targetTier} target, {state.planningSummary.nextAction.totalPumpkinJuices?.toLocaleString() ?? 'unknown'} PJs, next PJ saves {state.planningSummary.nextAction.nextItemsSaved?.toLocaleString() ?? 'unknown'} mastery.
                </p>
              </>
            ) : state.hasSnapshot ? (
              <p className="subtle-text">Save a mastery goal or custom target to make this summary actionable.</p>
            ) : (
              <p className="subtle-text">
                <Link to="/import">Import mastery snapshot</Link>
              </p>
            )}
          </div>
        </div>

        {state.planningSummary.error ? (
          <p className="status-message status-message--error">{state.planningSummary.error}</p>
        ) : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="goal-sources-title">
        <div>
          <h2 id="goal-sources-title">Goal Sources</h2>
          <p className="supporting-text">Open the existing workflow that owns each goal type.</p>
        </div>

        <div className="quick-link-grid">
          {goalSources.map((source) => {
            const metadata = getRouteToolMetadata(source.routeId);

            return (
              <Link className="quick-link-card" to={metadata.path} key={source.title}>
                <span className="quick-link-card__title">{source.title}</span>
                <span className="quick-link-card__description">{source.status}</span>
                <span className="quick-link-card__description">{source.description}</span>
                <span className="quick-link-card__description">Why: {source.reason}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="page-card page-stack" aria-labelledby="goal-actions-title">
        <div>
          <h2 id="goal-actions-title">Useful Goal Actions</h2>
          <p className="supporting-text">Shortcuts for the data or companion views that make goal pages more useful.</p>
        </div>

        <div className="quick-link-grid">
          {getUniqueActionSources(goalSources).flatMap((source) => {
            const relatedRoutes = source.secondaryRouteIds ?? [];
            const relatedLinks = relatedRoutes.map((routeId) => {
              const metadata = getRouteToolMetadata(routeId);

              return (
                <Link className="quick-link-card" to={metadata.path} key={`${source.title}-${routeId}`}>
                  <span className="quick-link-card__title">{metadata.label}</span>
                  <span className="quick-link-card__description">{metadata.description}</span>
                </Link>
              );
            });

            if (!source.action) {
              return relatedLinks;
            }

            return [
              ...relatedLinks,
              <Link className="quick-link-card" to={source.action.to} key={`${source.title}-action`}>
                <span className="quick-link-card__title">{source.action.label}</span>
                <span className="quick-link-card__description">Improves {source.title.toLowerCase()} when local data is available.</span>
              </Link>,
            ];
          })}
        </div>
      </section>
    </div>
  );
}
