import { type ReactNode, useState } from 'react';

import {
  getCurrentInventoryItemInputs,
  getStoredPetInventoryItemInputs,
  removeCurrentInventoryItemInput,
  removeStoredPetInventoryItemInput,
  replaceCurrentInventoryEntries,
  replaceStoredPetInventoryEntries,
  saveAcquisitionPlannerInputState,
  upsertCurrentInventoryItemInput,
  upsertStoredPetInventoryItemInput,
  type AcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import {
  resolveLocalItemReference,
  type LocalItemReferenceLookup,
} from '../lib/localItemReferenceLookup';
import { parseCurrentInventoryPaste } from '../lib/parseCurrentInventoryPaste';
import { parseStoredPetInventoryPaste } from '../lib/parseStoredPetInventoryPaste';

type ImportPanelProps = {
  acquisitionPlannerState: AcquisitionPlannerInputState;
  onAcquisitionPlannerStateChange: (nextState: AcquisitionPlannerInputState) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
  headingId: string;
};

type CurrentInventoryImportPanelProps = ImportPanelProps & {
  localItemLookup: LocalItemReferenceLookup | null;
};

type StoredPetInventoryImportPanelProps = ImportPanelProps & {
  knownItemKeys: Set<string> | null;
};

type PanelFrameProps = {
  title: string;
  description: string;
  headingId: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CurrentInventoryImportPanel({
  acquisitionPlannerState,
  onAcquisitionPlannerStateChange,
  localItemLookup,
  collapsible = false,
  defaultOpen = true,
  headingId,
}: CurrentInventoryImportPanelProps) {
  const currentInventoryEntries = getCurrentInventoryItemInputs(acquisitionPlannerState);
  const [currentInventoryPaste, setCurrentInventoryPaste] = useState('');
  const [currentInventoryName, setCurrentInventoryName] = useState('');
  const [currentInventoryQuantity, setCurrentInventoryQuantity] = useState('');
  const [currentInventoryMessage, setCurrentInventoryMessage] = useState<string | null>(null);
  const [currentInventoryWarnings, setCurrentInventoryWarnings] = useState<string[]>([]);

  const handleCurrentInventoryImport = () => {
    const parsed = parseCurrentInventoryPaste(currentInventoryPaste, {
      resolveItem: localItemLookup
        ? (itemName) => {
            const result = resolveLocalItemReference(itemName, localItemLookup);

            return {
              canonicalItemKey: result.canonicalKey,
              itemName: result.displayName,
              recognized: result.recognized,
              warnings: result.recognized ? [] : result.warnings,
            };
          }
        : undefined,
    });

    if (parsed.entries.length === 0) {
      setCurrentInventoryMessage('No item quantities found. Paste rows that include an item name and quantity.');
      setCurrentInventoryWarnings(parsed.warnings);
      return;
    }

    const savedState = replaceCurrentInventoryEntries(acquisitionPlannerState, parsed.entries);
    saveAcquisitionPlannerInputState(savedState);
    onAcquisitionPlannerStateChange(savedState);
    setCurrentInventoryPaste('');
    setCurrentInventoryMessage(`Imported ${parsed.entries.length.toLocaleString()} current inventory entries.`);
    setCurrentInventoryWarnings(parsed.warnings);
  };

  const handleCurrentInventoryManualAdd = () => {
    const quantity = Number.parseInt(currentInventoryQuantity, 10);

    if (!currentInventoryName.trim() || !Number.isFinite(quantity) || quantity < 0) {
      setCurrentInventoryMessage('Enter an item name and a quantity of 0 or more.');
      setCurrentInventoryWarnings([]);
      return;
    }

    const resolved = localItemLookup ? resolveLocalItemReference(currentInventoryName, localItemLookup) : null;
    const savedState = upsertCurrentInventoryItemInput(acquisitionPlannerState, {
      itemName: resolved?.displayName ?? currentInventoryName.trim(),
      inventoryCount: quantity,
    });

    saveAcquisitionPlannerInputState(savedState);
    onAcquisitionPlannerStateChange(savedState);
    setCurrentInventoryName('');
    setCurrentInventoryQuantity('');
    setCurrentInventoryMessage(`Saved ${resolved?.displayName ?? currentInventoryName.trim()} current inventory.`);
    setCurrentInventoryWarnings([]);
  };

  return (
    <PanelFrame
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      description="Paste your Inventory page or add corrections manually. These counts are used as current stock for planning."
      headingId={headingId}
      title="Current Inventory"
    >
      <div className="page-stack page-stack--tight">
        <label className="field-label" htmlFor={`${headingId}-paste`}>
          Paste current inventory
        </label>
        <textarea
          className="text-input"
          id={`${headingId}-paste`}
          onChange={(event) => setCurrentInventoryPaste(event.target.value)}
          placeholder="Paste inventory rows here, such as:&#10;Large Net 12,345&#10;Frost Snapper Shell 5,614"
          rows={7}
          value={currentInventoryPaste}
        />
        <div className="button-row">
          <button className="button button--primary" onClick={handleCurrentInventoryImport} type="button">
            Import Current Inventory
          </button>
        </div>
      </div>

      <div className="two-column-grid">
        <label className="field-label" htmlFor={`${headingId}-name`}>
          Inventory item name
          <input
            className="text-input"
            id={`${headingId}-name`}
            onChange={(event) => setCurrentInventoryName(event.target.value)}
            placeholder="Frost Snapper Shell"
            type="text"
            value={currentInventoryName}
          />
        </label>
        <label className="field-label" htmlFor={`${headingId}-quantity`}>
          Inventory quantity
          <input
            className="text-input"
            id={`${headingId}-quantity`}
            min={0}
            onChange={(event) => setCurrentInventoryQuantity(event.target.value)}
            placeholder="5614"
            type="number"
            value={currentInventoryQuantity}
          />
        </label>
      </div>
      <div className="button-row">
        <button className="button" onClick={handleCurrentInventoryManualAdd} type="button">
          Save Inventory Item
        </button>
      </div>

      {currentInventoryMessage ? <p className="status-message status-message--success">{currentInventoryMessage}</p> : null}
      {currentInventoryWarnings.length > 0 ? (
        <ul className="warning-list">
          {currentInventoryWarnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {currentInventoryEntries.length > 0 ? (
        <div role="region" aria-label="Saved current inventory">
          <table className="summary-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Quantity</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {currentInventoryEntries.map((entry) => (
                <tr key={entry.itemName}>
                  <td>{entry.itemName}</td>
                  <td>{entry.inventoryCount.toLocaleString()}</td>
                  <td>
                    <button
                      className="button"
                      onClick={() => {
                        const savedState = removeCurrentInventoryItemInput(
                          acquisitionPlannerState,
                          entry.canonicalItemKey,
                        );
                        saveAcquisitionPlannerInputState(savedState);
                        onAcquisitionPlannerStateChange(savedState);
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">No current inventory saved yet.</p>
      )}
    </PanelFrame>
  );
}

export function StoredPetInventoryImportPanel({
  acquisitionPlannerState,
  onAcquisitionPlannerStateChange,
  knownItemKeys,
  collapsible = false,
  defaultOpen = true,
  headingId,
}: StoredPetInventoryImportPanelProps) {
  const storedPetInventoryEntries = getStoredPetInventoryItemInputs(acquisitionPlannerState);
  const [storedPetInventoryPaste, setStoredPetInventoryPaste] = useState('');
  const [storedPetInventoryName, setStoredPetInventoryName] = useState('');
  const [storedPetInventoryQuantity, setStoredPetInventoryQuantity] = useState('');
  const [storedPetInventoryMessage, setStoredPetInventoryMessage] = useState<string | null>(null);
  const [storedPetInventoryWarnings, setStoredPetInventoryWarnings] = useState<string[]>([]);

  const handleStoredPetInventoryImport = () => {
    const parsed = parseStoredPetInventoryPaste(storedPetInventoryPaste, {
      knownCanonicalKeys: knownItemKeys ?? undefined,
    });

    if (parsed.entries.length === 0) {
      setStoredPetInventoryMessage('No stored pet item quantities found. Paste rows from the Stored Pet Inventory page.');
      setStoredPetInventoryWarnings(parsed.warnings);
      return;
    }

    const savedState = replaceStoredPetInventoryEntries(acquisitionPlannerState, parsed.entries);
    saveAcquisitionPlannerInputState(savedState);
    onAcquisitionPlannerStateChange(savedState);
    setStoredPetInventoryPaste('');
    setStoredPetInventoryMessage(`Imported ${parsed.entries.length.toLocaleString()} stored pet inventory entries.`);
    setStoredPetInventoryWarnings(parsed.warnings);
  };

  const handleStoredPetInventoryManualAdd = () => {
    const quantity = Number.parseInt(storedPetInventoryQuantity, 10);

    if (!storedPetInventoryName.trim() || !Number.isFinite(quantity) || quantity < 0) {
      setStoredPetInventoryMessage('Enter an item name and a quantity of 0 or more.');
      setStoredPetInventoryWarnings([]);
      return;
    }

    const savedState = upsertStoredPetInventoryItemInput(acquisitionPlannerState, {
      itemName: storedPetInventoryName.trim(),
      storedCount: quantity,
    });

    saveAcquisitionPlannerInputState(savedState);
    onAcquisitionPlannerStateChange(savedState);
    setStoredPetInventoryName('');
    setStoredPetInventoryQuantity('');
    setStoredPetInventoryMessage(`Saved ${storedPetInventoryName.trim()} stored pet inventory.`);
    setStoredPetInventoryWarnings([]);
  };

  return (
    <PanelFrame
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      description="Paste Stored Pet Inventory output or add item counts manually. These counts reduce projected pet-resource gaps."
      headingId={headingId}
      title="Stored Pet Items"
    >
      <div className="page-stack page-stack--tight">
        <label className="field-label" htmlFor={`${headingId}-paste`}>
          Paste pet inventory
        </label>
        <textarea
          className="text-input"
          id={`${headingId}-paste`}
          onChange={(event) => setStoredPetInventoryPaste(event.target.value)}
          placeholder="Paste stored pet inventory rows here."
          rows={7}
          value={storedPetInventoryPaste}
        />
        <div className="button-row">
          <button className="button button--primary" onClick={handleStoredPetInventoryImport} type="button">
            Import Stored Pet Inventory
          </button>
        </div>
      </div>

      <div className="two-column-grid">
        <label className="field-label" htmlFor={`${headingId}-name`}>
          Pet item name
          <input
            className="text-input"
            id={`${headingId}-name`}
            onChange={(event) => setStoredPetInventoryName(event.target.value)}
            placeholder="Frost Snapper Shell"
            type="text"
            value={storedPetInventoryName}
          />
        </label>
        <label className="field-label" htmlFor={`${headingId}-quantity`}>
          Stored quantity
          <input
            className="text-input"
            id={`${headingId}-quantity`}
            min={0}
            onChange={(event) => setStoredPetInventoryQuantity(event.target.value)}
            placeholder="5614"
            type="number"
            value={storedPetInventoryQuantity}
          />
        </label>
      </div>
      <div className="button-row">
        <button className="button" onClick={handleStoredPetInventoryManualAdd} type="button">
          Save Stored Pet Item
        </button>
      </div>

      {storedPetInventoryMessage ? <p className="status-message status-message--success">{storedPetInventoryMessage}</p> : null}
      {storedPetInventoryWarnings.length > 0 ? (
        <ul className="warning-list">
          {storedPetInventoryWarnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {storedPetInventoryEntries.length > 0 ? (
        <div role="region" aria-label="Saved stored pet inventory">
          <table className="summary-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Quantity</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {storedPetInventoryEntries.map((entry) => (
                <tr key={entry.itemName}>
                  <td>{entry.itemName}</td>
                  <td>{entry.storedCount.toLocaleString()}</td>
                  <td>
                    <button
                      className="button"
                      onClick={() => {
                        const savedState = removeStoredPetInventoryItemInput(
                          acquisitionPlannerState,
                          entry.canonicalItemKey,
                        );
                        saveAcquisitionPlannerInputState(savedState);
                        onAcquisitionPlannerStateChange(savedState);
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">No stored pet inventory saved yet.</p>
      )}
    </PanelFrame>
  );
}

function PanelFrame({
  title,
  description,
  headingId,
  collapsible,
  defaultOpen,
  children,
}: PanelFrameProps) {
  if (collapsible) {
    return (
      <details className="page-card page-stack import-panel-details" open={defaultOpen}>
        <summary className="import-panel-summary">
          <span className="section-title" id={headingId}>
            {title}
          </span>
          <span className="supporting-text">{description}</span>
        </summary>
        {children}
      </details>
    );
  }

  return (
    <section className="page-card page-stack" aria-labelledby={headingId}>
      <div>
        <h2 id={headingId}>{title}</h2>
        <p className="supporting-text">{description}</p>
      </div>
      {children}
    </section>
  );
}
