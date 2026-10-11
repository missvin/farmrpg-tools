import { useMemo, useState } from 'react';
import type { TowerPumpkinJuiceHistory } from '../lib/deriveTowerPumpkinJuiceHistory';
import type { TowerProgressItem } from '../lib/deriveTowerProgress';
import { getItemIcon } from '../lib/itemIconManifest';
import { layoutPJTreemap, pjItemColor } from '../lib/pjTreemapLayout';

function itemDetails(item: TowerProgressItem): string {
  const pj = item.pumpkinJuiceEstimate.totalPumpkinJuices;
  return `${item.itemName} · ${pj === null ? 'Unknown PJ (needs baseline)' : `${pj.toLocaleString()} PJ`} · Target ${item.masteryLevelLabel} · Snapshot mastery ${item.matchedSnapshotRow ? item.currentMastery.toLocaleString() : 'missing'}`;
}

export function TowerPJContribution({ history }: { history: TowerPumpkinJuiceHistory }) {
  const [targetLevel, setTargetLevel] = useState<number | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [fixedScale, setFixedScale] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const series = history.series.find((candidate) => candidate.targetLevel === targetLevel)
    ?? history.series[history.series.length - 1];
  const point = series?.points.find((candidate) => candidate.snapshotId === snapshotId)
    ?? series?.points[series.points.length - 1];
  const baseline = Math.max(0, ...(series?.points.map((candidate) => candidate.totalPumpkinJuicesNeeded) ?? []));
  const partialHistory = series?.points.some((candidate) => candidate.isLowerBound) ?? false;
  const items = useMemo(() => [...(point?.items ?? [])].sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey)), [point]);
  const tiles = useMemo(() => layoutPJTreemap(items.map((item) => ({
    key: item.canonicalKey, value: item.pumpkinJuiceEstimate.totalPumpkinJuices ?? 0,
  })), fixedScale ? baseline : (point?.totalPumpkinJuicesNeeded ?? 0)), [items, fixedScale, baseline, point]);
  const itemsByKey = new Map(items.map((item) => [item.canonicalKey, item]));
  const activeItem = itemsByKey.get(activeKey ?? '');
  const activeIcon = activeItem ? getItemIcon(activeItem.canonicalKey) : null;
  const unknownItems = items.filter((item) => item.pumpkinJuiceEstimate.status === 'needs_baseline');

  if (!point || !series) return null;

  return (
    <section className="page-card page-stack" aria-labelledby="pj-contribution-title">
      <div>
        <h2 id="pj-contribution-title">PJ needed by item</h2>
        <p className="supporting-text">Tile area shows remaining PJ at each item&apos;s highest required tier.</p>
      </div>
      <div className="pj-contribution-controls">
        <div>
          <label className="field-label" htmlFor="pj-contribution-cutoff">Item chart Tower cutoff</label>
          <select id="pj-contribution-cutoff" className="text-input" value={series.targetLevel} onChange={(event) => setTargetLevel(Number(event.target.value))}>
            {history.targetLevels.map((level) => <option key={level} value={level}>T{level}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="pj-contribution-snapshot">Item chart snapshot</label>
          <select id="pj-contribution-snapshot" className="text-input" value={point.snapshotId} onChange={(event) => setSnapshotId(event.target.value)}>
            {[...series.points].reverse().map((candidate) => <option key={candidate.snapshotId} value={candidate.snapshotId}>{new Date(candidate.savedAt).toLocaleString()}</option>)}
          </select>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={fixedScale} onChange={(event) => setFixedScale(event.target.checked)} /> Fixed scale
        </label>
      </div>
      <p aria-live="polite"><strong>{point.isLowerBound ? 'At least ' : ''}{point.totalPumpkinJuicesNeeded.toLocaleString()} PJ</strong> · Through T{series.targetLevel} · {new Date(point.savedAt).toLocaleString()}</p>
      {unknownItems.length > 0 ? <p className="status-message" role="note">Incomplete total: {unknownItems.map((item) => item.itemName).join(', ')} need a mastery baseline. Their unknown PJ is outside the tile area.</p> : null}
      <p className="subtle-text">{fixedScale
        ? `Fixed area: ${baseline.toLocaleString()} PJ, the largest known total across saved snapshots for T${series.targetLevel}. Empty space is the difference from that baseline.${partialHistory ? ' History includes incomplete totals; empty space cannot be read as confirmed completion.' : ''}`
        : 'Proportional area: the selected snapshot fills the chart.'} Item colors and ordering stay consistent; tile positions can change with values.</p>
      {point.totalPumpkinJuicesNeeded === 0 ? <p className="empty-state">{point.isLowerBound ? 'No calculable PJ yet; missing baselines prevent a complete total.' : 'All included Tower mastery targets are complete.'}</p> : null}
      <div className="pj-treemap" role="group" aria-label="Remaining PJ contribution treemap">
        {tiles.map((tile) => {
          const item = itemsByKey.get(tile.key)!;
          const icon = getItemIcon(tile.key);
          return <button key={tile.key} type="button" className="pj-treemap__tile"
            style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.width}%`, height: `${tile.height}%`, backgroundColor: pjItemColor(tile.key) }}
            title={itemDetails(item)} aria-label={itemDetails(item)}
            onMouseEnter={() => setActiveKey(tile.key)} onFocus={() => setActiveKey(tile.key)} onClick={() => setActiveKey(tile.key)}>
            <span className="pj-treemap__content">
              {icon ? <img src={icon.src} alt="" className="pj-treemap__icon" /> : <span className="pj-treemap__icon" aria-hidden="true">◆</span>}
              <span className="pj-treemap__name">{item.itemName}</span>
              <span className="pj-treemap__count">{tile.value.toLocaleString()} PJ</span>
            </span>
          </button>;
        })}
      </div>
      <div className="pj-treemap__detail" role="status">
        {activeItem ? <>{activeIcon ? <img className="item-icon" src={activeIcon.src} alt="" /> : null}{itemDetails(activeItem)}</> : 'Hover, focus or tap a tile for item details. Tiny tiles are also available in the item list.'}
      </div>
      <details>
        <summary>All item contributions ({items.length})</summary>
        <ul className="pj-contribution-list">
          {items.map((item) => <li key={item.canonicalKey}>
            <button type="button" className="button button--secondary" onClick={() => setActiveKey(item.canonicalKey)}>{itemDetails(item)}</button>
          </li>)}
        </ul>
      </details>
    </section>
  );
}
