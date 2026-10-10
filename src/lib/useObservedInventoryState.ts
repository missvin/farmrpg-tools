import { useEffect, useState } from 'react';
import { loadAcquisitionPlannerInputState, type AcquisitionPlannerInputState } from './acquisitionPlannerState';
import { usePlayerDataRevision } from './playerDataNotifications';

/** Refresh observed stock without resetting a page's draft inputs or assumptions. */
export function useObservedInventoryState(initial: () => AcquisitionPlannerInputState) {
  const [state, setState] = useState(initial);
  const revision = usePlayerDataRevision();
  useEffect(() => {
    if (revision === 0) return;
    try {
      const { inventory } = loadAcquisitionPlannerInputState();
      setState((current) => ({ ...current, inventory }));
    } catch { /* The receiver reports persistence errors; retain this view's good state. */ }
  }, [revision]);
  return [state, setState] as const;
}
