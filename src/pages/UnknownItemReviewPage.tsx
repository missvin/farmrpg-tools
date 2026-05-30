import { useMemo, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { downloadTextFile } from '../lib/appBackupExport';
import {
  addUnknownItemEvidenceRecords,
  createFirstUnknownInventoryBatchEvidence,
  groupUnknownItemEvidence,
  loadUnknownItemEvidenceState,
  saveUnknownItemEvidenceState,
  setUnknownItemReviewDecision,
  toUnknownItemIconCandidateCsv,
  toUnknownItemPromotionReviewCsv,
  UNKNOWN_ITEM_PROMOTION_TARGET_LABELS,
  UNKNOWN_ITEM_REVIEW_STATE_LABELS,
  type UnknownItemEvidenceSourceType,
  type UnknownItemEvidenceState,
  type UnknownItemPromotionTarget,
  type UnknownItemReviewState,
} from '../lib/unknownItemEvidence';

const SOURCE_TYPE_LABELS: Record<UnknownItemEvidenceSourceType, string> = {
  current_inventory_import: 'Inventory import',
  stored_pet_inventory_import: 'Pet inventory import',
  locksmith_import: 'Locksmith import',
  lost_and_found: "Borgen's Lost and Found",
  museum_tools: 'Museum Tools',
  quest_source: 'Quest/source tooling',
  local_reference_review: 'Local reference review',
  manual: 'Manual',
  other: 'Other',
};

function formatDateTime(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value || 'Unknown';
  }

  return parsedDate.toLocaleString();
}

function downloadCsv(filename: string, content: string): void {
  downloadTextFile(filename, `${content}\n`, 'text/csv;charset=utf-8');
}

export function UnknownItemReviewPage() {
  const [state, setState] = useState<UnknownItemEvidenceState>(() => loadUnknownItemEvidenceState());
  const [stateFilter, setStateFilter] = useState<UnknownItemReviewState | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<UnknownItemEvidenceSourceType | 'all'>('all');
  const groups = useMemo(() => groupUnknownItemEvidence(state), [state]);
  const filteredGroups = groups.filter((group) => {
    const matchesState = stateFilter === 'all' || group.reviewState === stateFilter;
    const matchesSource = sourceFilter === 'all' || group.sourceTypes.includes(sourceFilter);
    return matchesState && matchesSource;
  });
  const availableSourceTypes = [...new Set(groups.flatMap((group) => group.sourceTypes))].sort((left, right) =>
    SOURCE_TYPE_LABELS[left].localeCompare(SOURCE_TYPE_LABELS[right]),
  );
  const reviewedIconCandidateCount = groups.filter((group) => {
    return group.reviewState === 'reviewed' && group.targetDestination === 'buddy_icon_candidates';
  }).length;

  function persist(nextState: UnknownItemEvidenceState): void {
    setState(saveUnknownItemEvidenceState(nextState));
  }

  function handleAddFirstBatch(): void {
    persist(addUnknownItemEvidenceRecords(state, createFirstUnknownInventoryBatchEvidence()));
  }

  function handleReviewChange(
    normalizedKey: string,
    displayName: string,
    reviewState: Exclude<UnknownItemReviewState, 'new'>,
    targetDestination: UnknownItemPromotionTarget,
    notes: string,
  ): void {
    persist(
      setUnknownItemReviewDecision(state, {
        normalizedKey,
        displayName,
        reviewState,
        targetDestination,
        notes,
      }),
    );
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Unknown Item Review"
        storageKey="unknown-item-review"
        description="Review unknown item evidence gathered from imports and helper tools before preparing data or icon candidates."
      />

      <section className="page-card page-stack" aria-labelledby="unknown-item-summary-title">
        <div className="section-heading-row">
          <div>
            <h2 id="unknown-item-summary-title">Review Queue</h2>
            <p className="supporting-text">
              This queue is local review state only. Exports are candidates for manual data work and do not update canonical data.
            </p>
          </div>
          <div className="button-row">
            <button className="button" onClick={handleAddFirstBatch} type="button">
              Add First Unknown Batch
            </button>
            <button
              className="button"
              disabled={groups.length === 0}
              onClick={() => downloadCsv('unknown-item-promotion-review.csv', toUnknownItemPromotionReviewCsv(groups))}
              type="button"
            >
              Export Promotion Review CSV
            </button>
            <button
              className="button"
              disabled={reviewedIconCandidateCount === 0}
              onClick={() => downloadCsv('unknown-item-icon-candidates.csv', toUnknownItemIconCandidateCsv(groups))}
              type="button"
            >
              Export Icon Candidates CSV
            </button>
          </div>
        </div>

        <dl className="summary-grid">
          <div className="summary-grid__item">
            <dt>Unknown groups</dt>
            <dd>{groups.length.toLocaleString()}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>New</dt>
            <dd>{groups.filter((group) => group.reviewState === 'new').length.toLocaleString()}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Reviewed</dt>
            <dd>{groups.filter((group) => group.reviewState === 'reviewed').length.toLocaleString()}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Icon candidates</dt>
            <dd>{reviewedIconCandidateCount.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="page-card page-stack" aria-labelledby="unknown-item-filters-title">
        <h2 id="unknown-item-filters-title">Filters</h2>
        <div className="filter-grid">
          <label className="field-label" htmlFor="unknown-item-state-filter">
            Review state
            <select
              className="text-input"
              id="unknown-item-state-filter"
              onChange={(event) => setStateFilter(event.target.value as UnknownItemReviewState | 'all')}
              value={stateFilter}
            >
              <option value="all">All states</option>
              <option value="new">New</option>
              <option value="needs_more_evidence">Needs more evidence</option>
              <option value="reviewed">Reviewed</option>
              <option value="ignored">Ignored</option>
            </select>
          </label>
          <label className="field-label" htmlFor="unknown-item-source-filter">
            Source
            <select
              className="text-input"
              id="unknown-item-source-filter"
              onChange={(event) => setSourceFilter(event.target.value as UnknownItemEvidenceSourceType | 'all')}
              value={sourceFilter}
            >
              <option value="all">All sources</option>
              {availableSourceTypes.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {SOURCE_TYPE_LABELS[sourceType]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="page-card page-stack" aria-labelledby="unknown-item-list-title">
        <h2 id="unknown-item-list-title">Items</h2>
        {filteredGroups.length > 0 ? (
          <ul className="unknown-item-list">
            {filteredGroups.map((group) => {
              const sample = group.evidenceRecords[0];

              return (
                <li className="unknown-item-card" key={group.normalizedKey}>
                  <div className="unknown-item-card__header">
                    <div>
                      <h3>{group.displayName}</h3>
                      <p className="supporting-text">{group.normalizedKey}</p>
                    </div>
                    <span className="status-pill">{UNKNOWN_ITEM_REVIEW_STATE_LABELS[group.reviewState]}</span>
                  </div>
                  <dl className="compact-stat-grid">
                    <div>
                      <dt>Occurrences</dt>
                      <dd>{group.totalOccurrences.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Sources</dt>
                      <dd>{group.sourceLabels.join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Last seen</dt>
                      <dd>{formatDateTime(group.lastSeenAt)}</dd>
                    </div>
                  </dl>
                  {sample ? (
                    <details className="advanced-details">
                      <summary className="advanced-details__summary">Evidence sample</summary>
                      <p>{sample.sampleContext || sample.warningText || 'No sample context saved.'}</p>
                    </details>
                  ) : null}
                  <div className="filter-grid">
                    <label className="field-label" htmlFor={`${group.normalizedKey}-state`}>
                      Review decision
                      <select
                        className="text-input"
                        id={`${group.normalizedKey}-state`}
                        onChange={(event) =>
                          handleReviewChange(
                            group.normalizedKey,
                            group.displayName,
                            event.target.value as Exclude<UnknownItemReviewState, 'new'>,
                            group.targetDestination,
                            group.notes,
                          )
                        }
                        value={group.reviewState === 'new' ? 'needs_more_evidence' : group.reviewState}
                      >
                        <option value="needs_more_evidence">Needs more evidence</option>
                        <option value="reviewed">Reviewed for export</option>
                        <option value="ignored">Ignored</option>
                      </select>
                    </label>
                    <label className="field-label" htmlFor={`${group.normalizedKey}-target`}>
                      Promotion target
                      <select
                        className="text-input"
                        id={`${group.normalizedKey}-target`}
                        onChange={(event) =>
                          handleReviewChange(
                            group.normalizedKey,
                            group.displayName,
                            group.reviewState === 'new' ? 'needs_more_evidence' : group.reviewState,
                            event.target.value as UnknownItemPromotionTarget,
                            group.notes,
                          )
                        }
                        value={group.targetDestination}
                      >
                        {Object.entries(UNKNOWN_ITEM_PROMOTION_TARGET_LABELS).map(([target, label]) => (
                          <option key={target} value={target}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field-label" htmlFor={`${group.normalizedKey}-notes`}>
                    Review notes
                    <textarea
                      className="text-input"
                      id={`${group.normalizedKey}-notes`}
                      onBlur={(event) =>
                        handleReviewChange(
                          group.normalizedKey,
                          group.displayName,
                          group.reviewState === 'new' ? 'needs_more_evidence' : group.reviewState,
                          group.targetDestination,
                          event.target.value,
                        )
                      }
                      placeholder="Evidence, naming notes, or why this needs more review."
                      rows={2}
                      defaultValue={group.notes}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state">No unknown item evidence matches these filters yet.</p>
        )}
      </section>
    </div>
  );
}
