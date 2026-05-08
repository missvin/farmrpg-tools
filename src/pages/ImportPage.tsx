import { useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { parseMasteryPaste } from '../lib/parseMasteryPaste';
import { createSnapshotId, saveSnapshot } from '../lib/storage/masterySnapshots';

const PREVIEW_LIMIT = 10;
const MIN_EXPECTED_IMPORT_ROWS = 50;
const IMPORT_PLACEHOLDER = `Farm RPG
Back
Item Mastery

Gold Cucumber
967,174 / 1,000,000 Progress
96.7174%

Red Diamond Fish
8,835 / 10,000 Progress
88.35%`;
const EXPECTED_MASTERY_TIERS = [
  { targetTier: 10, label: 'No Tier' },
  { targetTier: 1_000, label: 'Tier II' },
  { targetTier: 10_000, label: 'Tier III (M)' },
  { targetTier: 100_000, label: 'Tier IV (GM)' },
  { targetTier: 1_000_000, label: 'Tier V (MM)' },
] as const;

type ImportTrustSummary = {
  tone: 'high' | 'medium' | 'low';
  title: string;
  confidenceLabel: string;
  message: string;
  nextStep: string;
  findings: Array<{
    label: string;
    detail: string;
  }>;
};

function formatTierList(tiers: Array<number | 'INF'>): string {
  if (tiers.length === 0) {
    return 'None detected';
  }

  return tiers.map((tier) => (tier === 'INF' ? 'INF' : tier.toLocaleString())).join(', ');
}

function formatTierLabel(tier: number | 'INF'): string {
  return tier === 'INF' ? 'INF' : tier.toLocaleString();
}

function getMasteryTierLabel(targetTier: number): string | null {
  return EXPECTED_MASTERY_TIERS.find((tier) => tier.targetTier === targetTier)?.label ?? null;
}

function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function buildImportValidationWarning(parseResult: ReturnType<typeof parseMasteryPaste>): string | null {
  const tierCounts = parseResult.parsedRows.reduce<Record<number, number>>((counts, row) => {
    if (row.targetTier === 'INF') {
      return counts;
    }

    const tierLabel = getMasteryTierLabel(row.targetTier);
    if (tierLabel) {
      counts[row.targetTier] = (counts[row.targetTier] ?? 0) + 1;
    }

    return counts;
  }, {});
  const missingTiers = EXPECTED_MASTERY_TIERS.filter((tier) => (tierCounts[tier.targetTier] ?? 0) === 0).map(
    (tier) => tier.label,
  );
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

function buildImportTrustSummary(
  parseResult: ReturnType<typeof parseMasteryPaste>,
  importValidationWarning: string | null,
): ImportTrustSummary {
  const duplicateRowsCount = parseResult.parseSummary.duplicateRowsCount;
  const detailedWarningCount = Math.max(0, parseResult.parseSummary.warnings.length - duplicateRowsCount);
  const findings: ImportTrustSummary['findings'] = [];

  if (importValidationWarning) {
    findings.push({
      label: 'Possible incomplete export',
      detail: importValidationWarning,
    });
  }

  if (duplicateRowsCount > 0) {
    findings.push({
      label: 'Duplicate rows merged',
      detail: `${formatCountLabel(duplicateRowsCount, 'duplicate row was', 'duplicate rows were')} merged using the highest parsed count.`,
    });
  }

  if (detailedWarningCount > 0) {
    findings.push({
      label: 'Rows to review',
      detail: `${formatCountLabel(detailedWarningCount, 'additional warning needs', 'additional warnings need')} a quick look before saving.`,
    });
  }

  if (parseResult.parseSummary.skippedNonItemLinesCount > 0) {
    findings.push({
      label: 'Ignored non-item lines',
      detail: `${formatCountLabel(parseResult.parseSummary.skippedNonItemLinesCount, 'header/navigation line was', 'header/navigation lines were')} ignored as expected.`,
    });
  }

  if (importValidationWarning) {
    return {
      tone: 'low',
      title: 'Review before saving',
      confidenceLabel: 'Low confidence',
      message: 'This paste may be incomplete, so saving it could replace a fuller snapshot with partial data.',
      nextStep: 'Expand all mastery tiers in FarmRPG, copy again, and parse a fresh preview. Use Import anyway only if this partial snapshot is intentional.',
      findings,
    };
  }

  if (duplicateRowsCount > 0 || detailedWarningCount > 0) {
    return {
      tone: 'medium',
      title: 'Usable after review',
      confidenceLabel: 'Medium confidence',
      message: 'The paste produced usable item rows, with a few findings worth checking before you save.',
      nextStep: 'Review the grouped findings below, then save if the merged counts match what you expect.',
      findings,
    };
  }

  return {
    tone: 'high',
    title: 'Ready to save',
    confidenceLabel: 'High confidence',
    message: 'This looks like a complete mastery export with no review-worthy findings.',
    nextStep: 'Save this snapshot if it matches the FarmRPG export you meant to capture.',
    findings,
  };
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
  const importTrustSummary =
    parseResult && hasParsedItems ? buildImportTrustSummary(parseResult, importValidationWarning) : null;
  const validationSummaryFindings = parseResult
    ? [
        parseResult.parseSummary.duplicateRowsCount > 0
          ? `${formatCountLabel(parseResult.parseSummary.duplicateRowsCount, 'duplicate row was', 'duplicate rows were')} merged using the highest parsed count.`
          : null,
      ].filter((finding): finding is string => Boolean(finding))
    : [];

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
        description="Paste a FarmRPG mastery export, review the parsed rows and warnings, then save the snapshot locally for the rest of the app."
        storageKey="import"
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
          placeholder={IMPORT_PLACEHOLDER}
          rows={14}
        />
        <p className="supporting-text">
          Extra header, navigation, or other unrelated lines are okay. The importer will ignore lines that are not
          mastery item rows.
        </p>

        {importValidationWarning ? (
          <div className="status-alert status-alert--warning page-stack" role="alert" aria-live="polite">
            <div>
              <h3 className="section-title">Import Warning</h3>
              <p className="status-message">{importValidationWarning}</p>
            </div>
            <p className="supporting-text">
              Review the warning, expand all mastery tiers in FarmRPG if needed, then re-copy the export. You can
              still choose Import anyway if this partial import is intentional.
            </p>
          </div>
        ) : null}

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
                <dt>Duplicate rows</dt>
                <dd>{parseResult.parseSummary.duplicateRowsCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Ignored lines</dt>
                <dd>{parseResult.parseSummary.skippedNonItemLinesCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Tiers detected</dt>
                <dd>{formatTierList(parseResult.parseSummary.tiersDetected)}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Review findings</dt>
                <dd>{validationSummaryFindings.length.toLocaleString()}</dd>
              </div>
            </dl>

            {importTrustSummary ? (
              <div className="page-stack">
                <h3 className="section-title">Import Trust Summary</h3>
                <div
                  className={`status-alert page-stack ${
                    importTrustSummary.tone === 'low' ? 'status-alert--warning' : ''
                  }`}
                >
                  <div>
                    <p className="status-message">
                      <strong>{importTrustSummary.confidenceLabel}</strong>: {importTrustSummary.title}
                    </p>
                    <p className="supporting-text">{importTrustSummary.message}</p>
                    <p className="supporting-text">
                      <strong>Next step:</strong> {importTrustSummary.nextStep}
                    </p>
                  </div>

                  {importTrustSummary.findings.length > 0 ? (
                    <ul className="data-list">
                      {importTrustSummary.findings.map((finding) => (
                        <li key={finding.label}>
                          <span>
                            <strong>{finding.label}:</strong> {finding.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="page-stack">
              <h3 className="section-title">Import Validation Report</h3>
              <p className="supporting-text">
                This read-only summary shows what the parser kept, any actual review-worthy findings, and the expected
                non-item lines it ignored before you save.
              </p>

              {validationSummaryFindings.length > 0 ? (
                <ul className="data-list">
                  {validationSummaryFindings.map((finding) => (
                    <li key={finding}>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state">No duplicate-row merges or other review-worthy parser findings were detected.</p>
              )}

              {parseResult.parseSummary.skippedNonItemLinesCount > 0 ? (
                <div className="page-stack page-stack--tight">
                  <h4 className="section-title">Expected Ignored Lines</h4>
                  <p className="supporting-text">
                    {formatCountLabel(
                      parseResult.parseSummary.skippedNonItemLinesCount,
                      'non-item line was',
                      'non-item lines were',
                    )}{' '}
                    ignored during parsing. This is normal when the pasted export includes headers, navigation, or
                    standalone percent lines.
                  </p>
                </div>
              ) : null}

              {parseResult.parseSummary.skippedNonItemLineSamples.length > 0 ? (
                <div className="page-stack page-stack--tight">
                  <h4 className="section-title">Ignored line samples</h4>
                  <p className="supporting-text">
                    These non-item lines were ignored on purpose and can help explain why the skipped-line count is
                    higher than the number of parsed rows.
                  </p>
                  <ul className="data-list">
                    {parseResult.parseSummary.skippedNonItemLineSamples.map((sample) => (
                      <li key={`${sample.lineNumber}-${sample.text}`}>
                        <span>
                          Line {sample.lineNumber}: {sample.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {parseResult.parseSummary.warnings.length > 0 ? (
              <div className="page-stack">
                <h3 className="section-title">Detailed Warnings</h3>
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

            <div className="page-stack">
              <h3 className="section-title">Parsed Row Details</h3>
              <p className="supporting-text">
                Use this detail view to inspect exactly which rows were parsed from the pasted export.
              </p>

              <dl className="summary-grid">
                <div className="summary-grid__item">
                  <dt>Total parsed rows</dt>
                  <dd>{parseResult.parseSummary.parsedRowsCount.toLocaleString()}</dd>
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
