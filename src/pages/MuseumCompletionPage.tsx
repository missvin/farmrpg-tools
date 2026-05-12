import { useMemo, useState, type CSSProperties } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  deriveMuseumCompletionProgress,
  type MuseumCompletionMissingItem,
  type MuseumCompletionProgress,
  type MuseumCompletionUnresolvedSlot,
} from '../lib/museumCompletion';
import {
  clearMuseumCompletionState,
  loadMuseumCompletionState,
  saveMuseumCompletionState,
} from '../lib/museumCompletionState';
import { getItemIcon } from '../lib/itemIconManifest';

const FULL_MUSEUM_PLACEHOLDER = `Museum Completion

Crops Count = 2
Beet Beet Corn Corn

Library Home
2026-03-16 19:37:49 by Lunarific`;

const PERSONAL_MUSEUM_PLACEHOLDER = `Crops (1 / 2)
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

function formatCountStatus(status: MuseumCompletionProgress['categories'][number]['countStatus']): string {
  switch (status) {
    case 'matches_full_list':
      return 'Matched';
    case 'full_list_mismatch':
      return 'Full list differs';
    default:
      return 'No full list match';
  }
}

function formatUnresolvedReason(reason: MuseumCompletionUnresolvedSlot['reason']): string {
  switch (reason) {
    case 'candidate_seen_elsewhere':
      return 'Candidate item appears elsewhere';
    case 'missing_full_slot':
      return 'Full list is missing this slot';
    default:
      return 'Full list is missing this category';
  }
}

function renderMissingItem(item: MuseumCompletionMissingItem) {
  const icon = getItemIcon(item.canonicalKey);

  return (
    <li key={`${item.categoryName}-${item.slotIndex}-${item.canonicalKey}`}>
      <div>
        <ItemProfileLink canonicalKey={item.canonicalKey} itemName={item.itemName} iconSrc={icon?.src} />
        <p className="subtle-text">
          {item.categoryName} slot {(item.slotIndex + 1).toLocaleString()}
        </p>
      </div>
      <span>{item.confidence === 'known' ? 'Missing' : 'Possible match'}</span>
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
      };
    }
  });
  const [fullMuseumText, setFullMuseumText] = useState(savedState.fullMuseumText);
  const [personalMuseumText, setPersonalMuseumText] = useState(savedState.personalMuseumText);
  const [parseMessage, setParseMessage] = useState<string | null>(
    savedState.fullMuseumText && savedState.personalMuseumText ? null : 'Paste both museum exports to preview progress.',
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const progress = useMemo(() => {
    if (!fullMuseumText.trim() || !personalMuseumText.trim()) {
      return null;
    }

    return deriveMuseumCompletionProgress(fullMuseumText, personalMuseumText);
  }, [fullMuseumText, personalMuseumText]);

  function handlePreview(): void {
    setSaveMessage(null);

    if (!fullMuseumText.trim() || !personalMuseumText.trim()) {
      setParseMessage('Paste both the full museum list and your museum export before previewing progress.');
      return;
    }

    setParseMessage('Museum completion preview updated.');
  }

  function handleSave(): void {
    setParseMessage(null);

    if (!fullMuseumText.trim() || !personalMuseumText.trim()) {
      setSaveMessage('Paste both museum exports before saving.');
      return;
    }

    const nextSavedState = saveMuseumCompletionState({
      fullMuseumText,
      personalMuseumText,
    });
    setSavedState(nextSavedState);
    setSaveMessage('Museum completion inputs saved locally.');
  }

  function handleClear(): void {
    clearMuseumCompletionState();
    const emptyState = {
      schemaVersion: 1 as const,
      savedAt: null,
      fullMuseumText: '',
      personalMuseumText: '',
    };
    setSavedState(emptyState);
    setFullMuseumText('');
    setPersonalMuseumText('');
    setParseMessage('Saved museum completion inputs cleared.');
    setSaveMessage(null);
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Museum Completion"
        storageKey="museum-completion"
        description="Paste the full museum list and your own museum export to see seen, missing, and uncertain museum slots."
      />

      <section className="page-card page-stack" aria-labelledby="museum-completion-input-title">
        <div>
          <h2 id="museum-completion-input-title">Museum Inputs</h2>
          <p className="supporting-text">
            These stay in this browser. If the full list is older than your museum page, the app will still count your
            progress and mark uncertain missing slots for review.
          </p>
        </div>

        <div className="two-column-grid">
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="museum-full-list">
              Full museum list
            </label>
            <textarea
              id="museum-full-list"
              className="text-area"
              value={fullMuseumText}
              placeholder={FULL_MUSEUM_PLACEHOLDER}
              onChange={(event) => setFullMuseumText(event.target.value)}
            />
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
        </div>

        <div className="button-row">
          <button type="button" className="button" onClick={handlePreview}>
            Preview Progress
          </button>
          <button type="button" className="button button--primary" onClick={handleSave}>
            Save Inputs
          </button>
          <button type="button" className="button" onClick={handleClear}>
            Clear Saved Inputs
          </button>
        </div>

        <p className="supporting-text">Saved: {formatSavedAt(savedState.savedAt)}</p>
        {parseMessage ? <p className="status-message">{parseMessage}</p> : null}
        {saveMessage ? <p className="status-message status-message--success">{saveMessage}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="museum-completion-progress-title">
        <div>
          <h2 id="museum-completion-progress-title">Progress</h2>
          <p className="supporting-text">
            Missing rows are named only when the full list and your export line up safely enough.
          </p>
        </div>

        {!progress ? (
          <p className="empty-state">Paste both museum exports to see museum completion progress.</p>
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
                <dt>Missing markers</dt>
                <dd>{progress.summary.missingMarkers.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Named missing items</dt>
                <dd>{progress.summary.knownMissingItems.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Needs review</dt>
                <dd>
                  {(progress.summary.possibleMissingItems + progress.summary.unresolvedMissingSlots).toLocaleString()}
                </dd>
              </div>
            </dl>

            {progress.metadata.footerUpdatedLabel || progress.metadata.lastUpdatedLabel ? (
              <p className="supporting-text">
                Full list source: {progress.metadata.footerUpdatedLabel ?? progress.metadata.lastUpdatedLabel}
              </p>
            ) : null}

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
                      <th scope="col">Missing</th>
                      <th scope="col">Review</th>
                      <th scope="col">Full list</th>
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
                        <td>{category.knownMissingCount.toLocaleString()}</td>
                        <td>
                          {(category.possibleMissingCount + category.unresolvedMissingCount).toLocaleString()}
                        </td>
                        <td>{formatCountStatus(category.countStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="page-stack">
              <h3 className="section-title">Named Missing Items</h3>
              {progress.knownMissingItems.length === 0 ? (
                <p className="empty-state">No safely named missing items yet.</p>
              ) : (
                <ul className="data-list">{progress.knownMissingItems.map(renderMissingItem)}</ul>
              )}
            </div>

            {progress.possibleMissingItems.length > 0 || progress.unresolvedSlots.length > 0 ? (
              <details className="advanced-details">
                <summary className="advanced-details__summary">Review uncertain missing slots</summary>
                <div className="page-stack">
                  {progress.possibleMissingItems.length > 0 ? (
                    <div className="page-stack page-stack--tight">
                      <h3 className="section-title">Possible Missing Items</h3>
                      <p className="supporting-text">
                        These are named from the full list, but the category counts do not currently match.
                      </p>
                      <ul className="data-list">{progress.possibleMissingItems.map(renderMissingItem)}</ul>
                    </div>
                  ) : null}

                  {progress.unresolvedSlots.length > 0 ? (
                    <div className="page-stack page-stack--tight">
                      <h3 className="section-title">Unnamed Slots</h3>
                      <ul className="data-list">
                        {progress.unresolvedSlots.map((slot) => (
                          <li key={`${slot.categoryName}-${slot.slotIndex}-${slot.reason}`}>
                            <div>
                              <strong>
                                {slot.categoryName} slot {(slot.slotIndex + 1).toLocaleString()}
                              </strong>
                              <p className="subtle-text">{formatUnresolvedReason(slot.reason)}</p>
                            </div>
                            <span>{slot.candidateItemName ?? 'Unnamed'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
