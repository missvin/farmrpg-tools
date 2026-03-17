import { useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  generateBuddyFarmCandidates,
  parseMuseumSeedCsv,
  toBuddyFarmCandidateReviewCsv,
  toBuddyFarmCandidatesCsv,
  toBuddyFarmCandidatesJson,
} from '../lib/generateBuddyFarmCandidates';
import { parseMuseumExport, toMuseumSeedCsv, toMuseumSeedJson } from '../lib/parseMuseumExport';

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
const MUSEUM_SEED_PLACEHOLDER = `museum_category,category,item_name,canonical_key,obtainable
Items,Item,Bamboo Trellis,bamboo trellis,Y
Items,Item,Banana Peel,banana peel,N
Event,Event,Piñata Whop Stick,piñata whop stick,Y`;

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

export function MuseumToolsPage() {
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseMuseumExport> | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [seedCsvText, setSeedCsvText] = useState('');
  const [candidateResult, setCandidateResult] = useState<ReturnType<typeof generateBuddyFarmCandidates> | null>(null);
  const [candidateValidationMessage, setCandidateValidationMessage] = useState<string | null>(null);
  const [candidateExportMessage, setCandidateExportMessage] = useState<string | null>(null);

  function handleParse(): void {
    setExportMessage(null);

    if (!rawText.trim()) {
      setParseResult(null);
      setValidationMessage('Paste a Farm RPG museum export to build a seed list.');
      return;
    }

    const nextParseResult = parseMuseumExport(rawText);
    setParseResult(nextParseResult);

    if (nextParseResult.parseSummary.uniqueItemsParsed === 0) {
      setValidationMessage('No museum items were detected in that paste.');
      return;
    }

    setValidationMessage(null);
  }

  function handleExportJson(): void {
    if (!parseResult) {
      return;
    }

    downloadTextFile('museum_seed.json', toMuseumSeedJson(parseResult), 'application/json;charset=utf-8');
    setExportMessage('Museum seed JSON downloaded.');
  }

  function handleExportCsv(): void {
    if (!parseResult) {
      return;
    }

    downloadTextFile('museum_seed.csv', toMuseumSeedCsv(parseResult), 'text/csv;charset=utf-8');
    setExportMessage('Museum seed CSV downloaded.');
  }

  function handleUseCurrentMuseumSeed(): void {
    if (!parseResult || parseResult.parseSummary.uniqueItemsParsed === 0) {
      return;
    }

    setSeedCsvText(toMuseumSeedCsv(parseResult));
    setCandidateValidationMessage(null);
    setCandidateExportMessage('Current museum seed copied into the buddy candidate tool.');
  }

  function handleGenerateCandidates(): void {
    setCandidateExportMessage(null);

    if (!seedCsvText.trim()) {
      setCandidateResult(null);
      setCandidateValidationMessage('Paste museum_seed.csv contents or use the current museum seed first.');
      return;
    }

    try {
      const seedRows = parseMuseumSeedCsv(seedCsvText);

      if (seedRows.length === 0) {
        setCandidateResult(null);
        setCandidateValidationMessage('No museum seed rows were detected in that CSV.');
        return;
      }

      const nextCandidateResult = generateBuddyFarmCandidates(seedRows);
      setCandidateResult(nextCandidateResult);
      setCandidateValidationMessage(null);
    } catch (error) {
      setCandidateResult(null);
      setCandidateValidationMessage(error instanceof Error ? error.message : 'Unable to parse museum seed CSV.');
    }
  }

  function handleExportCandidateJson(): void {
    if (!candidateResult) {
      return;
    }

    downloadTextFile(
      'buddy_item_candidates.json',
      toBuddyFarmCandidatesJson(candidateResult),
      'application/json;charset=utf-8',
    );
    setCandidateExportMessage('Buddy candidate JSON downloaded.');
  }

  function handleExportCandidateCsv(): void {
    if (!candidateResult) {
      return;
    }

    downloadTextFile(
      'buddy_item_candidates.csv',
      toBuddyFarmCandidatesCsv(candidateResult),
      'text/csv;charset=utf-8',
    );
    setCandidateExportMessage('Buddy candidate CSV downloaded.');
  }

  function handleExportCandidateReviewCsv(): void {
    if (!candidateResult) {
      return;
    }

    downloadTextFile(
      'buddy_item_candidates_review.csv',
      toBuddyFarmCandidateReviewCsv(candidateResult),
      'text/csv;charset=utf-8',
    );
    setCandidateExportMessage('Buddy candidate review CSV downloaded.');
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Museum Tools"
        description="Parse pasted Farm RPG museum exports into clean local seed lists for downstream reference-data tooling."
      />

      <section className="page-card page-stack" aria-labelledby="museum-tools-input-title">
        <div>
          <h2 id="museum-tools-input-title">Paste Museum Export</h2>
          <p className="supporting-text">
            This is a local tooling helper only. It parses museum categories, removes duplicated icon/text artifacts,
            and prepares deduplicated seed output for later recipe/reference-data workflows.
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
          The parser will ignore obvious UI lines and deduplicate repeated item-name artifacts from copied icon/text
          output.
        </p>

        <div className="button-row">
          <button type="button" className="button" onClick={handleParse}>
            Parse Museum Export
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleExportJson}
            disabled={!parseResult || parseResult.parseSummary.uniqueItemsParsed === 0}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="button"
            onClick={handleExportCsv}
            disabled={!parseResult || parseResult.parseSummary.uniqueItemsParsed === 0}
          >
            Export CSV
          </button>
        </div>

        {validationMessage ? <p className="status-message">{validationMessage}</p> : null}
        {exportMessage ? <p className="status-message status-message--success">{exportMessage}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="museum-tools-preview-title">
        <div>
          <h2 id="museum-tools-preview-title">Seed Preview</h2>
          <p className="supporting-text">
            Review the parsed category structure, validation warnings, and deduplicated item-universe seed list before
            using it downstream.
          </p>
        </div>

        {!parseResult || parseResult.parseSummary.uniqueItemsParsed === 0 ? (
          <p className="empty-state">No parsed museum seed yet. Paste an export and choose Parse Museum Export.</p>
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
                <dt>Warnings</dt>
                <dd>{parseResult.parseSummary.warnings.length.toLocaleString()}</dd>
              </div>
            </dl>

            {parseResult.parseSummary.warnings.length > 0 ? (
              <div className="page-stack">
                <h3 className="section-title">Validation Warnings</h3>
                <ul className="data-list">
                  {parseResult.parseSummary.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

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
                        <td>{category.items[0] ? parseResult.uniqueItems.find((item) => item.categoryName === category.categoryName)?.category ?? '-' : '-'}</td>
                        <td>
                          {formatExpectedCounts(category.expectedOwnedCount, category.expectedTotalCount)}
                        </td>
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

      <section className="page-card page-stack" aria-labelledby="buddy-candidate-title">
        <div>
          <h2 id="buddy-candidate-title">Buddy Item Page Candidates</h2>
          <p className="supporting-text">
            This local tooling step reads <code>museum_seed.csv</code> and generates reviewable buddy.farm item-page
            candidates only. It does not probe pages yet, and museum-derived items must not be treated as
            mastery-eligible by default.
          </p>
        </div>

        <label className="field-label" htmlFor="museum-seed-csv">
          Museum seed CSV
        </label>
        <textarea
          id="museum-seed-csv"
          className="text-area"
          value={seedCsvText}
          onChange={(event) => setSeedCsvText(event.target.value)}
          placeholder={MUSEUM_SEED_PLACEHOLDER}
          rows={10}
        />
        <p className="supporting-text">
          Paste the contents of <code>museum_seed.csv</code>, or reuse the parsed museum seed above. Candidate slugs
          stay review-oriented so punctuation and diacritic edge cases remain visible before later probing.
        </p>

        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={handleUseCurrentMuseumSeed}
            disabled={!parseResult || parseResult.parseSummary.uniqueItemsParsed === 0}
          >
            Use Current Museum Seed
          </button>
          <button type="button" className="button" onClick={handleGenerateCandidates}>
            Generate Buddy Candidates
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleExportCandidateJson}
            disabled={!candidateResult || candidateResult.parseSummary.itemsParsed === 0}
          >
            Export Candidate JSON
          </button>
          <button
            type="button"
            className="button"
            onClick={handleExportCandidateCsv}
            disabled={!candidateResult || candidateResult.parseSummary.itemsParsed === 0}
          >
            Export Candidate CSV
          </button>
          <button
            type="button"
            className="button"
            onClick={handleExportCandidateReviewCsv}
            disabled={!candidateResult || candidateResult.reviewItems.length === 0}
          >
            Export Review CSV
          </button>
        </div>

        {candidateValidationMessage ? <p className="status-message">{candidateValidationMessage}</p> : null}
        {candidateExportMessage ? <p className="status-message status-message--success">{candidateExportMessage}</p> : null}

        {!candidateResult || candidateResult.parseSummary.itemsParsed === 0 ? (
          <p className="empty-state">
            No buddy item-page candidates yet. Paste museum_seed.csv contents and choose Generate Buddy Candidates.
          </p>
        ) : (
          <>
            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Candidate rows</dt>
                <dd>{candidateResult.parseSummary.itemsParsed.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Needs review</dt>
                <dd>{candidateResult.parseSummary.reviewItemsCount.toLocaleString()}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Slug collisions</dt>
                <dd>{candidateResult.parseSummary.collisionCount.toLocaleString()}</dd>
              </div>
            </dl>

            {candidateResult.parseSummary.warnings.length > 0 ? (
              <div className="page-stack">
                <h3 className="section-title">Candidate Review Warnings</h3>
                <ul className="data-list">
                  {candidateResult.parseSummary.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="page-stack">
              <h3 className="section-title">Review Needed</h3>
              {candidateResult.reviewItems.length === 0 ? (
                <p className="empty-state">No candidate rows are currently flagged for manual review.</p>
              ) : (
                <div className="table-scroll">
                  <table className="summary-table">
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Primary slug</th>
                        <th scope="col">Alternate slug</th>
                        <th scope="col">Confidence</th>
                        <th scope="col">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidateResult.reviewItems.map((item) => (
                        <tr key={`${item.canonicalKey}-${item.generatedBuddySlug}`}>
                          <td>
                            <strong>{item.itemName}</strong>
                            <p className="subtle-text">{item.candidateBuddyUrl}</p>
                          </td>
                          <td>{item.generatedBuddySlug}</td>
                          <td>{item.alternateBuddySlug ?? '-'}</td>
                          <td>{item.confidence}</td>
                          <td>
                            {item.flags.join(', ')}
                            {item.notes.length > 0 ? <p className="subtle-text">{item.notes.join(' ')}</p> : null}
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
    </div>
  );
}
