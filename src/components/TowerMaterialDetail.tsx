import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ItemProfileLink } from './ItemProfileLink';
import { getItemIcon } from '../lib/itemIconManifest';
import { estimateTowerMaterial, type TowerEstimateSources } from '../lib/towerMaterialEstimates';
import type { TowerMaterial } from '../lib/towerMaterials';
import type { TowerRemainingRow } from '../lib/towerRemainingRows';

export function TowerMaterialDetail({ material, row, sources }: { material: TowerMaterial; row: TowerRemainingRow; sources: TowerEstimateSources }) {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const isOpen = Boolean(position);
  const estimate = useMemo(() => isOpen ? estimateTowerMaterial(row, material.canonicalKey, sources) : null,
    [isOpen, row, material.canonicalKey, sources]); // Calculate only when details are requested.
  const icon = getItemIcon(material.canonicalKey)?.src;
  function open(element: HTMLElement) {
    anchor.current = element;
    const rect = element.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 308)),
      ...(rect.bottom + 240 > window.innerHeight ? { bottom: window.innerHeight - rect.top } : { top: rect.bottom }) });
  }
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    const reposition = () => {
      const element = anchor.current;
      if (!element) return close();
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) close();
      else open(element);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', escape);
    return () => { window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', escape); };
  }, [position]);
  return <span className="tower-material-detail" onMouseEnter={(event) => open(event.currentTarget)}
    onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setPosition(null); }}
    onFocus={(event) => open(event.currentTarget)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPosition(null); }}>
    <ItemProfileLink {...material} iconSrc={icon ?? null} className={icon ? 'tower-material-icon-link' : undefined} describedBy={id} />
    <button className="tower-material-detail-button" aria-label={`${material.itemName} needed for ${row.itemName} T${row.towerLevel} ${row.masteryLevelNeeded}`}
      aria-describedby={id} aria-expanded={Boolean(position)} onClick={(event) => open(event.currentTarget)}>i</button>
    <span id={id} role="tooltip" hidden={!position} className={`tower-mastery-tooltip${position ? ' tower-mastery-tooltip--open' : ''}`} style={position ?? undefined}>
      <strong>{material.itemName}: {estimate?.quantity === null || !estimate ? 'Estimate unavailable' : `${Math.ceil(estimate.quantity).toLocaleString()} total needed`}</strong>
      <span className="tower-detail-line">{row.itemName} · T{row.towerLevel} {row.masteryLevelNeeded}{row.laterRequirement ? '*' : ''} · {row.remainingToRequirement.toLocaleString()} mastery remaining</span>
      <span className="tower-detail-line">{estimate?.note}</span>
      {row.laterRequirement ? <span className="tower-detail-line">* More needed later for {row.laterRequirement.tier} at T{row.laterRequirement.towerLevel}{row.laterRequirement.beyondCutoff ? ' (beyond this cutoff)' : ''}. These values cover {row.masteryLevelNeeded} only.</span> : null}
    </span>
  </span>;
}
