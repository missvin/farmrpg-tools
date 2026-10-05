import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { buildItemPageMaterialRows, getItemPageTargets, getVisibleItemPageMaterials, withItemPageIngredientBuildingSources, type ItemPageTarget } from '../lib/itemPagePlanning';
import {
  createDefaultAcquisitionPlannerInputState,
  loadAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import {
  createDefaultBuildingProductionState,
  loadBuildingProductionState,
  saveBuildingProductionState,
  setBuildingProductionPerk,
  setQueuedBuildingOutput,
  type BuildingProductionState,
} from '../lib/buildingProductionState';
import {
  createDefaultCraftingModifierState,
  loadCraftingModifierState,
  type UserCraftingModifierState,
} from '../lib/craftingModifierState';
import {
  deriveCraftMaterialMatrix,
} from '../lib/craftMaterialMatrix';
import {
  buildItemGoalCalculatorResult,
  type ItemGoalCalculatorResult,
} from '../lib/itemGoalCalculator';
import { decodeItemProfileParam, toItemProfilePath } from '../lib/itemProfileRoutes';
import { getItemIcon } from '../lib/itemIconManifest';
import { resolveItemProfile, type ItemProfile, type ItemProfileTowerTarget } from '../lib/itemProfileResolver';
import { loadDropRateReference, type DropRateReferenceData } from '../lib/loadDropRateReference';
import {
  loadBuildingProductionReference,
  type BuildingProductionReferenceData,
} from '../lib/loadBuildingProductionReference';
import { loadItemCatalog, type ItemCatalogData } from '../lib/loadItemCatalog';
import {
  loadOpenableContentsReference,
  type OpenableContentsReferenceData,
} from '../lib/loadOpenableContentsReference';
import { loadPetSourceReference, type PetSourceReferenceData } from '../lib/loadPetSourceReference';
import { loadQuestReference, type QuestReferenceData } from '../lib/loadQuestReference';
import { loadRecipeGraph, type RecipeGraph, type RecipeInput } from '../lib/loadRecipeGraph';
import { loadWishingWellReference, type WishingWellReferenceData } from '../lib/loadWishingWellReference';
import {
  deriveQuestHistoryPlanningAnalytics,
  getQuestFutureDemandScopeLabel,
  type QuestFutureDemandRow,
} from '../lib/questHistoryPlanning';
import { loadQuestHistoryState, type QuestHistoryState } from '../lib/questHistoryState';
import { loadQuestPlannerState, type QuestPlannerState } from '../lib/questPlannerState';
import {
  loadTowerRequirements,
  type TowerRequirementsData,
} from '../lib/loadTowerRequirements';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';

type ItemProfileResources = {
  snapshot: MasterySnapshot | null;
  itemCatalog: ItemCatalogData | null;
  towerRequirementsData: TowerRequirementsData | null;
  recipeGraph: RecipeGraph | null;
  dropRateReference: DropRateReferenceData | null;
  petSourceReference: PetSourceReferenceData | null;
  openableContentsReference: OpenableContentsReferenceData | null;
  wishingWellReference: WishingWellReferenceData | null;
  buildingProductionReference: BuildingProductionReferenceData | null;
  questReferenceData: QuestReferenceData | null;
  questHistoryState: QuestHistoryState | null;
  questPlannerState: QuestPlannerState | null;
};

type MasteryMilestone = {
  label: 'M' | 'GM' | 'MM';
  targetMastery: number;
};

const MASTERY_MILESTONES: MasteryMilestone[] = [
  { label: 'M', targetMastery: 10_000 },
  { label: 'GM', targetMastery: 100_000 },
  { label: 'MM', targetMastery: 1_000_000 },
];

function formatMastery(value: number): string {
  return value.toLocaleString();
}

function formatPlannerQuantity(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function formatProductionDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 'No processing time';
  }

  const roundedMinutes = Math.ceil(minutes);
  const days = Math.floor(roundedMinutes / 1440);
  const hours = Math.floor((roundedMinutes % 1440) / 60);
  const remainingMinutes = roundedMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(`${remainingMinutes}m`);
  }

  return parts.join(' ');
}

function formatPumpkinJuiceCount(value: number | null): string {
  return value === null ? 'Needs baseline mastery first' : value.toLocaleString();
}

function formatTowerLevels(levels: number[]): string {
  if (levels.length === 0) {
    return 'No Tower levels';
  }

  if (levels.length === 1) {
    return `Tower Level ${levels[0]}`;
  }

  return `Tower Levels ${levels.join(', ')}`;
}

function formatTowerLevelForTarget(target: ItemProfileTowerTarget): string {
  return `${target.masteryLevelLabel} at ${formatTowerLevels(target.levels)}`;
}


function getMasteryMilestonePercent(currentMastery: number): number {
  const mastery = Math.max(0, currentMastery);

  if (mastery <= 10_000) {
    return (mastery / 10_000) * 33.333;
  }

  if (mastery <= 100_000) {
    return 33.333 + ((mastery - 10_000) / 90_000) * 33.333;
  }

  return 66.666 + ((Math.min(mastery, 1_000_000) - 100_000) / 900_000) * 33.334;
}

function getMasteryProgressStyle(currentMastery: number): CSSProperties & Record<'--item-mastery-fill', string> {
  return {
    '--item-mastery-fill': `${getMasteryMilestonePercent(currentMastery)}%`,
  };
}

function getNextMasteryMilestone(currentMastery: number): MasteryMilestone | null {
  const mastery = Math.max(0, currentMastery);

  return MASTERY_MILESTONES.find((milestone) => mastery < milestone.targetMastery) ?? null;
}

function formatNextMasteryMilestoneProgress(currentMastery: number): string {
  const nextMilestone = getNextMasteryMilestone(currentMastery);

  if (!nextMilestone) {
    return 'MM complete';
  }

  const percent = Math.max(0, Math.min(100, (currentMastery / nextMilestone.targetMastery) * 100));
  return `${percent.toFixed(percent >= 100 ? 0 : 1)}% to ${nextMilestone.label}`;
}

function isTowerTargetComplete(profile: ItemProfile, towerTarget: ItemProfileTowerTarget): boolean {
  return profile.currentMastery >= towerTarget.requiredThreshold;
}

function getTowerRequirementsPath(profile: ItemProfile): string {
  const firstEntry = profile.towerTargets.flatMap(target => target.entries).sort((a, b) => a.towerLevel - b.towerLevel)[0];

  if (!firstEntry) {
    return '/tower';
  }

  const searchParams = new URLSearchParams({
    level: String(firstEntry.towerLevel),
    item: profile.canonicalKey,
  });

  return `/tower?${searchParams.toString()}`;
}

function getTowerProgressPath(profile: ItemProfile): string {
  const searchParams = new URLSearchParams({
    item: profile.canonicalKey,
  });

  return `/tower-progress?${searchParams.toString()}`;
}

function getCraftMaterialMatrixPath(profile: ItemProfile): string {
  const searchParams = new URLSearchParams({
    seed: profile.canonicalKey,
  });

  return `/craft-material-matrix?${searchParams.toString()}`;
}

function RecipeInputRow({ input }: { input: RecipeInput }) {
  const icon = getItemIcon(input.canonicalKey);

  return (
    <li>
      <Link className="recipe-link-row" to={toItemProfilePath(input.canonicalKey)}>
        <span className="recipe-link-row__item">
          {icon ? <img className="item-icon" src={icon.src} alt="" aria-hidden="true" loading="lazy" /> : null}
          <strong>{input.itemName}</strong>
        </span>
        <strong>{input.quantity.toLocaleString()}</strong>
      </Link>
    </li>
  );
}

function ItemUsesPanel({ profile, recipeGraph, towerRequirementsData, snapshot, questDemand }: {
  profile: ItemProfile; recipeGraph: RecipeGraph; towerRequirementsData: TowerRequirementsData | null; snapshot: MasterySnapshot | null; questDemand: QuestFutureDemandRow | null;
}) {
  const [filter, setFilter] = useState<'tower' | 'quests' | 'recipes'>('tower');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const rows = useMemo(() => deriveCraftMaterialMatrix({ seedCanonicalKeys: [profile.canonicalKey], recipeGraph, towerRequirementsData, snapshot, maxDepth: 1 }).rows, [profile.canonicalKey, recipeGraph, towerRequirementsData, snapshot]);
  const towerRows = rows.flatMap(row => row.towerTargets.filter(target => includeCompleted || !target.achieved).map(target => ({ row, target })))
    .sort((a, b) => Math.min(...a.target.levels) - Math.min(...b.target.levels) || a.row.outputItemName.localeCompare(b.row.outputItemName));
  return <section className="page-card page-stack" aria-labelledby="item-uses-title">
    <div className="section-heading-row"><h2 id="item-uses-title">Use {profile.itemName}</h2><details><summary>More tools</summary><Link className="button" to={getCraftMaterialMatrixPath(profile)}>Open Matrix</Link></details></div>
    <div className="button-row" aria-label="Use filters">{([['tower', 'Tower'], ['quests', 'Quests'], ['recipes', 'All recipes']] as const).map(([value, label]) => <button className={'button' + (filter === value ? ' button--active' : '')} type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {filter === 'tower' ? <>
      <label className="checkbox-label"><input type="checkbox" checked={includeCompleted} onChange={event => setIncludeCompleted(event.target.checked)} /> Include completed targets</label>
      {towerRows.length ? <ul className="item-compact-list item-use-list">{towerRows.map(({row, target}) => <li key={row.outputCanonicalKey + row.pathType + target.requiredThreshold}>
        <ItemProfileLink canonicalKey={row.outputCanonicalKey} itemName={row.outputItemName} iconSrc={getItemIcon(row.outputCanonicalKey)?.src} />
        <span>T{target.levels.join(', T')} · {target.masteryLevelNeeded} · {target.achieved ? 'Complete' : formatMastery(target.remainingToRequirement) + ' mastery left'}<small className="subtle-text">{formatMastery(target.currentMastery)} / {formatMastery(target.requiredThreshold)}</small></span>
        <details><summary>Requirement details</summary><span>{formatMastery(row.consumedSeedQuantity)} {profile.itemName} per output{row.pathType === 'one_step_downstream' ? ' via an intermediate' : ''}; before crafting modifiers.</span></details>
      </li>)}</ul> : <p className="empty-state">No {includeCompleted ? '' : 'unfinished '}Tower craft uses found in supported recipe paths.</p>}
    </> : filter === 'quests' ? <ItemQuestFutureDemandPanel demand={questDemand} /> : <>
      {profile.usedInRecipes.length ? <ul className="item-compact-list item-use-list">{profile.usedInRecipes.map(recipe => <li key={recipe.outputCanonicalKey}><ItemProfileLink canonicalKey={recipe.outputCanonicalKey} itemName={recipe.outputItemName} iconSrc={getItemIcon(recipe.outputCanonicalKey)?.src} /><span>{recipe.inputs.filter(input => input.canonicalKey === profile.canonicalKey).reduce((sum, input) => sum + input.quantity, 0)} per {recipe.recipeType === 'craft' ? 'craft' : 'cook'}</span></li>)}</ul> : <p className="empty-state">No recorded recipes use this item directly.</p>}
    </>}
  </section>;
}

function ItemGoalSupplyBreakdownList({ result }: { result: ItemGoalCalculatorResult }) {
  const targetSummary = result.plannerResult.targetSummaries[0];
  const breakdowns = targetSummary?.row?.supply?.breakdowns ?? [];

  if (breakdowns.length === 0) {
    return <p className="empty-state">No saved supply is currently counted for this target item.</p>;
  }

  return (
    <ul className="data-list">
      {breakdowns.map((entry, index) => (
        <li key={`${entry.sourceKey}-${index}`}>
          <div className="recipe-link-row">
            <span>
              <strong>{entry.label}</strong>
              {entry.notes.length > 0 ? <span className="subtle-text"> {entry.notes.join(' ')}</span> : null}
            </span>
            <strong>{formatPlannerQuantity(entry.quantity)}</strong>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ItemGoalSourceRows({ result }: { result: ItemGoalCalculatorResult }) {
  const hasPetSources = result.petSources.length > 0 || result.referencePetSources.length > 0;

  return (
    <div className="item-goal-source-grid">
      {result.openableSources.length > 0 ? <div className="item-goal-source-card">
        <h3>Openables</h3>
        {result.openableSources.length > 0 ? (
          <ul className="data-list">
            {result.openableSources.map((source) => (
              <li key={`${source.entry.openableCanonicalKey}-${source.entry.contentCanonicalKey}`}>
                <div className="recipe-link-row">
                  <span>
                    <strong>{source.entry.openableItemName}</strong>
                    <span className="subtle-text">
                      {source.ownedOpenableCount.toLocaleString()} owned at {source.entry.quantityPerOpen.toLocaleString()}{' '}
                      each
                    </span>
                  </span>
                  <strong>{formatPlannerQuantity(source.projectedContentQuantity)}</strong>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No reviewed openable contents are available for this item from saved containers.</p>
        )}
      </div> : null}
      {hasPetSources ? <div className="item-goal-source-card">
        <h3>Pets</h3>
        {hasPetSources ? (
          <ul className="data-list data-list--clickable">
            {result.petSources.map((source) => {
              const icon = getItemIcon(source.canonicalKey);
              const petNames = source.forecast.petDetails.map((detail) => detail.petName).join(', ');

              return (
                <li key={source.canonicalKey}>
                  <div className="recipe-link-row">
                    <ItemProfileLink canonicalKey={source.canonicalKey} itemName={source.itemName} iconSrc={icon?.src} />
                    <span>
                      <strong>{formatPlannerQuantity(source.forecastQuantity)}</strong>
                      <span className="subtle-text">
                        {source.role === 'target' ? 'Target item' : 'Recipe ingredient'} from {petNames}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
            {result.referencePetSources.map((source) => {
              const icon = getItemIcon(source.canonicalKey);

              return (
                <li key={`reference-${source.overrideKey}`}>
                  <div className="recipe-link-row">
                    <ItemProfileLink canonicalKey={source.canonicalKey} itemName={source.itemName} iconSrc={icon?.src} />
                    <span>
                      <strong>{formatPlannerQuantity(source.forecastQuantity)}</strong>
                      <span className="subtle-text">
                        {source.role === 'target' ? 'Target item' : 'Recipe ingredient'} from {source.petName} level{' '}
                        {source.petLevel.toLocaleString()} over {source.forecastHours.toLocaleString()} hours
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state">No reviewed or saved future pet path matches this item goal yet.</p>
        )}
      </div> : null}
      {result.wishingWellSources.length > 0 ? <div className="item-goal-source-card">
        <h3>Wishing Well</h3>
        {result.wishingWellSources.length > 0 ? (
          <ul className="data-list data-list--clickable">
            {result.wishingWellSources.map((source) => {
              const icon = getItemIcon(source.entry.thrownCanonicalKey);

              return (
                <li key={`${source.entry.thrownCanonicalKey}-${source.entry.rewardCanonicalKey}`}>
                  <div className="recipe-link-row">
                    <ItemProfileLink
                      canonicalKey={source.entry.thrownCanonicalKey}
                      itemName={source.entry.thrownItemName}
                      iconSrc={icon?.src}
                    />
                    <span>
                      <strong>{formatPlannerQuantity(source.expectedDailyQuantity)} / day</strong>
                      <span className="subtle-text">
                        {source.entry.rewardChance * 100}% chance, x{formatPlannerQuantity(source.rewardMultiplier)} reward,
                        {` ${formatPlannerQuantity(source.thrownItemAvailableQuantity)} available to throw`}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state">No reviewed Wishing Well path is available for this item yet.</p>
        )}
      </div> : null}
      {result.buildingSources.length > 0 ? <div className="item-goal-source-card">
        <h3>Buildings</h3>
        {result.buildingSources.length > 0 ? (
          <ul className="data-list data-list--clickable">
            {result.buildingSources.map((source) => (
              <li key={source.sourceKey}>
                <div className="building-source-row">
                  <div className="recipe-link-row">
                    <ItemProfileLink
                      canonicalKey={source.outputCanonicalKey}
                      itemName={source.outputItemName}
                      iconSrc={getItemIcon(source.outputCanonicalKey)?.src ?? null}
                    />
                    <span>
                      <strong>{formatProductionDuration(source.processingMinutes)}</strong>
                      <span className="subtle-text">
                        {' '}
                        {source.buildingName}
                        {source.role === 'conversion' ? ` for ${source.finalItemName}` : ''}
                      </span>
                    </span>
                  </div>
                  <p className="subtle-text">
                    Produce {formatPlannerQuantity(source.remainingBuildingOutputQuantity)} more{' '}
                    {source.outputItemName}
                    {source.queuedOutputQuantity > 0
                      ? ` after ${formatPlannerQuantity(source.queuedOutputQuantity)} queued output`
                      : ''}
                    {source.perksApplied.length > 0 ? ` with ${source.perksApplied.join(', ')}` : ''}.
                  </p>
                  <dl className="compact-stat-grid compact-stat-grid--dense">
                    {source.inputRequirements.map((requirement) => (
                      <div key={requirement.canonicalKey}>
                        <dt>{requirement.itemName}</dt>
                        <dd>{formatPlannerQuantity(requirement.remainingQuantity)} left</dd>
                      </div>
                    ))}
                    {source.secondaryRequirements.map((requirement) => (
                      <div key={requirement.canonicalKey}>
                        <dt>{requirement.itemName}</dt>
                        <dd>{formatPlannerQuantity(requirement.remainingQuantity)} left</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No timed building production path is available for this item yet.</p>
        )}
      </div> : null}
    </div>
  );
}

function ItemQuestFutureDemandPanel({ demand }: { demand: QuestFutureDemandRow | null }) {
  if (!demand) return <p className="empty-state">No unfinished quest demand recorded for this item. Coverage depends on saved quest history and reviewed requirements.</p>;
  return <div className="page-stack"><p className="item-plan-summary">{formatPlannerQuantity(demand.totalQuantity)} required across {demand.questCount} quests · {demand.scopes.map(scope => getQuestFutureDemandScopeLabel(scope.scope)).join(', ')}</p>
    <ul className="item-compact-list">{demand.requirements.map(requirement => <li key={requirement.questKey + requirement.scope}><details><summary>{requirement.questName} · {formatPlannerQuantity(requirement.quantity)}</summary><span>{requirement.questlineName} · {getQuestFutureDemandScopeLabel(requirement.scope)}</span></details></li>)}</ul>
    {demand.sourceHints.length ? <details><summary>Source hints</summary><ul className="item-compact-list">{demand.sourceHints.map(hint => <li key={hint.sourceCanonicalKey + hint.sourceType}><ItemProfileLink canonicalKey={hint.sourceCanonicalKey} itemName={hint.sourceName} /><span>{hint.sourceType}</span></li>)}</ul></details> : null}
  </div>;
}

function ItemGoalWaitProjectionRows({ result }: { result: ItemGoalCalculatorResult }) {
  const rows = result.waitProjection.activeRemainingRows;

  if (rows.length === 0) {
    return <p className="empty-state">No active remainder is projected after these wait-day assumptions.</p>;
  }

  return (
    <ul className="data-list data-list--clickable">
      {rows.map((row) => {
        const icon = getItemIcon(row.canonicalKey);

        return (
          <li key={row.canonicalKey}>
            <div className="recipe-link-row">
              <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} iconSrc={icon?.src} />
              <span>
                <strong>{formatPlannerQuantity(row.remainingQuantity)} left</strong>
                <span className="subtle-text">
                  {' '}
                  {formatPlannerQuantity(row.grossRequiredQuantity)} needed before counted supply; {row.sourceSummary}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ItemTargetControl({ target, options, onSelect, onAmount }: {
  target: ItemPageTarget; options: ItemPageTarget[]; onSelect: (id: string) => void; onAmount: (amount: number) => void;
}) {
  return <div className="item-quick-plan">
    <label>Planning target<select className="text-input" value={target.id} onChange={event => onSelect(event.target.value)}>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
    {target.id.startsWith('custom-') ? <label>{target.mode === 'mastery' ? 'Target mastery' : 'Total quantity'}<input className="text-input" type="number" min="0" value={target.amount} onChange={event => onAmount(Math.max(0, Number(event.target.value)))} /></label> : null}
  </div>;
}

function ItemCompactSources({ result, canonicalKey, itemName, dropRateReference, recipeGraph, openableContentsReference }: {
  result: ItemGoalCalculatorResult; canonicalKey: string; itemName: string; dropRateReference: DropRateReferenceData | null; recipeGraph: RecipeGraph; openableContentsReference: OpenableContentsReferenceData | null;
}) {
  const filtered = { ...result,
    openableSources: result.openableSources.filter(source => source.entry.contentCanonicalKey === canonicalKey),
    petSources: result.petSources.filter(source => source.canonicalKey === canonicalKey),
    referencePetSources: result.referencePetSources.filter(source => source.canonicalKey === canonicalKey),
    wishingWellSources: result.wishingWellSources.filter(source => source.entry.rewardCanonicalKey === canonicalKey),
    buildingSources: result.buildingSources.filter(source => source.outputCanonicalKey === canonicalKey || source.finalCanonicalKey === canonicalKey),
  };
  const unownedOpenables = (openableContentsReference?.byContentCanonicalKey[canonicalKey] ?? []).filter(entry => !filtered.openableSources.some(source => source.entry.openableCanonicalKey === entry.openableCanonicalKey));
  const drops = [...new Map((dropRateReference?.byTargetCanonicalKey[canonicalKey] ?? []).map(source => [source.sourceName + source.sourceType, source])).values()];
  const recipe = recipeGraph.byOutputCanonicalKey[canonicalKey];
  const groups = [
    { name: 'Openables', count: filtered.openableSources.length, estimate: filtered.openableSources.reduce((sum, source) => sum + source.projectedContentQuantity, 0), key: 'openableSources' as const },
    { name: 'Pets', count: filtered.petSources.length + filtered.referencePetSources.length, estimate: filtered.petSources.reduce((sum, source) => sum + source.forecastQuantity, 0) + filtered.referencePetSources.reduce((sum, source) => sum + source.forecastQuantity, 0), key: 'petSources' as const },
    { name: 'Wishing Well', count: filtered.wishingWellSources.length, estimate: filtered.wishingWellSources.reduce((sum, source) => sum + source.expectedDailyQuantity, 0), key: 'wishingWellSources' as const },
    { name: 'Buildings', count: filtered.buildingSources.length, estimate: null, key: 'buildingSources' as const },
  ];
  return <div className="item-compact-sources" aria-label={itemName + ' sources'}>
    {recipe ? <details><summary>{recipe.recipeType === 'craft' ? 'Craft' : 'Cook'} {itemName}</summary><ul className="item-compact-list">{recipe.inputs.map(input => <li key={input.canonicalKey}><ItemProfileLink canonicalKey={input.canonicalKey} itemName={input.itemName} /> <span>×{input.quantity.toLocaleString()}</span></li>)}</ul>{recipe.sourceBuddyUrl ? <a href={recipe.sourceBuddyUrl} target="_blank" rel="noreferrer">Recipe evidence</a> : null}</details> : null}
    {unownedOpenables.map(entry => <details key={'known-' + entry.openableCanonicalKey}><summary>{entry.openableItemName} · {entry.quantityPerOpen.toLocaleString()} {entry.quantityKind === 'expected' ? 'expected' : ''} per open</summary><p className="subtle-text">Reviewed container source; no contents from this path are counted in the selected plan. Add owned containers in saved acquisition inputs to include them.</p><ItemProfileLink canonicalKey={entry.openableCanonicalKey} itemName={entry.openableItemName} /></details>)}
    {drops.map(source => <details key={source.sourceName + source.sourceType}><summary>{source.sourceName} · {source.sourceType}</summary><p className="subtle-text">Reference rate: {source.rawRate.toLocaleString()}. This is reference coverage, not a net or consumable budget.</p><a href={source.sourcePageUrl} target="_blank" rel="noreferrer">Source evidence</a></details>)}
    {groups.filter(group => group.count > 0).map(group => <details key={group.name}><summary>{group.name} · {group.count} path{group.count === 1 ? '' : 's'}{group.estimate !== null ? ' · ' + formatPlannerQuantity(group.estimate) + (group.name === 'Wishing Well' ? ' expected/day' : group.name === 'Pets' ? ' projected' : ' available from owned containers') : ''}</summary>
      <ItemGoalSourceRows result={{ ...filtered, openableSources: group.key === 'openableSources' ? filtered.openableSources : [], petSources: group.key === 'petSources' ? filtered.petSources : [], referencePetSources: group.key === 'petSources' ? filtered.referencePetSources : [], wishingWellSources: group.key === 'wishingWellSources' ? filtered.wishingWellSources : [], buildingSources: group.key === 'buildingSources' ? filtered.buildingSources : [] }} />
    </details>)}
    {!recipe && drops.length === 0 && unownedOpenables.length === 0 && !groups.some(group => group.count > 0) ? <p className="empty-state">No supported source path recorded for {itemName}.</p> : null}
  </div>;
}

function ItemGoalCalculatorSection({
  profile,
  acquisitionState,
  modifierState,
  recipeGraph,
  petSourceReference,
  openableContentsReference,
  wishingWellReference,
  buildingProductionReference,
  buildingProductionState,
  setBuildingProductionState,
  target, targetOptions, setSelectedTargetId, setCustomAmount, dropRateReference,
}: {
  target: ItemPageTarget;
  targetOptions: ItemPageTarget[];
  setSelectedTargetId: (id: string) => void;
  setCustomAmount: (amount: number) => void;
  dropRateReference: DropRateReferenceData | null;
  profile: ItemProfile;
  acquisitionState: AcquisitionPlannerInputState;
  modifierState: UserCraftingModifierState;
  recipeGraph: RecipeGraph;
  petSourceReference: PetSourceReferenceData | null;
  openableContentsReference: OpenableContentsReferenceData | null;
  wishingWellReference: WishingWellReferenceData | null;
  buildingProductionReference: BuildingProductionReferenceData | null;
  buildingProductionState: BuildingProductionState;
  setBuildingProductionState: (state: BuildingProductionState) => void;
}) {
  const goalMode = target.mode;
  const targetMastery = target.amount;
  const targetQuantity = target.amount;
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [waitDays, setWaitDays] = useState(acquisitionState.pets.futureProduction.horizonDays);
  const [includeOpenables, setIncludeOpenables] = useState(true);
  const [crunchyOmeletteActive, setCrunchyOmeletteActive] = useState(false);
  const [towerAntlersPerDay, setTowerAntlersPerDay] = useState(0);
  const [wishingWellThrowsPerDay, setWishingWellThrowsPerDay] = useState(30);
  const [wishingWellRewardMultiplier, setWishingWellRewardMultiplier] = useState(1);
  const [referencePetLevelOverrides, setReferencePetLevelOverrides] = useState<Record<string, number>>({});

  useEffect(() => { setExpandedKeys(new Set()); setExpandAll(false); }, [profile.canonicalKey, target.id, target.amount]);

  const result = useMemo(() => {
    return withItemPageIngredientBuildingSources(buildItemGoalCalculatorResult({
      itemName: profile.itemName,
      canonicalKey: profile.canonicalKey,
      currentMastery: profile.currentMastery,
      acquisitionState,
      modifierState,
      recipeGraph,
      petSourceReference,
      openableContentsReference,
      wishingWellReference,
      buildingProductionReference,
      buildingProductionState,
      settings: {
        goalMode,
        targetMastery,
        targetQuantity,
        waitDays,
        includeOpenableContents: includeOpenables,
        crunchyOmeletteActive,
        towerAntlersPerDay,
        wishingWellThrowsPerDay,
        wishingWellRewardMultiplier,
        referencePetLevelOverrides,
      },
    }), buildingProductionReference, buildingProductionState);
  }, [
    acquisitionState,
    crunchyOmeletteActive,
    buildingProductionReference,
    buildingProductionState,
    goalMode,
    includeOpenables,
    modifierState,
    openableContentsReference,
    petSourceReference,
    profile.canonicalKey,
    profile.currentMastery,
    profile.itemName,
    recipeGraph,
    targetMastery,
    targetQuantity,
    towerAntlersPerDay,
    waitDays,
    referencePetLevelOverrides,
    wishingWellReference,
    wishingWellRewardMultiplier,
    wishingWellThrowsPerDay,
  ]);
  const goalLabel = goalMode === 'mastery' ? 'Mastery remaining' : 'Quantity target';
  const allWarnings = [...new Set([...result.warnings, ...result.waitProjection.warnings, ...(goalMode === 'mastery' && !profile.matchedSnapshotRow ? ['No imported mastery baseline for this item; this estimate starts from zero.'] : [])])];
  const countedSupplyNotes = [
    result.openableQuantity > 0 ? `${formatPlannerQuantity(result.openableQuantity)} from openables` : '',
    result.storedPetInventoryQuantity > 0
      ? `${formatPlannerQuantity(result.storedPetInventoryQuantity)} stored pet inventory`
      : '',
    result.crunchyStoredPetBonusQuantity > 0
      ? `${formatPlannerQuantity(result.effectiveStoredPetInventoryQuantity)} after Crunchy`
      : '',
    result.waitProjection.futurePetQuantity > 0
      ? `${formatPlannerQuantity(result.waitProjection.futurePetQuantity)} projected pet supply across this plan`
      : '',
  ].filter(Boolean);
  const hasAntlerAssumption =
    result.plannerResult.rows.some((row) => row.canonicalKey === 'antler') ||
    result.openableSources.some((source) => source.entry.openableCanonicalKey === 'large chest 03');
  const hasWishingWellAssumption = result.wishingWellSources.length > 0;
  const hasPetCollectionAssumption =
    result.storedPetInventoryQuantity > 0 || result.petSources.length > 0 || result.referencePetSources.length > 0;
  const hasSugarBuildingSource = result.buildingSources.some((source) => source.buildingName === 'Sugar Cane Mill');
  const hasPineBuildingSource = result.buildingSources.some((source) => source.buildingName === 'Sawmill');

  function updateReferencePetLevel(overrideKey: string, nextLevel: number): void {
    setReferencePetLevelOverrides((currentOverrides) => ({
      ...currentOverrides,
      [overrideKey]: nextLevel,
    }));
  }

  return (
    <section className="page-card page-stack" aria-labelledby="item-goal-calculator-title">
      <h2 id="item-goal-calculator-title">Plan materials</h2>
      <ItemCompactSources result={result} canonicalKey={profile.canonicalKey} itemName={profile.itemName} dropRateReference={dropRateReference} recipeGraph={recipeGraph} openableContentsReference={openableContentsReference} />
      <ItemTargetControl target={target} options={targetOptions} onSelect={setSelectedTargetId} onAmount={setCustomAmount} />
      <p className="item-plan-summary">{goalLabel}: <strong>{formatPlannerQuantity(result.desiredQuantity)}</strong> · Counted supply: <strong>{formatPlannerQuantity(result.totalAvailableQuantity)}</strong> · Shortfall: <strong>{formatPlannerQuantity(result.remainingQuantity)}</strong></p>
      {countedSupplyNotes.length > 0 ? <p className="subtle-text">{countedSupplyNotes.join(', ')}</p> : null}
      <p className="subtle-text">After waiting {waitDays} days: {formatPlannerQuantity(result.waitProjection.projectedRemainingQuantity)} remaining. Future supply is a projection.</p>
      <details className="advanced-details">
        <summary>Adjust assumptions</summary>
        <p className="subtle-text">Saved crafting settings: Resource Saver {(result.plannerResult.problem.modifierTotals.totalResourceSaverPercent * 100).toLocaleString()}% · Mastery bonus {(result.plannerResult.problem.modifierTotals.totalMasteryBonusPercent * 100).toLocaleString()}%. {modifierState.planning.ironDepotActive ? 'Iron Depot on.' : 'Iron Depot off.'}</p>
        <div className="item-goal-controls">
          <label>
            Wait days
            <input
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={waitDays}
              onChange={(event) => setWaitDays(Number(event.target.value))}
            />
          </label>
          {hasAntlerAssumption ? (
            <label>
              Tower Antlers / day
              <input
                className="text-input"
                type="number"
                min="0"
                step="1"
                value={towerAntlersPerDay}
                onChange={(event) => setTowerAntlersPerDay(Number(event.target.value))}
              />
            </label>
          ) : null}
          {hasWishingWellAssumption ? (
            <>
              <label>
                Wishing Well throws / day
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  step="1"
                  value={wishingWellThrowsPerDay}
                  onChange={(event) => setWishingWellThrowsPerDay(Number(event.target.value))}
                />
              </label>
              <label>
                Wishing Well reward multiplier
                <input
                  className="text-input"
                  type="number"
                  min="1"
                  step="1"
                  value={wishingWellRewardMultiplier}
                  onChange={(event) => setWishingWellRewardMultiplier(Number(event.target.value))}
                />
              </label>
            </>
          ) : null}
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={includeOpenables}
              onChange={(event) => setIncludeOpenables(event.target.checked)}
            />
            Count reviewed openable contents
          </label>
          {hasPetCollectionAssumption ? (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={crunchyOmeletteActive}
                onChange={(event) => setCrunchyOmeletteActive(event.target.checked)}
              />
              Crunchy Omelette for pet collection
            </label>
          ) : null}
          {result.referencePetSources.length > 0 ? (
            <div className="item-goal-control-group">
              <h3>Future pet levels</h3>
              {result.referencePetSources.map((source) => (
                <label key={source.overrideKey}>
                  {source.petName} for {source.itemName}
                  <input
                    className="text-input"
                    type="number"
                    min={source.unlockLevel}
                    step="1"
                    value={
                      referencePetLevelOverrides[source.overrideKey] ??
                      source.petLevel
                    }
                    onChange={(event) => updateReferencePetLevel(source.overrideKey, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
          ) : null}
          {hasSugarBuildingSource ? (
            <>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={buildingProductionState.perkSettings.sugarBoostI}
                  onChange={(event) =>
                    setBuildingProductionState(
                      setBuildingProductionPerk(buildingProductionState, 'sugarBoostI', event.target.checked),
                    )}
                />
                Sugar Boost I
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={buildingProductionState.perkSettings.sugarBoostII}
                  onChange={(event) =>
                    setBuildingProductionState(
                      setBuildingProductionPerk(buildingProductionState, 'sugarBoostII', event.target.checked),
                    )}
                />
                Sugar Boost II
              </label>
              <label>
                Queued Unrefined Sugar
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  step="1"
                  value={buildingProductionState.queuedOutputByCanonicalKey['unrefined sugar'] ?? 0}
                  onChange={(event) =>
                    setBuildingProductionState(
                      setQueuedBuildingOutput(buildingProductionState, 'unrefined sugar', Number(event.target.value)),
                    )}
                />
              </label>
            </>
          ) : null}
          {hasPineBuildingSource ? (
            <>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={buildingProductionState.perkSettings.pineBoost}
                  onChange={(event) =>
                    setBuildingProductionState(
                      setBuildingProductionPerk(buildingProductionState, 'pineBoost', event.target.checked),
                    )}
                />
                Pine Boost
              </label>
              <label>
                Queued Pine Board
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  step="1"
                  value={buildingProductionState.queuedOutputByCanonicalKey['pine board'] ?? 0}
                  onChange={(event) =>
                    setBuildingProductionState(
                      setQueuedBuildingOutput(buildingProductionState, 'pine board', Number(event.target.value)),
                    )}
                />
              </label>
            </>
          ) : null}
        </div>
      </details>

      {allWarnings.length > 0 ? (
        <ul className="status-message">
          {allWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <details className="advanced-details">
        <summary>Show wait-day plan</summary>
        <dl className="summary-grid">
          <div className="summary-grid__item">
            <dt>Future pets counted</dt>
            <dd>{formatPlannerQuantity(result.waitProjection.futurePetQuantity)}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Tower Antlers counted</dt>
            <dd>{formatPlannerQuantity(result.waitProjection.towerAntlerQuantity)}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Wishing Well expected</dt>
            <dd>{formatPlannerQuantity(result.waitProjection.expectedWishingWellQuantity)}</dd>
          </div>
        </dl>
        <ItemGoalWaitProjectionRows result={result} />
      </details>

      <details className="advanced-details">
        <summary>Show counted supply</summary>
        <ItemGoalSupplyBreakdownList result={result} />
      </details>

      <div className="section-heading-row"><h3>Ingredients</h3><button className="button" type="button" onClick={() => { setExpandAll(!(expandAll || expandedKeys.size > 0)); setExpandedKeys(new Set()); }}>{expandAll || expandedKeys.size > 0 ? 'Collapse all' : 'Expand all'}</button></div>
      <div className="item-material-table" role="table" aria-label="Material plan">
        <div className="item-material-table__row item-material-table__head" role="row"><span role="columnheader">Ingredient</span><span role="columnheader">Needed</span><span role="columnheader">Counted supply</span><span role="columnheader">Shortfall</span></div>
        {getVisibleItemPageMaterials(buildItemPageMaterialRows(result.plannerResult, recipeGraph, profile.canonicalKey), expandedKeys, expandAll).map(entry => (
          <div key={entry.row.canonicalKey} className="item-material-entry">
            <div className="item-material-table__row" role="row">
              <span role="cell"><ItemProfileLink canonicalKey={entry.row.canonicalKey} itemName={entry.row.itemName} iconSrc={getItemIcon(entry.row.canonicalKey)?.src} />
                {!entry.direct ? <small className="subtle-text">Whole-plan total · used by {entry.parentKeys.map(key => result.plannerResult.rowsByCanonicalKey[key]?.itemName ?? key).join(', ')}</small> : null}
                <button className="button item-detail-toggle" type="button" aria-expanded={expandAll || expandedKeys.has(entry.row.canonicalKey)} onClick={() => { if (expandAll) { setExpandAll(false); setExpandedKeys(new Set()); } else setExpandedKeys(keys => { const next = new Set(keys); if (next.has(entry.row.canonicalKey)) next.delete(entry.row.canonicalKey); else next.add(entry.row.canonicalKey); return next; }); }}>Details</button>
              </span>
              <span role="cell">{formatPlannerQuantity(entry.row.grossRequiredQuantity)}</span><span role="cell">{formatPlannerQuantity(entry.row.availableUsedQuantity)}{entry.row.supply?.breakdowns.some(part => part.timing === 'future' && part.quantity > 0) ? <small className="subtle-text">Includes projected supply</small> : null}</span><strong role="cell">{formatPlannerQuantity(entry.row.remainingQuantity)}</strong>
            </div>
            {expandAll || expandedKeys.has(entry.row.canonicalKey) ? <div className="item-material-details"><ItemCompactSources result={result} canonicalKey={entry.row.canonicalKey} itemName={entry.row.itemName} dropRateReference={dropRateReference} recipeGraph={recipeGraph} openableContentsReference={openableContentsReference} /></div> : null}
          </div>
        ))}
      </div>
      {result.plannerResult.rows.length <= 1 ? <p className="empty-state">No ingredient demand for this target. Check available sources above.</p> : null}
    </section>
  );
}

export function ItemProfilePage() {
  const { canonicalKey: canonicalKeyParam } = useParams();
  const canonicalKey = decodeItemProfileParam(canonicalKeyParam);
  const [activeView, setActiveView] = useState<'overview' | 'get-more' | 'use-it'>('overview');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [customAmount, setCustomAmount] = useState(10_000);
  const [acquisitionState, setAcquisitionState] = useState<AcquisitionPlannerInputState>(() => {
    try {
      return loadAcquisitionPlannerInputState();
    } catch {
      return createDefaultAcquisitionPlannerInputState();
    }
  });
  const [modifierState] = useState<UserCraftingModifierState>(() => {
    try {
      return loadCraftingModifierState();
    } catch {
      return createDefaultCraftingModifierState();
    }
  });
  const [buildingProductionState, setBuildingProductionState] = useState<BuildingProductionState>(() => {
    try {
      return loadBuildingProductionState();
    } catch {
      return createDefaultBuildingProductionState();
    }
  });
  const [resourcesState, setResourcesState] = useState<{
    isLoading: boolean;
    error: string | null;
    resources: ItemProfileResources | null;
  }>({
    isLoading: true,
    error: null,
    resources: null,
  });

  useEffect(() => {
    let isMounted = true;
    let loadedAcquisitionState: AcquisitionPlannerInputState;

    try {
      loadedAcquisitionState = loadAcquisitionPlannerInputState();
    } catch {
      loadedAcquisitionState = createDefaultAcquisitionPlannerInputState();
    }

    setAcquisitionState(loadedAcquisitionState);

    try {
      setBuildingProductionState(loadBuildingProductionState());
    } catch {
      setBuildingProductionState(createDefaultBuildingProductionState());
    }

    void Promise.all([
      getLatestSnapshot(),
      loadItemCatalog(),
      loadTowerRequirements(),
      loadRecipeGraph(),
      loadDropRateReference().catch(() => null),
      loadPetSourceReference().catch(() => null),
      loadOpenableContentsReference().catch(() => null),
      loadWishingWellReference().catch(() => null),
      loadBuildingProductionReference().catch(() => null),
      loadQuestReference().catch(() => null),
    ])
      .then((
        [
          snapshot,
          itemCatalog,
          towerRequirementsData,
          recipeGraph,
          dropRateReference,
          petSourceReference,
          openableContentsReference,
          wishingWellReference,
          buildingProductionReference,
          questReferenceData,
        ],
      ) => {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: null,
          resources: {
            snapshot,
            itemCatalog,
            towerRequirementsData,
            recipeGraph,
            dropRateReference,
            petSourceReference,
            openableContentsReference,
            wishingWellReference,
            buildingProductionReference,
            questReferenceData,
            questHistoryState: loadQuestHistoryState(),
            questPlannerState: loadQuestPlannerState(),
          },
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load local item profile data.',
          resources: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      saveBuildingProductionState(buildingProductionState);
    } catch {
      // Local storage can be unavailable in private or restricted contexts.
    }
  }, [buildingProductionState]);

  const profile = useMemo(() => {
    if (!canonicalKey || !resourcesState.resources) {
      return null;
    }

    return resolveItemProfile({
      canonicalKey,
      snapshot: resourcesState.resources.snapshot,
      itemCatalog: resourcesState.resources.itemCatalog,
      towerRequirementsData: resourcesState.resources.towerRequirementsData,
      recipeGraph: resourcesState.resources.recipeGraph,
    });
  }, [canonicalKey, resourcesState.resources]);

  const masteryEligibility = resourcesState.resources?.itemCatalog?.byCanonicalKey[canonicalKey ?? '']?.masteryPossible;
  const masterable = masteryEligibility === 'yes' || (masteryEligibility !== 'no' && Boolean(profile?.matchedSnapshotRow || profile?.towerTargets.length));
  const targetOptions = profile ? getItemPageTargets(profile, masterable) : [];
  const selectedTarget = targetOptions.find(target => target.id === selectedTargetId) ?? targetOptions[0];
  const effectiveTarget = selectedTarget ? { ...selectedTarget, amount: selectedTarget.id.startsWith('custom-') ? customAmount : selectedTarget.amount } : null;
  useEffect(() => { setSelectedTargetId(''); setCustomAmount(10_000); setActiveView('overview'); }, [canonicalKey]);
  const icon = profile ? getItemIcon(profile.canonicalKey) : null;
  const nextMilestone = profile ? getNextMasteryMilestone(profile.currentMastery) : null;
  const savedInventory = acquisitionState.inventory.entries.find((entry) => entry.canonicalItemKey === profile?.canonicalKey);
  const nextTowerTarget = profile ? [...profile.towerTargets]
    .filter((target) => !isTowerTargetComplete(profile, target))
    .sort((left, right) => (left.levels[0] ?? Infinity) - (right.levels[0] ?? Infinity))[0] ?? null : null;
  const questFutureDemand = useMemo(() => {
    if (!profile || !resourcesState.resources?.questReferenceData || !resourcesState.resources.questHistoryState) {
      return null;
    }

    const planning = deriveQuestHistoryPlanningAnalytics({
      state: resourcesState.resources.questHistoryState,
      questPlannerState: resourcesState.resources.questPlannerState,
      referenceData: resourcesState.resources.questReferenceData,
    });

    return planning.futureDemandByCanonicalKey.get(profile.canonicalKey) ?? null;
  }, [
    profile,
    resourcesState.resources?.questHistoryState,
    resourcesState.resources?.questPlannerState,
    resourcesState.resources?.questReferenceData,
  ]);

  return (
    <div className="page-stack item-profile-page">
      <details className="item-page-help"><summary>About item pages</summary><p>Review saved progress, plan how to get more, and compare uses. Inventory and queues are saved values.</p></details>

      {resourcesState.isLoading ? <p className="empty-state">Loading local item profile data...</p> : null}

      {!resourcesState.isLoading && resourcesState.error ? (
        <p className="status-message status-message--error">{resourcesState.error}</p>
      ) : null}

      {!resourcesState.isLoading && !canonicalKey ? (
        <section className="page-card page-stack">
          <h2>Item Not Found</h2>
          <p className="empty-state">Use search or an item link to open an item profile.</p>
        </section>
      ) : null}

      {profile ? (
        <>
          <section className="page-card page-stack item-profile-status" aria-labelledby="item-profile-title">
            <div className="item-profile-header">
              <div className="item-profile-header__identity">
                {icon ? <img className="item-profile-header__icon" src={icon.src} alt="" aria-hidden="true" /> : null}
                <div>
                  <h2 id="item-profile-title">{profile.itemName}</h2>
                  <span className="subtle-text">Saved inventory: {savedInventory ? formatMastery(savedInventory.inventoryCount) : 'Not recorded'}</span>
                  {resourcesState.resources?.snapshot ? (
                    <span className="subtle-text item-profile-snapshot">Mastery snapshot: <time dateTime={resourcesState.resources.snapshot.createdAt}>{new Date(resourcesState.resources.snapshot.createdAt).toLocaleDateString()}</time></span>
                  ) : null}
                  {!profile.known ? (
                    <p className="status-message">
                      This item is not in the current local reference data yet, so only safe fallback details are shown.
                    </p>
                  ) : null}
                </div>
              </div>
              <div
                className="item-mastery-progress"
                style={getMasteryProgressStyle(profile.currentMastery)}
                aria-label={`${profile.itemName} mastery progress`}
              >
                <span className="item-mastery-progress__label">{nextMilestone ? `Remaining to ${nextMilestone.label}` : 'Mastery'}</span>
                <strong>
                  {!masterable ? (masteryEligibility === 'no' ? 'Not masterable' : 'Eligibility not recorded') : !profile.matchedSnapshotRow ? 'Not in latest import' : nextMilestone ? formatMastery(nextMilestone.targetMastery - profile.currentMastery) : 'MM complete'}
                </strong>
                <span className="subtle-text">{formatMastery(profile.currentMastery)} / 1,000,000</span>
                <span className="subtle-text">
                  {formatNextMasteryMilestoneProgress(profile.currentMastery)}
                </span>
                <div className="item-mastery-progress__track" aria-hidden="true">
                  <span className="item-mastery-progress__tick item-mastery-progress__tick--m">M</span>
                  <span className="item-mastery-progress__tick item-mastery-progress__tick--gm">GM</span>
                  <span className="item-mastery-progress__tick item-mastery-progress__tick--mm">MM</span>
                </div>
                {!profile.matchedSnapshotRow ? (
                  <span className="subtle-text">
                    Not in your latest import yet. Get at least 1 mastery and import again to estimate Pumpkin Juice.
                  </span>
                ) : null}
              </div>
            </div>
            <div className="item-profile-next-tower" aria-label="Next Tower need">
              {nextTowerTarget ? (
                <>
                  <span className="field-label">Next Tower need</span>
                  <Link to={`/tower-progress?through=${nextTowerTarget.levels[0]}&item=${encodeURIComponent(profile.canonicalKey)}&level=${nextTowerTarget.levels[0]}`}>
                    {nextTowerTarget.masteryLevelLabel} at Tower {nextTowerTarget.levels[0]}
                  </Link>
                  <span>{formatMastery(nextTowerTarget.requiredThreshold - profile.currentMastery)} mastery left</span>
                  <span>PJ: {formatPumpkinJuiceCount(nextTowerTarget.estimate.totalPumpkinJuices)}</span>
                </>
              ) : <span className="subtle-text">{profile.towerTargets.length ? 'All Tower targets complete' : 'No Tower requirement found for this item.'}</span>}
            </div>
            {profile.towerTargets.length > 0 ? <details className="item-profile-tower-details">
              <summary>All Tower targets ({profile.towerTargets.length})</summary>
          <section className="page-stack" aria-labelledby="item-profile-tower-title">
            <h2 id="item-profile-tower-title">Tower Need</h2>
            {profile.towerTargets.length > 0 ? (
              <div className="page-stack">
                {profile.towerTargets.map((towerTarget) => (
                  <div key={towerTarget.requiredThreshold} className="tower-need-card">
                    <p className="supporting-text">Required for Tower</p>
                    <p className="tower-need-card__target">{formatTowerLevelForTarget(towerTarget)}</p>
                    {isTowerTargetComplete(profile, towerTarget) ? (
                      <p className="status-pill">Complete</p>
                    ) : null}
                    <dl className="summary-grid">
                      <div className="summary-grid__item">
                        <dt>Mastery left</dt>
                        <dd>{formatMastery(Math.max(0, towerTarget.requiredThreshold - profile.currentMastery))}</dd>
                      </div>
                      <div className="summary-grid__item">
                        <dt>Pumpkin Juice needed to finish tower</dt>
                        <dd>{formatPumpkinJuiceCount(towerTarget.estimate.totalPumpkinJuices)}</dd>
                        {towerTarget.estimate.nextPumpkinJuiceGain ? (
                          <p className="subtle-text">
                            Next PJ: +{towerTarget.estimate.nextPumpkinJuiceGain.toLocaleString()} mastery
                          </p>
                        ) : null}
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No Tower requirement found for this item.</p>
            )}
          </section>
            </details> : null}
          </section>

          <nav className="item-profile-view-nav" aria-label="Item page views">
            {([
              ['overview', 'Overview'],
              ['get-more', 'Get more'],
              ['use-it', 'Use it'],
            ] as const).map(([view, label]) => (
              <button key={view} type="button" className={`button${activeView === view ? ' button--active' : ''}`} aria-pressed={activeView === view}
                aria-controls={`item-view-${view}`} onClick={() => setActiveView(view)}>
                {label}
              </button>
            ))}
          </nav>
          <div id="item-view-overview" className="page-stack item-profile-view" role="region" aria-label="Overview" hidden={activeView !== 'overview'}>
          <section className="page-card page-stack" aria-labelledby="item-profile-recipe-title">
            <h2 id="item-profile-recipe-title">Made From</h2>
            {profile.directRecipe ? (
              <>
                <span className="subtle-text">Per {profile.directRecipe.recipeType === 'craft' ? 'craft' : 'cook'}</span>
                <ul className="data-list data-list--clickable item-overview-recipe">
                  {profile.directRecipe.inputs.map((input) => (
                    <RecipeInputRow key={`${input.inputOrder}-${input.canonicalKey}`} input={input} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="empty-state">No direct recipe found in local recipe data.</p>
            )}
          </section>

          {effectiveTarget ? <section className="page-card item-overview-plan" aria-label="Quick plan">
            <ItemTargetControl target={effectiveTarget} options={targetOptions} onSelect={setSelectedTargetId} onAmount={setCustomAmount} />
            <span>{formatPlannerQuantity(Math.max(0, effectiveTarget.amount - (effectiveTarget.mode === 'mastery' ? profile.currentMastery : savedInventory?.inventoryCount ?? 0)))} {effectiveTarget.mode === 'mastery' ? 'mastery remaining' : 'remaining after saved inventory'}</span>
            <button className="button button--primary" type="button" onClick={() => setActiveView('get-more')}>Plan materials</button>
          </section> : null}
          {resourcesState.resources?.buildingProductionReference?.byOutputCanonicalKey[profile.canonicalKey]?.map(process => <p className="item-saved-production" key={process.productionKey}>{process.buildingName}: saved queue <strong>{formatPlannerQuantity(buildingProductionState.queuedOutputByCanonicalKey[profile.canonicalKey] ?? 0)}</strong> {profile.itemName} · reference processing {process.outputQuantity} per {process.processingMinutes} min, before saved perks. <span className="subtle-text">Saved values; not live production.</span></p>)}
          <details className="item-secondary-links"><summary>More tools</summary>
          <section className="page-card page-stack" aria-labelledby="item-profile-links-title">
            <h2 id="item-profile-links-title">Open In</h2>
            <div className="quick-link-grid">
              {profile.towerTarget ? (
                <>
                  <Link className="quick-link-card" to={getTowerProgressPath(profile)}>
                    <span className="quick-link-card__title">Tower Progress</span>
                    <span className="quick-link-card__description">See this item in the unique Tower list.</span>
                  </Link>
                  <Link className="quick-link-card" to={getTowerRequirementsPath(profile)}>
                    <span className="quick-link-card__title">Tower Requirements</span>
                    <span className="quick-link-card__description">Review row-by-row Tower requirements.</span>
                  </Link>
                </>
              ) : null}
              <Link className="quick-link-card" to="/mastery-goals">
                <span className="quick-link-card__title">Mastery Goals</span>
                <span className="quick-link-card__description">Save or review personal mastery goals.</span>
              </Link>
              <Link className="quick-link-card" to={`/ingredient-demand?item=${encodeURIComponent(profile.canonicalKey)}`}>
                <span className="quick-link-card__title">Ingredient Lookup</span>
                <span className="quick-link-card__description">Check recursive material demand for this item.</span>
              </Link>
            </div>
          </section>
          </details>
          </div>
          <div id="item-view-get-more" className="page-stack item-profile-view" role="region" aria-label="Get more" hidden={activeView !== 'get-more'}>
          {resourcesState.resources?.recipeGraph && effectiveTarget ? (
            <ItemGoalCalculatorSection
              key={profile.canonicalKey}
              target={effectiveTarget}
              targetOptions={targetOptions}
              setSelectedTargetId={setSelectedTargetId}
              setCustomAmount={setCustomAmount}
              dropRateReference={resourcesState.resources.dropRateReference}
              profile={profile}
              acquisitionState={acquisitionState}
              modifierState={modifierState}
              recipeGraph={resourcesState.resources.recipeGraph}
              petSourceReference={resourcesState.resources.petSourceReference}
              openableContentsReference={resourcesState.resources.openableContentsReference}
              wishingWellReference={resourcesState.resources.wishingWellReference}
              buildingProductionReference={resourcesState.resources.buildingProductionReference}
              buildingProductionState={buildingProductionState}
              setBuildingProductionState={setBuildingProductionState}
            />
          ) : null}

          </div>
          <div id="item-view-use-it" className="page-stack item-profile-view" role="region" aria-label="Use it" hidden={activeView !== 'use-it'}>
            {resourcesState.resources?.recipeGraph ? <ItemUsesPanel key={profile.canonicalKey} profile={profile} recipeGraph={resourcesState.resources.recipeGraph} towerRequirementsData={resourcesState.resources.towerRequirementsData} snapshot={resourcesState.resources.snapshot} questDemand={questFutureDemand} /> : <p className="empty-state">Recipe use coverage is unavailable.</p>}
          </div>
        </>
      ) : null}
    </div>
  );
}
