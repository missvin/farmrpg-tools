import { useEffect, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { deriveTowerRequirements } from '../lib/deriveTowerRequirements';
import {
  downloadTowerReferenceReviewCsv,
  deriveTowerReferenceReviewRows,
} from '../lib/exportTowerReferenceReviewCsv';
import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

export function TowerReferenceMaintenancePage() {
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [towerState, setTowerState] = useState<{
    isLoading: boolean;
    snapshotError: string | null;
    towerError: string | null;
    snapshot: Awaited<ReturnType<typeof getLatestSnapshot>>;
    derivedTowerRequirements: ReturnType<typeof deriveTowerRequirements> | null;
  }>({
    isLoading: true,
    snapshotError: null,
    towerError: null,
    snapshot: null,
    derivedTowerRequirements: null,
  });

  useEffect(() => {
    let isMounted = true;

    void getLatestSnapshot()
      .then(async (snapshot) => {
        if (!isMounted) {
          return;
        }

        if (!snapshot) {
          setTowerState({
            isLoading: false,
            snapshotError: null,
            towerError: null,
            snapshot: null,
            derivedTowerRequirements: null,
          });
          return;
        }

        try {
          const towerRequirementsData = await loadTowerRequirements();

          if (!isMounted) {
            return;
          }

          setTowerState({
            isLoading: false,
            snapshotError: null,
            towerError: null,
            snapshot,
            derivedTowerRequirements: deriveTowerRequirements(snapshot, towerRequirementsData),
          });
        } catch (error: unknown) {
          if (!isMounted) {
            return;
          }

          setTowerState({
            isLoading: false,
            snapshotError: null,
            towerError: error instanceof Error ? error.message : 'Unable to load local tower requirements data.',
            snapshot,
            derivedTowerRequirements: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setTowerState({
          isLoading: false,
          snapshotError: error instanceof Error ? error.message : 'Unable to load local snapshots.',
          towerError: null,
          snapshot: null,
          derivedTowerRequirements: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const referenceReviewRows = towerState.derivedTowerRequirements
    ? deriveTowerReferenceReviewRows(towerState.derivedTowerRequirements.rows)
    : [];
  const tbdPlaceholderCount = referenceReviewRows.filter((row) =>
    row.reviewReasons.includes('tbd_placeholder'),
  ).length;
  const unmatchedReviewCount = referenceReviewRows.filter((row) =>
    row.reviewReasons.includes('unmatched_snapshot'),
  ).length;

  function handleExportTowerReferenceReviewCsv(): void {
    if (!towerState.derivedTowerRequirements || referenceReviewRows.length === 0) {
      return;
    }

    try {
      downloadTowerReferenceReviewCsv(towerState.derivedTowerRequirements.rows);
      setExportError(null);
      setExportMessage('Tower reference review CSV downloaded for local maintenance.');
    } catch (error) {
      setExportMessage(null);
      setExportError(error instanceof Error ? error.message : 'Unable to export tower reference review CSV.');
    }
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Tower Reference Maintenance"
        description="Review dev-facing tower rows that need reference-data follow-up without cluttering the user Tower page."
      />

      {towerState.isLoading ? <p className="empty-state">Loading latest snapshot and tower requirements...</p> : null}

      {!towerState.isLoading && towerState.snapshotError ? (
        <p className="status-message status-message--error">{towerState.snapshotError}</p>
      ) : null}

      {!towerState.isLoading && !towerState.snapshotError && !towerState.snapshot ? (
        <section className="page-card page-stack">
          <h2>No Saved Snapshot</h2>
          <p className="empty-state">Import a mastery export first to review tower reference rows.</p>
        </section>
      ) : null}

      {!towerState.isLoading && towerState.snapshot && towerState.towerError ? (
        <section className="page-card page-stack">
          <h2>Tower Requirements Data</h2>
          <p className="status-message status-message--error">{towerState.towerError}</p>
        </section>
      ) : null}

      {!towerState.isLoading && towerState.snapshot && towerState.derivedTowerRequirements ? (
        <section className="page-card page-stack" aria-labelledby="tower-reference-review-title">
          <div>
            <h2 id="tower-reference-review-title">Tower Reference Review</h2>
            <p className="supporting-text">
              Dev-facing maintenance output for placeholder or unmatched tower rows. The export includes per-row
              review reasons and tower provenance fields for later reference-data cleanup.
            </p>
          </div>

          <dl className="summary-grid">
            <div className="summary-grid__item">
              <dt>Review rows</dt>
              <dd>{referenceReviewRows.length.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Unmatched snapshot rows</dt>
              <dd>{unmatchedReviewCount.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>TBD placeholder rows</dt>
              <dd>{tbdPlaceholderCount.toLocaleString()}</dd>
            </div>
          </dl>

          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={handleExportTowerReferenceReviewCsv}
              disabled={referenceReviewRows.length === 0}
            >
              Export Tower Reference Review CSV
            </button>
          </div>

          {exportMessage ? <p className="status-message status-message--success">{exportMessage}</p> : null}
          {exportError ? <p className="status-message status-message--error">{exportError}</p> : null}

          {referenceReviewRows.length === 0 ? (
            <p className="empty-state">No tower reference review rows are currently surfaced.</p>
          ) : (
            <ul className="data-list">
              {referenceReviewRows.map((row) => (
                <li key={`${row.towerLevel}-${row.slotIndex}-${row.canonicalKey}`}>
                  <div>
                    <strong>
                      Tower Level {row.towerLevel} Slot {row.slotIndex}: {row.itemName}
                    </strong>
                    <p className="subtle-text">Review reasons: {row.reviewReasons.join(', ')}</p>
                  </div>
                  <strong>{row.masteryLevelNeeded}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
