import { useEffect, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  createMuseumKnownBaseline,
  deriveMuseumRefreshWorkflow,
  toMuseumRefreshActionableCsv,
  type MuseumCoverageInputs,
  type MuseumRefreshWorkflowResult,
} from '../lib/deriveMuseumRefreshWorkflow';
import {
  toBuddyFarmCandidateReviewCsv,
  toBuddyFarmCandidatesCsv,
  toBuddyFarmCandidatesJson,
} from '../lib/generateBuddyFarmCandidates';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { loadRecipeGraph } from '../lib/loadRecipeGraph';
import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import {
  clearMuseumKnownBaseline,
  loadMuseumKnownBaseline,
  saveMuseumKnownBaseline,
} from '../lib/museumKnownBaselineStorage';
import { parseMuseumExport, toMuseumSeedCsv, toMuseumSeedJson, type MuseumParseResult } from '../lib/parseMuseumExport';

const MUSEUM_PLACEHOLDER = `Farm RPG
Back
Museum

Fish (2 / 3)
Blue Catfish
Blue Catfish
Yellow Perch

Artifacts 2 / 2
Chef's Hat 2
Chef's Hat 2`;

const EMPTY_COVERAGE: MuseumCoverageInputs = {
  masteryEntries: [],
  towerEntries: [],
  recipeRows: [],
};

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatExpectedCounts(ownedCount: number | null, totalCount: number | null): string {
  if (ownedCount === null || totalCount === null) {
    return 'No header counts detected';
  }

  return `${ownedCount.toLocaleString()} / ${totalCount.toLocaleString()}`;
}

function formatValidationLabel(validation: string): string {
  switch (validation) {
    case 'matches_total':
      return 'Matches total count';
    case 'matches_owned':
      return 'Matches owned count only';
    case 'mismatch':
      return 'Count mismatch';
    default:
      return 'No count validation';
  }
}

function formatSavedAt(savedAt: string): string {
  const parsedDate = new Date(savedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return savedAt;
  }

  return parsedDate.toLocaleString();
}

export function MuseumToolsPage() {
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<MuseumParseResult | null>(null);
  const [workflowResult, setWorkflowResult] = useState<MuseumRefreshWorkflowResult | null>(null);
  const [workflowMode, setWorkflowMode] = useState<'bootstrap' | 'incremental' | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [baselineMessage, setBaselineMessage] = useState<string | null>(null);
  const [savedBaseline, setSavedBaseline] = useState(() => loadMuseumKnownBaseline());
  const [coverage, setCoverage] = useState<MuseumCoverageInputs>(EMPTY_COVERAGE);
  const [coverageStatus, setCoverageStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [coverageMessage, setCoverageMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCoverage(): Promise<void> {
      try {
        const [masteryDifficulty, towerRequirements, recipeGraph] = await Promise.all([
          loadMasteryDifficulty(),
          loadTowerRequirements(),
          loadRecipeGraph(),
        ]);

        if (!isActive) {
          return;
        }

        setCoverage({
          masteryEntries: masteryDifficulty.entries,
          towerEntries: towerRequirements.entries,
          recipeRows: recipeGraph.recipes,
        });
        setCoverageStatus('ready');
        setCoverageMessage(null);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setCoverage(EMPTY_COVERAGE);
        setCoverageStatus('error');
        setCoverageMessage(
          error instanceof Error
            ? `${error.message} Coverage follow-up counts are using empty local reference data for now.`
            : 'Unable to load local reference coverage data. Coverage follow-up counts are using empty local reference data for now.',
        );
      }
    }

    void loadCoverage();

    return () => {
      isActive = false;
    };
  }, []);

  function runWorkflow(nextMode: 'bootstrap' | 'incremental', nextBaseline = savedBaseline): void {
    setExportMessage(null);
    setBaselineMessage(null);

    if (!rawText.trim()) {
      setParseResult(null);
      setWorkflowResult(null);
      setWorkflowMode(nextMode);
      setValidationMessage('Paste a Farm RPG museum export before running the museum workflow.');
      return;
    }

    const nextParseResult = parseMuseumExport(rawText);
    setParseResult(nextParseResult);
    setWorkflowMode(nextMode);

    if (nextParseResult.parseSummary.uniqueItemsParsed === 0) {
      setWorkflowResult(null);
      setValidationMessage('No museum items were detected in that paste.');
      return;
    }

    if (nextMode === 'incremental' && !nextBaseline) {
      setWorkflowResult(null);
      setValidationMessage('Save a bootstrap baseline first before running incremental refresh.');
      return;
    }

    setWorkflowResult(deriveMuseumRefreshWorkflow(nextParseResult, coverage, nextBaseline));
    setValidationMessage(null);
  }

  function handleSaveBaseline(): void {
    if (!workflowResult || !parseResult) {
      return;
    }

    const nextBaseline = createMuseumKnownBaseline(workflowResult);
    saveMuseumKnownBaseline(nextBaseline);
    setSavedBaseline(nextBaseline);
    setBaselineMessage('Current museum item set saved as the local bootstrap baseline.');
    setWorkflowResult(deriveMuseumRefreshWorkflow(parseResult, coverage, nextBaseline));
  }

  function handleClearBaseline(): void {
    clearMuseumKnownBaseline();
    setSavedBaseline(null);
    setBaselineMessage('Saved museum baseline cleared.');

    if (!parseResult || !workflowResult) {
      return;
    }

    if (workflowMode === 'incremental') {
      setWorkflowResult(null);
      setValidationMessage('Saved museum baseline cleared. Run a bootstrap pass before using incremental refresh again.');
      return;
    }

    setWorkflowResult(deriveMuseumRefreshWorkflow(parseResult, coverage, null));
  }

  function handleExportSeedJson(): void {
    if (!parseResult) {
      return;
    }

    downloadTextFile('museum_seed.json', toMuseumSeedJson(parseResult), 'application/json;charset=utf-8');
    setExportMessage('Museum seed JSON downloaded.');
  }

  function handleExportSeedCsv(): void {
    if (!parseResult) {
      return;
    }

    downloadTextFile('museum_seed.csv', toMuseumSeedCsv(parseResult), 'text/csv;charset=utf-8');
    setExportMessage('Museum seed CSV downloaded.');
  }

  function handleExportCandidateJson(): void {
    if (!workflowResult) {
      return;
    }

    downloadTextFile(
      'buddy_item_candidates.json',
      toBuddyFarmCandidatesJson(workflowResult.candidateResult),
      'application/json;charset=utf-8',
    );
    setExportMessage('Buddy candidate JSON downloaded.');
  }

  function handleExportCandidateCsv(): void {
    if (!workflowResult) {
      return;
    }

    downloadTextFile(
      'buddy_item_candidates.csv',
      toBuddyFarmCandidatesCsv(workflowResult.candidateResult),
      'text/csv;charset=utf-8',
    );
    setExportMessage('Buddy candidate CSV downloaded.');
  }

  function handleExportCandidateReviewCsv(): void {
    if (!workflowResult) {
      return;
    }

    downloadTextFile(
      'buddy_item_candidates_review.csv',
      toBuddyFarmCandidateReviewCsv(workflowResult.candidateResult),
      'text/csv;charset=utf-8',
    );
    setExportMessage('Buddy candidate review CSV downloaded.');
  }

  function handleExportActionableCsv(): void {
    if (!workflowResult) {
      return;
    }

    downloadTextFile(
      'museum_refresh_follow_up.csv',
      toMuseumRefreshActionableCsv(workflowResult.actionableItems),
      'text/csv;charset=utf-8',
    );
    setExportMessage('Museum refresh follow-up CSV downloaded.');
  }

  const runButtonsDisabled = coverageStatus === 'loading';

  return (
    <div className="page-stack">
      <PageIntro
        title="Museum Tools"
        description="Run a paste-once local museum refresh that chains parsing, buddy candidate generation, and local coverage follow-up reporting without adding live runtime scraping."
      />

      <section className="page-card page-stack" aria-labelledby="museum-tools-input-title">
        <div>
          <h2 id="museum-tools-input-title">Paste Museum Export</h2>
          <p className="supporting-text">
            This dev-facing local workflow keeps raw pasted input, parsed seed output, generated buddy candidates, and
            local follow-up reporting distinct while avoiding the old paste-parse-paste-again loop.
          </p>
        </div>

        <label className="field-label" htmlFor="museum-export">
          Raw museum export
        </label>
        <textarea
          id="museum-export"
          className="text-area"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder={MUSEUM_PLACEHOLDER}
          rows={14}
        />
        <p className="supporting-text">
          The parser ignores obvious UI lines, removes duplicated icon/text artifacts, and uses your pasted museum
          export as the primary source so incremental refreshes stay local-first and respectful of the server.
        </p>

        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={() => runWorkflow('bootstrap')}
            disabled={runButtonsDisabled}
          >
            Run Bootstrap Pass
          </button>
          <button
            type="button"
            className="button"
            onClick={() => runWorkflow('incremental')}
            disabled={runButtonsDisabled || !savedBaseline}
          >
            Run Incremental Refresh
          </button>
          <button
            type="button"
            className="button"
            onClick={handleSaveBaseline}
            disabled={!workflowResult || workflowMode !== 'bootstrap'}
          >
            Save Bootstrap Baseline
          </button>
          <button type="button" className="button" onClick={handleClearBaseline} disabled={!savedBaseline}>
            Clear Saved Baseline
          </button>
        </div>

        {coverageStatus === 'loading' ? (
          <p className="status-message">Loading local mastery, tower, and recipe coverage data…</p>
        ) : null}
        {coverageMessage ? <p className="status-message">{coverageMessage}</p> : null}
        {savedBaseline ? (
          <p className="status-message status-message--success">
            Saved baseline: {savedBaseline.items.length.toLocaleString()} items as of {formatSavedAt(savedBaseline.savedAt)}.
          </p>
        ) : (
          <p className="status-message">
            No saved museum baseline yet. Use bootstrap mode once, then save the parsed result locally for future
            incremental refreshes.
          </p>
        )}
        {validationMessage ? <p className="status-message">{validationMessage}</p> : null}
        {baselineMessage ? <p className="status-message status-message--success">{baselineMessage}</p> : null}
        {exportMessage ? <p className="status-message status-message--success">{exportMessage}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="museum-tools-summary-title">
        <div>
          <h2 id="museum-tools-summary-title">
            {workflowMode === 'incremental' ? 'Incremental Refresh Report' : 'Bootstrap Workflow Report'}
          </h2>
          <p className="supporting-text">
            Bootstrap mode establishes a local known museum baseline and buddy candidate set. Incremental refresh mode
            compares the latest full museum export against that saved baseline plus current local reference coverage,
            then surfaces only new or still-uncovered items.
          </p>
        </div>

        {!workflowResult ? (
          <p className="empty-state">
            No chained museum workflow run yet. Paste a museum export, then run a bootstrap pass or incremental
            refresh.
          </p>
        ) : (
          <>
            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Parsed museum items</dt>
                <dd>{workflowResult.summary.itemsParsed.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Known baseline items</dt>
                <dd>{workflowResult.summary.knownBaselineItemCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Newly discovered items</dt>
                <dd>{workflowResult.summary.newItemsCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Unmatched items</dt>
                <dd>{workflowResult.summary.unmatchedItemsCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Missing buddy slug coverage</dt>
                <dd>{workflowResult.summary.missingBuddySlugCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Missing recipe coverage</dt>
                <dd>{workflowResult.summary.missingRecipeCoverageCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Candidate review rows</dt>
                <dd>{workflowResult.summary.candidateReviewCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Actionable items surfaced</dt>
                <dd>{workflowResult.summary.actionableItemsCount.toLocaleString()}</dd>
              </div>
            </dl>

            <div className="button-row">
              <button type="button" className="button button--primary" onClick={handleExportSeedJson}>
                Export Seed JSON
              </button>
              <button type="button" className="button" onClick={handleExportSeedCsv}>
                Export Seed CSV
              </button>
              <button type="button" className="button" onClick={handleExportCandidateJson}>
                Export Candidate JSON
              </button>
              <button type="button" className="button" onClick={handleExportCandidateCsv}>
                Export Candidate CSV
              </button>
              <button
                type="button"
                className="button"
                onClick={handleExportCandidateReviewCsv}
                disabled={workflowResult.candidateResult.reviewItems.length === 0}
              >
                Export Candidate Review CSV
              </button>
              <button type="button" className="button" onClick={handleExportActionableCsv}>
                Export Follow-Up CSV
              </button>
            </div>

            {workflowResult.warnings.length > 0 ? (
              <div className="page-stack">
                <h3 className="section-title">Workflow Warnings</h3>
                <ul className="data-list">
                  {workflowResult.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="page-stack">
              <h3 className="section-title">
                {workflowMode === 'incremental' ? 'New Or Uncovered Items' : 'Bootstrap Follow-Up Items'}
              </h3>
              {workflowResult.actionableItems.length === 0 ? (
                <p className="empty-state">
                  {workflowMode === 'incremental'
                    ? 'No new or still-uncovered items were found in this incremental refresh.'
                    : 'No bootstrap follow-up items are currently flagged.'}
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="summary-table">
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">New</th>
                        <th scope="col">Reference</th>
                        <th scope="col">Buddy slug</th>
                        <th scope="col">Recipe</th>
                        <th scope="col">Candidate review</th>
                        <th scope="col">Follow-up</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workflowResult.actionableItems.map((item) => (
                        <tr key={item.canonicalKey}>
                          <td>
                            <strong>{item.itemName}</strong>
                            <p className="subtle-text">
                              {item.canonicalKey}
                              {' | '}
                              {item.candidateBuddyUrl}
                            </p>
                          </td>
                          <td>{item.isNewSinceBaseline ? 'New' : 'Known'}</td>
                          <td>{item.hasAnyReferenceCoverage ? 'Covered' : 'Missing'}</td>
                          <td>{item.hasLocalBuddySlugCoverage ? 'Covered' : 'Missing'}</td>
                          <td>{item.hasRecipeCoverage ? 'Covered' : 'Missing or intentional'}</td>
                          <td>{item.needsCandidateReview ? item.flags.join(', ') : 'No review needed'}</td>
                          <td>
                            {item.followUpReasons.join(' ')}
                            {!item.hasRecipeCoverage ? (
                              <p className="subtle-text">
                                Recipe coverage is reported separately so known museum items can remain intentionally
                                non-recipe-covered.
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="page-card page-stack" aria-labelledby="museum-tools-preview-title">
        <div>
          <h2 id="museum-tools-preview-title">Parsed Seed Preview</h2>
          <p className="supporting-text">
            The parsed museum seed remains distinct from the saved baseline and from later canonical outputs. Use this
            view to inspect the current pasted export before any downstream probe, recipe, or icon work.
          </p>
        </div>

        {!parseResult || parseResult.parseSummary.uniqueItemsParsed === 0 ? (
          <p className="empty-state">No parsed museum seed yet. Paste an export and run the museum workflow.</p>
        ) : (
          <>
            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Categories parsed</dt>
                <dd>{parseResult.parseSummary.categoriesParsed.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Unique seed items</dt>
                <dd>{parseResult.parseSummary.uniqueItemsParsed.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Duplicate artifacts removed</dt>
                <dd>{parseResult.parseSummary.duplicateArtifactsRemoved.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Parse warnings</dt>
                <dd>{parseResult.parseSummary.warnings.length.toLocaleString()}</dd>
              </div>
            </dl>

            <div className="page-stack">
              <h3 className="section-title">Parsed Categories</h3>
              <div className="table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Derived type</th>
                      <th scope="col">Header counts</th>
                      <th scope="col">Parsed items</th>
                      <th scope="col">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.categories.map((category) => (
                      <tr key={category.categoryName}>
                        <td>{category.categoryName}</td>
                        <td>
                          {category.items[0]
                            ? parseResult.uniqueItems.find((item) => item.categoryName === category.categoryName)
                                ?.category ?? '-'
                            : '-'}
                        </td>
                        <td>{formatExpectedCounts(category.expectedOwnedCount, category.expectedTotalCount)}</td>
                        <td>{category.parsedItemCount.toLocaleString()}</td>
                        <td>{formatValidationLabel(category.countValidation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="page-stack">
              <h3 className="section-title">Grouped Seed List</h3>
              {parseResult.categories.map((category) => (
                <div key={category.categoryName} className="page-stack page-stack--tight">
                  <h4 className="section-title">
                    {category.categoryName} ({category.items.length.toLocaleString()})
                  </h4>
                  <ul className="data-list">
                    {category.items.map((item) => (
                      <li key={`${category.categoryName}-${item.canonicalKey}`}>
                        <div>
                          <strong>{item.itemName}</strong>
                          <p className="subtle-text">
                            {item.canonicalKey}
                            {' | '}Obtainable: {item.obtainable ? 'Y' : 'N'}
                          </p>
                        </div>
                        <span>
                          {parseResult.uniqueItems.find(
                            (seedItem) =>
                              seedItem.categoryName === category.categoryName &&
                              seedItem.canonicalKey === item.canonicalKey,
                          )?.category ?? '-'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
