import { useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  getOwnedNowItemInputs,
  loadAcquisitionPlannerInputState,
  removeOwnedNowItemInput,
  saveAcquisitionPlannerInputState,
  upsertOwnedNowItemInput,
  type AcquisitionOwnedNowItemInput,
} from '../lib/acquisitionPlannerState';
import { resolveLocalItemReference } from '../lib/localItemReferenceLookup';
import { parseLocksmithStockpilePaste } from '../lib/parseLocksmithStockpilePaste';
import { useImportReferenceLookup } from '../lib/useImportReferenceLookup';

export function LocksmithImportPage() {
  const [acquisitionPlannerState, setAcquisitionPlannerState] = useState(() => loadAcquisitionPlannerInputState());
  const [pasteText, setPasteText] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualQuantity, setManualQuantity] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const { localItemLookup } = useImportReferenceLookup();
  const containerEntries = getOwnedNowItemInputs(acquisitionPlannerState, 'container');

  function saveState(nextEntries: AcquisitionOwnedNowItemInput[]): void {
    const savedState = saveAcquisitionPlannerInputState({
      ...acquisitionPlannerState,
      ownedNow: {
        entries: [
          ...acquisitionPlannerState.ownedNow.entries.filter((entry) => entry.sourceCategory !== 'container'),
          ...nextEntries,
        ],
      },
    });

    setAcquisitionPlannerState(savedState);
  }

  function handleImport(): void {
    const parsed = parseLocksmithStockpilePaste(pasteText, {
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
      setMessage('No openable item quantities found. Paste rows that include an item name and quantity.');
      setWarnings(parsed.warnings);
      return;
    }

    saveState(
      parsed.entries.map((entry) => ({
        ...entry,
        sourceCategory: 'container',
      })),
    );
    setPasteText('');
    setMessage(`Imported ${parsed.entries.length.toLocaleString()} Locksmith stockpile entries.`);
    setWarnings(parsed.warnings);
  }

  function handleManualSave(): void {
    const quantity = Number.parseInt(manualQuantity, 10);

    if (!manualItemName.trim() || !Number.isFinite(quantity) || quantity < 0) {
      setMessage('Enter an openable item name and a quantity of 0 or more.');
      setWarnings([]);
      return;
    }

    const resolved = localItemLookup ? resolveLocalItemReference(manualItemName, localItemLookup) : null;
    const savedState = upsertOwnedNowItemInput(acquisitionPlannerState, {
      itemName: resolved?.displayName ?? manualItemName.trim(),
      ownedCount: quantity,
      sourceCategory: 'container',
    });

    saveAcquisitionPlannerInputState(savedState);
    setAcquisitionPlannerState(savedState);
    setManualItemName('');
    setManualQuantity('');
    setMessage(`Saved ${resolved?.displayName ?? manualItemName.trim()} as an openable stockpile.`);
    setWarnings(resolved && !resolved.recognized ? resolved.warnings : []);
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Locksmith Import"
        storageKey="locksmith-import"
        description="Paste openable item counts so they can feed local resource planning."
      />

      <section className="page-card page-stack" aria-labelledby="locksmith-import-title">
        <div>
          <h2 id="locksmith-import-title">Openable Stockpiles</h2>
          <p className="supporting-text">
            Imported rows replace saved openable stockpiles and leave manual stockpile items untouched.
          </p>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="locksmith-import-paste">
            Paste Locksmith stockpiles
          </label>
          <textarea
            className="text-input"
            id="locksmith-import-paste"
            onChange={(event) => setPasteText(event.target.value)}
            placeholder="Paste rows like:&#10;Large Chest 12&#10;Small Chest, 4"
            rows={7}
            value={pasteText}
          />
          <div className="button-row">
            <button className="button button--primary" onClick={handleImport} type="button">
              Import Locksmith Stockpiles
            </button>
          </div>
        </div>

        <div className="two-column-grid">
          <label className="field-label" htmlFor="locksmith-manual-name">
            Openable item name
            <input
              className="text-input"
              id="locksmith-manual-name"
              onChange={(event) => setManualItemName(event.target.value)}
              placeholder="Large Chest"
              type="text"
              value={manualItemName}
            />
          </label>
          <label className="field-label" htmlFor="locksmith-manual-quantity">
            Quantity
            <input
              className="text-input"
              id="locksmith-manual-quantity"
              min={0}
              onChange={(event) => setManualQuantity(event.target.value)}
              placeholder="12"
              type="number"
              value={manualQuantity}
            />
          </label>
        </div>
        <div className="button-row">
          <button className="button" onClick={handleManualSave} type="button">
            Save Openable Item
          </button>
        </div>

        {message ? <p className="status-message status-message--success">{message}</p> : null}
        {warnings.length > 0 ? (
          <ul className="warning-list">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        ) : null}

        {containerEntries.length > 0 ? (
          <div role="region" aria-label="Saved openable stockpiles">
            <table className="summary-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {containerEntries.map((entry) => (
                  <tr key={entry.canonicalItemKey}>
                    <td>{entry.itemName}</td>
                    <td>{entry.ownedCount.toLocaleString()}</td>
                    <td>
                      <button
                        className="button"
                        onClick={() => {
                          const savedState = removeOwnedNowItemInput(
                            acquisitionPlannerState,
                            entry.canonicalItemKey,
                            'container',
                          );
                          saveAcquisitionPlannerInputState(savedState);
                          setAcquisitionPlannerState(savedState);
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
          <p className="empty-state">No openable stockpiles saved yet.</p>
        )}
      </section>
    </div>
  );
}
