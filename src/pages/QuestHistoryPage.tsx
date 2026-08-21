import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import { loadAcquisitionPlannerInputState, type AcquisitionPlannerInputState } from '../lib/acquisitionPlannerState';
import {
  loadCraftingModifierState,
  type UserCraftingModifierState,
} from '../lib/craftingModifierState';
import {
  loadDropRateAcquisitionSettings,
  type DropRateAcquisitionSettings,
} from '../lib/dropRateAcquisitionSettings';
import {
  deriveQuestGameAreaNeeds,
  deriveQuestMealNeeds,
  type QuestGameAreaNeeds,
  type QuestMealNeeds,
} from '../lib/gameAreaNeedsPlanning';
import { getItemIcon } from '../lib/itemIconManifest';
import { loadDropRateReference, type DropRateReferenceData } from '../lib/loadDropRateReference';
import { loadMasteryDifficulty, type MasteryDifficultyData } from '../lib/loadMasteryDifficulty';
import { loadPetSourceReference, type PetSourceReferenceData } from '../lib/loadPetSourceReference';
import { loadQuestReference, type QuestReferenceData } from '../lib/loadQuestReference';
import { loadRecipeGraph, type RecipeGraph } from '../lib/loadRecipeGraph';
import {
  parseCompletedRequestsPaste,
  type CompletedRequestsPasteParseResult,
} from '../lib/parseCompletedRequestsPaste';
import { deriveQuestHistoryAnalytics } from '../lib/questHistoryAnalytics';
import {
  deriveQuestHistoryPlanningAnalytics,
  getQuestFutureDemandScopeLabel,
  type QuestFutureDemandRow,
  type QuestHistoryPlanningAnalytics,
  type QuestlineHeatmapRow,
  type QuestlineProgressSummary,
} from '../lib/questHistoryPlanning';
import {
  addQuestHistoryImport,
  createQuestHistoryImport,
  loadQuestHistoryState,
  saveQuestHistoryState,
  type QuestHistoryState,
} from '../lib/questHistoryState';
import { loadQuestPlannerState, type QuestPlannerState } from '../lib/questPlannerState';
import {
  DEFAULT_SCARY_PREP_DAYS_THRESHOLD,
  deriveQuestSourceAllocationScenario,
  deriveQuestSourceBurdenAnalytics,
  type QuestSourceBurdenAnalytics,
  type QuestSourceBurdenRow,
} from '../lib/questSourceBurden';
import { loadSourceRateAssumptionsState, type SourceRateAssumptionsState } from '../lib/sourceRateAssumptions';

type QuestHistoryResourceState = {
  isLoading: boolean;
  error: string | null;
  referenceData: QuestReferenceData | null;
  dropRateReference: DropRateReferenceData | null;
  dropRateSettings: DropRateAcquisitionSettings;
  sourceRateState: SourceRateAssumptionsState;
  acquisitionState: AcquisitionPlannerInputState;
  craftingModifierState: UserCraftingModifierState;
  petSourceReference: PetSourceReferenceData | null;
  recipeGraph: RecipeGraph | null;
  masteryDifficulty: MasteryDifficultyData | null;
  historyState: QuestHistoryState;
  questPlannerState: QuestPlannerState | null;
};

const EMPTY_HISTORY_STATE: QuestHistoryState = {
  schemaVersion: 1,
  imports: [],
};

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatPreciseNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  if (value >= 100 || Number.isInteger(value)) {
    return Math.round(value).toLocaleString();
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function formatDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: value < 10 ? 1 : 0,
  })} days`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }

  return `${value.toFixed(value < 10 ? 2 : 1)}%`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatQuestlineStatus(status: QuestlineProgressSummary['status']): string {
  switch (status) {
    case 'completed':
      return 'Complete';
    case 'in_progress':
      return 'In progress';
    case 'not_started':
      return 'Not started';
  }
}

function QuestHistoryImportSummary({ preview }: { preview: CompletedRequestsPasteParseResult }) {
  return (
    <div className="page-stack">
      <dl className="compact-stat-grid">
        <div>
          <dt>Completed rows</dt>
          <dd>{preview.summary.completedRowsCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Reported completed</dt>
          <dd>{preview.summary.reportedCompletedCount?.toLocaleString() ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>Active rows found</dt>
          <dd>{preview.summary.activeRowsCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{preview.summary.warningCount.toLocaleString()}</dd>
        </div>
      </dl>
      {preview.warnings.length > 0 ? (
        <ul className="quest-warning-list">
          {preview.warnings.slice(0, 8).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function QuestHistoryDashboard({
  historyState,
  planning,
}: {
  historyState: QuestHistoryState;
  planning: QuestHistoryPlanningAnalytics;
}) {
  const questHistoryAnalytics = deriveQuestHistoryAnalytics(historyState);
  const latestImport = questHistoryAnalytics.latestImport;
  const rarestCompletedQuest = questHistoryAnalytics.rarestCompletedQuests[0] ?? null;
  const fastestMover = questHistoryAnalytics.fastestMovingQuests[0] ?? null;

  return (
    <section className="page-card page-stack" aria-labelledby="quest-history-dashboard-title">
      <h2 id="quest-history-dashboard-title">Quest History Dashboard</h2>
      <dl className="summary-grid">
        <div className="summary-grid__item">
          <dt>Saved imports</dt>
          <dd>{historyState.imports.length.toLocaleString()}</dd>
          <p className="subtle-text">Latest: {formatDate(latestImport?.importedAt ?? null)}</p>
        </div>
        <div className="summary-grid__item">
          <dt>Completed quests</dt>
          <dd>{latestImport?.completedRequests.length.toLocaleString() ?? '0'}</dd>
          <p className="subtle-text">From the latest completed-request import.</p>
        </div>
        <div className="summary-grid__item">
          <dt>Rarest completed</dt>
          <dd>{rarestCompletedQuest?.questName ?? 'n/a'}</dd>
          <p className="subtle-text">{formatPercent(rarestCompletedQuest?.completionPercent ?? null)} completion</p>
        </div>
        <div className="summary-grid__item">
          <dt>Questlines left</dt>
          <dd>{planning.partialQuestlines.length + planning.unstartedQuestlines.length}</dd>
          <p className="subtle-text">
            {planning.partialQuestlines.length.toLocaleString()} started,{' '}
            {planning.unstartedQuestlines.length.toLocaleString()} not started.
          </p>
        </div>
        <div className="summary-grid__item">
          <dt>Fastest mover</dt>
          <dd>{fastestMover?.questName ?? 'n/a'}</dd>
          <p className="subtle-text">
            {fastestMover?.playerCountDelta !== null && fastestMover?.playerCountDelta !== undefined
              ? `+${fastestMover.playerCountDelta.toLocaleString()} players since last import`
              : 'Needs two imports.'}
          </p>
        </div>
        <div className="summary-grid__item">
          <dt>Known future item demand</dt>
          <dd>{planning.futureDemandRows.length.toLocaleString()}</dd>
          <p className="subtle-text">Distinct items in unfinished reviewed quest requirements.</p>
        </div>
      </dl>
      {planning.warnings.length > 0 ? (
        <ul className="quest-warning-list">
          {planning.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function getSeverityLabel(row: QuestSourceBurdenRow): string {
  switch (row.severity) {
    case 'scary':
      return 'Scary';
    case 'watch':
      return 'Watch';
    case 'ok':
      return 'Covered';
    case 'unknown':
      return 'Unknown';
  }
}

function QuestScaryWatch({
  burden,
  thresholdDays,
  onThresholdDaysChange,
}: {
  burden: QuestSourceBurdenAnalytics;
  thresholdDays: number;
  onThresholdDaysChange: (value: number) => void;
}) {
  const visibleRows = burden.scaryRows.slice(0, 12);

  return (
    <section className="page-card page-stack" aria-labelledby="quest-scary-watch-title">
      <div className="section-heading-row">
        <div>
          <h2 id="quest-scary-watch-title">Scary Future Prep</h2>
          <p className="supporting-text">
            Future quest items ranked by counted supply, reviewed source burden, and saved daily source rates.
          </p>
        </div>
        <label className="inline-control" htmlFor="quest-scary-threshold-days">
          <span>Scary after</span>
          <input
            id="quest-scary-threshold-days"
            className="number-input number-input--compact"
            type="number"
            min="1"
            value={thresholdDays}
            onChange={(event) => onThresholdDaysChange(Number(event.target.value))}
          />
          <span>days</span>
        </label>
      </div>
      {burden.warnings.length > 0 ? (
        <ul className="quest-warning-list">
          {burden.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {visibleRows.length > 0 ? (
        <ul className="data-list">
          {visibleRows.map((row) => {
            const icon = getItemIcon(row.canonicalKey);
            const bestOption = row.bestOption;

            return (
              <li key={row.canonicalKey}>
                <div className="quest-burden-row">
                  <div className="quest-burden-row__main">
                    <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} iconSrc={icon?.src ?? null} />
                    <span className={`history-reason-badge history-reason-badge--${row.severity}`}>
                      {getSeverityLabel(row)}
                    </span>
                  </div>
                  <dl className="compact-stat-grid compact-stat-grid--dense">
                    <div>
                      <dt>Remaining</dt>
                      <dd>{formatNumber(row.remainingQuantity)}</dd>
                    </div>
                    <div>
                      <dt>Counted supply</dt>
                      <dd>{formatNumber(row.availableQuantity)}</dd>
                    </div>
                    <div>
                      <dt>Best estimate</dt>
                      <dd>{formatDays(row.prepDays)}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{bestOption ? bestOption.sourceName : 'n/a'}</dd>
                    </div>
                  </dl>
                  {bestOption ? (
                    <p className="subtle-text">
                      {bestOption.sourceUnitQuantity !== null
                        ? `${formatPreciseNumber(bestOption.sourceUnitQuantity)} ${bestOption.unitLabel}${
                          bestOption.dailyRate ? ` at ${formatPreciseNumber(bestOption.dailyRate)}/day` : ''
                        }.`
                        : `${bestOption.sourceName} is known, but exact source units are not reviewed yet.`}
                    </p>
                  ) : null}
                  <p className="subtle-text">{row.reasons.join('; ')}.</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state">No future quest item has crossed the current scary-prep threshold.</p>
      )}
    </section>
  );
}

function QuestAllocationScenario({
  burden,
}: {
  burden: QuestSourceBurdenAnalytics;
}) {
  const candidates = useMemo(
    () =>
      burden.scaryRows
        .filter((row) => row.bestOption?.sourceUnitQuantity !== null && row.bestOption?.dailyRate !== null)
        .slice(0, 8),
    [burden.scaryRows],
  );
  const [waitDays, setWaitDays] = useState(7);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const scenario = useMemo(() => {
    return deriveQuestSourceAllocationScenario(burden, {
      waitDays,
      allocations: candidates.map((row) => ({
        canonicalKey: row.canonicalKey,
        allocationPercent: allocations[row.canonicalKey] ?? 0,
      })),
    });
  }, [allocations, burden, candidates, waitDays]);

  function handleEvenSplit(): void {
    if (candidates.length === 0) {
      return;
    }

    const split = Math.floor((100 / candidates.length) * 10) / 10;
    setAllocations(
      Object.fromEntries(candidates.map((row) => [row.canonicalKey, split])),
    );
  }

  return (
    <section className="page-card page-stack" aria-labelledby="quest-allocation-title">
      <div className="section-heading-row">
        <div>
          <h2 id="quest-allocation-title">Source Allocation What-if</h2>
          <p className="supporting-text">
            Split saved daily source budgets across scary items and see what remains after a chosen wait.
          </p>
        </div>
        <div className="button-row">
          <label className="inline-control" htmlFor="quest-allocation-wait-days">
            <span>Wait</span>
            <input
              id="quest-allocation-wait-days"
              className="number-input number-input--compact"
              type="number"
              min="0"
              value={waitDays}
              onChange={(event) => setWaitDays(Number(event.target.value))}
            />
            <span>days</span>
          </label>
          <button type="button" className="button" onClick={handleEvenSplit} disabled={candidates.length === 0}>
            Even split
          </button>
        </div>
      </div>
      {candidates.length > 0 ? (
        <div className="table-scroll">
          <table className="summary-table quest-history-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Allocation</th>
                <th>Daily source</th>
                <th>After wait</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((row) => {
                const scenarioRow = scenario.rows.find((entry) => entry.canonicalKey === row.canonicalKey);

                return (
                  <tr key={row.canonicalKey}>
                    <td>
                      <ItemProfileLink
                        canonicalKey={row.canonicalKey}
                        itemName={row.itemName}
                        iconSrc={getItemIcon(row.canonicalKey)?.src ?? null}
                      />
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`quest-allocation-${row.canonicalKey}`}>
                        {row.itemName} allocation percent
                      </label>
                      <input
                        id={`quest-allocation-${row.canonicalKey}`}
                        className="number-input number-input--compact"
                        type="number"
                        min="0"
                        max="100"
                        value={allocations[row.canonicalKey] ?? 0}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          setAllocations((current) => ({
                            ...current,
                            [row.canonicalKey]: Number.isFinite(nextValue) ? nextValue : 0,
                          }));
                        }}
                      />
                      <span className="subtle-text">%</span>
                    </td>
                    <td>
                      {scenarioRow
                        ? `${formatPreciseNumber(scenarioRow.dailySourceUnits)} ${scenarioRow.unitLabel}/day`
                        : 'n/a'}
                    </td>
                    <td>
                      {scenarioRow
                        ? `${formatPreciseNumber(scenarioRow.projectedItemQuantity)} gained; ${formatNumber(
                          scenarioRow.remainingAfterWait,
                        )} left`
                        : 'n/a'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">
          Save daily source rates and reviewed source units before allocation scenarios can be modeled.
        </p>
      )}
      {scenario.warnings.length > 0 ? (
        <ul className="quest-warning-list">
          {scenario.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatKnownQuantity(value: number | null): string {
  return value === null ? 'Unknown' : formatNumber(value);
}

function QuestNamesDisclosure({ questNames }: { questNames: string[] }) {
  return (
    <details>
      <summary>{questNames.length.toLocaleString()} quest{questNames.length === 1 ? '' : 's'}</summary>
      <ul className="quest-warning-list">
        {questNames.map((questName) => (
          <li key={questName}>{questName}</li>
        ))}
      </ul>
    </details>
  );
}

function QuestGameAreaNeedsSection({ needs }: { needs: QuestGameAreaNeeds }) {
  const detailedGroups = needs.groups.filter((group) => group.area !== 'meals' && group.rows.length > 0);

  return (
    <section className="page-card page-stack" aria-labelledby="quest-game-area-needs-title">
      <div>
        <h2 id="quest-game-area-needs-title">Outstanding Quest Needs by Game Area</h2>
        <p className="supporting-text">
          Known unfinished requirements grouped by reviewed recipe, mastery-method, source, and pet evidence.
        </p>
      </div>

      <div className="summary-grid">
        {needs.groups.map((group) => (
          <div className="summary-grid__item" key={group.area}>
            <h3 className="section-title">{group.label}</h3>
            <p>
              <strong>{group.rows.length.toLocaleString()}</strong> item type{group.rows.length === 1 ? '' : 's'}
            </p>
            <p className="subtle-text">{formatNumber(group.totalRequiredQuantity)} total quest items</p>
          </div>
        ))}
      </div>

      {detailedGroups.map((group) => {
        const showStoredPets = group.area === 'pet_reliant';

        return (
          <details className="tower-range-card" key={group.area}>
            <summary className="tower-range-summary">
              <span className="tower-range-summary__text">
                <strong>{group.label}</strong>
                <span className="subtle-text">
                  {group.rows.length.toLocaleString()} item type{group.rows.length === 1 ? '' : 's'}
                </span>
              </span>
              <strong>{formatNumber(group.totalRequiredQuantity)} required</strong>
            </summary>
            <div className="table-scroll">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Required</th>
                    <th scope="col">Inventory</th>
                    {showStoredPets ? <th scope="col">Stored pets</th> : null}
                    <th scope="col">Still needed</th>
                    <th scope="col">Quests</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={`${group.area}-${row.canonicalKey}`}>
                      <td>
                        <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} />
                      </td>
                      <td>{formatNumber(row.requiredQuantity)}</td>
                      <td>{formatKnownQuantity(row.currentInventoryQuantity)}</td>
                      {showStoredPets ? <td>{formatKnownQuantity(row.storedPetQuantity)}</td> : null}
                      <td>{formatKnownQuantity(row.missingQuantity)}</td>
                      <td>
                        <QuestNamesDisclosure questNames={row.questNames} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}

      {needs.warnings.length > 0 ? (
        <div>
          <ul className="quest-warning-list">
            {needs.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          {!needs.hasCurrentInventory ? <Link to="/import-inventory">Import current inventory</Link> : null}
          {!needs.hasStoredPetInventory && needs.groups.some((group) => group.area === 'pet_reliant' && group.rows.length > 0) ? (
            <p>
              <Link to="/import-pet-items">Import stored pet inventory</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function getIngredientPlanningStatus(reason: QuestMealNeeds['ingredientRows'][number]['unresolvedReason']): string {
  switch (reason) {
    case 'leaf_item':
      return 'Direct source';
    case 'cooking_recipe_not_expanded':
      return 'Cooking input';
    case 'excluded_recipe':
      return 'Recipe excluded';
    case 'auto_supplied':
      return 'Auto-supplied';
    case 'no_remaining_quantity':
      return 'Covered';
    case null:
      return 'Craft inputs expanded';
  }
}

function QuestMealNeedsSection({ needs }: { needs: QuestMealNeeds }) {
  return (
    <section className="page-card page-stack" aria-labelledby="quest-meal-needs-title">
      <div>
        <h2 id="quest-meal-needs-title">Meals for Unfinished Quests</h2>
        <p className="supporting-text">
          Direct meal requests use current inventory first. Ingredient planning covers only the meals still missing.
        </p>
      </div>

      <dl className="compact-stat-grid">
        <div>
          <dt>Meal types</dt>
          <dd>{needs.rows.length.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Required</dt>
          <dd>{formatNumber(needs.totalRequiredQuantity)}</dd>
        </div>
        <div>
          <dt>Inventory used</dt>
          <dd>{formatKnownQuantity(needs.totalInventoryUsedQuantity)}</dd>
        </div>
        <div>
          <dt>Still needed</dt>
          <dd>{formatKnownQuantity(needs.totalMissingQuantity)}</dd>
        </div>
      </dl>

      {needs.rows.length > 0 ? (
        <div className="table-scroll">
          <table className="summary-table">
            <thead>
              <tr>
                <th scope="col">Meal</th>
                <th scope="col">Required</th>
                <th scope="col">Inventory</th>
                <th scope="col">Still needed</th>
                <th scope="col">Quests</th>
              </tr>
            </thead>
            <tbody>
              {needs.rows.map((row) => (
                <tr key={row.canonicalKey}>
                  <td>
                    <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} />
                  </td>
                  <td>{formatNumber(row.requiredQuantity)}</td>
                  <td>{formatKnownQuantity(row.currentInventoryQuantity)}</td>
                  <td>{formatKnownQuantity(row.missingQuantity)}</td>
                  <td>
                    <QuestNamesDisclosure questNames={row.questNames} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">No reviewed cooking outputs are required by known unfinished quests.</p>
      )}

      {needs.hasCurrentInventory && needs.ingredientRows.length > 0 ? (
        <details className="tower-range-card">
          <summary className="tower-range-summary">
            <span className="tower-range-summary__text">
              <strong>Ingredients for missing meals</strong>
              <span className="subtle-text">Current inventory is spent once across the combined plan.</span>
            </span>
            <strong>{needs.ingredientRows.length.toLocaleString()} ingredient rows</strong>
          </summary>
          <div className="table-scroll">
            <table className="summary-table">
              <thead>
                <tr>
                  <th scope="col">Ingredient</th>
                  <th scope="col">Gross need</th>
                  <th scope="col">Inventory used</th>
                  <th scope="col">Still needed</th>
                  <th scope="col">Craft operations</th>
                  <th scope="col">Driven by</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {needs.ingredientRows.map((row) => (
                  <tr key={row.canonicalKey}>
                    <td>
                      <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} />
                      {row.isDirectMealInput ? <p className="subtle-text">Direct meal input</p> : null}
                    </td>
                    <td>{formatNumber(row.grossRequiredQuantity)}</td>
                    <td>{formatNumber(row.inventoryUsedQuantity)}</td>
                    <td>{formatNumber(row.missingQuantity)}</td>
                    <td>{formatNumber(row.requiredCraftOperations)}</td>
                    <td>{row.mealNames.join(', ')}</td>
                    <td>{getIngredientPlanningStatus(row.unresolvedReason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {needs.warnings.length > 0 ? (
        <div>
          <ul className="quest-warning-list">
            {needs.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          {!needs.hasCurrentInventory ? <Link to="/import-inventory">Import current inventory</Link> : null}
        </div>
      ) : null}
    </section>
  );
}

function FutureDemandRow({ row }: { row: QuestFutureDemandRow }) {
  const icon = getItemIcon(row.canonicalKey);

  return (
    <li>
      <div className="quest-demand-row">
        <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} iconSrc={icon?.src ?? null} />
        <span>
          <strong>{formatNumber(row.totalQuantity)}</strong>
          <span className="subtle-text"> across {row.questCount.toLocaleString()} unfinished quest(s)</span>
        </span>
        <span className="history-reason-list">
          {row.scopes.map((scope) => (
            <span key={scope.scope} className="history-reason-badge">
              {getQuestFutureDemandScopeLabel(scope.scope)}
            </span>
          ))}
        </span>
      </div>
    </li>
  );
}

function QuestFutureDemandList({ rows }: { rows: QuestFutureDemandRow[] }) {
  const visibleRows = rows.slice(0, 20);

  return (
    <section className="page-card page-stack" aria-labelledby="quest-future-demand-title">
      <div>
        <h2 id="quest-future-demand-title">Future Item Demand</h2>
        <p className="supporting-text">
          Unfinished reviewed quest requirements, subtracting completed quest history and manual Quest Planner completions.
        </p>
      </div>
      {visibleRows.length > 0 ? (
        <ul className="data-list data-list--clickable">
          {visibleRows.map((row) => (
            <FutureDemandRow key={row.canonicalKey} row={row} />
          ))}
        </ul>
      ) : (
        <p className="empty-state">No unfinished item demand can be derived from current quest history yet.</p>
      )}
    </section>
  );
}

function QuestlineProgressList({ rows }: { rows: QuestlineProgressSummary[] }) {
  const visibleRows = rows.slice(0, 40);

  return (
    <section className="page-card page-stack" aria-labelledby="questline-progress-title">
      <div>
        <h2 id="questline-progress-title">Questline Progress</h2>
        <p className="supporting-text">Completed history plus manual active/watched/completed Quest Planner state.</p>
      </div>
      <div className="table-scroll">
        <table className="summary-table quest-history-table">
          <thead>
            <tr>
              <th>Questline</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Next known quest</th>
              <th>Top demand</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.questlineKey}>
                <td>
                  <strong>{row.questlineName}</strong>
                  {row.aliases.length > 0 ? <span className="subtle-text"> {row.aliases.join(', ')}</span> : null}
                </td>
                <td>{formatQuestlineStatus(row.status)}</td>
                <td>
                  <div className="quest-history-progress-cell">
                    <span>{formatPercent(row.completionPercent)}</span>
                    <span className="quest-history-progress-track" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, row.completionPercent)}%` }} />
                    </span>
                    <span className="subtle-text">
                      {row.completedQuests.toLocaleString()} / {row.totalQuests.toLocaleString()}
                    </span>
                  </div>
                </td>
                <td>{row.nextQuest?.questName ?? 'n/a'}</td>
                <td>
                  {row.topFutureDemandRows.length > 0
                    ? row.topFutureDemandRows.map((demandRow) => demandRow.itemName).join(', ')
                    : 'n/a'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuestlineHeatmap({ rows }: { rows: QuestlineHeatmapRow[] }) {
  const [searchText, setSearchText] = useState('');
  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleRows = rows
    .filter((row) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        row.questlineName.toLowerCase().includes(normalizedSearch) ||
        (row.nextQuestName?.toLowerCase().includes(normalizedSearch) ?? false) ||
        row.topDemandItems.some((item) => item.itemName.toLowerCase().includes(normalizedSearch))
      );
    })
    .slice(0, 60);

  return (
    <section className="page-card page-stack" aria-labelledby="questline-heatmap-title">
      <div>
        <h2 id="questline-heatmap-title">Questline Heatmap</h2>
        <p className="supporting-text">A scan-friendly view of chain progress, next known quests, rarity, and big item blockers.</p>
      </div>
      <label className="field-label" htmlFor="questline-heatmap-search">
        Search heatmap
      </label>
      <input
        id="questline-heatmap-search"
        className="text-input"
        type="search"
        value={searchText}
        placeholder="DI, PSA, Lima Bean, Frost Snapper Shell..."
        onChange={(event) => setSearchText(event.target.value)}
      />
      <div className="questline-heatmap-grid">
        {visibleRows.map((row) => (
          <article key={row.questlineKey} className={`questline-heatmap-card questline-heatmap-card--${row.status}`}>
            <div>
              <h3>{row.questlineName}</h3>
              <p className="subtle-text">
                {row.completedQuests.toLocaleString()} / {row.totalQuests.toLocaleString()} complete
              </p>
            </div>
            <div className="quest-history-progress-track" aria-label={`${row.questlineName} progress`}>
              <span style={{ width: `${Math.min(100, row.completionPercent)}%` }} />
            </div>
            <dl className="compact-stat-grid">
              <div>
                <dt>Next</dt>
                <dd>{row.nextQuestName ?? 'n/a'}</dd>
              </div>
              <div>
                <dt>Rarest completed</dt>
                <dd>
                  {row.rarestCompletedQuestName
                    ? `${row.rarestCompletedQuestName} (${formatPercent(row.rarestCompletedPercent)})`
                    : 'n/a'}
                </dd>
              </div>
            </dl>
            {row.topDemandItems.length > 0 ? (
              <ul className="quest-inline-list">
                {row.topDemandItems.map((item) => (
                  <li key={item.canonicalKey}>
                    <ItemProfileLink
                      canonicalKey={item.canonicalKey}
                      itemName={`${item.itemName} (${formatNumber(item.totalQuantity)})`}
                      iconSrc={getItemIcon(item.canonicalKey)?.src ?? null}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ImportHistoryList({ state }: { state: QuestHistoryState }) {
  return (
    <section className="page-card page-stack" aria-labelledby="quest-import-history-title">
      <h2 id="quest-import-history-title">Saved Imports</h2>
      {state.imports.length > 0 ? (
        <ul className="data-list">
          {state.imports.slice(0, 10).map((questImport) => (
            <li key={questImport.importId}>
              <div className="recipe-link-row">
                <strong>{formatDate(questImport.importedAt)}</strong>
                <span>
                  {questImport.completedRequests.length.toLocaleString()} completed rows;{' '}
                  {questImport.activeRequests.length.toLocaleString()} active rows;{' '}
                  {questImport.warnings.length.toLocaleString()} warning(s)
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No completed-request imports have been saved yet.</p>
      )}
    </section>
  );
}

export function QuestHistoryPage() {
  const [resourcesState, setResourcesState] = useState<QuestHistoryResourceState>({
    isLoading: true,
    error: null,
    referenceData: null,
    dropRateReference: null,
    dropRateSettings: loadDropRateAcquisitionSettings(),
    sourceRateState: loadSourceRateAssumptionsState(),
    acquisitionState: loadAcquisitionPlannerInputState(),
    craftingModifierState: loadCraftingModifierState(),
    petSourceReference: null,
    recipeGraph: null,
    masteryDifficulty: null,
    historyState: EMPTY_HISTORY_STATE,
    questPlannerState: null,
  });
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<CompletedRequestsPasteParseResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [scaryThresholdDays, setScaryThresholdDays] = useState(DEFAULT_SCARY_PREP_DAYS_THRESHOLD);

  useEffect(() => {
    let isMounted = true;

    async function loadResources(): Promise<void> {
      try {
        const [referenceData, dropRateReference, petSourceReference, recipeGraph, masteryDifficulty] = await Promise.all([
          loadQuestReference(),
          loadDropRateReference().catch(() => null),
          loadPetSourceReference().catch(() => null),
          loadRecipeGraph().catch(() => null),
          loadMasteryDifficulty().catch(() => null),
        ]);
        const historyState = loadQuestHistoryState();
        const questPlannerState = loadQuestPlannerState();
        const dropRateSettings = loadDropRateAcquisitionSettings();
        const sourceRateState = loadSourceRateAssumptionsState();
        const acquisitionState = loadAcquisitionPlannerInputState();
        const craftingModifierState = loadCraftingModifierState();

        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: null,
          referenceData,
          dropRateReference,
          dropRateSettings,
          sourceRateState,
          acquisitionState,
          craftingModifierState,
          petSourceReference,
          recipeGraph,
          masteryDifficulty,
          historyState,
          questPlannerState,
        });
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load quest history resources.',
          referenceData: null,
          dropRateReference: null,
          dropRateSettings: loadDropRateAcquisitionSettings(),
          sourceRateState: loadSourceRateAssumptionsState(),
          acquisitionState: loadAcquisitionPlannerInputState(),
          craftingModifierState: loadCraftingModifierState(),
          petSourceReference: null,
          recipeGraph: null,
          masteryDifficulty: null,
          historyState: EMPTY_HISTORY_STATE,
          questPlannerState: null,
        });
      }
    }

    void loadResources();

    return () => {
      isMounted = false;
    };
  }, []);

  const planning = useMemo(() => {
    if (!resourcesState.referenceData) {
      return null;
    }

    return deriveQuestHistoryPlanningAnalytics({
      state: resourcesState.historyState,
      questPlannerState: resourcesState.questPlannerState,
      referenceData: resourcesState.referenceData,
    });
  }, [resourcesState.historyState, resourcesState.questPlannerState, resourcesState.referenceData]);
  const sourceBurden = useMemo(() => {
    if (!planning) {
      return null;
    }

    return deriveQuestSourceBurdenAnalytics({
      demandRows: planning.futureDemandRows,
      sourceRateState: resourcesState.sourceRateState,
      scaryThresholdDays,
      acquisitionState: resourcesState.acquisitionState,
      petSourceReference: resourcesState.petSourceReference,
      dropRateReference: resourcesState.dropRateReference,
      dropRateSettings: resourcesState.dropRateSettings,
    });
  }, [
    planning,
    resourcesState.acquisitionState,
    resourcesState.dropRateReference,
    resourcesState.dropRateSettings,
    resourcesState.petSourceReference,
    resourcesState.sourceRateState,
    scaryThresholdDays,
  ]);
  const gameAreaNeeds = useMemo(() => {
    if (!planning || !resourcesState.referenceData) {
      return null;
    }

    return deriveQuestGameAreaNeeds({
      demandRows: planning.futureDemandRows,
      acquisitionState: resourcesState.acquisitionState,
      classificationSources: {
        recipeGraph: resourcesState.recipeGraph,
        dropRateReference: resourcesState.dropRateReference,
        petSourceReference: resourcesState.petSourceReference,
        masteryDifficulty: resourcesState.masteryDifficulty,
        sourceHintsByCanonicalKey: resourcesState.referenceData.sourceHintsByCanonicalKey,
      },
    });
  }, [
    planning,
    resourcesState.acquisitionState,
    resourcesState.dropRateReference,
    resourcesState.masteryDifficulty,
    resourcesState.petSourceReference,
    resourcesState.recipeGraph,
    resourcesState.referenceData,
  ]);
  const mealNeeds = useMemo(() => {
    if (!planning || !resourcesState.recipeGraph) {
      return null;
    }

    return deriveQuestMealNeeds({
      demandRows: planning.futureDemandRows,
      acquisitionState: resourcesState.acquisitionState,
      recipeGraph: resourcesState.recipeGraph,
      modifierState: resourcesState.craftingModifierState,
      isQuestHistoryPersonalized: resourcesState.historyState.imports.length > 0,
    });
  }, [
    planning,
    resourcesState.acquisitionState,
    resourcesState.craftingModifierState,
    resourcesState.historyState.imports.length,
    resourcesState.recipeGraph,
  ]);

  function handlePreview(): void {
    const nextPreview = parseCompletedRequestsPaste(pasteText);
    setPreview(nextPreview);
    setSaveMessage(null);
  }

  function handleSaveImport(): void {
    const questImport = createQuestHistoryImport({ rawText: pasteText });
    const nextState = saveQuestHistoryState(addQuestHistoryImport(resourcesState.historyState, questImport));

    setResourcesState((currentState) => ({
      ...currentState,
      historyState: nextState,
    }));
    setPreview({
      completedRequests: questImport.completedRequests,
      activeRequests: questImport.activeRequests,
      summary: questImport.summary,
      warnings: questImport.warnings,
    });
    setSaveMessage(`Saved ${questImport.completedRequests.length.toLocaleString()} completed quest rows.`);
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Quest History"
        description="Import completed requests, review rarity and community movement, and connect unfinished quest demand back to item pages."
        storageKey="quest-history"
      />

      {resourcesState.isLoading ? <p className="empty-state">Loading quest history resources...</p> : null}

      {!resourcesState.isLoading && resourcesState.error ? (
        <p className="status-message status-message--error">{resourcesState.error}</p>
      ) : null}

      {!resourcesState.isLoading && resourcesState.referenceData && planning ? (
        <>
          <section className="page-card page-stack" aria-labelledby="quest-history-import-title">
            <div>
              <h2 id="quest-history-import-title">Import Completed Requests</h2>
              <p className="supporting-text">
                Paste the noisy FarmRPG Completed Requests page. The parser keeps completed quest rows and ignores page chrome.
              </p>
            </div>
            <textarea
              className="text-area quest-paste-input"
              value={pasteText}
              placeholder="Paste Completed Requests here..."
              onChange={(event) => setPasteText(event.target.value)}
            />
            <div className="button-row">
              <button type="button" className="button" onClick={handlePreview} disabled={!pasteText.trim()}>
                Preview
              </button>
              <button type="button" className="button button--primary" onClick={handleSaveImport} disabled={!pasteText.trim()}>
                Save import
              </button>
            </div>
            {saveMessage ? <p className="status-message">{saveMessage}</p> : null}
            {preview ? <QuestHistoryImportSummary preview={preview} /> : null}
          </section>

          <QuestHistoryDashboard historyState={resourcesState.historyState} planning={planning} />
          {gameAreaNeeds ? <QuestGameAreaNeedsSection needs={gameAreaNeeds} /> : null}
          {mealNeeds ? <QuestMealNeedsSection needs={mealNeeds} /> : null}
          {sourceBurden ? (
            <>
              <QuestScaryWatch
                burden={sourceBurden}
                thresholdDays={scaryThresholdDays}
                onThresholdDaysChange={setScaryThresholdDays}
              />
              <QuestAllocationScenario burden={sourceBurden} />
            </>
          ) : null}
          <QuestFutureDemandList rows={planning.futureDemandRows} />
          <QuestlineProgressList rows={planning.questlineSummaries} />
          <QuestlineHeatmap rows={planning.heatmapRows} />
          <ImportHistoryList state={resourcesState.historyState} />
        </>
      ) : null}
    </div>
  );
}
