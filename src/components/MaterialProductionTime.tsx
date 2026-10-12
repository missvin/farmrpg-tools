import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createDefaultTowerProductionRates, estimateTowerProductionHours, formatTowerProductionHours,
  getMaterialHourlyProductionRate, HOURLY_PRODUCTION_MATERIALS, loadTowerProductionRates,
} from '../lib/towerProductionRates';

function SavedProductionTime({ canonicalKey, quantity }: { canonicalKey: string; quantity: number | null }) {
  const [rates] = useState(() => {
    try { return loadTowerProductionRates(); }
    catch { return createDefaultTowerProductionRates(); }
  });
  const rate = getMaterialHourlyProductionRate(canonicalKey, rates);
  const hours = estimateTowerProductionHours(quantity, rate);
  return <small className="subtle-text" title={rate === null ? 'Hourly production rate unknown.' : `Production for this quantity at ${rate.toLocaleString()}/hour; material times are separate.`}>
    {' · '}{quantity === null ? 'Production time unavailable' : hours === null ? 'Production hours unknown' : `~${formatTowerProductionHours(hours)} production`}
    {' · '}<Link to="/tower?productionRates=edit#tower-production-rates">{rate === null ? 'Set rate' : 'Edit rate'}</Link>
  </small>;
}

export function MaterialProductionTime(props: { canonicalKey: string; quantity: number | null }) {
  return HOURLY_PRODUCTION_MATERIALS.includes(props.canonicalKey) ? <SavedProductionTime {...props} /> : null;
}
