import { useState } from 'react';

import { CurrentInventoryImportPanel } from '../components/InventoryImportPanels';
import { PageIntro } from '../components/PageIntro';
import { loadAcquisitionPlannerInputState } from '../lib/acquisitionPlannerState';
import { useImportReferenceLookup } from '../lib/useImportReferenceLookup';

export function ImportInventoryPage() {
  const [acquisitionPlannerState, setAcquisitionPlannerState] = useState(() => loadAcquisitionPlannerInputState());
  const { localItemLookup } = useImportReferenceLookup();

  return (
    <div className="page-stack">
      <PageIntro
        title="Import Inventory"
        storageKey="import-inventory"
        description="Paste current inventory or maintain manual corrections for resource planning."
      />

      <CurrentInventoryImportPanel
        acquisitionPlannerState={acquisitionPlannerState}
        headingId="import-inventory-panel-title"
        localItemLookup={localItemLookup}
        onAcquisitionPlannerStateChange={setAcquisitionPlannerState}
      />
    </div>
  );
}
