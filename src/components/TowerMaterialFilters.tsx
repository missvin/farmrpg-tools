import { useState } from 'react';
import { getItemIcon } from '../lib/itemIconManifest';
import { COMMON_TOWER_MATERIALS, TOWER_CROPS, TOWER_DYES, type TowerMaterial } from '../lib/towerMaterials';
import { toCanonicalItemKey } from '../lib/normalizeItemKey';

export function TowerMaterialFilters({ choices, selected, mode, onChange }: {
  choices: TowerMaterial[]; selected: string[]; mode: 'any' | 'all';
  onChange: (keys: string[], mode: 'any' | 'all') => void;
}) {
  const [search, setSearch] = useState('');
  const dyeKeys = TOWER_DYES.map(toCanonicalItemKey);
  const dyeCount = dyeKeys.filter((key) => selected.includes(key)).length;
  const cropKeys = TOWER_CROPS.map(toCanonicalItemKey);
  const cropCount = cropKeys.filter((key) => selected.includes(key)).length;
  const commonKeys = COMMON_TOWER_MATERIALS.map(toCanonicalItemKey);
  const other = choices.filter((choice) => !commonKeys.includes(choice.canonicalKey) && !dyeKeys.includes(choice.canonicalKey) && !cropKeys.includes(choice.canonicalKey));
  const results = other.filter((choice) => choice.itemName.toLowerCase().includes(search.trim().toLowerCase()));
  function option(material: TowerMaterial) {
    const icon = getItemIcon(material.canonicalKey)?.src;
    return <label className="tower-material-chip" key={material.canonicalKey}>
      <input type="checkbox" aria-label={`Filter by ${material.itemName}`} checked={selected.includes(material.canonicalKey)}
        onChange={(event) => onChange(event.target.checked ? [...selected, material.canonicalKey] : selected.filter((key) => key !== material.canonicalKey), mode)} />
      {icon ? <img className="item-icon" src={icon} alt="" /> : null}
      <span>{material.itemName}</span><span className="tower-chip-check" aria-hidden="true">✓</span>
    </label>;
  }
  return <fieldset className="tower-material-filters">
    <legend>Filter by material</legend>
    <div className="tower-material-options">
      {COMMON_TOWER_MATERIALS.map((itemName) => option({ itemName, canonicalKey: toCanonicalItemKey(itemName) }))}
      <label className="tower-material-chip" data-partial={dyeCount > 0 && dyeCount < dyeKeys.length || undefined}><input type="checkbox" aria-label="Dyes" checked={dyeCount === dyeKeys.length}
        ref={(input) => { if (input) input.indeterminate = dyeCount > 0 && dyeCount < dyeKeys.length; }}
        onChange={() => onChange(dyeCount === dyeKeys.length ? selected.filter((key) => !dyeKeys.includes(key)) : [...new Set([...selected, ...dyeKeys])], mode)} />
        <span className="tower-dye-stack" aria-hidden="true">{['Purple Dye', 'Red Dye', 'Yellow Dye'].map((name) => {
          const icon = getItemIcon(toCanonicalItemKey(name))?.src;
          return icon ? <img key={name} src={icon} alt="" /> : null;
        })}</span>
        <span>Dyes{dyeCount > 0 && dyeCount < dyeKeys.length ? ` · ${dyeCount}` : ''}</span>
        <span className="tower-chip-check" aria-hidden="true">{dyeCount > 0 && dyeCount < dyeKeys.length ? '−' : '✓'}</span>
      </label>
      <label className="tower-material-chip" data-partial={cropCount > 0 && cropCount < cropKeys.length || undefined}>
        <input type="checkbox" aria-label="Crops" checked={cropCount === cropKeys.length}
          ref={(input) => { if (input) input.indeterminate = cropCount > 0 && cropCount < cropKeys.length; }}
          onChange={() => onChange(cropCount === cropKeys.length ? selected.filter((key) => !cropKeys.includes(key)) : [...new Set([...selected, ...cropKeys])], mode)} />
        <span className="tower-dye-stack" aria-hidden="true">{['Corn', 'Cotton', 'Pine Tree'].map((name) => {
          const icon = getItemIcon(toCanonicalItemKey(name))?.src;
          return icon ? <img key={name} src={icon} alt="" /> : null;
        })}</span>
        <span>Crops{cropCount > 0 && cropCount < cropKeys.length ? ` · ${cropCount}` : ''}</span>
        <span className="tower-chip-check" aria-hidden="true">{cropCount > 0 && cropCount < cropKeys.length ? '−' : '✓'}</span>
      </label>
    </div>
    <div className="tower-material-actions">
      <span>Match</span><div className="tower-material-match" role="radiogroup" aria-label="Material matching">
        {(['any', 'all'] as const).map((value) => <label key={value}>
          <input type="radio" name="tower-material-match" checked={mode === value} onChange={() => onChange(selected, value)} />
          <span>{value === 'any' ? 'Any' : 'All'}</span>
        </label>)}
      </div>
      <button className="tower-view-link" onClick={() => { setSearch(''); onChange([], 'any'); }}>Clear</button>
      <span className="subtle-text">{selected.length ? `${selected.length} selected` : 'All requirements · common icons'}</span>
      <details><summary>Dye colors</summary><div className="tower-material-options">
        {TOWER_DYES.map((itemName) => option({ itemName, canonicalKey: toCanonicalItemKey(itemName) }))}
      </div><p className="subtle-text">All requires every checked color. Uncheck colors to narrow the dye group.</p></details>
      <details><summary>Individual crops</summary><div className="tower-material-options">
        {TOWER_CROPS.filter((itemName) => !commonKeys.includes(toCanonicalItemKey(itemName))).map((itemName) => option({ itemName, canonicalKey: toCanonicalItemKey(itemName) }))}
      </div><p className="subtle-text">Corn is also available above. All requires every checked crop; use Any to find requirements using any crop.</p></details>
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
