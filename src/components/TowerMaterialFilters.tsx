import { useState } from 'react';
import { ItemProfileLink } from './ItemProfileLink';
import { getItemIcon } from '../lib/itemIconManifest';
import { COMMON_TOWER_MATERIALS, TOWER_DYES, type TowerMaterial } from '../lib/towerMaterials';
import { toCanonicalItemKey } from '../lib/normalizeItemKey';

export function TowerMaterialFilters({ choices, selected, mode, onChange }: {
  choices: TowerMaterial[]; selected: string[]; mode: 'any' | 'all';
  onChange: (keys: string[], mode: 'any' | 'all') => void;
}) {
  const [search, setSearch] = useState('');
  const dyeKeys = TOWER_DYES.map(toCanonicalItemKey);
  const dyeCount = dyeKeys.filter((key) => selected.includes(key)).length;
  const commonKeys = COMMON_TOWER_MATERIALS.map(toCanonicalItemKey);
  const other = choices.filter((choice) => !commonKeys.includes(choice.canonicalKey) && !dyeKeys.includes(choice.canonicalKey));
  const results = other.filter((choice) => choice.itemName.toLowerCase().includes(search.trim().toLowerCase()));
  function option(material: TowerMaterial) {
    return <span className="tower-material-option" key={material.canonicalKey}>
      <input type="checkbox" aria-label={`Filter by ${material.itemName}`} checked={selected.includes(material.canonicalKey)}
        onChange={(event) => onChange(event.target.checked ? [...selected, material.canonicalKey] : selected.filter((key) => key !== material.canonicalKey), mode)} />
      <ItemProfileLink {...material} iconSrc={getItemIcon(material.canonicalKey)?.src ?? null} />
    </span>;
  }
  return <fieldset className="tower-material-filters">
    <legend>Materials</legend>
    <div className="tower-material-options">
      {COMMON_TOWER_MATERIALS.map((itemName) => option({ itemName, canonicalKey: toCanonicalItemKey(itemName) }))}
      <label className="checkbox-label"><input type="checkbox" checked={dyeCount === dyeKeys.length}
        ref={(input) => { if (input) input.indeterminate = dyeCount > 0 && dyeCount < dyeKeys.length; }}
        onChange={() => onChange(dyeCount === dyeKeys.length ? selected.filter((key) => !dyeKeys.includes(key)) : [...new Set([...selected, ...dyeKeys])], mode)} />Dyes</label>
    </div>
    <div className="tower-material-actions">
      <label>Match <select aria-label="Material matching" value={mode} onChange={(event) => onChange(selected, event.target.value as 'any' | 'all')}>
        <option value="any">Any</option><option value="all">All</option>
      </select></label>
      <button className="tower-view-link" onClick={() => { setSearch(''); onChange([], 'any'); }}>Clear</button>
      <span className="subtle-text">{selected.length ? `${selected.length} selected` : 'All requirements · common icons'}</span>
      <details><summary>Dye colors</summary><div className="tower-material-options">
        {TOWER_DYES.map((itemName) => option({ itemName, canonicalKey: toCanonicalItemKey(itemName) }))}
      </div><p className="subtle-text">All requires every checked color. Uncheck colors to narrow the dye group.</p></details>
      <details><summary>Other materials{selected.some((key) => other.some((item) => item.canonicalKey === key)) ? ' (selected)' : ''}</summary>
        <label>Search materials <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="tower-material-options tower-material-search-results">
          {(search.trim() ? results : other.filter((choice) => selected.includes(choice.canonicalKey))).map(option)}
        </div>
        <p className="subtle-text">{search.trim() ? `${results.length} materials found` : 'Search recipe ingredients and fishing nets.'}</p>
      </details>
    </div>
  </fieldset>;
}
