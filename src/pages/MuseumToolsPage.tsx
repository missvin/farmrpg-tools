import { useEffect, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  createMuseumKnownBaseline,
  createMuseumUnresolvedTriageKey,
  deriveMuseumRefreshWorkflow,
  toMuseumRefreshCandidateReviewCsv,
  toMuseumRefreshActionableCsv,
  toMuseumUnresolvedTriageCsv,
  type MuseumCoverageInputs,
  type MuseumRefreshWorkflowResult,
} from '../lib/deriveMuseumRefreshWorkflow';
import {
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
import {
  clearMuseumCandidateReviewMarks,
  clearMuseumCandidateReviewedMark,
  loadMuseumCandidateReviewMarks,
  markMuseumCandidateReviewed,
} from '../lib/museumCandidateReviewStorage';
import {
  clearMuseumUnresolvedTriagedMark,
  clearMuseumUnresolvedTriageMarks,
  loadMuseumUnresolvedTriageMarks,
  markMuseumUnresolvedTriaged,
} from '../lib/museumUnresolvedTriageStorage';
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

function formatRecipeCoverageLabel(status: MuseumRefreshWorkflowResult['items'][number]['recipeCoverageStatus']): string {
  switch (status) {
    case 'covered':
      return 'Covered';
    case 'missing_expected':
      return 'Missing expected coverage';
    case 'not_expected':
      return 'No recipe expected';
    default:
      return 'Expectation unresolved';
  }
}

function formatBuddySlugCoverageLabel(
  status: MuseumRefreshWorkflowResult['items'][number]['buddySlugCoverageStatus'],
): string {
  switch (status) {
    case 'covered_local':
      return 'Locally covered';
    case 'derived_candidate_ready':
      return 'Auto-derived candidate ready';
    case 'missing_known_expected':
      return 'True missing expected slug';
    case 'missing_new_item':
      return 'New item follow-up';
    case 'candidate_review_needed':
      return 'Candidate needs review';
    case 'candidate_reviewed':
      return 'Candidate reviewed';
    default:
      return 'Status unresolved';
  }
}

function formatIconReadyCoverageLabel(
  status: MuseumRefreshWorkflowResult['items'][number]['iconReadyCoverageStatus'],
): string {
  switch (status) {
    case 'maintained_local':
      return 'Maintained local coverage';
    case 'derived_ready':
      return 'Museum-only icon-ready';
    case 'reviewed_candidate':
      return 'Reviewed icon-ready candidate';
    default:
      return 'Not icon-ready yet';
  }
}

function formatPlanningReferenceLabel(
  status: MuseumRefreshWorkflowResult['items'][number]['planningReferenceStatus'],
): string {
  switch (status) {
    case 'matched_local':
      return 'Matched local coverage';
    case 'museum_only_icon_ready':
      return 'Museum-only / icon-ready';
    case 'missing_planning_reference':
      return 'Missing planning reference';
    case 'likely_name_mismatch':
      return 'Likely naming mismatch';
    default:
      return 'Truly unresolved';
  }
}

function formatCandidateReviewLabel(
  status: MuseumRefreshWorkflowResult['items'][number]['candidateReviewStatus'],
  flags: string[],
): string {
  if (status === 'review_needed') {
    return flags.join(', ');
  }

  if (status === 'reviewed') {
    return 'Reviewed locally';
  }

  return 'No review needed';
}

function formatUnresolvedCaseLabel(
  status: MuseumRefreshWorkflowResult['items'][number]['unresolvedCaseType'],
): string {
  switch (status) {
    case 'likely_name_mismatch':
      return 'Likely naming mismatch';
    case 'collision_or_ambiguity':
      return 'Collision or ambiguity';
    case 'slug_edge_case':
      return 'Slug edge case';
    case 'likely_new_item':
      return 'Likely new local item';
    case 'missing_planning_reference':
      return 'Missing planning reference';
    default:
      return 'Not unresolved';
  }
}

type UnresolvedSortMode = 'case_then_name' | 'name' | 'likely_matches';

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
  const [reviewedCandidateMarks, setReviewedCandidateMarks] = useState(() => loadMuseumCandidateReviewMarks());
  const [triagedUnresolvedMarks, setTriagedUnresolvedMarks] = useState(() => loadMuseumUnresolvedTriageMarks());
  const [unresolvedSortMode, setUnresolvedSortMode] = useState<UnresolvedSortMode>('case_then_name');
  const [unresolvedCaseFilter, setUnresolvedCaseFilter] = useState<
    'all' | NonNullable<MuseumRefreshWorkflowResult['items'][number]['unresolvedCaseType']>
  >('all');
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

    setWorkflowResult(
      deriveMuseumRefreshWorkflow(nextParseResult, coverage, nextBaseline, {
        reviewedCandidateKeys: reviewedCandidateMarks.map((mark) => mark.reviewKey),
        triagedUnresolvedKeys: triagedUnresolvedMarks.map((mark) => mark.triageKey),
      }),
    );
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
    setWorkflowResult(
      deriveMuseumRefreshWorkflow(parseResult, coverage, nextBaseline, {
        reviewedCandidateKeys: reviewedCandidateMarks.map((mark) => mark.reviewKey),
        triagedUnresolvedKeys: triagedUnresolvedMarks.map((mark) => mark.triageKey),
      }),
    );
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

    setWorkflowResult(
      deriveMuseumRefreshWorkflow(parseResult, coverage, null, {
        reviewedCandidateKeys: reviewedCandidateMarks.map((mark) => mark.reviewKey),
        triagedUnresolvedKeys: triagedUnresolvedMarks.map((mark) => mark.triageKey),
      }),
    );
  }

  function handleMarkCandidateReviewed(item: MuseumRefreshWorkflowResult['items'][number]): void {
    const reviewKey = item.candidateReviewKey;
    const nextMark = {
      reviewKey,
      canonicalKey: item.canonicalKey,
      itemName: item.itemName,
      generatedBuddySlug: item.generatedBuddySlug,
      alternateBuddySlug: item.alternateBuddySlug,
      flags: item.flags,
      reviewedAt: new Date().toISOString(),
    };
    const nextMarks = [...reviewedCandidateMarks.filter((mark) => mark.reviewKey !== reviewKey), nextMark];

    markMuseumCandidateReviewed(nextMark);
    setReviewedCandidateMarks(nextMarks);

    if (parseResult) {
      setWorkflowResult(
        deriveMuseumRefreshWorkflow(parseResult, coverage, savedBaseline, {
          reviewedCandidateKeys: nextMarks.map((mark) => mark.reviewKey),
          triagedUnresolvedKeys: triagedUnresolvedMarks.map((mark) => mark.triageKey),
        }),
      );
    }
  }

  function handleClearReviewedCandidate(item: MuseumRefreshWorkflowResult['items'][number]): void {
    const reviewKey = item.candidateReviewKey;
    const nextMarks = reviewedCandidateMarks.filter((mark) => mark.reviewKey !== reviewKey);

    clearMuseumCandidateReviewedMark(reviewKey);
    setReviewedCandidateMarks(nextMarks);

    if (parseResult) {
      setWorkflowResult(
        deriveMuseumRefreshWorkflow(parseResult, coverage, savedBaseline, {
          reviewedCandidateKeys: nextMarks.map((mark) => mark.reviewKey),
          triagedUnresolvedKeys: triagedUnresolvedMarks.map((mark) => mark.triageKey),
        }),
      );
    }
  }

  function handleClearReviewedCandidates(): void {
    clearMuseumCandidateReviewMarks();
    setReviewedCandidateMarks([]);

    if (parseResult) {
      setWorkflowResult(
        deriveMuseumRefreshWorkflow(parseResult, coverage, savedBaseline, {
          reviewedCandidateKeys: [],
          triagedUnresolvedKeys: triagedUnresolvedMarks.map((mark) => mark.triageKey),
        }),
      );
    }
  }

  function handleMarkUnresolvedTriaged(item: MuseumRefreshWorkflowResult['items'][number]): void {
    if (!item.unresolvedCaseType || !item.unresolvedTriageKey) {
      return;
    }

    const triageKey = createMuseumUnresolvedTriageKey(item);
    const nextMark = {
      triageKey,
      canonicalKey: item.canonicalKey,
      itemName: item.itemName,
      unresolvedCaseType: item.unresolvedCaseType,
      generatedBuddySlug: item.generatedBuddySlug,
      alternateBuddySlug: item.alternateBuddySlug,
      reviewedAt: new Date().toISOString(),
    };
    const nextMarks = [...triagedUnresolvedMarks.filter((mark) => mark.triageKey !== triageKey), nextMark];

    markMuseumUnresolvedTriaged(nextMark);
    setTriagedUnresolvedMarks(nextMarks);

    if (parseResult) {
      setWorkflowResult(
        deriveMuseumRefreshWorkflow(parseResult, coverage, savedBaseline, {
          reviewedCandidateKeys: reviewedCandidateMarks.map((mark) => mark.reviewKey),
          triagedUnresolvedKeys: nextMarks.map((mark) => mark.triageKey),
        }),
      );
    }
  }

  function handleClearUnresolvedTriaged(item: MuseumRefreshWorkflowResult['items'][number]): void {
    if (!item.unresolvedTriageKey) {
      return;
    }

    const triageKey = item.unresolvedTriageKey;
    const nextMarks = triagedUnresolvedMarks.filter((mark) => mark.triageKey !== triageKey);

    clearMuseumUnresolvedTriagedMark(triageKey);
    setTriagedUnresolvedMarks(nextMarks);

    if (parseResult) {
      setWorkflowResult(
        deriveMuseumRefreshWorkflow(parseResult, coverage, savedBaseline, {
          reviewedCandidateKeys: reviewedCandidateMarks.map((mark) => mark.reviewKey),
          triagedUnresolvedKeys: nextMarks.map((mark) => mark.triageKey),
        }),
      );
    }
  }

  function handleClearUnresolvedTriagedMarks(): void {
    clearMuseumUnresolvedTriageMarks();
    setTriagedUnresolvedMarks([]);

    if (parseResult) {
      setWorkflowResult(
        deriveMuseumRefreshWorkflow(parseResult, coverage, savedBaseline, {
          reviewedCandidateKeys: reviewedCandidateMarks.map((mark) => mark.reviewKey),
          triagedUnresolvedKeys: [],
        }),
      );
    }
  }

  function handleBulkMarkVisibleUnresolvedTriaged(): void {
    if (!workflowResult) {
      return;
    }

    const unresolvedItems = getVisibleActiveUnresolvedItems(workflowResult.activeUnresolvedItems, unresolvedSortMode, unresolvedCaseFilter);

    if (unresolvedItems.length === 0) {
      return;
    }

    const newMarks = unresolvedItems
      .filter((item) => item.unresolvedCaseType && item.unresolvedTriageKey)
      .map((item) => ({
        triageKey: item.unresolvedTriageKey!,
        canonicalKey: item.canonicalKey,
        itemName: item.itemName,
        unresolvedCaseType: item.unresolvedCaseType!,
        generatedBuddySlug: item.generatedBuddySlug,
        alternateBuddySlug: item.alternateBuddySlug,
        reviewedAt: new Date().toISOString(),
      }));
    const nextMarks = [
      ...triagedUnresolvedMarks.filter(
        (mark) => !unresolvedItems.some((item) => item.unresolvedTriageKey === mark.triageKey),
      ),
      ...newMarks,
    ];

    for (const mark of newMarks) {
      markMuseumUnresolvedTriaged(mark);
    }

    setTriagedUnresolvedMarks(nextMarks);

    if (parseResult) {
      setWorkflowResult(
        deriveMuseumRefreshWorkflow(parseResult, coverage, savedBaseline, {
          reviewedCandidateKeys: reviewedCandidateMarks.map((mark) => mark.reviewKey),
          triagedUnresolvedKeys: nextMarks.map((mark) => mark.triageKey),
        }),
      );
    }
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
      toMuseumRefreshCandidateReviewCsv(workflowResult.items),
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

  function handleExportUnresolvedTriageCsv(): void {
    if (!workflowResult) {
      return;
    }

    downloadTextFile(
      'museum_unresolved_triage.csv',
      toMuseumUnresolvedTriageCsv(workflowResult.unresolvedItems),
      'text/csv;charset=utf-8',
    );
    setExportMessage('Museum unresolved triage CSV downloaded.');
  }

  const runButtonsDisabled = coverageStatus === 'loading';
  const visibleActiveUnresolvedItems = workflowResult
    ? getVisibleActiveUnresolvedItems(workflowResult.activeUnresolvedItems, unresolvedSortMode, unresolvedCaseFilter)
    : [];

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
        {reviewedCandidateMarks.length > 0 ? (
          <p className="status-message status-message--success">
            {reviewedCandidateMarks.length.toLocaleString()} candidate review mark
            {reviewedCandidateMarks.length === 1 ? '' : 's'} saved locally. Reviewed rows stay quiet unless their
            derived candidate changes materially.
          </p>
        ) : null}
        {triagedUnresolvedMarks.length > 0 ? (
          <p className="status-message status-message--success">
            {triagedUnresolvedMarks.length.toLocaleString()} unresolved triage mark
            {triagedUnresolvedMarks.length === 1 ? '' : 's'} saved locally. Triaged unresolved rows stay out of the
            active queue unless their unresolved signature changes.
          </p>
        ) : null}
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
                <dt>Matched known items</dt>
                <dd>{workflowResult.summary.matchedKnownItemsCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Unmatched museum items</dt>
                <dd>{workflowResult.summary.unmatchedItemsCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Newly discovered items</dt>
                <dd>{workflowResult.summary.newItemsCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Known baseline items</dt>
                <dd>{workflowResult.summary.knownBaselineItemCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Candidate review rows</dt>
                <dd>{workflowResult.summary.candidateReviewCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Reviewed candidate rows</dt>
                <dd>{workflowResult.summary.reviewedCandidateCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Expected recipe coverage missing</dt>
                <dd>{workflowResult.summary.recipeMissingExpectedCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>No recipe expected</dt>
                <dd>{workflowResult.summary.recipeNotExpectedCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Recipe expectation unresolved</dt>
                <dd>{workflowResult.summary.recipeExpectationUnresolvedCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Locally covered buddy slugs</dt>
                <dd>{workflowResult.summary.knownItemsWithBuddySlugCoverageCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Auto-derived buddy slugs ready</dt>
                <dd>{workflowResult.summary.autoDerivedBuddySlugReadyCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Known items missing expected buddy slug</dt>
                <dd>{workflowResult.summary.knownItemsMissingExpectedBuddySlugCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>New items still missing buddy slug</dt>
                <dd>{workflowResult.summary.newItemsMissingBuddySlugCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Buddy slug status unresolved</dt>
                <dd>{workflowResult.summary.unresolvedBuddySlugStatusCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Active unresolved triage rows</dt>
                <dd>{workflowResult.summary.activeUnresolvedTriageCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Triaged unresolved rows</dt>
                <dd>{workflowResult.summary.triagedUnresolvedCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Likely naming mismatch hints</dt>
                <dd>{workflowResult.summary.likelyNameMismatchCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Museum-only icon-ready items</dt>
                <dd>{workflowResult.summary.museumOnlyIconReadyCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Missing planning reference</dt>
                <dd>{workflowResult.summary.missingPlanningReferenceCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Truly unresolved reference status</dt>
                <dd>{workflowResult.summary.trulyUnresolvedCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Likely new local items</dt>
                <dd>{workflowResult.summary.likelyNewItemCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Truly actionable follow-up</dt>
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
                disabled={workflowResult.items.every((item) => item.flags.length === 0)}
              >
                Export Candidate Review CSV
              </button>
              <button type="button" className="button" onClick={handleExportActionableCsv}>
                Export Follow-Up CSV
              </button>
              <button
                type="button"
                className="button"
                onClick={handleExportUnresolvedTriageCsv}
                disabled={workflowResult.unresolvedItems.length === 0}
              >
                Export Unresolved Triage CSV
              </button>
              <button
                type="button"
                className="button"
                onClick={handleClearReviewedCandidates}
                disabled={reviewedCandidateMarks.length === 0}
              >
                Clear Reviewed Candidate Marks
              </button>
              <button
                type="button"
                className="button"
                onClick={handleClearUnresolvedTriagedMarks}
                disabled={triagedUnresolvedMarks.length === 0}
              >
                Clear Unresolved Triage Marks
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
              <h3 className="section-title">Unresolved Reconciliation Queue</h3>
              <p className="supporting-text">
                This queue focuses on unresolved museum items that do not yet reconcile safely against current local
                mastery, tower, or recipe coverage. Museum-only icon-ready rows stay out of this queue; use the case
                label, likely local match hints, and export to work through the remaining planning-relevant unresolved
                rows intentionally without promoting uncertain matches.
              </p>
              <div className="button-row">
                <label className="field-label" htmlFor="unresolved-sort-mode">
                  Sort unresolved queue
                </label>
                <select
                  id="unresolved-sort-mode"
                  className="select-input"
                  value={unresolvedSortMode}
                  onChange={(event) => setUnresolvedSortMode(event.target.value as UnresolvedSortMode)}
                >
                  <option value="case_then_name">Case then name</option>
                  <option value="name">Name</option>
                  <option value="likely_matches">Most likely-match hints first</option>
                </select>
                <label className="field-label" htmlFor="unresolved-case-filter">
                  Filter unresolved case
                </label>
                <select
                  id="unresolved-case-filter"
                  className="select-input"
                  value={unresolvedCaseFilter}
                  onChange={(event) =>
                    setUnresolvedCaseFilter(
                      event.target.value as 'all' | NonNullable<MuseumRefreshWorkflowResult['items'][number]['unresolvedCaseType']>,
                    )
                  }
                >
                  <option value="all">All unresolved cases</option>
                  <option value="likely_name_mismatch">Likely naming mismatch</option>
                  <option value="collision_or_ambiguity">Collision or ambiguity</option>
                  <option value="slug_edge_case">Slug edge case</option>
                  <option value="likely_new_item">Likely new local item</option>
                  <option value="missing_planning_reference">Missing planning reference</option>
                </select>
                <button
                  type="button"
                  className="button"
                  onClick={handleBulkMarkVisibleUnresolvedTriaged}
                  disabled={visibleActiveUnresolvedItems.length === 0}
                >
                  Mark Visible Triaged
                </button>
              </div>
              {workflowResult.activeUnresolvedItems.length === 0 ? (
                <p className="empty-state">
                  No active unresolved triage rows are currently surfaced. Triaged unresolved rows remain available in
                  the unresolved export and can reappear if their signatures change.
                </p>
              ) : visibleActiveUnresolvedItems.length === 0 ? (
                <p className="empty-state">
                  No active unresolved rows match the current case filter.
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="summary-table">
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Case</th>
                        <th scope="col">Likely local matches</th>
                        <th scope="col">Candidate slug</th>
                        <th scope="col">Triage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleActiveUnresolvedItems.map((item) => (
                        <tr key={`unresolved-${item.canonicalKey}`}>
                          <td>
                            <strong>{item.itemName}</strong>
                            <p className="subtle-text">
                              {item.canonicalKey}
                              {' | '}
                              {item.category}
                            </p>
                          </td>
                          <td>{formatUnresolvedCaseLabel(item.unresolvedCaseType)}</td>
                          <td>
                            {item.likelyReferenceMatches.length === 0 ? (
                              'No strong local hints'
                            ) : (
                              item.likelyReferenceMatches.map((match) => (
                                <p key={`${item.canonicalKey}-${match.canonicalKey}`} className="subtle-text">
                                  {match.itemName} [{match.sources.join('/')}]
                                  {' - '}
                                  {match.reason}
                                </p>
                              ))
                            )}
                          </td>
                          <td>
                            <p>{item.generatedBuddySlug}</p>
                            <p className="subtle-text">{item.candidateBuddyUrl}</p>
                          </td>
                          <td>
                            <p>{item.unresolvedTriageStatus === 'active' ? 'Active' : 'Triaged'}</p>
                            <div className="button-row">
                              <button type="button" className="button" onClick={() => handleMarkUnresolvedTriaged(item)}>
                                Mark Triaged
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {workflowResult.triagedUnresolvedItems.length > 0 ? (
                <div className="page-stack">
                  <h4 className="section-title">Locally Triaged Unresolved Rows</h4>
                  <div className="table-scroll">
                    <table className="summary-table">
                      <thead>
                        <tr>
                          <th scope="col">Item</th>
                          <th scope="col">Case</th>
                          <th scope="col">Likely local matches</th>
                          <th scope="col">Triage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflowResult.triagedUnresolvedItems.map((item) => (
                          <tr key={`triaged-${item.canonicalKey}`}>
                            <td>
                              <strong>{item.itemName}</strong>
                              <p className="subtle-text">{item.canonicalKey}</p>
                            </td>
                            <td>{formatUnresolvedCaseLabel(item.unresolvedCaseType)}</td>
                            <td>
                              {item.likelyReferenceMatches.length === 0
                                ? 'No strong local hints'
                                : item.likelyReferenceMatches.map((match) => (
                                    <p key={`${item.canonicalKey}-triaged-${match.canonicalKey}`} className="subtle-text">
                                      {match.itemName} [{match.sources.join('/')}]
                                    </p>
                                  ))}
                            </td>
                            <td>
                              <p>Triaged locally</p>
                              <div className="button-row">
                                <button type="button" className="button" onClick={() => handleClearUnresolvedTriaged(item)}>
                                  Remove Triage Mark
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

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
                        <th scope="col">Planning reference</th>
                        <th scope="col">Icon-ready</th>
                        <th scope="col">Buddy slug</th>
                        <th scope="col">Recipe</th>
                        <th scope="col">Review state</th>
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
                          <td>{formatPlanningReferenceLabel(item.planningReferenceStatus)}</td>
                          <td>{formatIconReadyCoverageLabel(item.iconReadyCoverageStatus)}</td>
                          <td>{formatBuddySlugCoverageLabel(item.buddySlugCoverageStatus)}</td>
                          <td>{formatRecipeCoverageLabel(item.recipeCoverageStatus)}</td>
                          <td>
                            {formatCandidateReviewLabel(item.candidateReviewStatus, item.flags)}
                            {item.candidateReviewStatus === 'review_needed' ? (
                              <div className="button-row">
                                <button
                                  type="button"
                                  className="button"
                                  onClick={() => handleMarkCandidateReviewed(item)}
                                >
                                  Mark Reviewed
                                </button>
                              </div>
                            ) : null}
                            {item.candidateReviewStatus === 'reviewed' ? (
                              <div className="button-row">
                                <button
                                  type="button"
                                  className="button"
                                  onClick={() => handleClearReviewedCandidate(item)}
                                >
                                  Remove Reviewed Mark
                                </button>
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {item.followUpReasons.join(' ')}
                            {item.buddySlugCoverageStatus === 'derived_candidate_ready' ? (
                              <p className="subtle-text">
                                This item already has a clean local auto-derived buddy slug candidate and is no longer
                                counted as a true missing slug gap.
                              </p>
                            ) : null}
                            {item.buddySlugCoverageStatus === 'candidate_reviewed' ? (
                              <p className="subtle-text">
                                This candidate was reviewed locally and will only resurface as fresh review work if the
                                candidate signature changes.
                              </p>
                            ) : null}
                            {item.recipeCoverageStatus === 'not_expected' ? (
                              <p className="subtle-text">
                                This matched item is currently classified as not expected to have recipe coverage.
                              </p>
                            ) : null}
                            {item.recipeCoverageStatus === 'unresolved' ? (
                              <p className="subtle-text">
                                Recipe expectation stays unresolved until local reconciliation is strong enough to judge
                                whether recipe coverage should exist.
                              </p>
                            ) : null}
                            {item.planningReferenceStatus === 'museum_only_icon_ready' ? (
                              <p className="subtle-text">
                                This row is museum-only for now because icon-ready slug coverage is already good enough
                                without active planning/reference coverage.
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

function compareUnresolvedItems(
  left: MuseumRefreshWorkflowResult['items'][number],
  right: MuseumRefreshWorkflowResult['items'][number],
  sortMode: UnresolvedSortMode,
): number {
  if (sortMode === 'name') {
    return left.itemName.localeCompare(right.itemName);
  }

  if (sortMode === 'likely_matches') {
    return (
      right.likelyReferenceMatches.length - left.likelyReferenceMatches.length ||
      left.itemName.localeCompare(right.itemName)
    );
  }

  return (
    formatUnresolvedCaseLabel(left.unresolvedCaseType).localeCompare(formatUnresolvedCaseLabel(right.unresolvedCaseType)) ||
    left.itemName.localeCompare(right.itemName)
  );
}

function getVisibleActiveUnresolvedItems(
  items: MuseumRefreshWorkflowResult['activeUnresolvedItems'],
  sortMode: UnresolvedSortMode,
  caseFilter: 'all' | NonNullable<MuseumRefreshWorkflowResult['items'][number]['unresolvedCaseType']>,
): MuseumRefreshWorkflowResult['activeUnresolvedItems'] {
  return [...items]
    .filter((item) => caseFilter === 'all' || item.unresolvedCaseType === caseFilter)
    .sort((left, right) => compareUnresolvedItems(left, right, sortMode));
}
