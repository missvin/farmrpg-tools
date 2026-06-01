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
  DEFAULT_LARGE_NET_CATCH_MULTIPLIER,
  DEFAULT_LARGE_NET_CRAFT_OUTPUT_MULTIPLIER,
  FISHING_NETS_PER_LARGE_NET,
  type LargeNetPlannerResult,
} from '../lib/largeNetPlanner';
import { loadDropRateReference, type DropRateReferenceData } from '../lib/loadDropRateReference';
import { loadItemCatalog, type ItemCatalogData } from '../lib/loadItemCatalog';
import { loadPetSourceReference, type PetSourceReferenceData } from '../lib/loadPetSourceReference';

type TargetEditorRow = {
  id: string;
  itemName: string;
  targetQuantity: string;
  manualLargeNetsPerDrop: string;
};

type ResourceState = {
  isLoading: boolean;
  itemCatalog: ItemCatalogData | null;
  dropRateReference: DropRateReferenceData | null;
  petSourceReference: PetSourceReferenceData | null;
  itemCatalogError: string | null;
  dropRateError: string | null;
  petSourceError: string | null;
};

const DEFAULT_TARGET_ROWS: TargetEditorRow[] = [
  {
    id: 'frost-snapper-shell',
    itemName: 'Frost Snapper Shell',
    targetQuantity: '15000',
    manualLargeNetsPerDrop: '',
  },
  {
    id: 'spiked-shell',
    itemName: 'Spiked Shell',
    targetQuantity: '10000',
    manualLargeNetsPerDrop: '6.1',
  },
];

function parsePositiveInput(value: string): number {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
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

function createNewTargetRow(): TargetEditorRow {
  return {
    id: crypto.randomUUID(),
    itemName: '',
    targetQuantity: '',
    manualLargeNetsPerDrop: '',
  };
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
  const [dailyAntlers, setDailyAntlers] = useState('');
  const [directLargeNetsPerDay, setDirectLargeNetsPerDay] = useState('2000');
  const [craftOutputMultiplier, setCraftOutputMultiplier] = useState(
    DEFAULT_LARGE_NET_CRAFT_OUTPUT_MULTIPLIER.toString(),
  );
  const [catchMultiplier, setCatchMultiplier] = useState(DEFAULT_LARGE_NET_CATCH_MULTIPLIER.toString());
  const [petCollectionMultiplier, setPetCollectionMultiplier] = useState(
    acquisitionState.pets.futureProduction.crunchyOmeletteActive ? '1.5' : '1',
  );
  const [crunchyOmeletteActive, setCrunchyOmeletteActive] = useState(
    acquisitionState.pets.futureProduction.crunchyOmeletteActive,
  );
  const [targets, setTargets] = useState<TargetEditorRow[]>(DEFAULT_TARGET_ROWS);

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
          manualLargeNetsPerDrop: parsePositiveInput(target.manualLargeNetsPerDrop),
        };
      }),
      dailyAntlers: parsePositiveInput(dailyAntlers),
      directLargeNetsPerDay: parsePositiveInput(directLargeNetsPerDay),
      craftOutputMultiplier: parsePositiveInput(craftOutputMultiplier),
      catchMultiplier: parsePositiveInput(catchMultiplier),
      petCollectionMultiplier: parsePositiveInput(petCollectionMultiplier),
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
    petCollectionMultiplier,
    resourceState.dropRateReference,
    resourceState.itemCatalog,
    resourceState.petSourceReference,
    targets,
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

  function updateTargetRow(id: string, updates: Partial<TargetEditorRow>): void {
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

          <label className="field-label" htmlFor="large-net-pet-collection-multiplier">
            Stored pet collection multiplier
            <input
              id="large-net-pet-collection-multiplier"
              className="text-input"
              type="number"
              min="0"
              step="0.01"
              value={petCollectionMultiplier}
              onChange={(event) => setPetCollectionMultiplier(event.target.value)}
            />
          </label>

          <label className="checkbox-field" htmlFor="large-net-crunchy">
            <input
              id="large-net-crunchy"
              type="checkbox"
              checked={crunchyOmeletteActive}
              onChange={(event) => setCrunchyOmeletteActive(event.target.checked)}
            />
            <span>Crunchy Omelette for future pet output</span>
          </label>
        </div>

        <p className="subtle-text">
          Antler conversion assumes other crafting materials are not limiting:
          {' '}
          Antlers/day x craft multiplier / {FISHING_NETS_PER_LARGE_NET.toLocaleString()} x craft multiplier.
          Current estimate from Antlers is {formatDecimal(plannerResult.dailyLargeNetsFromAntlers)} Large Nets/day.
        </p>
      </details>

      <section className="page-card page-stack" aria-labelledby="large-net-targets-title">
        <div>
          <h2 id="large-net-targets-title">Targets</h2>
          <p className="supporting-text">
            Current inventory comes from <Link to="/import-inventory">Import Inventory</Link>. Stored pet inventory and
            future pet rows come from <Link to="/settings">Settings</Link>.
          </p>
        </div>

        <div className="table-scroll">
          <table className="summary-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Target</th>
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
                      placeholder="Auto if known"
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
                  <th scope="col">Current</th>
                  <th scope="col">Stored pet</th>
                  <th scope="col">Pet/day</th>
                  <th scope="col">Remaining</th>
                  <th scope="col">LN/drop</th>
                  <th scope="col">LN needed now</th>
                  <th scope="col">Solo days</th>
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
                    <td>{formatCount(target.regularInventoryQuantity)}</td>
                    <td>
                      {formatCount(target.effectiveStoredPetInventoryQuantity)}
                      <br />
                      <span className="subtle-text">
                        {formatCount(target.storedPetInventoryQuantity)} raw
                      </span>
                    </td>
                    <td>{formatDecimal(target.dailyPetQuantity, 1)}</td>
                    <td>{formatCount(target.remainingAfterImmediateQuantity)}</td>
                    <td>
                      {target.largeNetsPerDrop > 0 ? formatDecimal(target.largeNetsPerDrop, 2) : 'Missing'}
                      <br />
                      <span className="subtle-text">
                        {target.largeNetsPerDropSource === 'drop_rate_reference'
                          ? target.largeNetsPerDropSourceLabel ?? 'Drop-rate reference'
                          : target.largeNetsPerDropSource === 'manual'
                            ? 'Manual'
                            : 'Needs input'}
                      </span>
                    </td>
                    <td>{formatEstimate(target.largeNetsNeededNow)}</td>
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
