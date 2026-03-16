import { useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { parseMasteryPaste } from '../lib/parseMasteryPaste';
import { createSnapshotId, saveSnapshot } from '../lib/storage/masterySnapshots';

const PREVIEW_LIMIT = 10;
const MIN_EXPECTED_IMPORT_ROWS = 50;
const EXPECTED_MASTERY_TIERS = ['No Tier', 'Tier II', 'Tier III (M)', 'Tier IV (GM)', 'Tier V (MM)'] as const;

function formatTierList(tiers: Array<number | 'INF'>): string {
  if (tiers.length === 0) {
    return 'None detected';
  }

  return tiers.map((tier) => (tier === 'INF' ? 'INF' : tier.toLocaleString())).join(', ');
}

function formatTierLabel(tier: number | 'INF'): string {
  return tier === 'INF' ? 'INF' : tier.toLocaleString();
}

function getMasteryTierLabel(targetTier: number | 'INF'): (typeof EXPECTED_MASTERY_TIERS)[number] | null {
  if (targetTier === 10) {
    return 'No Tier';
  }

  if (targetTier === 100) {
    return 'Tier II';
  }

  if (targetTier === 10_000) {
    return 'Tier III (M)';
  }

  if (targetTier === 100_000) {
    return 'Tier IV (GM)';
  }

  if (targetTier === 1_000_000 || targetTier === 'INF') {
    return 'Tier V (MM)';
  }

  return null;
}

function buildImportValidationWarning(parseResult: ReturnType<typeof parseMasteryPaste>): string | null {
  const tierCounts = parseResult.parsedRows.reduce<Record<string, number>>((counts, row) => {
    const tierLabel = getMasteryTierLabel(row.targetTier);

    if (tierLabel) {
      counts[tierLabel] = (counts[tierLabel] ?? 0) + 1;
    }

    return counts;
  }, {});
  const missingTiers = EXPECTED_MASTERY_TIERS.filter((tierLabel) => (tierCounts[tierLabel] ?? 0) === 0);
  const totalRows = parseResult.parsedRows.length;

  if (missingTiers.length === 0 && totalRows >= MIN_EXPECTED_IMPORT_ROWS) {
    return null;
  }

  const messageParts = [`This mastery import may be incomplete. Only ${totalRows.toLocaleString()} rows were detected`];

  if (missingTiers.length === 1) {
    messageParts.push(`, and ${missingTiers[0]} appears to be missing.`);
  } else if (missingTiers.length > 1) {
    messageParts.push(`, and the following tiers appear to be missing: ${missingTiers.join(', ')}.`);
  } else {
    messageParts.push('.');
  }

  if (missingTiers.length > 0) {
    messageParts.push(
      ' This often happens if the mastery page sections were collapsed before copying. Please expand all tiers and copy again.',
    );
  }

  return messageParts.join('');
}

export function ImportPage() {
  const [rawText, setRawText] = useState('');
  const [parsedText, setParsedText] = useState('');
  const [debugFilter, setDebugFilter] = useState('');
  const [importValidationAcknowledged, setImportValidationAcknowledged] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const parseResult = parsedText ? parseMasteryPaste(parsedText) : null;
  const importValidationWarning = parseResult ? buildImportValidationWarning(parseResult) : null;
  const previewEntries = parseResult
    ? Object.entries(parseResult.masteryByItem)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .slice(0, PREVIEW_LIMIT)
    : [];
  const filteredParsedRows = parseResult
    ? parseResult.parsedRows.filter((row) => {
        const filterValue = debugFilter.trim().toLowerCase();

        if (!filterValue) {
          return true;
        }

        return (
          row.rawItemName.toLowerCase().includes(filterValue) ||
          row.canonicalKey.toLowerCase().includes(filterValue)
        );
      })
    : [];
  const tierDebugCounts = parseResult
    ? parseResult.parsedRows.reduce<Record<string, number>>((counts, row) => {
        const key = formatTierLabel(row.targetTier);
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {})
    : {};
  const tierDebugEntries = Object.entries(tierDebugCounts).sort(([left], [right]) => {
    if (left === 'INF') {
      return 1;
    }

    if (right === 'INF') {
      return -1;
    }

    return Number(left.replace(/,/g, '')) - Number(right.replace(/,/g, ''));
  });

  const hasParsedItems = (parseResult?.parseSummary.itemsParsed ?? 0) > 0;
  const requiresImportOverride = Boolean(importValidationWarning) && !importValidationAcknowledged;

  function handleParsePreview(): void {
    setSaveMessage(null);
    setSaveError(null);
    setImportValidationAcknowledged(false);

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
        parsedRows: parseResult.parsedRows,
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
            disabled={!hasParsedItems || isSaving || requiresImportOverride}
          >
            {isSaving ? 'Saving...' : 'Save Snapshot'}
          </button>
          {requiresImportOverride ? (
            <button
              type="button"
              className="button"
              onClick={() => setImportValidationAcknowledged(true)}
            >
              Import anyway
            </button>
          ) : null}
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

            {importValidationWarning ? (
              <div className="page-stack">
                <h3 className="section-title">Import Validation Warning</h3>
                <p className="status-message">{importValidationWarning}</p>
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

            <div className="page-stack">
              <h3 className="section-title">Temporary Parser Debug</h3>
              <p className="supporting-text">
                Use this temporary view to inspect exactly which rows were parsed from the pasted export.
              </p>

              <dl className="summary-grid">
                <div className="summary-grid__item">
                  <dt>Total parsed rows</dt>
                  <dd>{parseResult.parsedRows.length.toLocaleString()}</dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Unique canonical items</dt>
                  <dd>{parseResult.parseSummary.itemsParsed.toLocaleString()}</dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Tier row groups</dt>
                  <dd>{tierDebugEntries.map(([tier, count]) => `${tier}: ${count}`).join(', ') || 'None'}</dd>
                </div>
              </dl>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="parsed-row-filter">
                  Filter parsed rows
                </label>
                <input
                  id="parsed-row-filter"
                  className="text-input"
                  type="text"
                  value={debugFilter}
                  onChange={(event) => setDebugFilter(event.target.value)}
                  placeholder="Filter by raw item name or canonical key"
                />
              </div>

              {filteredParsedRows.length === 0 ? (
                <p className="empty-state">No parsed rows match the current filter.</p>
              ) : (
                <ul className="debug-list">
                  {filteredParsedRows.map((row, rowIndex) => (
                    <li
                      key={`${row.sourceLineIndex}-${row.canonicalKey}-${rowIndex}`}
                      className="debug-list__item"
                    >
                      <p>
                        <strong>Raw item:</strong> {row.rawItemName}
                      </p>
                      <p>
                        <strong>Canonical key:</strong> {row.canonicalKey}
                      </p>
                      <p>
                        <strong>Count:</strong> {row.count.toLocaleString()}
                      </p>
                      <p>
                        <strong>Target tier:</strong> {formatTierLabel(row.targetTier)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
