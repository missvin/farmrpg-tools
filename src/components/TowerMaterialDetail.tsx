import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ItemProfileLink } from './ItemProfileLink';
import { getItemIcon } from '../lib/itemIconManifest';
import { estimateTowerMaterial, type TowerEstimateSources } from '../lib/towerMaterialEstimates';
import type { TowerMaterial } from '../lib/towerMaterials';
import type { TowerRemainingRow } from '../lib/towerRemainingRows';

export function TowerMaterialDetail({ material, row, sources, showInlineAmount = false }: {
  material: TowerMaterial; row: TowerRemainingRow; sources: TowerEstimateSources; showInlineAmount?: boolean;
}) {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const isOpen = Boolean(position);
  const estimate = useMemo(() => isOpen || showInlineAmount ? estimateTowerMaterial(row, material.canonicalKey, sources) : null,
    [isOpen, showInlineAmount, row, material.canonicalKey, sources]); // Calculate only when details or inline amounts are requested.
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
    {showInlineAmount ? <span className="tower-material-quantity">
      <span className="sr-only">{material.itemName} remaining for this {row.masteryLevelNeeded}: </span>
      {estimate?.quantity === null || !estimate ? 'Unavailable' : Math.ceil(estimate.quantity).toLocaleString()}
    </span> : null}
    <span id={id} role="tooltip" hidden={!position} className={`tower-mastery-tooltip tower-material-tooltip${position ? ' tower-mastery-tooltip--open' : ''}`} style={position ?? undefined}>
      <strong>{material.itemName}: {estimate?.quantity === null || !estimate ? 'Estimate unavailable' : `${Math.ceil(estimate.quantity).toLocaleString()} remaining for this ${row.masteryLevelNeeded}`}</strong>
      {estimate?.quantity === null ? <span className="tower-detail-line">{estimate.note}</span> : null}
    </span>
  </span>;
}
