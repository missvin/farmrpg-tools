import { useState } from 'react';

import { StoredPetInventoryImportPanel } from '../components/InventoryImportPanels';
import { PageIntro } from '../components/PageIntro';
import { loadAcquisitionPlannerInputState } from '../lib/acquisitionPlannerState';
import { useImportReferenceLookup } from '../lib/useImportReferenceLookup';

export function ImportPetItemsPage() {
  const [acquisitionPlannerState, setAcquisitionPlannerState] = useState(() => loadAcquisitionPlannerInputState());
  const { knownItemKeys } = useImportReferenceLookup();

  return (
    <div className="page-stack">
      <PageIntro
        title="Import Pet Items"
        storageKey="import-pet-items"
        description="Paste stored pet inventory or maintain manual pet-item counts for resource planning."
      />

      <StoredPetInventoryImportPanel
        acquisitionPlannerState={acquisitionPlannerState}
        headingId="import-pet-items-panel-title"
        knownItemKeys={knownItemKeys}
        onAcquisitionPlannerStateChange={setAcquisitionPlannerState}
      />
    </div>
  );
}
