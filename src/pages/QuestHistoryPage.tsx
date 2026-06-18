import { useEffect, useMemo, useState } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import { getItemIcon } from '../lib/itemIconManifest';
import { loadQuestReference, type QuestReferenceData } from '../lib/loadQuestReference';
import {
  parseCompletedRequestsPaste,
  type CompletedRequestsPasteParseResult,
} from '../lib/parseCompletedRequestsPaste';
import { deriveQuestHistoryAnalytics } from '../lib/questHistoryAnalytics';
import {
  deriveQuestHistoryPlanningAnalytics,
  getQuestFutureDemandScopeLabel,
  type QuestFutureDemandRow,
  type QuestHistoryPlanningAnalytics,
  type QuestlineHeatmapRow,
  type QuestlineProgressSummary,
} from '../lib/questHistoryPlanning';
import {
  addQuestHistoryImport,
  createQuestHistoryImport,
  loadQuestHistoryState,
  saveQuestHistoryState,
  type QuestHistoryState,
} from '../lib/questHistoryState';
import { loadQuestPlannerState, type QuestPlannerState } from '../lib/questPlannerState';

type QuestHistoryResourceState = {
  isLoading: boolean;
  error: string | null;
  referenceData: QuestReferenceData | null;
  historyState: QuestHistoryState;
  questPlannerState: QuestPlannerState | null;
};

const EMPTY_HISTORY_STATE: QuestHistoryState = {
  schemaVersion: 1,
  imports: [],
};

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }

  return `${value.toFixed(value < 10 ? 2 : 1)}%`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatQuestlineStatus(status: QuestlineProgressSummary['status']): string {
  switch (status) {
    case 'completed':
      return 'Complete';
    case 'in_progress':
      return 'In progress';
    case 'not_started':
      return 'Not started';
  }
}

function QuestHistoryImportSummary({ preview }: { preview: CompletedRequestsPasteParseResult }) {
  return (
    <div className="page-stack">
      <dl className="compact-stat-grid">
        <div>
          <dt>Completed rows</dt>
          <dd>{preview.summary.completedRowsCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Reported completed</dt>
          <dd>{preview.summary.reportedCompletedCount?.toLocaleString() ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>Active rows found</dt>
          <dd>{preview.summary.activeRowsCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{preview.summary.warningCount.toLocaleString()}</dd>
        </div>
      </dl>
      {preview.warnings.length > 0 ? (
        <ul className="quest-warning-list">
          {preview.warnings.slice(0, 8).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function QuestHistoryDashboard({
  historyState,
  planning,
}: {
  historyState: QuestHistoryState;
  planning: QuestHistoryPlanningAnalytics;
}) {
  const questHistoryAnalytics = deriveQuestHistoryAnalytics(historyState);
  const latestImport = questHistoryAnalytics.latestImport;
  const rarestCompletedQuest = questHistoryAnalytics.rarestCompletedQuests[0] ?? null;
  const fastestMover = questHistoryAnalytics.fastestMovingQuests[0] ?? null;

  return (
    <section className="page-card page-stack" aria-labelledby="quest-history-dashboard-title">
      <h2 id="quest-history-dashboard-title">Quest History Dashboard</h2>
      <dl className="summary-grid">
        <div className="summary-grid__item">
          <dt>Saved imports</dt>
          <dd>{historyState.imports.length.toLocaleString()}</dd>
          <p className="subtle-text">Latest: {formatDate(latestImport?.importedAt ?? null)}</p>
        </div>
        <div className="summary-grid__item">
          <dt>Completed quests</dt>
          <dd>{latestImport?.completedRequests.length.toLocaleString() ?? '0'}</dd>
          <p className="subtle-text">From the latest completed-request import.</p>
        </div>
        <div className="summary-grid__item">
          <dt>Rarest completed</dt>
          <dd>{rarestCompletedQuest?.questName ?? 'n/a'}</dd>
          <p className="subtle-text">{formatPercent(rarestCompletedQuest?.completionPercent ?? null)} completion</p>
        </div>
        <div className="summary-grid__item">
          <dt>Questlines left</dt>
          <dd>{planning.partialQuestlines.length + planning.unstartedQuestlines.length}</dd>
          <p className="subtle-text">
            {planning.partialQuestlines.length.toLocaleString()} started,{' '}
            {planning.unstartedQuestlines.length.toLocaleString()} not started.
          </p>
        </div>
        <div className="summary-grid__item">
          <dt>Fastest mover</dt>
          <dd>{fastestMover?.questName ?? 'n/a'}</dd>
          <p className="subtle-text">
            {fastestMover?.playerCountDelta !== null && fastestMover?.playerCountDelta !== undefined
              ? `+${fastestMover.playerCountDelta.toLocaleString()} players since last import`
              : 'Needs two imports.'}
          </p>
        </div>
        <div className="summary-grid__item">
          <dt>Known future item demand</dt>
          <dd>{planning.futureDemandRows.length.toLocaleString()}</dd>
          <p className="subtle-text">Distinct items in unfinished reviewed quest requirements.</p>
        </div>
      </dl>
      {planning.warnings.length > 0 ? (
        <ul className="quest-warning-list">
          {planning.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function FutureDemandRow({ row }: { row: QuestFutureDemandRow }) {
  const icon = getItemIcon(row.canonicalKey);

  return (
    <li>
      <div className="quest-demand-row">
        <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} iconSrc={icon?.src ?? null} />
        <span>
          <strong>{formatNumber(row.totalQuantity)}</strong>
          <span className="subtle-text"> across {row.questCount.toLocaleString()} unfinished quest(s)</span>
        </span>
        <span className="history-reason-list">
          {row.scopes.map((scope) => (
            <span key={scope.scope} className="history-reason-badge">
              {getQuestFutureDemandScopeLabel(scope.scope)}
            </span>
          ))}
        </span>
      </div>
    </li>
  );
}

function QuestFutureDemandList({ rows }: { rows: QuestFutureDemandRow[] }) {
  const visibleRows = rows.slice(0, 20);

  return (
    <section className="page-card page-stack" aria-labelledby="quest-future-demand-title">
      <div>
        <h2 id="quest-future-demand-title">Future Item Demand</h2>
        <p className="supporting-text">
          Unfinished reviewed quest requirements, subtracting completed quest history and manual Quest Planner completions.
        </p>
      </div>
      {visibleRows.length > 0 ? (
        <ul className="data-list data-list--clickable">
          {visibleRows.map((row) => (
            <FutureDemandRow key={row.canonicalKey} row={row} />
          ))}
        </ul>
      ) : (
        <p className="empty-state">No unfinished item demand can be derived from current quest history yet.</p>
      )}
    </section>
  );
}

function QuestlineProgressList({ rows }: { rows: QuestlineProgressSummary[] }) {
  const visibleRows = rows.slice(0, 40);

  return (
    <section className="page-card page-stack" aria-labelledby="questline-progress-title">
      <div>
        <h2 id="questline-progress-title">Questline Progress</h2>
        <p className="supporting-text">Completed history plus manual active/watched/completed Quest Planner state.</p>
      </div>
      <div className="table-scroll">
        <table className="summary-table quest-history-table">
          <thead>
            <tr>
              <th>Questline</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Next known quest</th>
              <th>Top demand</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.questlineKey}>
                <td>
                  <strong>{row.questlineName}</strong>
                  {row.aliases.length > 0 ? <span className="subtle-text"> {row.aliases.join(', ')}</span> : null}
                </td>
                <td>{formatQuestlineStatus(row.status)}</td>
                <td>
                  <div className="quest-history-progress-cell">
                    <span>{formatPercent(row.completionPercent)}</span>
                    <span className="quest-history-progress-track" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, row.completionPercent)}%` }} />
                    </span>
                    <span className="subtle-text">
                      {row.completedQuests.toLocaleString()} / {row.totalQuests.toLocaleString()}
                    </span>
                  </div>
                </td>
                <td>{row.nextQuest?.questName ?? 'n/a'}</td>
                <td>
                  {row.topFutureDemandRows.length > 0
                    ? row.topFutureDemandRows.map((demandRow) => demandRow.itemName).join(', ')
                    : 'n/a'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuestlineHeatmap({ rows }: { rows: QuestlineHeatmapRow[] }) {
  const [searchText, setSearchText] = useState('');
  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleRows = rows
    .filter((row) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        row.questlineName.toLowerCase().includes(normalizedSearch) ||
        (row.nextQuestName?.toLowerCase().includes(normalizedSearch) ?? false) ||
        row.topDemandItems.some((item) => item.itemName.toLowerCase().includes(normalizedSearch))
      );
    })
    .slice(0, 60);

  return (
    <section className="page-card page-stack" aria-labelledby="questline-heatmap-title">
      <div>
        <h2 id="questline-heatmap-title">Questline Heatmap</h2>
        <p className="supporting-text">A scan-friendly view of chain progress, next known quests, rarity, and big item blockers.</p>
      </div>
      <label className="field-label" htmlFor="questline-heatmap-search">
        Search heatmap
      </label>
      <input
        id="questline-heatmap-search"
        className="text-input"
        type="search"
        value={searchText}
        placeholder="DI, PSA, Lima Bean, Frost Snapper Shell..."
        onChange={(event) => setSearchText(event.target.value)}
      />
      <div className="questline-heatmap-grid">
        {visibleRows.map((row) => (
          <article key={row.questlineKey} className={`questline-heatmap-card questline-heatmap-card--${row.status}`}>
            <div>
              <h3>{row.questlineName}</h3>
              <p className="subtle-text">
                {row.completedQuests.toLocaleString()} / {row.totalQuests.toLocaleString()} complete
              </p>
            </div>
            <div className="quest-history-progress-track" aria-label={`${row.questlineName} progress`}>
              <span style={{ width: `${Math.min(100, row.completionPercent)}%` }} />
            </div>
            <dl className="compact-stat-grid">
              <div>
                <dt>Next</dt>
                <dd>{row.nextQuestName ?? 'n/a'}</dd>
              </div>
              <div>
                <dt>Rarest completed</dt>
                <dd>
                  {row.rarestCompletedQuestName
                    ? `${row.rarestCompletedQuestName} (${formatPercent(row.rarestCompletedPercent)})`
                    : 'n/a'}
                </dd>
              </div>
            </dl>
            {row.topDemandItems.length > 0 ? (
              <ul className="quest-inline-list">
                {row.topDemandItems.map((item) => (
                  <li key={item.canonicalKey}>
                    <ItemProfileLink
                      canonicalKey={item.canonicalKey}
                      itemName={`${item.itemName} (${formatNumber(item.totalQuantity)})`}
                      iconSrc={getItemIcon(item.canonicalKey)?.src ?? null}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ImportHistoryList({ state }: { state: QuestHistoryState }) {
  return (
    <section className="page-card page-stack" aria-labelledby="quest-import-history-title">
      <h2 id="quest-import-history-title">Saved Imports</h2>
      {state.imports.length > 0 ? (
        <ul className="data-list">
          {state.imports.slice(0, 10).map((questImport) => (
            <li key={questImport.importId}>
              <div className="recipe-link-row">
                <strong>{formatDate(questImport.importedAt)}</strong>
                <span>
                  {questImport.completedRequests.length.toLocaleString()} completed rows;{' '}
                  {questImport.activeRequests.length.toLocaleString()} active rows;{' '}
                  {questImport.warnings.length.toLocaleString()} warning(s)
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No completed-request imports have been saved yet.</p>
      )}
    </section>
  );
}

export function QuestHistoryPage() {
  const [resourcesState, setResourcesState] = useState<QuestHistoryResourceState>({
    isLoading: true,
    error: null,
    referenceData: null,
    historyState: EMPTY_HISTORY_STATE,
    questPlannerState: null,
  });
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<CompletedRequestsPasteParseResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadResources(): Promise<void> {
      try {
        const [referenceData] = await Promise.all([loadQuestReference()]);
        const historyState = loadQuestHistoryState();
        const questPlannerState = loadQuestPlannerState();

        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: null,
          referenceData,
          historyState,
          questPlannerState,
        });
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load quest history resources.',
          referenceData: null,
          historyState: EMPTY_HISTORY_STATE,
          questPlannerState: null,
        });
      }
    }

    void loadResources();

    return () => {
      isMounted = false;
    };
  }, []);

  const planning = useMemo(() => {
    if (!resourcesState.referenceData) {
      return null;
    }

    return deriveQuestHistoryPlanningAnalytics({
      state: resourcesState.historyState,
      questPlannerState: resourcesState.questPlannerState,
      referenceData: resourcesState.referenceData,
    });
  }, [resourcesState.historyState, resourcesState.questPlannerState, resourcesState.referenceData]);

  function handlePreview(): void {
    const nextPreview = parseCompletedRequestsPaste(pasteText);
    setPreview(nextPreview);
    setSaveMessage(null);
  }

  function handleSaveImport(): void {
    const questImport = createQuestHistoryImport({ rawText: pasteText });
    const nextState = saveQuestHistoryState(addQuestHistoryImport(resourcesState.historyState, questImport));

    setResourcesState((currentState) => ({
      ...currentState,
      historyState: nextState,
    }));
    setPreview({
      completedRequests: questImport.completedRequests,
      activeRequests: questImport.activeRequests,
      summary: questImport.summary,
      warnings: questImport.warnings,
    });
    setSaveMessage(`Saved ${questImport.completedRequests.length.toLocaleString()} completed quest rows.`);
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Quest History"
        description="Import completed requests, review rarity and community movement, and connect unfinished quest demand back to item pages."
        storageKey="quest-history"
      />

      {resourcesState.isLoading ? <p className="empty-state">Loading quest history resources...</p> : null}

      {!resourcesState.isLoading && resourcesState.error ? (
        <p className="status-message status-message--error">{resourcesState.error}</p>
      ) : null}

      {!resourcesState.isLoading && resourcesState.referenceData && planning ? (
        <>
          <section className="page-card page-stack" aria-labelledby="quest-history-import-title">
            <div>
              <h2 id="quest-history-import-title">Import Completed Requests</h2>
              <p className="supporting-text">
                Paste the noisy FarmRPG Completed Requests page. The parser keeps completed quest rows and ignores page chrome.
              </p>
            </div>
            <textarea
              className="text-area quest-paste-input"
              value={pasteText}
              placeholder="Paste Completed Requests here..."
              onChange={(event) => setPasteText(event.target.value)}
            />
            <div className="button-row">
              <button type="button" className="button" onClick={handlePreview} disabled={!pasteText.trim()}>
                Preview
              </button>
              <button type="button" className="button button--primary" onClick={handleSaveImport} disabled={!pasteText.trim()}>
                Save import
              </button>
            </div>
            {saveMessage ? <p className="status-message">{saveMessage}</p> : null}
            {preview ? <QuestHistoryImportSummary preview={preview} /> : null}
          </section>

          <QuestHistoryDashboard historyState={resourcesState.historyState} planning={planning} />
          <QuestFutureDemandList rows={planning.futureDemandRows} />
          <QuestlineProgressList rows={planning.questlineSummaries} />
          <QuestlineHeatmap rows={planning.heatmapRows} />
          <ImportHistoryList state={resourcesState.historyState} />
        </>
      ) : null}
    </div>
  );
}
