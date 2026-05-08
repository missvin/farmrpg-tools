import { useEffect, useMemo, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  createDefaultCraftingModifierState,
  loadCraftingModifierState,
  saveCraftingModifierState,
  type UserCraftingModifierState,
} from '../lib/craftingModifierState';
import { loadRecipeGraph, type RecipeGraph } from '../lib/loadRecipeGraph';
import {
  calculateRecursiveIngredientBurden,
  type IngredientBurdenAggregateEntry,
  type IngredientBurdenGoalScope,
} from '../lib/recursiveIngredientBurden';
import { loadTowerRequirements, type TowerRequirementsData } from '../lib/loadTowerRequirements';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';

type IngredientDemandListRow = {
  canonicalKey: string;
  itemName: string;
  isCraftable: boolean;
  selectedScopeRequiredEffectiveOutput: number;
  selectedScopeRequiredCraftOperations: number;
  totalRequiredEffectiveOutput: number;
  totalRequiredCraftOperations: number;
};

type SortDirection = 'asc' | 'desc';
type IngredientDemandSortField =
  | 'itemName'
  | 'selectedScopeRequiredEffectiveOutput'
  | 'selectedScopeRequiredCraftOperations'
  | 'totalRequiredEffectiveOutput';

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatScopeLabel(scope: IngredientBurdenGoalScope): string {
  return scope === 'Tower' ? 'Tower' : scope;
}

function normalizePercentInput(value: string): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return numericValue / 100;
}

function buildIngredientDemandRows(
  burdenByCanonicalKey: Record<string, IngredientBurdenAggregateEntry>,
  selectedScope: IngredientBurdenGoalScope,
  hideZeroDemand: boolean,
  sortField: IngredientDemandSortField,
  sortDirection: SortDirection,
): IngredientDemandListRow[] {
  return Object.values(burdenByCanonicalKey)
    .map((entry) => {
      const selectedScopeValues = entry.byScope[selectedScope];

      return {
        canonicalKey: entry.canonicalKey,
        itemName: entry.itemName,
        isCraftable: entry.isCraftable,
        selectedScopeRequiredEffectiveOutput: selectedScopeValues?.requiredEffectiveOutput ?? 0,
        selectedScopeRequiredCraftOperations: selectedScopeValues?.requiredCraftOperations ?? 0,
        totalRequiredEffectiveOutput: entry.totalRequiredEffectiveOutput,
        totalRequiredCraftOperations: entry.totalRequiredCraftOperations,
      };
    })
    .filter((entry) => !hideZeroDemand || entry.selectedScopeRequiredEffectiveOutput > 0)
    .sort((left, right) => {
      let comparison = 0;

      if (sortField === 'itemName') {
        comparison = left.itemName.localeCompare(right.itemName);
      } else {
        comparison = left[sortField] - right[sortField];
      }

      if (comparison !== 0) {
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return left.itemName.localeCompare(right.itemName);
    });
}

export function IngredientDemandListPage() {
  const [resourcesState, setResourcesState] = useState<{
    isLoading: boolean;
    snapshotError: string | null;
    recipeError: string | null;
    towerError: string | null;
    modifierWarning: string | null;
    snapshot: MasterySnapshot | null;
    recipeGraph: RecipeGraph | null;
    towerRequirementsData: TowerRequirementsData | null;
  }>({
    isLoading: true,
    snapshotError: null,
    recipeError: null,
    towerError: null,
    modifierWarning: null,
    snapshot: null,
    recipeGraph: null,
    towerRequirementsData: null,
  });
  const [modifierState, setModifierState] = useState<UserCraftingModifierState>(() => {
    try {
      return loadCraftingModifierState();
    } catch {
      return createDefaultCraftingModifierState();
    }
  });
  const [selectedScope, setSelectedScope] = useState<IngredientBurdenGoalScope>('M');
  const [sortField, setSortField] = useState<IngredientDemandSortField>('selectedScopeRequiredEffectiveOutput');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [hideZeroDemand, setHideZeroDemand] = useState(true);
  const [towerCutoffInput, setTowerCutoffInput] = useState('');

  function updateModifierState(
    updater: (current: UserCraftingModifierState) => UserCraftingModifierState,
  ): void {
    setModifierState((current) => saveCraftingModifierState(updater(current)));
  }

  useEffect(() => {
    let isMounted = true;
    let loadedModifierState: UserCraftingModifierState;
    let modifierWarning: string | null = null;

    try {
      loadedModifierState = loadCraftingModifierState();
    } catch (error: unknown) {
      modifierWarning =
        error instanceof Error ? error.message : 'Unable to load saved crafting modifier assumptions.';
      loadedModifierState = createDefaultCraftingModifierState();
    }

    setModifierState(loadedModifierState);

    void getLatestSnapshot()
      .then(async (snapshot) => {
        if (!isMounted) {
          return;
        }

        if (!snapshot) {
          setResourcesState({
            isLoading: false,
            snapshotError: null,
            recipeError: null,
            towerError: null,
            modifierWarning,
            snapshot: null,
            recipeGraph: null,
            towerRequirementsData: null,
          });
          return;
        }

        try {
          const [recipeGraph, towerRequirementsData] = await Promise.all([
            loadRecipeGraph(),
            loadTowerRequirements(),
          ]);

          if (!isMounted) {
            return;
          }

          setResourcesState({
            isLoading: false,
            snapshotError: null,
            recipeError: null,
            towerError: null,
            modifierWarning,
            snapshot,
            recipeGraph,
            towerRequirementsData,
          });
        } catch (error: unknown) {
          if (!isMounted) {
            return;
          }

          const message =
            error instanceof Error ? error.message : 'Unable to load planning inputs for ingredient demand.';

          setResourcesState({
            isLoading: false,
            snapshotError: null,
            recipeError: message.includes('recipe') ? message : null,
            towerError: message.includes('tower') ? message : null,
            modifierWarning,
            snapshot,
            recipeGraph: null,
            towerRequirementsData: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          snapshotError: error instanceof Error ? error.message : 'Unable to load local snapshots.',
          recipeError: null,
          towerError: null,
          modifierWarning,
          snapshot: null,
          recipeGraph: null,
          towerRequirementsData: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const towerCutoff = useMemo(() => {
    const trimmedValue = towerCutoffInput.trim();

    if (!trimmedValue) {
      return null;
    }

    const numericValue = Number(trimmedValue);
    return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
  }, [towerCutoffInput]);

  const burdenResult = useMemo(() => {
    if (!resourcesState.snapshot || !resourcesState.recipeGraph || !resourcesState.towerRequirementsData) {
      return null;
    }

    return calculateRecursiveIngredientBurden({
      snapshot: resourcesState.snapshot,
      recipeGraph: resourcesState.recipeGraph,
      modifierState,
      towerRequirementsData: resourcesState.towerRequirementsData,
      towerTarget: {
        maxTowerLevel: towerCutoff,
      },
    });
  }, [
    modifierState,
    resourcesState.recipeGraph,
    resourcesState.snapshot,
    resourcesState.towerRequirementsData,
    towerCutoff,
  ]);

  const rows = useMemo(
    () =>
      buildIngredientDemandRows(
        burdenResult?.ingredientBurdenByCanonicalKey ?? {},
        selectedScope,
        hideZeroDemand,
        sortField,
        sortDirection,
      ),
    [burdenResult, hideZeroDemand, selectedScope, sortDirection, sortField],
  );

  const totalVisibleScopeBurden = useMemo(
    () => rows.reduce((total, row) => total + row.selectedScopeRequiredEffectiveOutput, 0),
    [rows],
  );

  const totalNonZeroScopeIngredients = useMemo(
    () =>
      Object.values(burdenResult?.ingredientBurdenByCanonicalKey ?? {}).filter(
        (entry) => (entry.byScope[selectedScope]?.requiredEffectiveOutput ?? 0) > 0,
      ).length,
    [burdenResult, selectedScope],
  );

  function handleSort(field: IngredientDemandSortField): void {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection(field === 'itemName' ? 'asc' : 'desc');
  }

  function getSortIndicator(field: IngredientDemandSortField): string {
    if (sortField !== field) {
      return '';
    }

    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Ingredient Demand List"
        description="Browse ingredients by recursive remaining burden for one goal scope at a time, using the shared recipe and planner assumptions."
        storageKey="ingredient-demand-list"
      />

      <section className="page-card page-stack" aria-labelledby="ingredient-demand-list-controls-title">
        <div>
          <h2 id="ingredient-demand-list-controls-title">List Controls</h2>
          <p className="supporting-text">
            Pick a goal scope, adjust the temporary planning assumptions, and sort the ingredient list without
            introducing any page-specific planning math.
          </p>
        </div>

        {resourcesState.isLoading ? (
          <p className="empty-state">Loading local snapshot, recipe graph, and tower data...</p>
        ) : null}

        {!resourcesState.isLoading && resourcesState.snapshotError ? (
          <p className="status-message status-message--error">{resourcesState.snapshotError}</p>
        ) : null}

        {!resourcesState.isLoading && !resourcesState.snapshotError && !resourcesState.snapshot ? (
          <p className="empty-state">Import a mastery export first to use ingredient demand planning.</p>
        ) : null}

        {!resourcesState.isLoading && resourcesState.recipeError ? (
          <p className="status-message status-message--error">{resourcesState.recipeError}</p>
        ) : null}

        {!resourcesState.isLoading && resourcesState.towerError ? (
          <p className="status-message status-message--error">{resourcesState.towerError}</p>
        ) : null}

        {resourcesState.modifierWarning ? (
          <p className="status-message">{resourcesState.modifierWarning}</p>
        ) : null}

        {!resourcesState.isLoading && resourcesState.snapshot && burdenResult ? (
          <>
            <div className="summary-grid">
              <div className="page-stack page-stack--tight">
                <span className="field-label">Permanent Resource Saver</span>
                <label className="checkbox-field" htmlFor="ingredient-demand-list-resource-saver-1">
                  <input
                    id="ingredient-demand-list-resource-saver-1"
                    type="checkbox"
                    checked={modifierState.persistent.resourceSaver1Unlocked}
                    onChange={(event) =>
                      updateModifierState((current) => ({
                        ...current,
                        persistent: {
                          ...current.persistent,
                          resourceSaver1Unlocked: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Resource Saver I</span>
                </label>
                <label className="checkbox-field" htmlFor="ingredient-demand-list-resource-saver-2">
                  <input
                    id="ingredient-demand-list-resource-saver-2"
                    type="checkbox"
                    checked={modifierState.persistent.resourceSaver2Unlocked}
                    onChange={(event) =>
                      updateModifierState((current) => ({
                        ...current,
                        persistent: {
                          ...current.persistent,
                          resourceSaver2Unlocked: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Resource Saver II</span>
                </label>
                <label className="checkbox-field" htmlFor="ingredient-demand-list-resource-saver-3">
                  <input
                    id="ingredient-demand-list-resource-saver-3"
                    type="checkbox"
                    checked={modifierState.persistent.resourceSaver3Unlocked}
                    onChange={(event) =>
                      updateModifierState((current) => ({
                        ...current,
                        persistent: {
                          ...current.persistent,
                          resourceSaver3Unlocked: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Resource Saver III</span>
                </label>
              </div>

              <div className="page-stack page-stack--tight">
                <span className="field-label">Goal scope</span>
                <div className="button-row" role="radiogroup" aria-label="Goal scope">
                  {(['M', 'GM', 'MM', 'Tower'] as IngredientBurdenGoalScope[]).map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      role="radio"
                      aria-checked={selectedScope === scope}
                      className={`button ${selectedScope === scope ? 'button--active' : ''}`}
                      onClick={() => setSelectedScope(scope)}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="ingredient-demand-list-mushroom-stew">
                  Mushroom Stew active
                </label>
                <label className="toggle-switch" htmlFor="ingredient-demand-list-mushroom-stew">
                  <input
                    id="ingredient-demand-list-mushroom-stew"
                    className="toggle-switch__input"
                    type="checkbox"
                    checked={modifierState.temporary.mushroomStewActive}
                    onChange={(event) =>
                      updateModifierState((current) => ({
                        ...current,
                        temporary: {
                          ...current.temporary,
                          mushroomStewActive: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span className="toggle-switch__track" aria-hidden="true">
                    <span className="toggle-switch__thumb" />
                  </span>
                  <span>{modifierState.temporary.mushroomStewActive ? 'On' : 'Off'}</span>
                </label>
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="ingredient-demand-list-event-mastery">
                  Event mastery bonus %
                </label>
                <input
                  id="ingredient-demand-list-event-mastery"
                  className="text-input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    modifierState.temporary.eventMasteryBonusPercent === 0
                      ? ''
                      : modifierState.temporary.eventMasteryBonusPercent * 100
                  }
                  onChange={(event) =>
                    updateModifierState((current) => ({
                      ...current,
                      temporary: {
                        ...current.temporary,
                        eventMasteryBonusPercent: normalizePercentInput(event.target.value),
                      },
                    }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="ingredient-demand-list-event-saver">
                  Event resource saver %
                </label>
                <input
                  id="ingredient-demand-list-event-saver"
                  className="text-input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    modifierState.temporary.eventResourceSaverBonusPercent === 0
                      ? ''
                      : modifierState.temporary.eventResourceSaverBonusPercent * 100
                  }
                  onChange={(event) =>
                    updateModifierState((current) => ({
                      ...current,
                      temporary: {
                        ...current.temporary,
                        eventResourceSaverBonusPercent: normalizePercentInput(event.target.value),
                      },
                    }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="page-stack page-stack--tight">
                <span className="field-label">Planning assumptions</span>
                <label className="checkbox-field" htmlFor="ingredient-demand-list-iron-depot">
                  <input
                    id="ingredient-demand-list-iron-depot"
                    type="checkbox"
                    checked={modifierState.planning.ironDepotActive}
                    onChange={(event) =>
                      updateModifierState((current) => ({
                        ...current,
                        planning: {
                          ...current.planning,
                          ironDepotActive: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Iron Depot active</span>
                </label>
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="ingredient-demand-list-tower-cutoff">
                  Tower max level
                </label>
                <input
                  id="ingredient-demand-list-tower-cutoff"
                  className="text-input"
                  type="number"
                  min="1"
                  step="1"
                  value={towerCutoffInput}
                  onChange={(event) => setTowerCutoffInput(event.target.value)}
                  placeholder="All tower levels"
                />
              </div>
            </div>

            <label className="checkbox-field" htmlFor="ingredient-demand-list-hide-zero">
              <input
                id="ingredient-demand-list-hide-zero"
                type="checkbox"
                checked={hideZeroDemand}
                onChange={(event) => setHideZeroDemand(event.target.checked)}
              />
              <span>Hide zero-demand ingredients</span>
            </label>

            <p className="subtle-text">
              List values come from the shared recursive burden engine. Permanent saver perks, temporary mastery
              bonuses, and Iron Depot all flow through the shared planning model, and dominated craft recipes stay
              excluded by default unless planner policy changes later.
            </p>
          </>
        ) : null}
      </section>

      {!resourcesState.isLoading && resourcesState.snapshot && burdenResult ? (
        <section className="page-card page-stack" aria-labelledby="ingredient-demand-list-results-title">
          <div>
            <h2 id="ingredient-demand-list-results-title">Ingredient Burden List</h2>
            <p className="supporting-text">
              This list is scoped to {formatScopeLabel(selectedScope)} and keeps recursive burden separate from raw
              direct recipe use. Terminal ingredients are highlighted in the final column and indicate ingredients
              that are not craftable locally.
            </p>
          </div>

          <dl className="summary-grid">
            <div className="summary-grid__item">
              <dt>Scope</dt>
              <dd>{formatScopeLabel(selectedScope)}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Visible ingredients</dt>
              <dd>{rows.length.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Scope ingredients with burden</dt>
              <dd>{totalNonZeroScopeIngredients.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Visible scope burden</dt>
              <dd>{formatAmount(totalVisibleScopeBurden)}</dd>
            </div>
          </dl>

          {rows.length === 0 ? (
            <p className="empty-state">No ingredients have burden under the current scope and filter settings.</p>
          ) : (
            <div className="table-scroll">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <button
                        type="button"
                        className="table-sort-button"
                        onClick={() => handleSort('itemName')}
                        aria-label={`Sort by ingredient${sortField === 'itemName' ? ` ${sortDirection}` : ''}`}
                      >
                        Ingredient{getSortIndicator('itemName')}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="table-sort-button"
                        onClick={() => handleSort('selectedScopeRequiredEffectiveOutput')}
                        aria-label={`Sort by ${formatScopeLabel(selectedScope)} burden${sortField === 'selectedScopeRequiredEffectiveOutput' ? ` ${sortDirection}` : ''}`}
                      >
                        {formatScopeLabel(selectedScope)} burden{getSortIndicator('selectedScopeRequiredEffectiveOutput')}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="table-sort-button"
                        onClick={() => handleSort('selectedScopeRequiredCraftOperations')}
                        aria-label={`Sort by ${formatScopeLabel(selectedScope)} craft ops${sortField === 'selectedScopeRequiredCraftOperations' ? ` ${sortDirection}` : ''}`}
                      >
                        {formatScopeLabel(selectedScope)} craft ops{getSortIndicator('selectedScopeRequiredCraftOperations')}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="table-sort-button"
                        onClick={() => handleSort('totalRequiredEffectiveOutput')}
                        aria-label={`Sort by total burden${sortField === 'totalRequiredEffectiveOutput' ? ` ${sortDirection}` : ''}`}
                      >
                        Total burden{getSortIndicator('totalRequiredEffectiveOutput')}
                      </button>
                    </th>
                    <th scope="col">Craftable</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.canonicalKey}>
                      <td>{row.itemName}</td>
                      <td>{formatAmount(row.selectedScopeRequiredEffectiveOutput)}</td>
                      <td>{formatAmount(row.selectedScopeRequiredCraftOperations)}</td>
                      <td>{formatAmount(row.totalRequiredEffectiveOutput)}</td>
                      <td className={row.isCraftable ? undefined : 'summary-table__cell--terminal'}>
                        {row.isCraftable ? 'Craftable' : 'Terminal'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
