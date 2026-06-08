import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  createDefaultAcquisitionPlannerInputState,
  loadAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import {
  createDefaultDropRateAcquisitionSettings,
  loadDropRateAcquisitionSettings,
  type DropRateAcquisitionSettings,
} from '../lib/dropRateAcquisitionSettings';
import { getItemIcon } from '../lib/itemIconManifest';
import {
  buildLargeNetPlanner,
  FISHING_NETS_PER_LARGE_NET,
  type LargeNetPlannerResult,
} from '../lib/largeNetPlanner';
import {
  createDefaultLargeNetPlannerState,
  loadLargeNetPlannerState,
  saveLargeNetPlannerState,
  type LargeNetPlannerTargetState,
} from '../lib/largeNetPlannerState';
import { loadDropRateReference, type DropRateReferenceData } from '../lib/loadDropRateReference';
import { loadItemCatalog, type ItemCatalogData } from '../lib/loadItemCatalog';
import { loadPetSourceReference, type PetSourceReferenceData } from '../lib/loadPetSourceReference';
import { toCanonicalItemKey } from '../lib/normalizeItemKey';

type ResourceState = {
  isLoading: boolean;
  itemCatalog: ItemCatalogData | null;
  dropRateReference: DropRateReferenceData | null;
  petSourceReference: PetSourceReferenceData | null;
  itemCatalogError: string | null;
  dropRateError: string | null;
  petSourceError: string | null;
};

function parsePositiveInput(value: string): number {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function parseOptionalNonNegativeInput(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : undefined;
}

function formatCount(value: number): string {
  return Math.ceil(value).toLocaleString();
}

function formatEstimate(value: number | null, suffix = ''): string {
  if (value === null) {
    return 'Needs rate';
  }

  if (value === 0) {
    return `0${suffix}`;
  }

  if (value < 1) {
    return `<1${suffix}`;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
}

function formatDecimal(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits,
  });
}

function getItemIconSrc(canonicalKey: string): string | null {
  return getItemIcon(canonicalKey)?.src ?? null;
}

const DAYS_COLUMN_HELP_TEXT = 'Days estimates this target by itself: target minus regular inventory and effective stored pet inventory, divided by expected daily progress from Large Nets, catch multiplier, and pet/day output. Shared-budget and allocation planning are separate.';

function findCatalogEntry(itemCatalog: ItemCatalogData | null, itemName: string) {
  const normalizedItemName = itemName.trim().toLowerCase();

  if (!normalizedItemName) {
    return null;
  }

  return itemCatalog?.entries.find((entry) => (
    entry.itemName.toLowerCase() === normalizedItemName ||
    entry.canonicalKey === normalizedItemName
  )) ?? null;
}

function createNewTargetRow(): LargeNetPlannerTargetState {
  return {
    id: crypto.randomUUID(),
    itemName: '',
    targetQuantity: '',
    allocationShare: '',
    regularInventoryOverride: '',
    storedPetInventoryOverride: '',
    petNameOverride: '',
    petLevelOverride: '',
    manualLargeNetsPerDrop: '',
  };
}

function findSavedPetEntry(acquisitionState: AcquisitionPlannerInputState, canonicalKey: string) {
  return acquisitionState.pets.futureProduction.entries.find((entry) => {
    return entry.canonicalItemKey === canonicalKey;
  }) ?? null;
}

function resolvePetNameForTarget(input: {
  acquisitionState: AcquisitionPlannerInputState;
  petSourceReference: PetSourceReferenceData | null;
  target: LargeNetPlannerTargetState;
  canonicalKey: string;
}): string {
  const manualPetName = input.target.petNameOverride.trim();

  if (manualPetName) {
    return manualPetName;
  }

  const savedPetEntry = findSavedPetEntry(input.acquisitionState, input.canonicalKey);

  if (savedPetEntry) {
    return savedPetEntry.petName;
  }

  const sourcePets = input.petSourceReference?.byItemCanonicalKey[input.canonicalKey] ?? [];
  return sourcePets.length === 1 ? sourcePets[0].petName : '';
}

function loadInitialPlannerState(acquisitionState: AcquisitionPlannerInputState) {
  try {
    return loadLargeNetPlannerState() ??
      createDefaultLargeNetPlannerState({
        crunchyOmeletteActive: acquisitionState.pets.futureProduction.crunchyOmeletteActive,
      });
  } catch {
    return createDefaultLargeNetPlannerState({
      crunchyOmeletteActive: acquisitionState.pets.futureProduction.crunchyOmeletteActive,
    });
  }
}

export function LargeNetPlannerPage() {
  const [acquisitionState, setAcquisitionState] = useState<AcquisitionPlannerInputState>(() => {
    try {
      return loadAcquisitionPlannerInputState();
    } catch {
      return createDefaultAcquisitionPlannerInputState();
    }
  });
  const [dropRateSettings, setDropRateSettings] = useState<DropRateAcquisitionSettings>(() => {
    try {
      return loadDropRateAcquisitionSettings();
    } catch {
      return createDefaultDropRateAcquisitionSettings();
    }
  });
  const [resourceState, setResourceState] = useState<ResourceState>({
    isLoading: true,
    itemCatalog: null,
    dropRateReference: null,
    petSourceReference: null,
    itemCatalogError: null,
    dropRateError: null,
    petSourceError: null,
  });
  const [initialPlannerState] = useState(() => loadInitialPlannerState(acquisitionState));
  const [dailyAntlers, setDailyAntlers] = useState(initialPlannerState.dailyAntlers);
  const [directLargeNetsPerDay, setDirectLargeNetsPerDay] = useState(initialPlannerState.directLargeNetsPerDay);
  const [waitDays, setWaitDays] = useState(initialPlannerState.waitDays);
  const [craftOutputMultiplier, setCraftOutputMultiplier] = useState(initialPlannerState.craftOutputMultiplier);
  const [catchMultiplier, setCatchMultiplier] = useState(initialPlannerState.catchMultiplier);
  const [crunchyOmeletteActive, setCrunchyOmeletteActive] = useState(initialPlannerState.crunchyOmeletteActive);
  const [targets, setTargets] = useState<LargeNetPlannerTargetState[]>(initialPlannerState.targets);

  useEffect(() => {
    let isMounted = true;

    try {
      setAcquisitionState(loadAcquisitionPlannerInputState());
    } catch {
      setAcquisitionState(createDefaultAcquisitionPlannerInputState());
    }

    try {
      setDropRateSettings(loadDropRateAcquisitionSettings());
    } catch {
      setDropRateSettings(createDefaultDropRateAcquisitionSettings());
    }

    void Promise.allSettled([
      loadItemCatalog(),
      loadDropRateReference(),
      loadPetSourceReference(),
    ]).then(([itemCatalogResult, dropRateResult, petSourceResult]) => {
      if (!isMounted) {
        return;
      }

      setResourceState({
        isLoading: false,
        itemCatalog: itemCatalogResult.status === 'fulfilled' ? itemCatalogResult.value : null,
        dropRateReference: dropRateResult.status === 'fulfilled' ? dropRateResult.value : null,
        petSourceReference: petSourceResult.status === 'fulfilled' ? petSourceResult.value : null,
        itemCatalogError: itemCatalogResult.status === 'rejected'
          ? 'Unable to load local item catalog data.'
          : null,
        dropRateError: dropRateResult.status === 'rejected'
          ? 'Unable to load local drop-rate reference data; manual Large Nets per drop still works.'
          : null,
        petSourceError: petSourceResult.status === 'rejected'
          ? 'Unable to load local pet-source data; future pet estimates can still use level-based output.'
          : null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      saveLargeNetPlannerState({
        schemaVersion: 1,
        dailyAntlers,
        directLargeNetsPerDay,
        waitDays,
        craftOutputMultiplier,
        catchMultiplier,
        crunchyOmeletteActive,
        targets,
      });
    } catch {
      // Planner persistence is convenience-only; calculation should still work when storage is unavailable.
    }
  }, [
    catchMultiplier,
    craftOutputMultiplier,
    crunchyOmeletteActive,
    dailyAntlers,
    directLargeNetsPerDay,
    targets,
    waitDays,
  ]);

  const plannerResult: LargeNetPlannerResult = useMemo(() => (
    buildLargeNetPlanner({
      acquisitionState,
      dropRateReference: resourceState.dropRateReference,
      dropRateSettings,
      petSourceReference: resourceState.petSourceReference,
      targets: targets.map((target) => {
        const catalogEntry = findCatalogEntry(resourceState.itemCatalog, target.itemName);

        return {
          itemName: catalogEntry?.itemName ?? target.itemName,
          canonicalKey: catalogEntry?.canonicalKey,
          targetQuantity: parsePositiveInput(target.targetQuantity),
          allocationShare: parseOptionalNonNegativeInput(target.allocationShare),
          regularInventoryOverride: parseOptionalNonNegativeInput(target.regularInventoryOverride),
          storedPetInventoryOverride: parseOptionalNonNegativeInput(target.storedPetInventoryOverride),
          petForecastOverride: parsePositiveInput(target.petLevelOverride) > 0
            ? {
              petName: resolvePetNameForTarget({
                acquisitionState,
                petSourceReference: resourceState.petSourceReference,
                target,
                canonicalKey: catalogEntry?.canonicalKey ?? toCanonicalItemKey(target.itemName),
              }),
              petLevel: parsePositiveInput(target.petLevelOverride),
            }
            : undefined,
          manualLargeNetsPerDrop: parsePositiveInput(target.manualLargeNetsPerDrop),
        };
      }),
      dailyAntlers: parsePositiveInput(dailyAntlers),
      directLargeNetsPerDay: parsePositiveInput(directLargeNetsPerDay),
      waitDays: parseOptionalNonNegativeInput(waitDays),
      craftOutputMultiplier: parsePositiveInput(craftOutputMultiplier),
      catchMultiplier: parsePositiveInput(catchMultiplier),
      crunchyOmeletteActive,
    })
  ), [
    acquisitionState,
    catchMultiplier,
    craftOutputMultiplier,
    crunchyOmeletteActive,
    dailyAntlers,
    directLargeNetsPerDay,
    dropRateSettings,
    resourceState.dropRateReference,
    resourceState.itemCatalog,
    resourceState.petSourceReference,
    targets,
    waitDays,
  ]);

  const warnings = [
    resourceState.itemCatalogError,
    resourceState.dropRateError,
    resourceState.petSourceError,
    ...plannerResult.warnings,
    ...plannerResult.targets.flatMap((target) => (
      target.warnings.map((warning) => `${target.itemName}: ${warning}`)
    )),
  ].filter((warning): warning is string => Boolean(warning));

  const totalImmediateSupply = plannerResult.targets.reduce(
    (total, target) => total + target.immediateQuantity,
    0,
  );
  const totalRemaining = plannerResult.targets.reduce(
    (total, target) => total + target.remainingAfterImmediateQuantity,
    0,
  );

  function updateTargetRow(id: string, updates: Partial<LargeNetPlannerTargetState>): void {
    setTargets((currentTargets) => currentTargets.map((target) => (
      target.id === id ? { ...target, ...updates } : target
    )));
  }

  function removeTargetRow(id: string): void {
    setTargets((currentTargets) => (
      currentTargets.length > 1 ? currentTargets.filter((target) => target.id !== id) : currentTargets
    ));
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Large Net Planner"
        description="Estimate shell timelines from daily Large Nets, Antler crafting, current inventory, stored pet inventory, and future pet output."
        storageKey="large-net-planner"
      />

      <section className="page-card page-stack" aria-labelledby="large-net-summary-title">
        <div>
          <h2 id="large-net-summary-title">Countdown</h2>
          <p className="supporting-text">
            Competing assumes the selected targets spend the same Large Net budget. Incidental assumes the same nets can
            produce every selected drop independently.
          </p>
        </div>

        {resourceState.isLoading ? (
          <p className="empty-state">Loading local item, drop-rate, and pet-source references...</p>
        ) : null}

        <dl className="summary-grid">
          <div className="summary-grid__item">
            <dt>Daily Large Nets</dt>
            <dd>{formatDecimal(plannerResult.dailyLargeNets)}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Competing targets</dt>
            <dd>{formatEstimate(plannerResult.competingDays, ' days')}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Incidental drops</dt>
            <dd>{formatEstimate(plannerResult.incidentalDays, ' days')}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Remaining items</dt>
            <dd>{formatCount(totalRemaining)}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Wait projection</dt>
            <dd>{formatEstimate(plannerResult.waitDays, ' days')}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Immediate supply</dt>
            <dd>{formatCount(totalImmediateSupply)}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Budget source</dt>
            <dd>{plannerResult.dailyLargeNetSource === 'direct_override' ? 'Large Net override' : 'Antlers/day'}</dd>
          </div>
        </dl>

        {warnings.length > 0 ? (
          <ul className="status-alert">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="large-net-scenario-title">
        <div>
          <h2 id="large-net-scenario-title">Scenario Sandbox</h2>
          <p className="supporting-text">
            Split the daily Large Net budget across targets, then see what remains after the selected wait period.
            If all allocation fields are blank, unfinished targets split the budget evenly.
          </p>
        </div>

        {plannerResult.targets.length === 0 ? (
          <p className="empty-state">Add target items to try an allocation scenario.</p>
        ) : (
          <div className="table-scroll">
            <table className="summary-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Share</th>
                  <th scope="col">Large Nets/day</th>
                  <th scope="col">Items from nets</th>
                  <th scope="col">Items from pets</th>
                  <th scope="col">Remaining after wait</th>
                  <th scope="col">Large Nets left</th>
                  <th scope="col">Days at share</th>
                </tr>
              </thead>
              <tbody>
                {plannerResult.targets.map((target) => (
                  <tr key={target.canonicalKey}>
                    <td>
                      <ItemProfileLink
                        canonicalKey={target.canonicalKey}
                        itemName={target.itemName}
                        iconSrc={getItemIconSrc(target.canonicalKey)}
                      />
                    </td>
                    <td>{formatDecimal(target.allocationPercent * 100, 1)}%</td>
                    <td>{formatDecimal(target.allocatedLargeNetsPerDay, 1)}</td>
                    <td>{formatDecimal(target.allocationProjectedFishingQuantityDuringWait, 1)}</td>
                    <td>{formatDecimal(target.allocationProjectedPetQuantityDuringWait, 1)}</td>
                    <td>{formatCount(target.allocationRemainingAfterWaitQuantity)}</td>
                    <td>{formatEstimate(target.allocationLargeNetsNeededAfterWait)}</td>
                    <td>{formatEstimate(target.allocationDays, ' days')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="page-card page-stack" open>
        <summary>
          <strong>Large Net Budget</strong>
        </summary>

        <div className="filter-grid">
          <label className="field-label" htmlFor="large-net-direct-budget">
            Large Nets/day override
            <input
              id="large-net-direct-budget"
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={directLargeNetsPerDay}
              onChange={(event) => setDirectLargeNetsPerDay(event.target.value)}
            />
          </label>

          <label className="field-label" htmlFor="large-net-antlers">
            Antlers/day
            <input
              id="large-net-antlers"
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={dailyAntlers}
              onChange={(event) => setDailyAntlers(event.target.value)}
            />
          </label>

          <label className="field-label" htmlFor="large-net-craft-multiplier">
            Craft output multiplier
            <input
              id="large-net-craft-multiplier"
              className="text-input"
              type="number"
              min="0"
              step="0.01"
              value={craftOutputMultiplier}
              onChange={(event) => setCraftOutputMultiplier(event.target.value)}
            />
          </label>

          <label className="field-label" htmlFor="large-net-wait-days">
            Wait days
            <input
              id="large-net-wait-days"
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={waitDays}
              onChange={(event) => setWaitDays(event.target.value)}
            />
          </label>

          <label className="field-label" htmlFor="large-net-catch-multiplier">
            Catch multiplier
            <input
              id="large-net-catch-multiplier"
              className="text-input"
              type="number"
              min="0"
              step="0.01"
              value={catchMultiplier}
              onChange={(event) => setCatchMultiplier(event.target.value)}
            />
          </label>

          <label className="checkbox-field" htmlFor="large-net-crunchy">
            <input
              id="large-net-crunchy"
              type="checkbox"
              checked={crunchyOmeletteActive}
              onChange={(event) => setCrunchyOmeletteActive(event.target.checked)}
            />
            <span>Collect pet inventory with Crunchy Omelette (1.5x)</span>
          </label>
        </div>

        <p className="subtle-text">
          Antler conversion assumes other crafting materials are not limiting:
          {' '}
          Antlers/day x craft multiplier / {FISHING_NETS_PER_LARGE_NET.toLocaleString()} x craft multiplier.
          Current estimate from Antlers is {formatDecimal(plannerResult.dailyLargeNetsFromAntlers)} Large Nets/day.
        </p>
        <p className="subtle-text">
          Crunchy Omelette is applied at collection time. When checked, stored pet inventory and future pet/day are both
          credited as if collected while Crunchy is active.
        </p>
        <p className="subtle-text">
          Wait projection is target-by-target: it applies that target's expected Large Net drops plus pet/day progress
          over the wait period. Splitting one Large Net budget across multiple goals is tracked separately.
        </p>
      </details>

      <section className="page-card page-stack" aria-labelledby="large-net-targets-title">
        <div>
          <h2 id="large-net-targets-title">Targets</h2>
          <p className="supporting-text">
            Regular inventory comes from <Link to="/import-inventory">Import Inventory</Link>. Stored pet inventory
            comes from <Link to="/import-pet-items">Import Pet Items</Link> or Settings. Pet/day comes from Settings
            future pet production.
          </p>
        </div>

        <div className="table-scroll">
          <table className="summary-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Target</th>
                <th scope="col">Allocation share</th>
                <th scope="col">Regular inv.</th>
                <th scope="col">Stored pet</th>
                <th scope="col">Pet</th>
                <th scope="col">Pet level</th>
                <th scope="col">Large Nets/drop</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((target, index) => (
                <tr key={target.id}>
                  <td>
                    <label className="sr-only" htmlFor={`large-net-target-item-${target.id}`}>
                      Target item {index + 1}
                    </label>
                    <input
                      id={`large-net-target-item-${target.id}`}
                      className="text-input"
                      type="text"
                      list="large-net-item-options"
                      value={target.itemName}
                      onChange={(event) => updateTargetRow(target.id, { itemName: event.target.value })}
                      placeholder="Item name"
                    />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`large-net-target-quantity-${target.id}`}>
                      Target quantity for {target.itemName || `target ${index + 1}`}
                    </label>
                    <input
                      id={`large-net-target-quantity-${target.id}`}
                      className="text-input"
                      type="number"
                      min="0"
                      step="1"
                      value={target.targetQuantity}
                      onChange={(event) => updateTargetRow(target.id, { targetQuantity: event.target.value })}
                    />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`large-net-target-allocation-${target.id}`}>
                      Allocation share for {target.itemName || `target ${index + 1}`}
                    </label>
                    <input
                      id={`large-net-target-allocation-${target.id}`}
                      className="text-input"
                      type="number"
                      min="0"
                      step="1"
                      value={target.allocationShare}
                      onChange={(event) => updateTargetRow(target.id, { allocationShare: event.target.value })}
                      placeholder="Even"
                    />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`large-net-target-regular-${target.id}`}>
                      Regular inventory override for {target.itemName || `target ${index + 1}`}
                    </label>
                    <input
                      id={`large-net-target-regular-${target.id}`}
                      className="text-input"
                      type="number"
                      min="0"
                      step="1"
                      value={target.regularInventoryOverride}
                      onChange={(event) => updateTargetRow(target.id, {
                        regularInventoryOverride: event.target.value,
                      })}
                      placeholder="Use import"
                    />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`large-net-target-stored-pet-${target.id}`}>
                      Stored pet inventory override for {target.itemName || `target ${index + 1}`}
                    </label>
                    <input
                      id={`large-net-target-stored-pet-${target.id}`}
                      className="text-input"
                      type="number"
                      min="0"
                      step="1"
                      value={target.storedPetInventoryOverride}
                      onChange={(event) => updateTargetRow(target.id, {
                        storedPetInventoryOverride: event.target.value,
                      })}
                      placeholder="Use pet import"
                    />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`large-net-target-pet-${target.id}`}>
                      Pet name override for {target.itemName || `target ${index + 1}`}
                    </label>
                    <input
                      id={`large-net-target-pet-${target.id}`}
                      className="text-input"
                      type="text"
                      list="large-net-pet-options"
                      value={target.petNameOverride}
                      onChange={(event) => updateTargetRow(target.id, { petNameOverride: event.target.value })}
                      placeholder="Saved pet"
                    />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`large-net-target-pet-level-${target.id}`}>
                      Pet level override for {target.itemName || `target ${index + 1}`}
                    </label>
                    <input
                      id={`large-net-target-pet-level-${target.id}`}
                      className="text-input"
                      type="number"
                      min="0"
                      step="1"
                      value={target.petLevelOverride}
                      onChange={(event) => updateTargetRow(target.id, { petLevelOverride: event.target.value })}
                      placeholder="Use settings"
                    />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`large-net-target-rate-${target.id}`}>
                      Manual Large Nets per drop for {target.itemName || `target ${index + 1}`}
                    </label>
                    <input
                      id={`large-net-target-rate-${target.id}`}
                      className="text-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={target.manualLargeNetsPerDrop}
                      onChange={(event) => updateTargetRow(target.id, { manualLargeNetsPerDrop: event.target.value })}
                      placeholder="Use local drop-rate if blank"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button"
                      onClick={() => removeTargetRow(target.id)}
                      disabled={targets.length <= 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="subtle-text">
          Manual Large Nets/drop values are saved locally on this page. Leave the field blank to use a reviewed local
          fishing drop-rate row when one exists.
        </p>
        <p className="subtle-text">
          Quick inventory and pet fields override only this page's calculation. Leave them blank to use imported
          inventory, imported pet inventory, and Settings future pet production.
        </p>

        <button
          type="button"
          className="button button--secondary"
          onClick={() => setTargets((currentTargets) => [...currentTargets, createNewTargetRow()])}
        >
          Add Target
        </button>

        <datalist id="large-net-item-options">
          {resourceState.itemCatalog?.entries.map((item) => (
            <option key={item.canonicalKey} value={item.itemName} />
          ))}
        </datalist>

        <datalist id="large-net-pet-options">
          {resourceState.petSourceReference?.entries.map((entry) => (
            <option key={`${entry.petCanonicalKey}:${entry.itemCanonicalKey}`} value={entry.petName} />
          ))}
        </datalist>
      </section>

      <section className="page-card page-stack" aria-labelledby="large-net-results-title">
        <div>
          <h2 id="large-net-results-title">Target Breakdown</h2>
        </div>

        {plannerResult.targets.length === 0 ? (
          <p className="empty-state">Add at least one target item to estimate a timeline.</p>
        ) : (
          <div className="table-scroll">
            <table className="summary-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Target</th>
                  <th scope="col">Regular inventory</th>
                  <th scope="col">Stored pet</th>
                  <th scope="col">Pet/day</th>
                  <th scope="col">Remaining</th>
                  <th scope="col">LN/drop</th>
                  <th scope="col">LN needed now</th>
                  <th scope="col">Remaining after wait</th>
                  <th scope="col">LN after wait</th>
                  <th scope="col">
                    <span className="table-heading-with-help">
                      Days
                      <span
                        className="progress-list__tooltip"
                        role="note"
                        title={DAYS_COLUMN_HELP_TEXT}
                        aria-label={DAYS_COLUMN_HELP_TEXT}
                      >
                        ?
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {plannerResult.targets.map((target) => (
                  <tr key={target.canonicalKey}>
                    <td>
                      <ItemProfileLink
                        canonicalKey={target.canonicalKey}
                        itemName={target.itemName}
                        iconSrc={getItemIconSrc(target.canonicalKey)}
                      />
                    </td>
                    <td>{formatCount(target.targetQuantity)}</td>
                    <td>
                      {formatCount(target.regularInventoryQuantity)}
                      <br />
                      <span className="subtle-text">
                        {target.regularInventoryQuantitySource === 'override' ? 'Quick override' : 'Import Inventory'}
                      </span>
                    </td>
                    <td>
                      {formatCount(target.effectiveStoredPetInventoryQuantity)}
                      <br />
                      <span className="subtle-text">
                        {formatCount(target.storedPetInventoryQuantity)} raw -{' '}
                        {target.storedPetInventoryQuantitySource === 'override'
                          ? 'Quick override'
                          : 'Import Pet Items'}
                      </span>
                    </td>
                    <td>
                      {formatDecimal(target.dailyPetQuantity, 1)}
                      <br />
                      <span className="subtle-text">
                        {target.dailyPetQuantitySource === 'override' ? 'Quick pet level' : 'Settings'}
                      </span>
                    </td>
                    <td>{formatCount(target.remainingAfterImmediateQuantity)}</td>
                    <td>
                      {target.largeNetsPerDrop > 0 ? formatDecimal(target.largeNetsPerDrop, 2) : 'Missing'}
                      <br />
                      <span className="subtle-text">
                        {target.largeNetsPerDropSource === 'drop_rate_reference'
                          ? target.largeNetsPerDropSourceUrl
                            ? (
                              <a href={target.largeNetsPerDropSourceUrl} target="_blank" rel="noreferrer">
                                {target.largeNetsPerDropSourceLabel ?? 'Drop-rate reference'}
                              </a>
                            )
                            : target.largeNetsPerDropSourceLabel ?? 'Drop-rate reference'
                          : target.largeNetsPerDropSource === 'manual'
                            ? 'Manual'
                            : 'Needs input'}
                      </span>
                    </td>
                    <td>{formatEstimate(target.largeNetsNeededNow)}</td>
                    <td>
                      {formatCount(target.remainingAfterWaitQuantity)}
                      <br />
                      <span className="subtle-text">
                        {formatDecimal(target.projectedFishingQuantityDuringWait, 1)} from nets +{' '}
                        {formatDecimal(target.projectedPetQuantityDuringWait, 1)} from pets
                      </span>
                    </td>
                    <td>{formatEstimate(target.largeNetsNeededAfterWait)}</td>
                    <td>{formatEstimate(target.soloDays, ' days')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
