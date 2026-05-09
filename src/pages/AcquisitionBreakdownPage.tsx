import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  createDefaultAcquisitionPlannerInputState,
  loadAcquisitionPlannerInputState,
  resolveAcquisitionSourceInclusionMap,
  type AcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import {
  deriveConsumableAcquisitionEstimates,
  estimateManualExploreAcquisition,
  type ConsumableAcquisitionSourceKey,
} from '../lib/acquisitionEstimates';
import {
  createDefaultCraftingModifierState,
  loadCraftingModifierState,
  type UserCraftingModifierState,
} from '../lib/craftingModifierState';
import { deriveFuturePetProductionForecast } from '../lib/deriveFuturePetProductionForecast';
import { loadRecipeGraph, type RecipeGraph } from '../lib/loadRecipeGraph';
import { loadTowerRequirements, type TowerRequirementsData } from '../lib/loadTowerRequirements';
import {
  calculateRecursiveIngredientBurden,
  type IngredientBurdenAggregateEntry,
  type RecursiveIngredientBurdenResult,
} from '../lib/recursiveIngredientBurden';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';

type ItemOption = {
  canonicalKey: string;
  itemName: string;
};

type KnownCoverage = {
  stockpileQuantity: number;
  containerQuantity: number;
  storedPetQuantity: number;
  futurePetQuantity: number;
};

const CONSUMABLE_LABELS: Record<ConsumableAcquisitionSourceKey, string> = {
  apple_cider: 'Apple Cider',
  lemonade: 'Lemonade',
  arnold_palmer: 'Arnold Palmer',
};

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString();
}

function parseNumberInput(value: string): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function buildItemOptions(burdenByCanonicalKey: Record<string, IngredientBurdenAggregateEntry>): ItemOption[] {
  return Object.values(burdenByCanonicalKey)
    .map((entry) => ({
      canonicalKey: entry.canonicalKey,
      itemName: entry.itemName,
    }))
    .sort((left, right) => left.itemName.localeCompare(right.itemName));
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

function sumOwnedNowEntries(
  acquisitionState: AcquisitionPlannerInputState,
  selectedCanonicalKey: string,
  sourceCategory: 'stockpile' | 'container',
): number {
  return acquisitionState.ownedNow.entries
    .filter((entry) => (
      entry.canonicalItemKey === selectedCanonicalKey && entry.sourceCategory === sourceCategory
    ))
    .reduce((total, entry) => total + entry.ownedCount, 0);
}

function getKnownCoverage(
  acquisitionState: AcquisitionPlannerInputState,
  selectedCanonicalKey: string,
): KnownCoverage {
  const inclusionMap = resolveAcquisitionSourceInclusionMap(acquisitionState);
  const futurePetForecast = deriveFuturePetProductionForecast(acquisitionState);
  const futurePetEntry = futurePetForecast.entries.find(
    (entry) => entry.canonicalItemKey === selectedCanonicalKey,
  );

  return {
    stockpileQuantity: inclusionMap.owned_stockpiles
      ? sumOwnedNowEntries(acquisitionState, selectedCanonicalKey, 'stockpile')
      : 0,
    containerQuantity: inclusionMap.owned_containers
      ? sumOwnedNowEntries(acquisitionState, selectedCanonicalKey, 'container')
      : 0,
    storedPetQuantity: inclusionMap.stored_pet_inventory
      ? acquisitionState.pets.storedInventoryEntries
        .filter((entry) => entry.canonicalItemKey === selectedCanonicalKey)
        .reduce((total, entry) => total + entry.storedCount, 0)
      : 0,
    futurePetQuantity: inclusionMap.future_pet_production && futurePetForecast.enabled
      ? futurePetEntry?.forecastQuantity ?? 0
      : 0,
  };
}

function getCoverageTotal(coverage: KnownCoverage): number {
  return (
    coverage.stockpileQuantity +
    coverage.containerQuantity +
    coverage.storedPetQuantity +
    coverage.futurePetQuantity
  );
}

export function AcquisitionBreakdownPage() {
  const [searchParams] = useSearchParams();
  const [resourcesState, setResourcesState] = useState<{
    isLoading: boolean;
    snapshotError: string | null;
    recipeError: string | null;
    towerError: string | null;
    snapshot: MasterySnapshot | null;
    recipeGraph: RecipeGraph | null;
    towerRequirementsData: TowerRequirementsData | null;
  }>({
    isLoading: true,
    snapshotError: null,
    recipeError: null,
    towerError: null,
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
  const [acquisitionState, setAcquisitionState] = useState<AcquisitionPlannerInputState>(() => {
    try {
      return loadAcquisitionPlannerInputState();
    } catch {
      return createDefaultAcquisitionPlannerInputState();
    }
  });
  const [itemQuery, setItemQuery] = useState('');
  const [selectedCanonicalKey, setSelectedCanonicalKey] = useState('');
  const [manualDropRateInput, setManualDropRateInput] = useState('');
  const [itemsPerDropInput, setItemsPerDropInput] = useState('1');
  const [eligibleConsumableSources, setEligibleConsumableSources] = useState<
    Record<ConsumableAcquisitionSourceKey, boolean>
  >({
    apple_cider: false,
    lemonade: false,
    arnold_palmer: false,
  });

  useEffect(() => {
    let isMounted = true;
    let loadedModifierState: UserCraftingModifierState;
    let loadedAcquisitionState: AcquisitionPlannerInputState;

    try {
      loadedModifierState = loadCraftingModifierState();
    } catch {
      loadedModifierState = createDefaultCraftingModifierState();
    }

    try {
      loadedAcquisitionState = loadAcquisitionPlannerInputState();
    } catch {
      loadedAcquisitionState = createDefaultAcquisitionPlannerInputState();
    }

    setModifierState(loadedModifierState);
    setAcquisitionState(loadedAcquisitionState);

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
            snapshot,
            recipeGraph,
            towerRequirementsData,
          });
        } catch (error: unknown) {
          if (!isMounted) {
            return;
          }

          const message =
            error instanceof Error ? error.message : 'Unable to load planning inputs for acquisition breakdown.';

          setResourcesState({
            isLoading: false,
            snapshotError: null,
            recipeError: message.includes('recipe') ? message : null,
            towerError: message.includes('tower') ? message : null,
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
          snapshot: null,
          recipeGraph: null,
          towerRequirementsData: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const burdenResult = useMemo(() => {
    if (!resourcesState.snapshot || !resourcesState.recipeGraph || !resourcesState.towerRequirementsData) {
      return null;
    }

    return calculateRecursiveIngredientBurden({
      snapshot: resourcesState.snapshot,
      recipeGraph: resourcesState.recipeGraph,
      modifierState,
      towerRequirementsData: resourcesState.towerRequirementsData,
    });
  }, [
    modifierState,
    resourcesState.recipeGraph,
    resourcesState.snapshot,
    resourcesState.towerRequirementsData,
  ]);

  const itemOptions = useMemo(
    () => buildItemOptions(burdenResult?.ingredientBurdenByCanonicalKey ?? {}),
    [burdenResult],
  );
  const requestedCanonicalKey = searchParams.get('item')?.trim().toLowerCase() ?? '';

  useEffect(() => {
    if (itemOptions.length === 0) {
      setSelectedCanonicalKey('');
      setItemQuery('');
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

    setItemQuery((currentQuery) => {
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
  const selectedRequiredQuantity = selectedBurden
    ? Math.ceil(selectedBurden.totalRequiredEffectiveOutput)
    : 0;
  const knownCoverage = selectedBurden
    ? getKnownCoverage(acquisitionState, selectedBurden.canonicalKey)
    : {
      stockpileQuantity: 0,
      containerQuantity: 0,
      storedPetQuantity: 0,
      futurePetQuantity: 0,
    };
  const immediateKnownCoverage =
    knownCoverage.stockpileQuantity + knownCoverage.containerQuantity + knownCoverage.storedPetQuantity;
  const remainingAfterImmediate = Math.max(0, selectedRequiredQuantity - immediateKnownCoverage);
  const remainingAfterKnownCoverage = Math.max(0, selectedRequiredQuantity - getCoverageTotal(knownCoverage));
  const manualEstimate = selectedBurden
    ? estimateManualExploreAcquisition({
      itemName: selectedBurden.itemName,
      requiredItemCount: remainingAfterImmediate,
      dropRatePercent: parseNumberInput(manualDropRateInput),
      itemsPerDrop: parseNumberInput(itemsPerDropInput),
      availableStamina: acquisitionState.explore.availableStamina,
      wandererPercent: acquisitionState.explore.wandererPercent,
    })
    : null;
  const inclusionMap = resolveAcquisitionSourceInclusionMap(acquisitionState);
  const consumableEstimates = deriveConsumableAcquisitionEstimates(acquisitionState)
    .filter((estimate) => inclusionMap[estimate.sourceKey])
    .map((estimate) => ({
      ...estimate,
      selectedForItem: eligibleConsumableSources[estimate.sourceKey],
    }));
  const selectedConsumableCapacity = consumableEstimates
    .filter((estimate) => estimate.selectedForItem)
    .reduce((total, estimate) => total + estimate.totalItemCapacity, 0);
  const remainingAfterSelectedSources = Math.max(
    0,
    remainingAfterKnownCoverage - selectedConsumableCapacity,
  );
  const recommendationRows = [
    immediateKnownCoverage > 0
      ? `Use known stockpiles, containers, and stored pet inventory first: ${formatAmount(immediateKnownCoverage)} item(s).`
      : null,
    knownCoverage.futurePetQuantity > 0
      ? `Future pet production can cover about ${formatAmount(knownCoverage.futurePetQuantity)} more item(s).`
      : null,
    manualEstimate?.calculable && manualEstimate.requiredItemCount > 0
      ? `Manual Explore needs about ${formatAmount(manualEstimate.staminaNeeded)} stamina for the current remainder.`
      : null,
    selectedConsumableCapacity > 0
      ? `Selected consumables can cover up to ${formatAmount(selectedConsumableCapacity)} item(s) if this item is eligible for those drops.`
      : null,
    remainingAfterKnownCoverage > 0 && selectedConsumableCapacity === 0 && !manualEstimate?.calculable
      ? 'Add a drop rate or mark eligible consumables to compare the remaining acquisition options.'
      : null,
  ].filter((row): row is string => Boolean(row));

  function handleItemQueryChange(value: string): void {
    setItemQuery(value);

    const exactMatch = itemOptions.find(
      (option) => option.itemName.toLowerCase() === value.trim().toLowerCase(),
    );

    setSelectedCanonicalKey(exactMatch?.canonicalKey ?? '');
  }

  function toggleConsumableSource(sourceKey: ConsumableAcquisitionSourceKey): void {
    setEligibleConsumableSources((current) => ({
      ...current,
      [sourceKey]: !current[sourceKey],
    }));
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Acquisition Breakdown"
        description="Pick one needed item and compare the saved sources that could help cover it."
        storageKey="acquisition-breakdown"
      />

      <section className="page-card page-stack" aria-labelledby="acquisition-breakdown-controls-title">
        <div>
          <h2 id="acquisition-breakdown-controls-title">Item to check</h2>
          <p className="supporting-text">
            Uses your latest snapshot, current material burden, and saved acquisition assumptions.
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
          <p className="empty-state">Import a mastery export first to use acquisition breakdowns.</p>
        ) : null}

        {!resourcesState.isLoading && resourcesState.recipeError ? (
          <p className="status-message status-message--error">{resourcesState.recipeError}</p>
        ) : null}

        {!resourcesState.isLoading && resourcesState.towerError ? (
          <p className="status-message status-message--error">{resourcesState.towerError}</p>
        ) : null}

        {!resourcesState.isLoading && resourcesState.snapshot && burdenResult ? (
          <>
            <div className="page-stack page-stack--tight">
              <label className="field-label" htmlFor="acquisition-breakdown-search">
                Item
              </label>
              <input
                id="acquisition-breakdown-search"
                className="text-input"
                list="acquisition-breakdown-options"
                type="text"
                value={itemQuery}
                onChange={(event) => handleItemQueryChange(event.target.value)}
                placeholder="Search item name"
              />
              <datalist id="acquisition-breakdown-options">
                {itemOptions.map((option) => (
                  <option key={option.canonicalKey} value={option.itemName} />
                ))}
              </datalist>
            </div>

            <p className="subtle-text">
              Source availability comes from <Link to="/settings">Settings</Link>. Item-specific drop choices on this
              page are temporary so you can test a source before making it part of your regular assumptions.
            </p>
          </>
        ) : null}
      </section>

      {!resourcesState.isLoading && resourcesState.snapshot && burdenResult ? (
        <section className="page-card page-stack" aria-labelledby="acquisition-breakdown-result-title">
          <div>
            <h2 id="acquisition-breakdown-result-title">Breakdown</h2>
          </div>

          {!selectedBurden ? (
            <p className="empty-state">Choose an item from the autocomplete list to compare acquisition sources.</p>
          ) : (
            <>
              <dl className="summary-grid">
                <div className="summary-grid__item">
                  <dt>Selected item</dt>
                  <dd>
                    <ItemProfileLink
                      canonicalKey={selectedBurden.canonicalKey}
                      itemName={selectedBurden.itemName}
                    />
                  </dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Total needed</dt>
                  <dd>{formatAmount(selectedRequiredQuantity)}</dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Covered by saved sources</dt>
                  <dd>{formatAmount(getCoverageTotal(knownCoverage))}</dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Still unplanned</dt>
                  <dd>{formatAmount(remainingAfterSelectedSources)}</dd>
                </div>
              </dl>

              <div className="table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Saved source</th>
                      <th scope="col">Items</th>
                      <th scope="col">Timing</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Stockpiles</td>
                      <td>{formatAmount(knownCoverage.stockpileQuantity)}</td>
                      <td>Now</td>
                    </tr>
                    <tr>
                      <td>Containers</td>
                      <td>{formatAmount(knownCoverage.containerQuantity)}</td>
                      <td>Now</td>
                    </tr>
                    <tr>
                      <td>Stored pet inventory</td>
                      <td>{formatAmount(knownCoverage.storedPetQuantity)}</td>
                      <td>Now</td>
                    </tr>
                    <tr>
                      <td>Future pet production</td>
                      <td>{formatAmount(knownCoverage.futurePetQuantity)}</td>
                      <td>Future</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <section className="page-stack" aria-labelledby="acquisition-breakdown-source-title">
                <div>
                  <h3 id="acquisition-breakdown-source-title" className="section-title">
                    Compare more sources
                  </h3>
                  <p className="subtle-text">
                    Only turn on a consumable if this item can actually come from that source.
                  </p>
                </div>

                <div className="summary-grid">
                  <div className="summary-grid__item page-stack page-stack--tight">
                    <h4>Manual Explore</h4>
                    <label className="field-label" htmlFor="acquisition-manual-drop-rate">
                      Drop rate %
                    </label>
                    <input
                      id="acquisition-manual-drop-rate"
                      className="text-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualDropRateInput}
                      onChange={(event) => setManualDropRateInput(event.target.value)}
                      placeholder="Example: 25"
                    />
                    <label className="field-label" htmlFor="acquisition-manual-items-per-drop">
                      Items per drop
                    </label>
                    <input
                      id="acquisition-manual-items-per-drop"
                      className="text-input"
                      type="number"
                      min="0"
                      step="1"
                      value={itemsPerDropInput}
                      onChange={(event) => setItemsPerDropInput(event.target.value)}
                    />
                    <p className="subtle-text">
                      {manualEstimate?.calculable
                        ? `Estimated stamina: ${formatAmount(manualEstimate.staminaNeeded)}`
                        : manualEstimate?.blockerReason}
                    </p>
                  </div>

                  {consumableEstimates.map((estimate) => (
                    <div key={estimate.sourceKey} className="summary-grid__item page-stack page-stack--tight">
                      <label className="checkbox-field" htmlFor={`acquisition-${estimate.sourceKey}`}>
                        <input
                          id={`acquisition-${estimate.sourceKey}`}
                          type="checkbox"
                          checked={estimate.selectedForItem}
                          onChange={() => toggleConsumableSource(estimate.sourceKey)}
                        />
                        <span>{CONSUMABLE_LABELS[estimate.sourceKey]}</span>
                      </label>
                      <p>
                        <strong>{formatAmount(estimate.totalItemCapacity)}</strong> item capacity
                      </p>
                      <p className="subtle-text">
                        {formatAmount(estimate.standardItemsPerUse)} per use
                        {estimate.boostedItemsPerUse
                          ? `, ${formatAmount(estimate.boostedItemsPerUse)} with Lemon Seltzer`
                          : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="page-stack" aria-labelledby="acquisition-breakdown-recommendations-title">
                <div>
                  <h3 id="acquisition-breakdown-recommendations-title" className="section-title">
                    Recommended next sources
                  </h3>
                </div>

                <ul className="data-list">
                  {recommendationRows.map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ul>

                <details>
                  <summary>Why these numbers show here</summary>
                  <ul className="data-list">
                    <li>
                      The item need comes from the same recursive material burden used by Material Planner.
                    </li>
                    <li>
                      Saved stockpiles, containers, stored pets, and future pets come from Settings.
                    </li>
                    <li>
                      Manual Explore uses the drop rate you enter here because item drop coverage is not part of the
                      local reference data yet.
                    </li>
                    <li>
                      Consumables are shown only as capacity until you mark this item as eligible for that source.
                    </li>
                  </ul>
                </details>
              </section>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
