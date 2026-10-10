import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { ItemProfileLink } from './ItemProfileLink';
import { getItemIcon } from '../lib/itemIconManifest';
import { sortTowerRemainingRows, type TowerRemainingRow, type TowerRemainingSort } from '../lib/towerRemainingRows';
import { Link, useSearchParams } from 'react-router-dom';
import { TowerMaterialDetail } from './TowerMaterialDetail';
import { loadCraftingModifierState } from '../lib/craftingModifierState';
import { loadDropRateAcquisitionSettings } from '../lib/dropRateAcquisitionSettings';
import { getCraftingModifierTotals } from '../lib/craftingMasteryEngine';
import { getCraftingPlanningPolicy } from '../lib/craftingPlanningPolicy';
import { TowerMaterialFilters } from './TowerMaterialFilters';
import { DEFAULT_TOWER_MATERIAL_KEYS, matchesTowerMaterials, towerMaterialChoices, towerMaterialKeys } from '../lib/towerMaterials';
import type { RecipeGraph } from '../lib/loadRecipeGraph';
import type { DropRateReferenceData } from '../lib/loadDropRateReference';
import { toCanonicalItemKey } from '../lib/normalizeItemKey';
import { TowerMaterialWatches } from './TowerMaterialWatches';
import { createDefaultTowerMaterialPreferences, loadTowerMaterialPreferences, saveTowerMaterialPreferences, type TowerMaterialPreferences } from '../lib/towerMaterialPreferences';
import { totalTowerMaterials } from '../lib/towerMaterialTotals';
import { createDefaultTowerProductionRates, estimateTowerProductionHours, formatTowerProductionHours, loadTowerProductionRates, saveTowerProductionRates } from '../lib/towerProductionRates';

const columns: Array<[TowerRemainingSort, string]> = [
  ['level', 'Level'], ['item', 'Item'], ['tier', 'Tier'], ['remaining', 'Remaining'], ['pj', 'PJ remaining'],
  ['materials', 'Key materials'],
];

function rowId(row: TowerRemainingRow): string {
  return `tower-remaining-${row.towerLevel}-${row.slotIndex}`;
}

export function TowerRemainingTable({ rows, targetItem, targetLevel, recipeGraph = null, dropRateReference = null }: {
  rows: TowerRemainingRow[];
  targetItem: string | null;
  targetLevel: number | null;
  recipeGraph?: RecipeGraph | null;
  dropRateReference?: DropRateReferenceData | null;
}) {
  const [params, setParams] = useSearchParams();
  const selected = useMemo(() => [...new Set(params.getAll('material').map(toCanonicalItemKey).filter(Boolean))], [params]);
  const mode = params.get('materialMatch') === 'all' ? 'all' : 'any';
  const choices = useMemo(() => towerMaterialChoices(recipeGraph), [recipeGraph]);
  const [modifierState] = useState(() => loadCraftingModifierState());
  const [fishingSettings] = useState(() => loadDropRateAcquisitionSettings());
  const [productionRates, setProductionRates] = useState(() => {
    try { return loadTowerProductionRates(); } catch { return createDefaultTowerProductionRates(); }
  });
  const [steelRateInput, setSteelRateInput] = useState(() => productionRates.steelPerHour?.toString() ?? '');
  const [wireRateInput, setWireRateInput] = useState(() => productionRates.steelWirePerHour?.toString() ?? '');
  const [rateMessage, setRateMessage] = useState('');
  function saveRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parse = (value: string) => value.trim() === '' ? null : Number(value);
    const steelPerHour = parse(steelRateInput);
    const steelWirePerHour = parse(wireRateInput);
    if ([steelPerHour, steelWirePerHour].some((rate) => rate !== null && (!Number.isFinite(rate) || rate <= 0))) {
      setRateMessage('Enter a positive hourly rate, or leave it blank when unknown.');
      return;
    }
    try {
      setProductionRates(saveTowerProductionRates({ schemaVersion: 1, steelPerHour, steelWirePerHour }));
      setRateMessage('Hourly rates saved.');
    } catch {
      setRateMessage('Unable to save rates in this browser.');
    }
  }
  const estimateSources = useMemo(() => ({ recipeGraph, dropRateReference, modifierState, fishingSettings }), [recipeGraph, dropRateReference, modifierState, fishingSettings]);
  const modifierTotals = getCraftingModifierTotals(modifierState);
  const recipePolicy = useMemo(() => getCraftingPlanningPolicy(modifierState), [modifierState]);
  const relationships = useMemo(() => new Map(rows.map((row) => [row.canonicalKey,
    towerMaterialKeys(row.canonicalKey, recipeGraph, dropRateReference, recipePolicy)])), [rows, recipeGraph, dropRateReference, recipePolicy]);
  function updateMaterials(keys: string[], match: 'any' | 'all') {
    const next = new URLSearchParams(params);
    next.delete('material'); next.delete('materialMatch');
    keys.forEach((key) => next.append('material', key));
    if (match === 'all') next.set('materialMatch', match);
    setParams(next);
  }
  const [initialPreferences] = useState(() => {
    try { return { state: loadTowerMaterialPreferences(), message: '' }; }
    catch { return { state: createDefaultTowerMaterialPreferences(), message: 'Saved material preferences could not be loaded. Defaults are shown.' }; }
  });
  const [preferences, setPreferences] = useState(initialPreferences.state);
  const [preferenceMessage, setPreferenceMessage] = useState(initialPreferences.message);
  function updatePreferences(next: TowerMaterialPreferences) {
    setPreferences(next);
    try { saveTowerMaterialPreferences(next); setPreferenceMessage(''); }
    catch { setPreferenceMessage('Material preferences could not be saved. These choices apply to this visit only.'); }
  }
  function updateWatch(item: string, material: string, checked: boolean) {
    const watched = preferences.watches[item] ?? [];
    const next = checked ? [...new Set([...watched, material])] : watched.filter((key) => key !== material);
    updatePreferences({ ...preferences, watches: { ...preferences.watches, [item]: next } });
  }
  const displayedMaterials = (key: string) => choices.filter((material) =>
    [...(selected.length ? selected : DEFAULT_TOWER_MATERIAL_KEYS), ...(preferences.watches[key] ?? [])].includes(material.canonicalKey)
      && relationships.get(key)?.has(material.canonicalKey));
  const [incompleteOnly, setIncompleteOnly] = useState(true);
  const [materialsOpen, setMaterialsOpen] = useState(true);
  const showMaterialAmounts = preferences.showInlineAmounts;
  const [sort, setSort] = useState<TowerRemainingSort>('level');
  const [descending, setDescending] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState<{ id: string; left: number; top?: number; bottom?: number } | null>(null);
  function showDetail(id: string, button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    setExpandedDetail({ id, left: Math.max(8, Math.min(rect.left, window.innerWidth - 308)),
      ...(rect.bottom + 200 > window.innerHeight ? { bottom: window.innerHeight - rect.top } : { top: rect.bottom - 1 }) });
  }
  useEffect(() => {
    if (!expandedDetail) return;
    const close = () => setExpandedDetail(null);
    const reposition = () => {
      const active = document.activeElement;
      if (active instanceof HTMLButtonElement && active.getAttribute('aria-describedby') === `${expandedDetail.id}-detail`) {
        showDetail(expandedDetail.id, active);
      } else close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', escape);
    };
  }, [expandedDetail]);
  const target = rows.find((row) => row.canonicalKey === targetItem
    && (targetLevel === null || row.towerLevel === targetLevel));
  // Explicit item links may reveal an achieved row without changing the normal default.
  const matchingRows = useMemo(() => rows.filter((row) => (!incompleteOnly || !row.achieved || row === target)
    && matchesTowerMaterials(relationships.get(row.canonicalKey) ?? new Set(), selected, mode)),
  [rows, incompleteOnly, target, relationships, selected, mode]);
  const visibleRows = sortTowerRemainingRows(
    matchingRows
      .map((row) => ({ ...row, materialNames: displayedMaterials(row.canonicalKey).map((material) => material.itemName) })), sort, descending,
  );
  const totals = useMemo(() => showMaterialAmounts && selected.length ? totalTowerMaterials(matchingRows, selected.map((key) =>
    choices.find((choice) => choice.canonicalKey === key) ?? { canonicalKey: key, itemName: key }), estimateSources) : [],
  [showMaterialAmounts, matchingRows, selected, choices, estimateSources]);
  const nextLevel = Math.min(...rows.filter((row) => !row.achieved).map((row) => row.towerLevel));

  useEffect(() => {
    if (!target) return;
    const timer = window.setTimeout(() => document.getElementById(rowId(target))
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    return () => window.clearTimeout(timer);
  }, [target]);

  return (
    <section className="tower-remaining" aria-labelledby="tower-remaining-title">
      <div className="section-heading-row">
        <h2 id="tower-remaining-title">Remaining Tower Items</h2>
        <label className="checkbox-label">
          <input type="checkbox" checked={incompleteOnly} onChange={(event) => setIncompleteOnly(event.target.checked)} />
          Incomplete only
        </label>
      </div>
      <details className="tower-material-panel" open={materialsOpen} onToggle={(event) => setMaterialsOpen(event.currentTarget.open)}>
        <summary>Materials <span className="subtle-text">· {selected.length ? `${selected.length} selected · ${mode === 'all' ? 'All' : 'Any'}` : 'All requirements'}</span></summary>
        <label className="checkbox-label tower-material-amount-toggle">
          <input type="checkbox" checked={showMaterialAmounts} onChange={(event) => updatePreferences({ ...preferences, showInlineAmounts: event.target.checked })} />
          Show material amounts inline
        </label>
        <TowerMaterialFilters choices={choices} selected={selected} mode={mode} onChange={updateMaterials} />
      </details>
      {preferenceMessage ? <p className="subtle-text" role="status">{preferenceMessage}</p> : null}
      <details className="tower-estimate-assumptions"><summary>Assumptions · Resource Saver {(modifierTotals.totalResourceSaverPercent * 100).toLocaleString()}% · Mastery bonus {(modifierTotals.totalMasteryBonusPercent * 100).toLocaleString()}%</summary>
        <p className="subtle-text">Total needed from current mastery to each row’s target. Inventory is not subtracted. Rows are independent estimates. Selected-material totals below use the highest visible target per item.</p>
        <form onSubmit={saveRates} className="page-stack page-stack--tight">
          <p className="subtle-text">Steel and Steel Wire are separate Steelworks outputs. Enter your effective production of each per hour; their time estimates are separate and should not be added.</p>
          <div className="summary-grid">
            <label className="field-label">Steel per hour
              <input className="text-input" type="number" min="0" step="any" value={steelRateInput} onChange={(event) => setSteelRateInput(event.target.value)} placeholder="Unknown" />
            </label>
            <label className="field-label">Steel Wire per hour
              <input className="text-input" type="number" min="0" step="any" value={wireRateInput} onChange={(event) => setWireRateInput(event.target.value)} placeholder="Unknown" />
            </label>
          </div>
          <div className="button-row"><button type="submit" className="button button--primary">Save production rates</button></div>
          {rateMessage ? <p role="status" className="subtle-text">{rateMessage}</p> : null}
        </form>
        <p className="subtle-text">Iron Depot {modifierState.planning.ironDepotActive ? 'on' : 'off'} · Excluded recipes {modifierState.planning.includeExcludedRecipes ? 'included' : 'excluded'} · <Link to="/ingredient-demand#ingredient-demand-controls-title">Edit crafting assumptions</Link></p>
        <p className="subtle-text">Fishing Trawl {fishingSettings.perks.fishingTrawlActive ? 'on' : 'off'} · Reinforced Netting {fishingSettings.perks.reinforcedNettingActive ? 'on' : 'off'} · Sea Pincher {fishingSettings.meals.seaPincherSpecialActive ? `${fishingSettings.meals.seaPincherSpecialPercent}%` : 'off'} · <Link to="/settings#settings-drop-rate-title">Fishing settings</Link></p>
      </details>
      {!recipeGraph || !dropRateReference ? <p className="subtle-text">Some material references are unavailable; matches may be incomplete.</p> : null}
      {selected.some((key) => !choices.some((choice) => choice.canonicalKey === key)) ? <p className="subtle-text">A selected material is not in the available reference. Clear filters to see all requirements.</p> : null}
      <p className="subtle-text" aria-live="polite">
        {visibleRows.length.toLocaleString()} requirements shown
        {Number.isFinite(nextLevel) ? ` · Next: T${nextLevel}` : ' · All requirements complete'}
        {incompleteOnly && target?.achieved ? ' · Linked completed requirement included' : ''}
      </p>
      {visibleRows.length ? (
        <div className="table-scroll" role="region" aria-label="Tower requirements table" tabIndex={0}>
          <table className="summary-table tower-remaining-table">
            <thead><tr>{columns.map(([key, label]) => (
              <th key={key} scope="col" aria-sort={sort === key ? descending ? 'descending' : 'ascending' : undefined}>
                <button className="tower-sort" onClick={() => {
                  setDescending(sort === key ? !descending : false);
                  setSort(key);
                }}>{label}{sort === key ? <span aria-hidden="true"> {descending ? '↓' : '↑'}</span> : null}</button>
              </th>
            ))}</tr></thead>
            <tbody>{visibleRows.map((row) => {
              const id = rowId(row);
              const detail = `${row.itemName}: Current ${row.currentMastery.toLocaleString()} · Target ${row.requiredThreshold.toLocaleString()} · Remaining ${row.remainingToRequirement.toLocaleString()} · Complete ${row.progressPercent.toFixed(1)}%${row.laterRequirement ? ` · * More needed later for ${row.laterRequirement.tier} at T${row.laterRequirement.towerLevel}${row.laterRequirement.beyondCutoff ? ' (beyond this cutoff)' : ''}. Mastery, PJ, and materials here cover GM only.` : ''}`;
              return (
                <tr key={id} id={id} className={target && id === rowId(target) ? 'tower-remaining-row--target' : row.towerLevel === nextLevel ? 'tower-remaining-row--next' : undefined}>
                  <td>{row.towerLevel}</td>
                  <td><ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} iconSrc={getItemIcon(row.canonicalKey)?.src ?? null} />
                    {!row.matchedSnapshotRow ? <span className="subtle-text tower-remaining-warning">Not in latest import</span> : null}
                  </td>
                  <td>{row.laterRequirement ? <button className="tower-sort" aria-label={`${row.itemName} T${row.towerLevel} later requirement`} aria-describedby={`${id}-detail`}
                    onMouseEnter={(event) => showDetail(id, event.currentTarget)} onFocus={(event) => showDetail(id, event.currentTarget)}
                    onBlur={() => setExpandedDetail(null)} onMouseLeave={() => setExpandedDetail(null)} onClick={(event) => showDetail(id, event.currentTarget)}>{row.masteryLevelNeeded}*</button> : row.masteryLevelNeeded}</td>
                  <td className={`tower-percent-cell tower-remaining-cell${row.achieved ? ' tower-percent-cell--complete' : ''}`}
                    onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setExpandedDetail(null); }}
                    style={{ '--tower-percent-fill': `${row.progressPercent}%` } as CSSProperties}>
                    <button className="tower-remaining-value" aria-label={`${row.itemName} T${row.towerLevel} ${row.masteryLevelNeeded} mastery details`}
                      aria-describedby={`${id}-detail`}
                      onMouseEnter={(event) => showDetail(id, event.currentTarget)}
                      onFocus={(event) => showDetail(id, event.currentTarget)}
                      onBlur={() => setExpandedDetail(null)}
                      onClick={(event) => showDetail(id, event.currentTarget)}>
                      {row.remainingToRequirement.toLocaleString()}
                    </button>
                    <span id={`${id}-detail`} role="tooltip" hidden={expandedDetail?.id !== id} className={`tower-mastery-tooltip${expandedDetail?.id === id ? ' tower-mastery-tooltip--open' : ''}`}
                      style={expandedDetail?.id === id ? { left: expandedDetail.left, top: expandedDetail.top, bottom: expandedDetail.bottom } : undefined}>{detail}</span>
                  </td>
                  <td className="tower-remaining-number">{row.pumpkinJuices === null ? <span className="subtle-text">Needs baseline</span> : row.pumpkinJuices.toLocaleString()}</td>
                  <td><div className="tower-material-icons">{displayedMaterials(row.canonicalKey).map((material) =>
                    <TowerMaterialDetail key={material.canonicalKey} material={material} row={row} sources={estimateSources} productionRates={productionRates} showInlineAmount={showMaterialAmounts} />
                  )}{!row.materialNames?.length ? <span className="subtle-text">—</span> : null}</div>
                    <TowerMaterialWatches row={row} materials={choices.filter((material) => relationships.get(row.canonicalKey)?.has(material.canonicalKey))}
                      watched={preferences.watches[row.canonicalKey] ?? []} graph={recipeGraph} sources={estimateSources}
                      productionRates={productionRates} showInlineAmounts={showMaterialAmounts}
                      onChange={(key, checked) => updateWatch(row.canonicalKey, key, checked)} />
                  </td>
                </tr>
              );
            })}</tbody>
            {totals.length ? <tfoot><tr className="tower-material-totals">
              <th scope="row" colSpan={5}>Selected material totals
                <span className="subtle-text tower-detail-line">Shown requirements · highest target per item</span>
              </th>
              <td><div className="tower-total-list">{totals.map((total) => {
                const rate = total.canonicalKey === 'steel' ? productionRates.steelPerHour : productionRates.steelWirePerHour;
                const showTime = total.canonicalKey === 'steel' || total.canonicalKey === 'steel wire';
                const hours = estimateTowerProductionHours(total.quantity, rate);
                const partial = total.unavailableItems.length > 0;
                return <div key={total.canonicalKey}>
                  <ItemProfileLink canonicalKey={total.canonicalKey} itemName={total.itemName} iconSrc={getItemIcon(total.canonicalKey)?.src ?? null} />
                  <span className="tower-material-quantity"> · {total.quantity === null ? 'Unavailable' : Math.ceil(total.quantity).toLocaleString()}
                    {partial && total.quantity !== null ? ' (partial)' : ''}
                    {showTime && total.quantity !== null ? ' · ' + (hours === null ? 'hours unknown' : (partial ? 'at least ' : '') + formatTowerProductionHours(hours)) : ''}
                  </span>
                  {partial ? <details className="tower-total-warning"><summary>{total.unavailableItems.length} items unavailable</summary>
                    <span className="subtle-text">Estimate unavailable for: {total.unavailableItems.join(', ')}.</span>
                  </details> : null}
                </div>;
              })}</div></td>
            </tr></tfoot> : null}
          </table>
        </div>
      ) : <p className="empty-state">{selected.length ? 'No requirements match these materials. Change your selections or Clear filters.' : 'All Tower requirements in this range are complete. Uncheck Incomplete only to see them.'}</p>}
    </section>
  );
}
