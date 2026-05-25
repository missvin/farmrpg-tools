import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  deriveMuseumCompletionFromPersonalExport,
  type MuseumCompletionManualProgress,
} from '../lib/museumCompletion';
import {
  clearMuseumCompletionState,
  loadMuseumCompletionState,
  saveMuseumCompletionState,
  type MuseumCompletionManualMissingEntry,
} from '../lib/museumCompletionState';
import { getItemIcon } from '../lib/itemIconManifest';
import { loadMuseumCompletionCanon, type MuseumCompletionCanonData } from '../lib/loadMuseumCompletionCanon';
import {
  loadMuseumReviewedMissingItems,
  type MuseumReviewedMissingItem,
} from '../lib/loadMuseumReviewedMissingItems';
import { toCanonicalItemKey } from '../lib/normalizeItemKey';

const PERSONAL_MUSEUM_PLACEHOLDER = `Collection Progress
Crops (1 / 2)
Beet
-`;

function formatPercent(value: number | null): string {
  if (value === null) {
    return '-';
  }

  return `${value.toFixed(1)}%`;
}

function formatSavedAt(value: string | null): string {
  if (!value) {
    return 'Not saved yet';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

function renderReviewedItem(item: MuseumCompletionManualMissingEntry) {
  const icon = getItemIcon(item.canonicalKey);

  return (
    <div>
      <ItemProfileLink canonicalKey={item.canonicalKey} itemName={item.itemName} iconSrc={icon?.src} />
      <p className="subtle-text">
        {item.categoryName}
        {item.slotCount > 1 ? `, ${item.slotCount.toLocaleString()} slots` : ''}
        {item.note ? ` - ${item.note}` : ''}
      </p>
    </div>
  );
}

function renderNamedMissingItem(item: MuseumCompletionManualMissingEntry) {
  return (
    <li key={item.id}>
      {renderReviewedItem(item)}
      <span>{item.slotCount > 1 ? `${item.slotCount.toLocaleString()} slots` : 'Missing'}</span>
    </li>
  );
}

export function MuseumCompletionPage() {
  const [savedState, setSavedState] = useState(() => {
    try {
      return loadMuseumCompletionState();
    } catch {
      return {
        schemaVersion: 1 as const,
        savedAt: null,
        fullMuseumText: '',
        personalMuseumText: '',
        manualMissingItems: [],
      };
    }
  });
  const [personalMuseumText, setPersonalMuseumText] = useState(savedState.personalMuseumText);
  const [manualMissingItems, setManualMissingItems] = useState(savedState.manualMissingItems);
  const [manualCategoryKey, setManualCategoryKey] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualSlotCount, setManualSlotCount] = useState('1');
  const [manualNote, setManualNote] = useState('');
  const [canonData, setCanonData] = useState<MuseumCompletionCanonData | null>(null);
  const [reviewedMissingItems, setReviewedMissingItems] = useState<MuseumReviewedMissingItem[]>([]);
  const [canonLoadMessage, setCanonLoadMessage] = useState<string | null>(null);
  const [parseMessage, setParseMessage] = useState<string | null>(
    savedState.personalMuseumText ? null : 'Paste your museum export to preview progress.',
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    Promise.all([loadMuseumCompletionCanon(), loadMuseumReviewedMissingItems()])
      .then(([loadedCanonData, loadedReviewedMissingItems]) => {
        if (!isCurrent) {
          return;
        }

        setCanonData(loadedCanonData);
        setReviewedMissingItems(loadedReviewedMissingItems.entries);
        setCanonLoadMessage(null);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        setCanonData(null);
        setReviewedMissingItems([]);
        setCanonLoadMessage('Reviewed museum slot names could not be loaded; locally saved names still work.');
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const combinedMissingItems = useMemo(() => {
    const reviewedKeys = new Set(
      reviewedMissingItems.map((item) => `${item.categoryKey}:${item.canonicalKey}`),
    );
    const localOnlyMissingItems = manualMissingItems.filter(
      (item) => !reviewedKeys.has(`${item.categoryKey}:${item.canonicalKey}`),
    );

    return [...reviewedMissingItems, ...localOnlyMissingItems];
  }, [manualMissingItems, reviewedMissingItems]);

  const progress = useMemo<MuseumCompletionManualProgress | null>(() => {
    if (!personalMuseumText.trim()) {
      return null;
    }

    return deriveMuseumCompletionFromPersonalExport(personalMuseumText, combinedMissingItems, canonData);
  }, [canonData, combinedMissingItems, personalMuseumText]);

  const categoriesWithMissing = useMemo(() => {
    return progress?.categories.filter((category) => category.missingMarkerCount > 0) ?? [];
  }, [progress]);
  const selectedCategory =
    categoriesWithMissing.find((category) => category.categoryKey === manualCategoryKey) ??
    categoriesWithMissing[0] ??
    null;

  function handlePreview(): void {
    setSaveMessage(null);

    if (!personalMuseumText.trim()) {
      setParseMessage('Paste your museum export before previewing progress.');
      return;
    }

    setParseMessage('Museum completion preview updated.');
  }

  function handleAddManualItem(): void {
    setSaveMessage(null);

    if (!selectedCategory) {
      setParseMessage('Paste a museum export with missing slots before adding a reviewed item.');
      return;
    }

    const itemName = manualItemName.trim();
    const canonicalKey = toCanonicalItemKey(itemName);

    if (!itemName || !canonicalKey) {
      setParseMessage('Enter the reviewed missing item name before saving it.');
      return;
    }

    const parsedSlotCount = Number(manualSlotCount);
    const slotCount = Number.isFinite(parsedSlotCount) ? Math.max(1, Math.floor(parsedSlotCount)) : 1;
    const entry: MuseumCompletionManualMissingEntry = {
      id: `${Date.now()}-${selectedCategory.categoryKey}-${canonicalKey}`,
      categoryKey: selectedCategory.categoryKey,
      categoryName: selectedCategory.categoryName,
      itemName,
      canonicalKey,
      slotCount,
      note: manualNote.trim(),
    };

    setManualMissingItems((currentItems) => [...currentItems, entry]);
    setManualItemName('');
    setManualSlotCount('1');
    setManualNote('');
    setParseMessage(`Saved ${itemName} as a reviewed missing museum item.`);
  }

  function handleRemoveManualItem(itemId: string): void {
    setManualMissingItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
    setParseMessage('Reviewed missing item removed.');
    setSaveMessage(null);
  }

  function handleSave(): void {
    setParseMessage(null);

    if (!personalMuseumText.trim()) {
      setSaveMessage('Paste your museum export before saving.');
      return;
    }

    const nextSavedState = saveMuseumCompletionState({
      fullMuseumText: savedState.fullMuseumText,
      personalMuseumText,
      manualMissingItems,
    });
    setSavedState(nextSavedState);
    setSaveMessage('Museum completion progress saved locally.');
  }

  function handleClear(): void {
    clearMuseumCompletionState();
    const emptyState = {
      schemaVersion: 1 as const,
      savedAt: null,
      fullMuseumText: '',
      personalMuseumText: '',
      manualMissingItems: [],
    };
    setSavedState(emptyState);
    setPersonalMuseumText('');
    setManualMissingItems([]);
    setManualCategoryKey('');
    setManualItemName('');
    setManualSlotCount('1');
    setManualNote('');
    setParseMessage('Saved museum completion progress cleared.');
    setSaveMessage(null);
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Museum Completion"
        storageKey="museum-completion"
        description="Paste your museum export to track seen items, missing slots, and reviewed missing-item names."
      />

      <section className="page-card page-stack" aria-labelledby="museum-completion-input-title">
        <div>
          <h2 id="museum-completion-input-title">Museum Export</h2>
          <p className="supporting-text">
            This stays in this browser. Missing slots can be named from reviewed local entries when the public list is
            stale or incomplete.
          </p>
        </div>

        <div className="page-stack page-stack--tight">
          <label className="field-label" htmlFor="museum-personal-export">
            My museum export
          </label>
          <textarea
            id="museum-personal-export"
            className="text-area"
            value={personalMuseumText}
            placeholder={PERSONAL_MUSEUM_PLACEHOLDER}
            onChange={(event) => setPersonalMuseumText(event.target.value)}
          />
        </div>

        <div className="button-row">
          <button type="button" className="button" onClick={handlePreview}>
            Preview Progress
          </button>
          <button type="button" className="button button--primary" onClick={handleSave}>
            Save Progress
          </button>
          <button type="button" className="button" onClick={handleClear}>
            Clear Saved Progress
          </button>
        </div>

        <p className="supporting-text">Saved: {formatSavedAt(savedState.savedAt)}</p>
        {parseMessage ? <p className="status-message">{parseMessage}</p> : null}
        {saveMessage ? <p className="status-message status-message--success">{saveMessage}</p> : null}
        {canonLoadMessage ? <p className="status-message">{canonLoadMessage}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="museum-manual-review-title">
        <div>
          <h2 id="museum-manual-review-title">Reviewed Missing Items</h2>
          <p className="supporting-text">
            The app includes Rebecca-reviewed missing names when available. Add local names only after you have
            confirmed what an unnamed museum slot represents.
          </p>
        </div>

        <div className="summary-grid">
          <label className="summary-grid__item page-stack page-stack--tight" htmlFor="museum-review-category">
            <span className="field-label">Category</span>
            <select
              id="museum-review-category"
              className="text-input"
              value={selectedCategory?.categoryKey ?? ''}
              disabled={categoriesWithMissing.length === 0}
              onChange={(event) => setManualCategoryKey(event.target.value)}
            >
              {categoriesWithMissing.length === 0 ? (
                <option value="">No missing categories</option>
              ) : (
                categoriesWithMissing.map((category) => (
                  <option key={category.categoryKey} value={category.categoryKey}>
                    {category.categoryName}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="summary-grid__item page-stack page-stack--tight" htmlFor="museum-review-item-name">
            <span className="field-label">Item name</span>
            <input
              id="museum-review-item-name"
              className="text-input"
              type="text"
              value={manualItemName}
              onChange={(event) => setManualItemName(event.target.value)}
            />
          </label>

          <label className="summary-grid__item page-stack page-stack--tight" htmlFor="museum-review-slot-count">
            <span className="field-label">Slots</span>
            <input
              id="museum-review-slot-count"
              className="text-input text-input--short"
              type="number"
              min="1"
              step="1"
              value={manualSlotCount}
              onChange={(event) => setManualSlotCount(event.target.value)}
            />
          </label>

          <label className="summary-grid__item page-stack page-stack--tight" htmlFor="museum-review-note">
            <span className="field-label">Note</span>
            <input
              id="museum-review-note"
              className="text-input"
              type="text"
              value={manualNote}
              onChange={(event) => setManualNote(event.target.value)}
            />
          </label>
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={categoriesWithMissing.length === 0}
            onClick={handleAddManualItem}
          >
            Add Reviewed Item
          </button>
        </div>

        {manualMissingItems.length === 0 ? (
          <p className="empty-state">No local reviewed missing items saved yet.</p>
        ) : (
          <ul className="data-list">
            {manualMissingItems.map((item) => (
              <li key={item.id}>
                {renderReviewedItem(item)}
                <button type="button" className="button" onClick={() => handleRemoveManualItem(item.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="page-card page-stack" aria-labelledby="museum-completion-progress-title">
        <div>
          <h2 id="museum-completion-progress-title">Progress</h2>
          <p className="supporting-text">
            Unnamed slots are okay; they just need review before the app can show item names for them.
          </p>
        </div>

        {!progress ? (
          <p className="empty-state">Paste your museum export to see museum completion progress.</p>
        ) : (
          <>
            <dl className="summary-grid">
              <div
                className="summary-grid__item summary-grid__item--progress"
                style={
                  {
                    '--summary-progress-fill': `${Math.min(100, progress.summary.completionPercent ?? 0)}%`,
                  } as CSSProperties
                }
              >
                <dt>Seen</dt>
                <dd>
                  {progress.summary.seenItems.toLocaleString()} / {progress.summary.totalSlots.toLocaleString()}
                </dd>
                <p className="subtle-text">{formatPercent(progress.summary.completionPercent)} complete</p>
              </div>
              <div className="summary-grid__item">
                <dt>Missing slots</dt>
                <dd>{progress.summary.missingMarkers.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Named missing slots</dt>
                <dd>{progress.summary.namedMissingSlots.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Needs review</dt>
                <dd>{progress.summary.unresolvedMissingSlots.toLocaleString()}</dd>
              </div>
            </dl>

            {progress.warnings.length > 0 ? (
              <div className="status-alert status-alert--warning page-stack" role="status">
                <h3 className="section-title">Review Notes</h3>
                <ul className="data-list">
                  {progress.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="page-stack">
              <h3 className="section-title">Categories</h3>
              <div className="table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Seen</th>
                      <th scope="col">Missing slots</th>
                      <th scope="col">Named</th>
                      <th scope="col">Needs review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.categories.map((category) => (
                      <tr key={category.categoryKey}>
                        <td>
                          <strong>{category.categoryName}</strong>
                        </td>
                        <td>
                          {category.seenCount.toLocaleString()} / {category.expectedTotalCount.toLocaleString()}
                        </td>
                        <td>{category.missingMarkerCount.toLocaleString()}</td>
                        <td>{category.namedMissingCount.toLocaleString()}</td>
                        <td>{category.unresolvedMissingCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="page-stack">
              <h3 className="section-title">Named Missing Items</h3>
              {progress.namedMissingItems.length === 0 ? (
                <p className="empty-state">No reviewed missing item names yet.</p>
              ) : (
                <ul className="data-list">{progress.namedMissingItems.map(renderNamedMissingItem)}</ul>
              )}
            </div>

            {progress.summary.unresolvedMissingSlots > 0 ? (
              <details className="advanced-details">
                <summary className="advanced-details__summary">Review unnamed slots</summary>
                <ul className="data-list">
                  {progress.categories
                    .filter((category) => category.unresolvedMissingCount > 0)
                    .map((category) => (
                      <li key={category.categoryKey}>
                        <div>
                          <strong>{category.categoryName}</strong>
                          <p className="subtle-text">
                            {category.unresolvedMissingCount.toLocaleString()} unnamed missing slot
                            {category.unresolvedMissingCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span>Needs review</span>
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
