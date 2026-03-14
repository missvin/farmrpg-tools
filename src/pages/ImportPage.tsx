import { useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { parseMasteryPaste } from '../lib/parseMasteryPaste';
import { createSnapshotId, saveSnapshot } from '../lib/storage/masterySnapshots';

const PREVIEW_LIMIT = 10;

function formatTierList(tiers: Array<number | 'INF'>): string {
  if (tiers.length === 0) {
    return 'None detected';
  }

  return tiers.map((tier) => (tier === 'INF' ? 'INF' : tier.toLocaleString())).join(', ');
}

export function ImportPage() {
  const [rawText, setRawText] = useState('');
  const [parsedText, setParsedText] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const parseResult = parsedText ? parseMasteryPaste(parsedText) : null;
  const previewEntries = parseResult
    ? Object.entries(parseResult.masteryByItem)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .slice(0, PREVIEW_LIMIT)
    : [];

  const hasParsedItems = (parseResult?.parseSummary.itemsParsed ?? 0) > 0;

  function handleParsePreview(): void {
    setSaveMessage(null);
    setSaveError(null);

    if (!rawText.trim()) {
      setParsedText('');
      setValidationMessage('Paste a FarmRPG mastery export to preview the parsed snapshot.');
      return;
    }

    const nextParseResult = parseMasteryPaste(rawText);
    if (nextParseResult.parseSummary.itemsParsed === 0) {
      setParsedText('');
      setValidationMessage('No mastery items were detected in that paste. Check that you copied the mastery export.');
      return;
    }

    setParsedText(rawText);
    setValidationMessage(null);
  }

  async function handleSaveSnapshot(): Promise<void> {
    if (!parseResult || !hasParsedItems) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      await saveSnapshot({
        snapshotId: createSnapshotId(),
        createdAt: new Date().toISOString(),
        rawText: parsedText,
        masteryByItem: parseResult.masteryByItem,
        parseSummary: parseResult.parseSummary,
      });

      setSaveMessage('Snapshot saved locally. The pasted text is still here if you want to review it.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the snapshot locally.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Import Mastery Snapshot"
        description="Paste a FarmRPG mastery export, preview the parsed snapshot, and save it locally."
      />

      <section className="page-card page-stack" aria-labelledby="import-form-title">
        <div>
          <h2 id="import-form-title">Paste Export</h2>
          <p className="supporting-text">
            Paste the raw mastery export from FarmRPG. This stays local to your browser.
          </p>
        </div>

        <label className="field-label" htmlFor="mastery-paste">
          Raw mastery export
        </label>
        <textarea
          id="mastery-paste"
          className="text-area"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder={'Gold Cucumber\n967,174 / 1,000,000 Progress\n96.7174%'}
          rows={14}
        />

        <div className="button-row">
          <button type="button" className="button" onClick={handleParsePreview}>
            Parse Preview
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              void handleSaveSnapshot();
            }}
            disabled={!hasParsedItems || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Snapshot'}
          </button>
        </div>

        {validationMessage ? <p className="status-message">{validationMessage}</p> : null}
        {saveMessage ? <p className="status-message status-message--success">{saveMessage}</p> : null}
        {saveError ? <p className="status-message status-message--error">{saveError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="preview-title">
        <div>
          <h2 id="preview-title">Parse Preview</h2>
          <p className="supporting-text">
            Review the parsed summary before saving a snapshot locally.
          </p>
        </div>

        {!parseResult || !hasParsedItems ? (
          <p className="empty-state">No parsed snapshot yet. Paste your export and choose Parse Preview.</p>
        ) : (
          <>
            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Items parsed</dt>
                <dd>{parseResult.parseSummary.itemsParsed.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Tiers detected</dt>
                <dd>{formatTierList(parseResult.parseSummary.tiersDetected)}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Warnings</dt>
                <dd>{parseResult.parseSummary.warnings.length.toLocaleString()}</dd>
              </div>
            </dl>

            {parseResult.parseSummary.warnings.length > 0 ? (
              <div className="page-stack">
                <h3 className="section-title">Warnings</h3>
                <ul className="data-list">
                  {parseResult.parseSummary.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="page-stack">
              <h3 className="section-title">Parsed Items Preview</h3>
              <p className="supporting-text">
                Showing the first {previewEntries.length} canonical item entries.
              </p>
              <ul className="data-list">
                {previewEntries.map(([itemKey, count]) => (
                  <li key={itemKey}>
                    <span>{itemKey}</span>
                    <strong>{count.toLocaleString()}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
