import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
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
  type RecursiveIngredientBurdenResult,
} from '../lib/recursiveIngredientBurden';
import { loadTowerRequirements, type TowerRequirementsData } from '../lib/loadTowerRequirements';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';

type ItemOption = {
  canonicalKey: string;
  itemName: string;
};

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatScopeLabel(scope: IngredientBurdenGoalScope): string {
  return scope === 'Tower' ? 'Tower' : scope;
}

function buildItemOptions(burdenByCanonicalKey: Record<string, IngredientBurdenAggregateEntry>): ItemOption[] {
  return Object.values(burdenByCanonicalKey)
    .map((entry) => ({
      canonicalKey: entry.canonicalKey,
      itemName: entry.itemName,
    }))
    .sort((left, right) => left.itemName.localeCompare(right.itemName));
}

function normalizePercentInput(value: string): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return numericValue / 100;
}

function getSelectedBurden(
  burdenResult: RecursiveIngredientBurdenResult | null,
  selectedCanonicalKey: string,
): IngredientBurdenAggregateEntry | null {
  if (!burdenResult || !selectedCanonicalKey) {
    return null;
  }

  return burdenResult.ingredientBurdenByCanonicalKey[selectedCanonicalKey] ?? null;
}

export function IngredientDemandPage() {
  const [searchParams] = useSearchParams();
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
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [selectedCanonicalKey, setSelectedCanonicalKey] = useState('');
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

  const itemOptions = useMemo(
    () => buildItemOptions(burdenResult?.ingredientBurdenByCanonicalKey ?? {}),
    [burdenResult],
  );
  const requestedCanonicalKey = searchParams.get('item')?.trim().toLowerCase() ?? '';

  useEffect(() => {
    if (itemOptions.length === 0) {
      setSelectedCanonicalKey('');
      setIngredientQuery('');
      return;
    }

    setSelectedCanonicalKey((currentSelectedCanonicalKey) => {
      if (requestedCanonicalKey && itemOptions.some((option) => option.canonicalKey === requestedCanonicalKey)) {
        return requestedCanonicalKey;
      }

      if (currentSelectedCanonicalKey && itemOptions.some((option) => option.canonicalKey === currentSelectedCanonicalKey)) {
        return currentSelectedCanonicalKey;
      }

      return itemOptions[0].canonicalKey;
    });

    setIngredientQuery((currentQuery) => {
      if (requestedCanonicalKey) {
        const requestedOption = itemOptions.find((option) => option.canonicalKey === requestedCanonicalKey);

        if (requestedOption) {
          return requestedOption.itemName;
        }
      }

      if (
        currentQuery &&
        itemOptions.some((option) => option.itemName.toLowerCase() === currentQuery.trim().toLowerCase())
      ) {
        return currentQuery;
      }

      return itemOptions[0].itemName;
    });
  }, [itemOptions, requestedCanonicalKey]);

  const selectedBurden = getSelectedBurden(burdenResult, selectedCanonicalKey);

  function handleIngredientQueryChange(value: string): void {
    setIngredientQuery(value);

    const exactMatch = itemOptions.find(
      (option) => option.itemName.toLowerCase() === value.trim().toLowerCase(),
    );

    setSelectedCanonicalKey(exactMatch?.canonicalKey ?? '');
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Ingredient Demand Lookup"
        description="Pick one ingredient to see its recursive demand across mastery and Tower goals under your current local planning assumptions."
        storageKey="ingredient-demand"
      />

      <section className="page-card page-stack" aria-labelledby="ingredient-demand-controls-title">
        <div>
          <h2 id="ingredient-demand-controls-title">Lookup Controls</h2>
          <p className="supporting-text">
            Pick an ingredient, adjust your saved perks and temporary bonuses, then see where that ingredient is still
            needed.
          </p>
        </div>

        {resourcesState.isLoading ? (
          <p className="empty-state">Loading local snapshot, recipe graph, and tower data...</p>
        ) : null}

        {!resourcesState.isLoading && resourcesState.snapshotError ? (
          <p className="status-message status-message--error">{resourcesState.snapshotError}</p>
        ) : null}

        {!resourcesState.isLoading &&
        !resourcesState.snapshotError &&
        !resourcesState.snapshot ? (
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

        {!resourcesState.isLoading &&
        resourcesState.snapshot &&
        burdenResult ? (
          <>
            <div className="page-stack page-stack--tight">
              <label className="field-label" htmlFor="ingredient-demand-search">
                Ingredient
              </label>
              <input
                id="ingredient-demand-search"
                className="text-input"
                list="ingredient-demand-options"
                type="text"
                value={ingredientQuery}
                onChange={(event) => handleIngredientQueryChange(event.target.value)}
                placeholder="Search ingredient name"
              />
              <datalist id="ingredient-demand-options">
                {itemOptions.map((option) => (
                  <option key={option.canonicalKey} value={option.itemName} />
                ))}
              </datalist>
            </div>

            <div className="summary-grid">
              <div className="page-stack page-stack--tight">
                <span className="field-label">Permanent Resource Saver</span>
                <label className="checkbox-field" htmlFor="ingredient-demand-resource-saver-1">
                  <input
                    id="ingredient-demand-resource-saver-1"
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
                <label className="checkbox-field" htmlFor="ingredient-demand-resource-saver-2">
                  <input
                    id="ingredient-demand-resource-saver-2"
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
                <label className="checkbox-field" htmlFor="ingredient-demand-resource-saver-3">
                  <input
                    id="ingredient-demand-resource-saver-3"
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
                <label className="field-label" htmlFor="ingredient-demand-mushroom-stew">
                  Mushroom Stew active
                </label>
                <select
                  id="ingredient-demand-mushroom-stew"
                  className="text-input"
                  value={modifierState.temporary.mushroomStewActive ? 'yes' : 'no'}
                  onChange={(event) =>
                    updateModifierState((current) => ({
                      ...current,
                      temporary: {
                        ...current.temporary,
                        mushroomStewActive: event.target.value === 'yes',
                      },
                    }))
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="ingredient-demand-event-mastery">
                  Event mastery bonus %
                </label>
                <input
                  id="ingredient-demand-event-mastery"
                  className="text-input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={modifierState.temporary.eventMasteryBonusPercent === 0 ? '' : modifierState.temporary.eventMasteryBonusPercent * 100}
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
                <label className="field-label" htmlFor="ingredient-demand-event-saver">
                  Event resource saver %
                </label>
                <input
                  id="ingredient-demand-event-saver"
                  className="text-input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={modifierState.temporary.eventResourceSaverBonusPercent === 0 ? '' : modifierState.temporary.eventResourceSaverBonusPercent * 100}
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
                <label className="checkbox-field" htmlFor="ingredient-demand-iron-depot">
                  <input
                    id="ingredient-demand-iron-depot"
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
                <label className="field-label" htmlFor="ingredient-demand-tower-cutoff">
                  Tower max level
                </label>
                <input
                  id="ingredient-demand-tower-cutoff"
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

            <p className="subtle-text">
              Resource Saver perks and event bonuses change the crafting totals. Iron Depot treats Iron as already
              covered, and the Tower limit lets you focus only on levels you care about right now.
            </p>
          </>
        ) : null}
      </section>

      {!resourcesState.isLoading && resourcesState.snapshot && burdenResult ? (
        <section className="page-card page-stack" aria-labelledby="ingredient-demand-results-title">
          <div>
            <h2 id="ingredient-demand-results-title">Lookup Result</h2>
            <p className="supporting-text">
              Totals include nested crafted items, so an ingredient can show demand even when it is several recipes
              below the item you ultimately want.
            </p>
          </div>

          {!selectedBurden ? (
            <p className="empty-state">Choose an ingredient from the autocomplete list to see its burden by scope.</p>
          ) : (
            <>
              <dl className="summary-grid">
                <div className="summary-grid__item">
                  <dt>Selected ingredient</dt>
                  <dd>
                    <ItemProfileLink
                      canonicalKey={selectedBurden.canonicalKey}
                      itemName={selectedBurden.itemName}
                    />
                  </dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Total recursive burden</dt>
                  <dd>{formatAmount(selectedBurden.totalRequiredEffectiveOutput)}</dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Craft operations if self-crafted</dt>
                  <dd>{formatAmount(selectedBurden.totalRequiredCraftOperations)}</dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Craftable ingredient</dt>
                  <dd>{selectedBurden.isCraftable ? 'Yes' : 'No'}</dd>
                </div>
              </dl>

              <div className="summary-grid">
                {(['M', 'GM', 'MM', 'Tower'] as const).map((scope) => {
                  const scopeValues = selectedBurden.byScope[scope];

                  return (
                    <div key={scope} className="summary-grid__item">
                      <dt>{formatScopeLabel(scope)}</dt>
                      <dd>{formatAmount(scopeValues?.requiredEffectiveOutput ?? 0)}</dd>
                      <p className="subtle-text">
                        Craft ops: {formatAmount(scopeValues?.requiredCraftOperations ?? 0)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <section className="page-stack" aria-labelledby="ingredient-demand-breakdown-title">
                <div>
                  <h3 id="ingredient-demand-breakdown-title" className="section-title">
                    Downstream drivers
                  </h3>
                  <p className="subtle-text">
                    These are the crafted items currently creating demand for this ingredient.
                  </p>
                </div>

                <ul className="data-list">
                  {Object.values(burdenResult.scopeResults).flatMap((scopeResult) => {
                    const scopeEntry = scopeResult.ingredientBurdenByCanonicalKey[selectedBurden.canonicalKey];
                    return (scopeEntry?.contributions ?? []).map((contribution) => ({
                      ...contribution,
                      scope: scopeResult.scope,
                    }));
                  })
                    .sort((left, right) => {
                      if (left.scope !== right.scope) {
                        return left.scope.localeCompare(right.scope);
                      }

                      return left.rootOutputItemName.localeCompare(right.rootOutputItemName);
                    })
                    .map((contribution) => (
                      <li key={`${contribution.scope}-${contribution.rootGoalId}`}>
                        <div>
                          <ItemProfileLink
                            canonicalKey={contribution.rootOutputCanonicalKey}
                            itemName={contribution.rootOutputItemName}
                          />
                          <p className="subtle-text">Scope: {formatScopeLabel(contribution.scope)}</p>
                        </div>
                        <strong>{formatAmount(contribution.requiredEffectiveOutput)}</strong>
                      </li>
                    ))}
                </ul>
              </section>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
