import { useEffect, useMemo, useState } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  createDefaultAcquisitionPlannerInputState,
  loadAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import { getItemIcon } from '../lib/itemIconManifest';
import {
  loadQuestReference,
  type QuestCatalogEntry,
  type QuestReferenceData,
} from '../lib/loadQuestReference';
import { loadRecipeGraph, type RecipeGraph } from '../lib/loadRecipeGraph';
import { loadTowerRequirements, type TowerRequirementsData } from '../lib/loadTowerRequirements';
import { parseHelpNeededPaste, type HelpNeededActiveRequest } from '../lib/parseHelpNeededPaste';
import {
  buildQuestPlanningViewModel,
  questMatchesSearch,
  type QuestPlanningViewModel,
  type QuestProgress,
  type QuestRequirementProgress,
} from '../lib/questPlanning';
import {
  getQuestState,
  loadQuestPlannerState,
  saveQuestPlannerState,
  upsertQuestState,
  type QuestPlannerState,
  type QuestPlannerStatus,
} from '../lib/questPlannerState';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';

type QuestPlannerResources = {
  referenceData: QuestReferenceData;
  acquisitionState: AcquisitionPlannerInputState;
  recipeGraph: RecipeGraph | null;
  towerRequirementsData: TowerRequirementsData | null;
  snapshot: MasterySnapshot | null;
};

type ResourceState = {
  isLoading: boolean;
  error: string | null;
  resources: QuestPlannerResources | null;
};

type HiddenPasteReview = {
  request: HelpNeededActiveRequest;
  quest: QuestCatalogEntry;
};

function formatQuantity(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(value >= 99.95 ? 0 : 1)}%`;
}

function formatNullablePercent(value: number | null): string {
  return value === null ? 'No game percent' : formatPercent(value);
}

function formatStatus(status: QuestPlannerStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'watched':
      return 'Watched';
    case 'completed':
      return 'Completed';
    case 'unknown':
      return 'Unknown';
  }
}

function formatGates(quest: QuestCatalogEntry): string {
  const gates = [
    quest.farmingLevel === null ? null : `Farming ${quest.farmingLevel}`,
    quest.fishingLevel === null ? null : `Fishing ${quest.fishingLevel}`,
    quest.craftingLevel === null ? null : `Crafting ${quest.craftingLevel}`,
    quest.exploringLevel === null ? null : `Exploring ${quest.exploringLevel}`,
    quest.towerLevel === null ? null : `Tower ${quest.towerLevel}`,
  ].filter(Boolean);

  return gates.length > 0 ? gates.join(' · ') : 'No local gate data';
}

function getItemIconSrc(canonicalKey: string): string | null {
  return getItemIcon(canonicalKey)?.src ?? null;
}

function compareQuestPickerRows(left: QuestCatalogEntry, right: QuestCatalogEntry): number {
  return (
    left.questlineName.localeCompare(right.questlineName) ||
    (left.stageLabel ?? '').localeCompare(right.stageLabel ?? '') ||
    left.questName.localeCompare(right.questName)
  );
}

function RequirementItemLink({ requirement }: { requirement: QuestRequirementProgress }) {
  return (
    <ItemProfileLink
      canonicalKey={requirement.canonicalKey}
      itemName={requirement.itemName}
      iconSrc={getItemIconSrc(requirement.canonicalKey)}
    />
  );
}

function QuestActionButtons({
  quest,
  questPlannerState,
  onSetStatus,
  onSetHidden,
}: {
  quest: QuestCatalogEntry;
  questPlannerState: QuestPlannerState;
  onSetStatus: (questKey: string, status: QuestPlannerStatus) => void;
  onSetHidden: (questKey: string, hidden: boolean) => void;
}) {
  const questState = getQuestState(questPlannerState, quest.questKey);

  return (
    <div className="button-row quest-action-row">
      {(['active', 'watched', 'completed'] as const).map((status) => (
        <button
          key={status}
          type="button"
          className={`button${questState.status === status ? ' button--active' : ''}`}
          onClick={() => onSetStatus(quest.questKey, status)}
        >
          {formatStatus(status)}
        </button>
      ))}
      <button
        type="button"
        className="button"
        onClick={() => onSetStatus(quest.questKey, 'unknown')}
        disabled={questState.status === 'unknown'}
      >
        Clear
      </button>
      <button type="button" className="button" onClick={() => onSetHidden(quest.questKey, !questState.hidden)}>
        {questState.hidden ? 'Unhide' : 'Hide'}
      </button>
    </div>
  );
}

function QuestProgressSummary({ progress }: { progress: QuestProgress }) {
  return (
    <dl className="compact-stat-grid quest-progress-stats">
      <div>
        <dt>Local progress</dt>
        <dd>{formatPercent(progress.completionPercent)}</dd>
      </div>
      <div>
        <dt>Game percent</dt>
        <dd>{formatNullablePercent(progress.observedCompletionPercent)}</dd>
      </div>
      <div>
        <dt>Missing</dt>
        <dd>{formatQuantity(progress.missingQuantity)}</dd>
      </div>
      <div>
        <dt>Item types</dt>
        <dd>{progress.missingItemTypes.toLocaleString()}</dd>
      </div>
    </dl>
  );
}

function QuestRequirementTable({ progress }: { progress: QuestProgress }) {
  if (progress.requirements.length === 0) {
    return <p className="empty-state">No local item requirements are available yet.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="summary-table quest-requirements-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Required</th>
            <th scope="col">Available</th>
            <th scope="col">Missing</th>
            <th scope="col">Likely source</th>
          </tr>
        </thead>
        <tbody>
          {progress.requirements.map((requirement) => (
            <tr key={`${progress.quest.questKey}:${requirement.canonicalKey}`}>
              <td>
                <RequirementItemLink requirement={requirement} />
              </td>
              <td>{formatQuantity(requirement.quantity)}</td>
              <td>
                {formatQuantity(requirement.availableQuantity)}
                {requirement.supplySources.length > 0 ? (
                  <span className="subtle-text"> · {requirement.supplySources.map((source) => source.label).join(', ')}</span>
                ) : null}
              </td>
              <td>{formatQuantity(requirement.missingQuantity)}</td>
              <td>
                {requirement.sourceHints.length > 0
                  ? requirement.sourceHints.map((sourceHint) => sourceHint.sourceName).join(', ')
                  : 'No local source hint'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestRewardList({ progress }: { progress: QuestProgress }) {
  if (progress.rewards.length === 0) {
    return <p className="empty-state">No local reward rows yet.</p>;
  }

  return (
    <ul className="quest-inline-list">
      {progress.rewards.map((reward) => (
        <li key={`${progress.quest.questKey}:${reward.canonicalKey}`}>
          <ItemProfileLink
            canonicalKey={reward.canonicalKey}
            itemName={reward.itemName}
            iconSrc={getItemIconSrc(reward.canonicalKey)}
          />
          <span>{formatQuantity(reward.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}

function QuestProgressCard({ progress }: { progress: QuestProgress }) {
  return (
    <article className="quest-progress-card">
      <div className="quest-progress-card__header">
        <div>
          <h3>{progress.quest.questName}</h3>
          <p className="subtle-text">
            {progress.quest.questlineName}
            {progress.quest.npc ? ` · ${progress.quest.npc}` : ''} · {formatGates(progress.quest)}
          </p>
        </div>
        <span className="status-pill">{formatStatus(progress.status)}</span>
      </div>
      {progress.warnings.length > 0 ? (
        <ul className="quest-warning-list">
          {progress.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <QuestProgressSummary progress={progress} />
      <QuestRequirementTable progress={progress} />
      <details className="quest-detail-disclosure">
        <summary>Rewards</summary>
        <QuestRewardList progress={progress} />
      </details>
    </article>
  );
}

function QuestPlanningSummary({ viewModel }: { viewModel: QuestPlanningViewModel }) {
  return (
    <dl className="summary-grid">
      <div className="summary-grid__item">
        <dt>Active</dt>
        <dd>{viewModel.activeQuestProgress.length.toLocaleString()}</dd>
      </div>
      <div className="summary-grid__item">
        <dt>Watched</dt>
        <dd>{viewModel.watchedQuestProgress.length.toLocaleString()}</dd>
      </div>
      <div className="summary-grid__item">
        <dt>Bottlenecks</dt>
        <dd>{viewModel.bottlenecks.length.toLocaleString()}</dd>
      </div>
      <div className="summary-grid__item">
        <dt>Immediate supply rows</dt>
        <dd>{viewModel.availableSupply.length.toLocaleString()}</dd>
      </div>
    </dl>
  );
}

export function QuestPlannerPage() {
  const [resourcesState, setResourcesState] = useState<ResourceState>({
    isLoading: true,
    error: null,
    resources: null,
  });
  const [questPlannerState, setQuestPlannerState] = useState(() => loadQuestPlannerState());
  const [searchText, setSearchText] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [helpNeededPasteText, setHelpNeededPasteText] = useState('');
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [pasteWarnings, setPasteWarnings] = useState<string[]>([]);
  const [hiddenPasteReviews, setHiddenPasteReviews] = useState<HiddenPasteReview[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadResources(): Promise<void> {
      try {
        const [referenceData, recipeGraph, towerRequirementsData, snapshot] = await Promise.all([
          loadQuestReference(),
          loadRecipeGraph(),
          loadTowerRequirements(),
          getLatestSnapshot(),
        ]);
        let acquisitionState: AcquisitionPlannerInputState;

        try {
          acquisitionState = loadAcquisitionPlannerInputState();
        } catch {
          acquisitionState = createDefaultAcquisitionPlannerInputState();
        }

        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: null,
          resources: {
            referenceData,
            acquisitionState,
            recipeGraph,
            towerRequirementsData,
            snapshot,
          },
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load Quest Planner data.',
          resources: null,
        });
      }
    }

    void loadResources();

    return () => {
      isMounted = false;
    };
  }, []);

  const viewModel = useMemo(() => {
    if (!resourcesState.resources) {
      return null;
    }

    return buildQuestPlanningViewModel({
      referenceData: resourcesState.resources.referenceData,
      questPlannerState,
      acquisitionState: resourcesState.resources.acquisitionState,
      recipeGraph: resourcesState.resources.recipeGraph,
      towerRequirementsData: resourcesState.resources.towerRequirementsData,
      snapshot: resourcesState.resources.snapshot,
      includeHidden: showHidden,
    });
  }, [questPlannerState, resourcesState.resources, showHidden]);

  const questPickerRows = useMemo(() => {
    const referenceData = resourcesState.resources?.referenceData;

    if (!referenceData) {
      return [];
    }

    return referenceData.quests
      .filter((quest) => questMatchesSearch(quest, searchText))
      .filter((quest) => showHidden || !getQuestState(questPlannerState, quest.questKey).hidden)
      .sort(compareQuestPickerRows);
  }, [questPlannerState, resourcesState.resources, searchText, showHidden]);

  function persistQuestPlannerState(nextState: QuestPlannerState): void {
    const savedState = saveQuestPlannerState(nextState);
    setQuestPlannerState(savedState);
  }

  function handleSetStatus(questKey: string, status: QuestPlannerStatus): void {
    persistQuestPlannerState(upsertQuestState(questPlannerState, questKey, { status }));
  }

  function handleSetHidden(questKey: string, hidden: boolean): void {
    persistQuestPlannerState(upsertQuestState(questPlannerState, questKey, { hidden }));
  }

  function applyHiddenPasteReview(review: HiddenPasteReview): void {
    persistQuestPlannerState(
      upsertQuestState(questPlannerState, review.quest.questKey, {
        hidden: false,
        status: 'active',
        observedNpc: review.request.npc,
        observedCompletionPercent: review.request.completionPercent,
        lastObservedAt: new Date().toISOString(),
      }),
    );
    setHiddenPasteReviews((currentReviews) => {
      return currentReviews.filter((currentReview) => currentReview.quest.questKey !== review.quest.questKey);
    });
  }

  function handleApplyHelpNeededPaste(): void {
    const referenceData = resourcesState.resources?.referenceData;

    if (!referenceData) {
      return;
    }

    const parsedResult = parseHelpNeededPaste(helpNeededPasteText);
    const nextWarnings = [...parsedResult.warnings];
    const hiddenReviews: HiddenPasteReview[] = [];
    let nextState = questPlannerState;
    let appliedCount = 0;
    const observedAt = new Date().toISOString();

    for (const request of parsedResult.activeRequests) {
      const quest = referenceData.questsByKey[request.questKey];

      if (!quest) {
        nextWarnings.push(`"${request.questName}" is not in local quest reference data yet.`);
        continue;
      }

      const currentQuestState = getQuestState(nextState, quest.questKey);

      if (currentQuestState.hidden) {
        hiddenReviews.push({ request, quest });
        continue;
      }

      nextState = upsertQuestState(nextState, quest.questKey, {
        status: 'active',
        observedNpc: request.npc,
        observedCompletionPercent: request.completionPercent,
        lastObservedAt: observedAt,
      });
      appliedCount += 1;
    }

    persistQuestPlannerState(nextState);
    setPasteWarnings(nextWarnings);
    setHiddenPasteReviews(hiddenReviews);
    setPasteMessage(
      appliedCount > 0
        ? `Updated ${appliedCount.toLocaleString()} active quest${appliedCount === 1 ? '' : 's'} from Help Needed.`
        : 'No active quests were applied from the paste.',
    );
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Quest Planner"
        description="Select active or future quests, track chain progress locally, and compare quest demand against local supply, bottlenecks, and useful source overlap."
        storageKey="quest-planner"
      />

      {resourcesState.isLoading ? (
        <section className="page-card route-loading" aria-label="Loading Quest Planner">
          <p>Loading Quest Planner...</p>
        </section>
      ) : null}

      {!resourcesState.isLoading && resourcesState.error ? (
        <section className="page-card status-alert status-alert--warning" aria-label="Quest Planner error">
          <p>{resourcesState.error}</p>
        </section>
      ) : null}

      {resourcesState.resources && viewModel ? (
        <>
          <section className="page-card">
            <QuestPlanningSummary viewModel={viewModel} />
            {viewModel.warnings.length > 0 ? (
              <ul className="quest-warning-list">
                {viewModel.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="page-card quest-picker-section" aria-labelledby="quest-picker-heading">
            <div className="section-heading-row">
              <div>
                <h2 id="quest-picker-heading">Quest Picker</h2>
                <p>Search the local catalog, then mark quests active, watched, complete, or hidden.</p>
              </div>
              <label className="toggle-switch">
                <input
                  className="toggle-switch__input"
                  type="checkbox"
                  checked={showHidden}
                  onChange={(event) => setShowHidden(event.target.checked)}
                />
                <span className="toggle-switch__track" aria-hidden="true">
                  <span className="toggle-switch__thumb" />
                </span>
                <span>Show hidden</span>
              </label>
            </div>
            <label className="field-label" htmlFor="quest-search">
              Search quests
            </label>
            <input
              id="quest-search"
              className="text-input"
              type="search"
              value={searchText}
              placeholder="DI XIII, PSA, Orange Gecko..."
              onChange={(event) => setSearchText(event.target.value)}
            />
            <div className="quest-picker-list" aria-live="polite">
              {questPickerRows.length > 0 ? (
                questPickerRows.map((quest) => {
                  const questState = getQuestState(questPlannerState, quest.questKey);

                  return (
                    <article className="quest-picker-row" key={quest.questKey}>
                      <div>
                        <h3>{quest.questName}</h3>
                        <p className="subtle-text">
                          {quest.questlineAliases.length > 0 ? `${quest.questlineAliases.join(', ')} · ` : ''}
                          {quest.questlineName}
                          {quest.npc ? ` · ${quest.npc}` : ''} · {formatGates(quest)}
                        </p>
                        <p className="subtle-text">
                          {formatStatus(questState.status)}
                          {questState.hidden ? ' · Hidden' : ''}
                          {quest.coverageStatus === 'partial' ? ' · Partial local requirements' : ''}
                        </p>
                      </div>
                      <QuestActionButtons
                        quest={quest}
                        questPlannerState={questPlannerState}
                        onSetStatus={handleSetStatus}
                        onSetHidden={handleSetHidden}
                      />
                    </article>
                  );
                })
              ) : (
                <p className="empty-state">No quests match the current search and hidden filter.</p>
              )}
            </div>
          </section>

          <section className="page-card" aria-labelledby="help-needed-heading">
            <h2 id="help-needed-heading">Help Needed Paste</h2>
            <p>Paste Help Needed when it is faster than selecting quests manually. Hidden quests stay hidden until reviewed.</p>
            <textarea
              className="text-area quest-paste-input"
              value={helpNeededPasteText}
              onChange={(event) => setHelpNeededPasteText(event.target.value)}
              placeholder="Paste the FarmRPG Help Needed page here..."
            />
            <div className="button-row">
              <button type="button" className="button button--primary" onClick={handleApplyHelpNeededPaste}>
                Apply active requests
              </button>
            </div>
            {pasteMessage ? <p className="status-message">{pasteMessage}</p> : null}
            {pasteWarnings.length > 0 ? (
              <ul className="quest-warning-list">
                {pasteWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {hiddenPasteReviews.length > 0 ? (
              <div className="quest-hidden-review">
                <h3>Hidden active requests</h3>
                <ul className="quest-inline-list">
                  {hiddenPasteReviews.map((review) => (
                    <li key={review.quest.questKey}>
                      <span>{review.quest.questName}</span>
                      <button type="button" className="button" onClick={() => applyHiddenPasteReview(review)}>
                        Unhide and add active
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {viewModel.nextSuggestions.length > 0 ? (
            <section className="page-card" aria-labelledby="next-quests-heading">
              <h2 id="next-quests-heading">Next Quest Suggestions</h2>
              <div className="quest-picker-list">
                {viewModel.nextSuggestions.map((suggestion) => (
                  <article className="quest-picker-row" key={`${suggestion.fromQuest.questKey}:${suggestion.quest.questKey}`}>
                    <div>
                      <h3>{suggestion.quest.questName}</h3>
                      <p className="subtle-text">Available after {suggestion.fromQuest.questName}</p>
                    </div>
                    <div className="button-row">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => handleSetStatus(suggestion.quest.questKey, 'active')}
                      >
                        Add active
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={() => handleSetStatus(suggestion.quest.questKey, 'watched')}
                      >
                        Watch
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="page-card" aria-labelledby="active-quests-heading">
            <h2 id="active-quests-heading">Active Quests</h2>
            {viewModel.activeQuestProgress.length > 0 ? (
              <div className="quest-progress-list">
                {viewModel.activeQuestProgress.map((progress) => (
                  <QuestProgressCard key={progress.quest.questKey} progress={progress} />
                ))}
              </div>
            ) : (
              <p className="empty-state">No active quests selected yet.</p>
            )}
          </section>

          <section className="page-card" aria-labelledby="watched-quests-heading">
            <h2 id="watched-quests-heading">Watched Future Quests</h2>
            {viewModel.watchedQuestProgress.length > 0 ? (
              <div className="quest-progress-list">
                {viewModel.watchedQuestProgress.map((progress) => (
                  <QuestProgressCard key={progress.quest.questKey} progress={progress} />
                ))}
              </div>
            ) : (
              <p className="empty-state">No watched quests selected yet.</p>
            )}
          </section>

          <section className="page-card" aria-labelledby="bottlenecks-heading">
            <h2 id="bottlenecks-heading">Bottlenecks</h2>
            {viewModel.bottlenecks.length > 0 ? (
              <div className="table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Missing</th>
                      <th scope="col">Quests</th>
                      <th scope="col">Known sources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.bottlenecks.slice(0, 12).map((bottleneck) => (
                      <tr key={bottleneck.canonicalKey}>
                        <td>
                          <ItemProfileLink
                            canonicalKey={bottleneck.canonicalKey}
                            itemName={bottleneck.itemName}
                            iconSrc={getItemIconSrc(bottleneck.canonicalKey)}
                          />
                        </td>
                        <td>{formatQuantity(bottleneck.missingQuantity)}</td>
                        <td>{bottleneck.questNames.join(', ')}</td>
                        <td>
                          {bottleneck.sourceHints.length > 0
                            ? bottleneck.sourceHints.map((sourceHint) => sourceHint.sourceName).join(', ')
                            : 'No local source hint'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No missing active or watched quest requirements yet.</p>
            )}
          </section>

          <section className="page-card" aria-labelledby="source-pressure-heading">
            <h2 id="source-pressure-heading">Source Pressure</h2>
            {viewModel.sourcePressure.length > 0 ? (
              <div className="table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Source family</th>
                      <th scope="col">Items</th>
                      <th scope="col">Quests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.sourcePressure.map((pressure) => (
                      <tr key={pressure.sourceKey}>
                        <td>{pressure.label}</td>
                        <td>{pressure.itemNames.join(', ')}</td>
                        <td>{pressure.questNames.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No source pressure yet.</p>
            )}
          </section>

          <section className="page-card" aria-labelledby="synergy-heading">
            <h2 id="synergy-heading">Synergies</h2>
            {viewModel.synergyHints.length > 0 ? (
              <div className="table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">While working</th>
                      <th scope="col">Same source</th>
                      <th scope="col">Also helps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.synergyHints.map((synergyHint) => (
                      <tr
                        key={`${synergyHint.sourceName}:${synergyHint.questItemName}:${synergyHint.relatedItemName}:${synergyHint.targetItemName}`}
                      >
                        <td>{synergyHint.questItemName}</td>
                        <td>
                          {synergyHint.sourceName} · {synergyHint.sourceType}
                        </td>
                        <td>
                          {synergyHint.relatedItemName} feeds {synergyHint.targetItemName} for {synergyHint.targetLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No synergy hints for the selected quest set yet.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
