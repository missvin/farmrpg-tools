import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ItemProfileLink } from './ItemProfileLink';
import { getItemIcon } from '../lib/itemIconManifest';
import { sortTowerRemainingRows, type TowerRemainingRow, type TowerRemainingSort } from '../lib/towerRemainingRows';

const columns: Array<[TowerRemainingSort, string]> = [
  ['level', 'Level'], ['item', 'Item'], ['tier', 'Tier'], ['remaining', 'Remaining'], ['pj', 'PJ remaining'],
];

function rowId(row: TowerRemainingRow): string {
  return `tower-remaining-${row.towerLevel}-${row.slotIndex}`;
}

export function TowerRemainingTable({ rows, targetItem, targetLevel }: {
  rows: TowerRemainingRow[];
  targetItem: string | null;
  targetLevel: number | null;
}) {
  const [incompleteOnly, setIncompleteOnly] = useState(true);
  const [sort, setSort] = useState<TowerRemainingSort>('level');
  const [descending, setDescending] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState<{ id: string; left: number; top: number } | null>(null);
  function showDetail(id: string, button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    setExpandedDetail({ id, left: Math.max(8, Math.min(rect.left, window.innerWidth - 308)),
      top: rect.bottom + 110 > window.innerHeight ? Math.max(8, rect.top - 110) : rect.bottom - 1 });
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
  const visibleRows = useMemo(() => sortTowerRemainingRows(
    rows.filter((row) => !incompleteOnly || !row.achieved || row === target), sort, descending,
  ), [rows, incompleteOnly, sort, descending, target]);
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
              const detail = `${row.itemName}: Current ${row.currentMastery.toLocaleString()} · Target ${row.requiredThreshold.toLocaleString()} · Remaining ${row.remainingToRequirement.toLocaleString()} · Complete ${row.progressPercent.toFixed(1)}%`;
              return (
                <tr key={id} id={id} className={row === target ? 'tower-remaining-row--target' : row.towerLevel === nextLevel ? 'tower-remaining-row--next' : undefined}>
                  <td>{row.towerLevel}</td>
                  <td><ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} iconSrc={getItemIcon(row.canonicalKey)?.src ?? null} />
                    {!row.matchedSnapshotRow ? <span className="subtle-text tower-remaining-warning">Not in latest import</span> : null}
                  </td>
                  <td>{row.masteryLevelNeeded}</td>
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
                      style={expandedDetail?.id === id ? { left: expandedDetail.left, top: expandedDetail.top } : undefined}>{detail}</span>
                  </td>
                  <td className="tower-remaining-number">{row.pumpkinJuices === null ? <span className="subtle-text">Needs baseline</span> : row.pumpkinJuices.toLocaleString()}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <p className="empty-state">All Tower requirements in this range are complete. Uncheck Incomplete only to see them.</p>}
    </section>
  );
}
