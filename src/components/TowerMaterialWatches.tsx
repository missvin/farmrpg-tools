import { useState } from 'react';
import type { RecipeGraph } from '../lib/loadRecipeGraph';
import type { TowerMaterial } from '../lib/towerMaterials';
import type { TowerRemainingRow } from '../lib/towerRemainingRows';
import type { TowerEstimateSources } from '../lib/towerMaterialEstimates';
import type { TowerProductionRates } from '../lib/towerProductionRates';
import { TowerMaterialDetail } from './TowerMaterialDetail';

export function TowerMaterialWatches({ row, materials, watched, graph, sources, productionRates, showInlineAmounts, onChange }: {
  row: TowerRemainingRow; materials: TowerMaterial[]; watched: string[]; graph: RecipeGraph | null;
  sources: TowerEstimateSources; productionRates: TowerProductionRates; showInlineAmounts: boolean;
  onChange: (key: string, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deeperOpen, setDeeperOpen] = useState(false);
  const directKeys = new Set(graph?.byOutputCanonicalKey[row.canonicalKey]?.inputs.map((input) => input.canonicalKey) ?? []);
  if (!directKeys.size) {
    for (const key of ['large net', 'fishing net', row.canonicalKey]) directKeys.add(key);
  }
  const direct = materials.filter((material) => directKeys.has(material.canonicalKey));
  const deeper = materials.filter((material) => !directKeys.has(material.canonicalKey));
  const unavailableWatches = watched.filter((key) => !materials.some((material) => material.canonicalKey === key));
  const options = (items: TowerMaterial[]) => <div className="tower-watch-options">{items.map((material) =>
    <div className="tower-watch-option" key={material.canonicalKey}>
      <label className="checkbox-label">
        <input type="checkbox" checked={watched.includes(material.canonicalKey)}
          aria-label={'Watch ' + material.itemName + ' for ' + row.itemName + ' T' + row.towerLevel}
          onChange={(event) => onChange(material.canonicalKey, event.target.checked)} />
        <span>{material.itemName}</span>
      </label>
      <TowerMaterialDetail material={material} row={row} sources={sources} productionRates={productionRates} showInlineAmount={showInlineAmounts} />
    </div>)}</div>;
  return <details className="tower-material-watches" onToggle={(event) => {
    if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
  }}>
    <summary aria-label={'Materials to watch for ' + row.itemName + ' T' + row.towerLevel}>Materials to watch{watched.length ? ' · ' + watched.length : ''}</summary>
    {open ? <div className="tower-watch-content">
      {direct.length ? options(direct) : null}
      {deeper.length ? <details onToggle={(event) => {
        if (event.target === event.currentTarget) setDeeperOpen(event.currentTarget.open);
      }}>
        <summary>Show deeper ingredients · {deeper.length}</summary>
        {deeperOpen ? options(deeper) : null}
      </details> : null}
      {!materials.length ? <p className="subtle-text">No supported ingredients available for this item.</p> : null}
      {unavailableWatches.map((key) => <label className="checkbox-label" key={key}>
        <input type="checkbox" checked aria-label={'Watch ' + key + ' for ' + row.itemName + ' T' + row.towerLevel}
          onChange={() => onChange(key, false)} />{key} · unavailable under current references or recipe policy
      </label>)}
    </div> : null}
  </details>;
}
