import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
  const selected = [...new Set(params.getAll('material').map(toCanonicalItemKey).filter(Boolean))];
  const mode = params.get('materialMatch') === 'all' ? 'all' : 'any';
  const choices = useMemo(() => towerMaterialChoices(recipeGraph), [recipeGraph]);
  const [modifierState] = useState(() => loadCraftingModifierState());
  const [fishingSettings] = useState(() => loadDropRateAcquisitionSettings());
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
  const displayedMaterials = (key: string) => choices.filter((material) =>
    (selected.length ? selected : DEFAULT_TOWER_MATERIAL_KEYS).includes(material.canonicalKey)
      && relationships.get(key)?.has(material.canonicalKey));
  const [incompleteOnly, setIncompleteOnly] = useState(true);
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
  const visibleRows = sortTowerRemainingRows(
    rows.filter((row) => (!incompleteOnly || !row.achieved || row === target)
      && matchesTowerMaterials(relationships.get(row.canonicalKey) ?? new Set(), selected, mode))
      .map((row) => ({ ...row, materialNames: displayedMaterials(row.canonicalKey).map((material) => material.itemName) })), sort, descending,
  );
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
      <TowerMaterialFilters choices={choices} selected={selected} mode={mode} onChange={updateMaterials} />
      <details className="tower-estimate-assumptions"><summary>Assumptions · Resource Saver {(modifierTotals.totalResourceSaverPercent * 100).toLocaleString()}% · Mastery bonus {(modifierTotals.totalMasteryBonusPercent * 100).toLocaleString()}%</summary>
        <p className="subtle-text">Total needed from current mastery to each row’s target. Inventory is not subtracted. Rows are independent estimates; do not add them together.</p>
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
                    <TowerMaterialDetail key={material.canonicalKey} material={material} row={row} sources={estimateSources} />
                  )}{!row.materialNames?.length ? <span className="subtle-text">—</span> : null}</div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <p className="empty-state">{selected.length ? 'No requirements match these materials. Change your selections or Clear filters.' : 'All Tower requirements in this range are complete. Uncheck Incomplete only to see them.'}</p>}
    </section>
  );
}
