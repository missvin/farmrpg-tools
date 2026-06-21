import { useEffect, useMemo, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  deriveClientCoinRatingReconciliationRows,
  downloadClientCoinRatingReconciliationCsv,
  downloadClientCoinReviewedRatingUpdateCsv,
  type ClientCoinRatingReconciliationRow,
  type ClientCoinReviewedRatingUpdateInput,
} from '../lib/deriveClientCoinRatingReconciliation';
import { loadItemAliases } from '../lib/itemAliases';
import { applyClientCoinRatingAliases, loadClientCoinMasteryRatings } from '../lib/loadClientCoinMasteryRatings';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';

type WorkbenchState = {
  isLoading: boolean;
  error: string | null;
  rows: ClientCoinRatingReconciliationRow[];
  sourceRowCount: number;
};

type RatingDraft = {
  newGmRating: string;
  newMmRating: string;
};

function countRowsByReason(rows: ClientCoinRatingReconciliationRow[], reason: string): number {
  return rows.filter((row) => row.reviewReasons.includes(reason as ClientCoinRatingReconciliationRow['reviewReasons'][number]))
    .length;
}

function countChangedDrafts(drafts: Record<string, RatingDraft>): number {
  return Object.values(drafts).filter((draft) => draft.newGmRating.trim() || draft.newMmRating.trim()).length;
}

export function RatingSourceWorkbenchPage() {
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [workbenchState, setWorkbenchState] = useState<WorkbenchState>({
    isLoading: true,
    error: null,
    rows: [],
    sourceRowCount: 0,
  });

  useEffect(() => {
    let isMounted = true;

    void Promise.all([loadClientCoinMasteryRatings(), loadItemAliases(), loadMasteryDifficulty()])
      .then(([clientCoinRatings, aliases, masteryDifficulty]) => {
        if (!isMounted) {
          return;
        }

        const resolvedClientCoinRatings = applyClientCoinRatingAliases(clientCoinRatings, aliases);

        setWorkbenchState({
          isLoading: false,
          error: null,
          rows: deriveClientCoinRatingReconciliationRows(resolvedClientCoinRatings, masteryDifficulty),
          sourceRowCount: resolvedClientCoinRatings.entries.length,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setWorkbenchState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load rating source reference data.',
          rows: [],
          sourceRowCount: 0,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(
    () => ({
      mismatchCount: countRowsByReason(workbenchState.rows, 'rating_mismatch'),
      missingCurrentCount: countRowsByReason(workbenchState.rows, 'missing_current_rating_row'),
      methodReviewCount: countRowsByReason(workbenchState.rows, 'method_review'),
      unratedCount:
        countRowsByReason(workbenchState.rows, 'current_unrated') +
        countRowsByReason(workbenchState.rows, 'clientcoin_unrated'),
    }),
    [workbenchState.rows],
  );
  const changedDraftCount = countChangedDrafts(ratingDrafts);

  function updateDraft(canonicalKey: string, field: keyof RatingDraft, value: string): void {
    setRatingDrafts((currentDrafts) => ({
      ...currentDrafts,
      [canonicalKey]: {
        newGmRating: currentDrafts[canonicalKey]?.newGmRating ?? '',
        newMmRating: currentDrafts[canonicalKey]?.newMmRating ?? '',
        [field]: value,
      },
    }));
  }

  function toUpdateInputs(): ClientCoinReviewedRatingUpdateInput[] {
    return Object.entries(ratingDrafts).map(([canonicalKey, draft]) => ({
      canonicalKey,
      newGmRating: draft.newGmRating,
      newMmRating: draft.newMmRating,
    }));
  }

  function handleExportReviewRows(): void {
    if (workbenchState.rows.length === 0) {
      return;
    }

    try {
      downloadClientCoinRatingReconciliationCsv(workbenchState.rows);
      setExportError(null);
      setExportMessage('ClientCoin rating reconciliation review CSV downloaded.');
    } catch (error) {
      setExportMessage(null);
      setExportError(error instanceof Error ? error.message : 'Unable to export ClientCoin rating review CSV.');
    }
  }

  function handleExportUpdates(): void {
    if (changedDraftCount === 0) {
      return;
    }

    try {
      downloadClientCoinReviewedRatingUpdateCsv(workbenchState.rows, toUpdateInputs());
      setExportError(null);
      setExportMessage('Reviewed rating update CSV downloaded with changed rows only.');
    } catch (error) {
      setExportMessage(null);
      setExportError(error instanceof Error ? error.message : 'Unable to export reviewed rating updates.');
    }
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Rating Source Workbench"
        description="Review alternate ClientCoin mastery ratings against the current local rating source before anything becomes user-facing."
        storageKey="rating-source-workbench"
      />

      {workbenchState.isLoading ? <p className="empty-state">Loading rating source reference data...</p> : null}

      {!workbenchState.isLoading && workbenchState.error ? (
        <p className="status-message status-message--error">{workbenchState.error}</p>
      ) : null}

      {!workbenchState.isLoading && !workbenchState.error ? (
        <section className="page-card page-stack" aria-labelledby="rating-source-review-title">
          <div>
            <h2 id="rating-source-review-title">ClientCoin Review Rows</h2>
            <p className="supporting-text">
              Dev-facing rows only. Blank reviewed rating cells mean no change; exported updates include only rows where
              a new rating is entered.
            </p>
          </div>

          <dl className="summary-grid">
            <div className="summary-grid__item">
              <dt>ClientCoin source rows</dt>
              <dd>{workbenchState.sourceRowCount.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Review rows</dt>
              <dd>{workbenchState.rows.length.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Rating mismatches</dt>
              <dd>{summary.mismatchCount.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Method review</dt>
              <dd>{summary.methodReviewCount.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Missing current rows</dt>
              <dd>{summary.missingCurrentCount.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Changed drafts</dt>
              <dd>{changedDraftCount.toLocaleString()}</dd>
            </div>
          </dl>

          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={handleExportReviewRows}
              disabled={workbenchState.rows.length === 0}
            >
              Export Review Rows
            </button>
            <button type="button" className="button" onClick={handleExportUpdates} disabled={changedDraftCount === 0}>
              Export Reviewed Updates
            </button>
          </div>

          {exportMessage ? <p className="status-message status-message--success">{exportMessage}</p> : null}
          {exportError ? <p className="status-message status-message--error">{exportError}</p> : null}

          {workbenchState.sourceRowCount === 0 ? (
            <p className="empty-state">
              No ClientCoin source rows are checked in yet. Add reviewed rows to the ClientCoin rating CSV to populate
              this workbench.
            </p>
          ) : null}

          {workbenchState.sourceRowCount > 0 && workbenchState.rows.length === 0 ? (
            <p className="empty-state">No ClientCoin rating review rows are currently surfaced.</p>
          ) : null}

          {workbenchState.rows.length > 0 ? (
            <ul className="data-list">
              {workbenchState.rows.map((row) => {
                const draft = ratingDrafts[row.canonicalKey] ?? { newGmRating: '', newMmRating: '' };

                return (
                  <li key={`${row.canonicalKey}-${row.sourceSheet ?? 'source'}-${row.sourceRow ?? 'row'}`}>
                    <div>
                      <strong>{row.itemName}</strong>
                      <p className="subtle-text">
                        Reasons: {row.reviewReasons.join(', ')}
                        {row.clientcoinMethods.length > 0
                          ? `; ClientCoin methods: ${row.clientcoinMethods.join(', ')}`
                          : ''}
                      </p>
                      <p className="subtle-text">
                        Source: {row.sourceSheet ?? 'Unknown source'} {row.sourceRow ? `row ${row.sourceRow}` : ''}
                      </p>
                    </div>
                    <div className="form-grid form-grid--compact">
                      <label>
                        Current GM
                        <span>{row.currentDifficulty ?? 'unrated'}</span>
                      </label>
                      <label>
                        ClientCoin MM
                        <span>{row.clientcoinRating ?? row.clientcoinRatingRaw ?? 'unrated'}</span>
                      </label>
                      <label>
                        New GM
                        <input
                          type="text"
                          value={draft.newGmRating}
                          onChange={(event) => updateDraft(row.canonicalKey, 'newGmRating', event.target.value)}
                          placeholder="blank = no change"
                        />
                      </label>
                      <label>
                        New MM
                        <input
                          type="text"
                          value={draft.newMmRating}
                          onChange={(event) => updateDraft(row.canonicalKey, 'newMmRating', event.target.value)}
                          placeholder="blank = no change"
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}