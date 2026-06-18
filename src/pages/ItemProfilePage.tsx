import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  createDefaultAcquisitionPlannerInputState,
  loadAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import {
  createDefaultCraftingModifierState,
  loadCraftingModifierState,
  type UserCraftingModifierState,
} from '../lib/craftingModifierState';
import {
  deriveCraftMaterialMatrix,
  type CraftMaterialMatrixRow,
} from '../lib/craftMaterialMatrix';
import { classifyCraftMaterialMatrixRow } from '../lib/craftMaterialMatrixFamilies';
import {
  buildItemGoalCalculatorResult,
  type ItemGoalCalculatorResult,
  type ItemGoalMode,
} from '../lib/itemGoalCalculator';
import {
  deriveItemAcquisitionContext,
  type ItemAcquisitionContext,
} from '../lib/itemAcquisitionContext';
import { decodeItemProfileParam, toItemProfilePath } from '../lib/itemProfileRoutes';
import { getItemIcon } from '../lib/itemIconManifest';
import { resolveItemProfile, type ItemProfile, type ItemProfileTowerTarget } from '../lib/itemProfileResolver';
import { loadDropRateReference, type DropRateReferenceData } from '../lib/loadDropRateReference';
import { loadItemCatalog, type ItemCatalogData } from '../lib/loadItemCatalog';
import {
  loadOpenableContentsReference,
  type OpenableContentsReferenceData,
} from '../lib/loadOpenableContentsReference';
import { loadPetSourceReference, type PetSourceReferenceData } from '../lib/loadPetSourceReference';
import { loadQuestReference, type QuestReferenceData } from '../lib/loadQuestReference';
import { loadRecipeGraph, type RecipeGraph, type RecipeInput, type RecipeNode } from '../lib/loadRecipeGraph';
import { loadWishingWellReference, type WishingWellReferenceData } from '../lib/loadWishingWellReference';
import {
  deriveQuestHistoryPlanningAnalytics,
  getQuestFutureDemandScopeLabel,
  type QuestFutureDemandRow,
} from '../lib/questHistoryPlanning';
import { loadQuestHistoryState, type QuestHistoryState } from '../lib/questHistoryState';
import { loadQuestPlannerState, type QuestPlannerState } from '../lib/questPlannerState';
import {
  calculateRecursiveIngredientBurden,
  type IngredientBurdenEntry,
  type IngredientBurdenGoalScope,
  type IngredientBurdenRootGoal,
  type IngredientBurdenUnresolvedGoal,
  type RecursiveIngredientBurdenResult,
} from '../lib/recursiveIngredientBurden';
import {
  type TowerRequirementEntry,
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
  questReferenceData: QuestReferenceData | null;
  questHistoryState: QuestHistoryState | null;
  questPlannerState: QuestPlannerState | null;
};

type MasteryMilestone = {
  label: 'M' | 'GM' | 'MM';
  targetMastery: number;
};

type ItemBurdenTarget = {
  scope: IngredientBurdenGoalScope;
  label: string;
  rootGoal: IngredientBurdenRootGoal | null;
  unresolvedGoal: IngredientBurdenUnresolvedGoal | null;
  entries: IngredientBurdenEntry[];
  isComplete: boolean;
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

function formatRecipeType(recipeType: string): string {
  return recipeType === 'cooking' ? 'Cooking' : 'Crafting';
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

function formatBurdenReason(reason: IngredientBurdenUnresolvedGoal['reason']): string {
  switch (reason) {
    case 'not_craft_recipe':
      return 'This item is not a craft recipe in local recipe data.';
    case 'missing_recipe':
      return 'No local recipe was found for this item.';
    case 'excluded_recipe_policy':
      return 'This recipe is excluded by your saved crafting assumptions.';
  }
}

function getIngredientEntriesForRootGoal(
  burdenResult: RecursiveIngredientBurdenResult,
  scope: IngredientBurdenGoalScope,
  rootGoal: IngredientBurdenRootGoal,
): IngredientBurdenEntry[] {
  return Object.values(burdenResult.scopeResults[scope].ingredientBurdenByCanonicalKey)
    .filter((entry) => entry.canonicalKey !== rootGoal.outputCanonicalKey)
    .filter((entry) => entry.contributions.some((contribution) => contribution.rootGoalId === rootGoal.goalId))
    .sort((left, right) => {
      if (right.totalRequiredEffectiveOutput !== left.totalRequiredEffectiveOutput) {
        return right.totalRequiredEffectiveOutput - left.totalRequiredEffectiveOutput;
      }

      return left.itemName.localeCompare(right.itemName);
    });
}

function buildBurdenTargets(
  profile: ItemProfile,
  burdenResult: RecursiveIngredientBurdenResult | null,
): ItemBurdenTarget[] {
  if (!burdenResult) {
    return [];
  }

  const masteryTargets = MASTERY_MILESTONES.map((milestone) => ({
    scope: milestone.label,
    label: `To ${milestone.label}`,
    targetMastery: milestone.targetMastery,
  }));
  const towerTarget = profile.towerTarget
    ? [
        {
          scope: 'Tower' as const,
          label: 'To finish Tower need',
          targetMastery: profile.towerTarget.requiredThreshold,
        },
      ]
    : [];

  return [...masteryTargets, ...towerTarget].map((target) => {
    const scopeResult = burdenResult.scopeResults[target.scope];
    const rootGoal =
      scopeResult.rootGoals.find((goal) => goal.outputCanonicalKey === profile.canonicalKey) ?? null;
    const unresolvedGoal =
      scopeResult.unresolvedGoals.find((goal) => goal.outputCanonicalKey === profile.canonicalKey) ?? null;

    return {
      scope: target.scope,
      label: target.label,
      rootGoal,
      unresolvedGoal,
      entries: rootGoal ? getIngredientEntriesForRootGoal(burdenResult, target.scope, rootGoal) : [],
      isComplete: profile.currentMastery >= target.targetMastery,
    };
  });
}

function getFirstTowerEntry(profile: ItemProfile): TowerRequirementEntry | null {
  return (
    profile.towerTargets
      .flatMap((target) => target.entries)
      .sort((left, right) => {
        if (left.towerLevel !== right.towerLevel) {
          return left.towerLevel - right.towerLevel;
        }

        return left.slotIndex - right.slotIndex;
      })[0] ?? null
  );
}

function getTowerRequirementsPath(profile: ItemProfile): string {
  const firstEntry = getFirstTowerEntry(profile);

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

function getAcquisitionBreakdownPath(profile: ItemProfile): string {
  const searchParams = new URLSearchParams({
    item: profile.canonicalKey,
  });

  return `/acquisition-breakdown?${searchParams.toString()}`;
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

function UsedInRecipeRow({ recipe }: { recipe: RecipeNode }) {
  const icon = getItemIcon(recipe.outputCanonicalKey);

  return (
    <li>
      <Link className="recipe-link-row" to={toItemProfilePath(recipe.outputCanonicalKey)}>
        <span className="recipe-link-row__item">
          {icon ? <img className="item-icon" src={icon.src} alt="" aria-hidden="true" loading="lazy" /> : null}
          <span>
            <strong>{recipe.outputItemName}</strong>
            <span className="subtle-text">{formatRecipeType(recipe.recipeType)} recipe</span>
          </span>
        </span>
        <span className="subtle-text">
          {recipe.inputs.length.toLocaleString()} input{recipe.inputs.length === 1 ? '' : 's'}
        </span>
      </Link>
    </li>
  );
}

function compareMaterialSinkRows(left: CraftMaterialMatrixRow, right: CraftMaterialMatrixRow): number {
  const leftUnfinished = left.towerTargets.some((target) => !target.achieved);
  const rightUnfinished = right.towerTargets.some((target) => !target.achieved);

  if (leftUnfinished !== rightUnfinished) {
    return leftUnfinished ? -1 : 1;
  }

  const leftLevel = left.towerTargets.flatMap((target) => target.levels)[0] ?? Number.POSITIVE_INFINITY;
  const rightLevel = right.towerTargets.flatMap((target) => target.levels)[0] ?? Number.POSITIVE_INFINITY;

  if (leftLevel !== rightLevel) {
    return leftLevel - rightLevel;
  }

  return left.outputItemName.localeCompare(right.outputItemName);
}

function formatMaterialSinkTarget(row: CraftMaterialMatrixRow): string {
  const target = row.towerTargets.find((towerTarget) => !towerTarget.achieved) ?? row.towerTargets[0] ?? null;

  if (!target) {
    return 'No Tower target';
  }

  const status = target.achieved ? 'done' : `${formatMastery(target.remainingToRequirement)} left`;
  return `${target.masteryLevelNeeded} L${target.levels.join(', ')} · ${status}`;
}

function ItemMaterialSinkPanel({
  profile,
  recipeGraph,
  towerRequirementsData,
  snapshot,
}: {
  profile: ItemProfile;
  recipeGraph: RecipeGraph;
  towerRequirementsData: TowerRequirementsData | null;
  snapshot: MasterySnapshot | null;
}) {
  const rows = useMemo(
    () =>
      deriveCraftMaterialMatrix({
        seedCanonicalKeys: [profile.canonicalKey],
        recipeGraph,
        towerRequirementsData,
        snapshot,
        maxDepth: 1,
      }).rows
        .filter((row) => row.towerRelevant)
        .sort(compareMaterialSinkRows),
    [profile.canonicalKey, recipeGraph, snapshot, towerRequirementsData],
  );
  const previewRows = rows.slice(0, 6);

  return (
    <section className="page-card page-stack" aria-labelledby="item-profile-material-sinks-title">
      <div className="section-heading-row">
        <div>
          <h2 id="item-profile-material-sinks-title">Tower Craft Sinks</h2>
          <p className="supporting-text">Tower-relevant downstream crafts that use this item directly or one step away.</p>
        </div>
        <Link className="button button--secondary" to={getCraftMaterialMatrixPath(profile)}>
          Open Matrix
        </Link>
      </div>

      {previewRows.length > 0 ? (
        <details className="advanced-details">
          <summary>Show Tower craft sinks</summary>
          <ul className="data-list data-list--clickable">
            {previewRows.map((row) => {
              const icon = getItemIcon(row.outputCanonicalKey);
              const family = classifyCraftMaterialMatrixRow(row);

              return (
                <li key={`${row.outputCanonicalKey}-${row.pathType}`}>
                  <div className="recipe-link-row">
                    <ItemProfileLink
                      canonicalKey={row.outputCanonicalKey}
                      itemName={row.outputItemName}
                      iconSrc={icon?.src}
                    />
                    <span>
                      <strong>{formatMaterialSinkTarget(row)}</strong>
                      <span className="subtle-text">
                        {' '}
                        {family.label}; {formatMastery(row.consumedSeedQuantity)} {profile.itemName} per output
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length > previewRows.length ? (
            <p className="supporting-text">
              Showing {previewRows.length.toLocaleString()} of {rows.length.toLocaleString()} Tower-relevant sinks.
            </p>
          ) : null}
        </details>
      ) : (
        <p className="empty-state">No Tower-relevant craft sinks found for this item in local recipe data.</p>
      )}
    </section>
  );
}

function ItemBurdenTargetCard({ target }: { target: ItemBurdenTarget }) {
  if (target.isComplete) {
    return (
      <div className="item-burden-card">
        <h3>{target.label}</h3>
        <p className="status-pill">Complete</p>
      </div>
    );
  }

  if (target.unresolvedGoal) {
    return (
      <div className="item-burden-card">
        <h3>{target.label}</h3>
        <p className="empty-state">{formatBurdenReason(target.unresolvedGoal.reason)}</p>
      </div>
    );
  }

  if (!target.rootGoal) {
    return (
      <div className="item-burden-card">
        <h3>{target.label}</h3>
        <p className="empty-state">No recursive material estimate is needed for this target.</p>
      </div>
    );
  }

  return (
    <div className="item-burden-card">
      <h3>{target.label}</h3>
      <dl className="compact-stat-grid">
        <div>
          <dt>Craft operations</dt>
          <dd>{formatMastery(target.rootGoal.requiredCraftOperations)}</dd>
        </div>
        <div>
          <dt>Mastery left</dt>
          <dd>{formatMastery(target.rootGoal.remainingMastery)}</dd>
        </div>
      </dl>
      {target.entries.length > 0 ? (
        <details className="item-burden-card__details">
          <summary>Show materials</summary>
          <ul className="data-list data-list--clickable">
            {target.entries.map((entry) => {
              const icon = getItemIcon(entry.canonicalKey);

              return (
                <li key={entry.canonicalKey}>
                  <div className="recipe-link-row">
                    <ItemProfileLink
                      canonicalKey={entry.canonicalKey}
                      itemName={entry.itemName}
                      iconSrc={icon?.src}
                    />
                    <strong>{formatMastery(entry.totalRequiredEffectiveOutput)}</strong>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ) : (
        <p className="empty-state">No additional recipe inputs found for this target.</p>
      )}
    </div>
  );
}

function ItemAcquisitionContextSection({
  context,
  profile,
}: {
  context: ItemAcquisitionContext;
  profile: ItemProfile;
}) {
  return (
    <section className="page-card page-stack" aria-labelledby="item-profile-acquisition-title">
      <div>
        <h2 id="item-profile-acquisition-title">Acquisition</h2>
        <p className="supporting-text">
          Saved source context for this item, with detailed source comparison kept in Acquisition Breakdown.
        </p>
      </div>

      <dl className="summary-grid">
        <div className="summary-grid__item">
          <dt>Needed by Material Planner</dt>
          <dd>{context.requiredQuantity === null ? 'Not currently needed' : formatMastery(context.requiredQuantity)}</dd>
        </div>
        <div className="summary-grid__item">
          <dt>Saved sources</dt>
          <dd>{formatMastery(context.totalSavedQuantity)}</dd>
          <p className="subtle-text">
            {formatMastery(context.immediateSavedQuantity)} now
            {context.futurePetQuantity > 0 ? `, ${formatMastery(context.futurePetQuantity)} from future pets` : ''}
          </p>
        </div>
        <div className="summary-grid__item">
          <dt>Known drop sources</dt>
          <dd>{context.dropRateSourceCount.toLocaleString()}</dd>
        </div>
      </dl>

      {context.hasBreakdownTarget ? (
        <Link className="quick-link-card" to={getAcquisitionBreakdownPath(profile)}>
          <span className="quick-link-card__title">Open Acquisition Breakdown</span>
          <span className="quick-link-card__description">Compare ways to get this item.</span>
        </Link>
      ) : (
        <p className="empty-state">
          Acquisition Breakdown focuses on items needed by the current material plan, so this item is not selectable
          there yet.
        </p>
      )}
    </section>
  );
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

function ItemGoalDemandList({
  result,
  targetCanonicalKey,
}: {
  result: ItemGoalCalculatorResult;
  targetCanonicalKey: string;
}) {
  const rows = result.plannerResult.rows
    .filter((row) => row.canonicalKey !== targetCanonicalKey)
    .filter((row) => row.grossRequiredQuantity > 0)
    .slice(0, 8);

  if (rows.length === 0) {
    return <p className="empty-state">No recursive recipe demand was found for this item goal.</p>;
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
                  {formatPlannerQuantity(row.grossRequiredQuantity)} needed before saved supply
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ItemGoalSourceRows({ result }: { result: ItemGoalCalculatorResult }) {
  return (
    <div className="item-goal-source-grid">
      <div className="item-goal-source-card">
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
      </div>

      <div className="item-goal-source-card">
        <h3>Pets</h3>
        {result.petSources.length > 0 ? (
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
          </ul>
        ) : (
          <p className="empty-state">No future pet rows match this target item or its current recipe demand.</p>
        )}
      </div>

      <div className="item-goal-source-card">
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
      </div>
    </div>
  );
}

function ItemQuestFutureDemandPanel({ demand }: { demand: QuestFutureDemandRow | null }) {
  return (
    <section className="page-card page-stack" aria-labelledby="item-profile-quest-demand-title">
      <div>
        <h2 id="item-profile-quest-demand-title">Future Quest Demand</h2>
        <p className="supporting-text">
          Known unfinished reviewed quest requirements, using saved quest history and manual Quest Planner state.
        </p>
      </div>
      {demand ? (
        <>
          <dl className="summary-grid">
            <div className="summary-grid__item">
              <dt>Total known demand</dt>
              <dd>{formatPlannerQuantity(demand.totalQuantity)}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Unfinished quests</dt>
              <dd>{demand.questCount.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Scopes</dt>
              <dd>
                {demand.scopes.map((scope) => getQuestFutureDemandScopeLabel(scope.scope)).join(', ')}
              </dd>
            </div>
          </dl>
          <details className="advanced-details">
            <summary>Show quest requirements</summary>
            <ul className="data-list">
              {demand.requirements.slice(0, 12).map((requirement) => (
                <li key={`${requirement.questKey}:${requirement.scope}`}>
                  <div className="recipe-link-row">
                    <span>
                      <strong>{requirement.questName}</strong>
                      <span className="subtle-text"> {requirement.questlineName}</span>
                    </span>
                    <span>
                      {formatPlannerQuantity(requirement.quantity)} needed ·{' '}
                      {getQuestFutureDemandScopeLabel(requirement.scope)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
          {demand.sourceHints.length > 0 ? (
            <details className="advanced-details">
              <summary>Show reviewed source hints</summary>
              <ul className="data-list data-list--clickable">
                {demand.sourceHints.slice(0, 8).map((sourceHint) => (
                  <li key={`${sourceHint.sourceCanonicalKey}:${sourceHint.sourceType}`}>
                    <div className="recipe-link-row">
                      <ItemProfileLink
                        canonicalKey={sourceHint.sourceCanonicalKey}
                        itemName={sourceHint.sourceName}
                        iconSrc={getItemIcon(sourceHint.sourceCanonicalKey)?.src ?? null}
                      />
                      <span>{sourceHint.sourceType}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <p className="empty-state">No unfinished reviewed quest requirements currently need this item.</p>
      )}
    </section>
  );
}

function ItemGoalWaitProjectionRows({ result }: { result: ItemGoalCalculatorResult }) {
  const rows = result.waitProjection.activeRemainingRows.slice(0, 8);

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

function ItemGoalCalculatorSection({
  profile,
  acquisitionState,
  modifierState,
  recipeGraph,
  petSourceReference,
  openableContentsReference,
  wishingWellReference,
}: {
  profile: ItemProfile;
  acquisitionState: AcquisitionPlannerInputState;
  modifierState: UserCraftingModifierState;
  recipeGraph: RecipeGraph;
  petSourceReference: PetSourceReferenceData | null;
  openableContentsReference: OpenableContentsReferenceData | null;
  wishingWellReference: WishingWellReferenceData | null;
}) {
  const defaultMasteryTarget = getNextMasteryMilestone(profile.currentMastery)?.targetMastery ?? 1_000_000;
  const [goalMode, setGoalMode] = useState<ItemGoalMode>('mastery');
  const [targetMastery, setTargetMastery] = useState(defaultMasteryTarget);
  const [targetQuantity, setTargetQuantity] = useState(10_000);
  const [waitDays, setWaitDays] = useState(acquisitionState.pets.futureProduction.horizonDays);
  const [includeOpenables, setIncludeOpenables] = useState(true);
  const [crunchyOmeletteActive, setCrunchyOmeletteActive] = useState(false);
  const [towerAntlersPerDay, setTowerAntlersPerDay] = useState(0);
  const [wishingWellThrowsPerDay, setWishingWellThrowsPerDay] = useState(30);
  const [wishingWellRewardMultiplier, setWishingWellRewardMultiplier] = useState(1);

  useEffect(() => {
    setTargetMastery(defaultMasteryTarget);
  }, [defaultMasteryTarget, profile.canonicalKey]);

  const result = useMemo(() => {
    return buildItemGoalCalculatorResult({
      itemName: profile.itemName,
      canonicalKey: profile.canonicalKey,
      currentMastery: profile.currentMastery,
      acquisitionState,
      modifierState,
      recipeGraph,
      petSourceReference,
      openableContentsReference,
      wishingWellReference,
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
      },
    });
  }, [
    acquisitionState,
    crunchyOmeletteActive,
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
    wishingWellReference,
    wishingWellRewardMultiplier,
    wishingWellThrowsPerDay,
  ]);
  const goalLabel = goalMode === 'mastery' ? 'Mastery remaining' : 'Quantity target';
  const allWarnings = [...result.warnings, ...result.waitProjection.warnings];

  return (
    <section className="page-card page-stack" aria-labelledby="item-goal-calculator-title">
      <div>
        <h2 id="item-goal-calculator-title">Goal Calculator</h2>
        <p className="supporting-text">
          Plan a mastery or quantity target with saved inventory, openables, pet forecasts, recipes, and reviewed Wishing
          Well paths.
        </p>
      </div>

      <dl className="summary-grid">
        <div className="summary-grid__item">
          <dt>{goalLabel}</dt>
          <dd>{formatPlannerQuantity(result.desiredQuantity)}</dd>
        </div>
        <div className="summary-grid__item">
          <dt>Counted supply</dt>
          <dd>{formatPlannerQuantity(result.totalAvailableQuantity)}</dd>
          {result.openableQuantity > 0 || result.crunchyStoredPetBonusQuantity > 0 ? (
            <p className="subtle-text">
              {result.openableQuantity > 0 ? `${formatPlannerQuantity(result.openableQuantity)} from openables` : ''}
              {result.openableQuantity > 0 && result.crunchyStoredPetBonusQuantity > 0 ? ', ' : ''}
              {result.crunchyStoredPetBonusQuantity > 0
                ? `${formatPlannerQuantity(result.crunchyStoredPetBonusQuantity)} Crunchy pet bonus`
                : ''}
            </p>
          ) : null}
        </div>
        <div className="summary-grid__item">
          <dt>Remaining</dt>
          <dd>{formatPlannerQuantity(result.remainingQuantity)}</dd>
        </div>
        <div className="summary-grid__item">
          <dt>After waiting</dt>
          <dd>{formatPlannerQuantity(result.waitProjection.projectedRemainingQuantity)}</dd>
          <p className="subtle-text">
            {result.waitProjection.waitDays.toLocaleString()} day{result.waitProjection.waitDays === 1 ? '' : 's'}
          </p>
        </div>
        <div className="summary-grid__item">
          <dt>Wishing Well EV</dt>
          <dd>{formatPlannerQuantity(result.expectedWishingWellQuantityPerDay)} / day</dd>
        </div>
      </dl>

      <details className="advanced-details">
        <summary>Adjust assumptions</summary>
        <div className="item-goal-controls">
          <label>
            Goal kind
            <select
              className="text-input"
              value={goalMode}
              onChange={(event) => setGoalMode(event.target.value as ItemGoalMode)}
            >
              <option value="mastery">Mastery target</option>
              <option value="quantity">Total quantity</option>
            </select>
          </label>
          {goalMode === 'mastery' ? (
            <label>
              Target mastery
              <input
                className="text-input"
                type="number"
                min="0"
                step="1000"
                value={targetMastery}
                onChange={(event) => setTargetMastery(Number(event.target.value))}
              />
            </label>
          ) : (
            <label>
              Target quantity
              <input
                className="text-input"
                type="number"
                min="0"
                step="1"
                value={targetQuantity}
                onChange={(event) => setTargetQuantity(Number(event.target.value))}
              />
            </label>
          )}
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
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={includeOpenables}
              onChange={(event) => setIncludeOpenables(event.target.checked)}
            />
            Count reviewed openable contents
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={crunchyOmeletteActive}
              onChange={(event) => setCrunchyOmeletteActive(event.target.checked)}
            />
            Crunchy Omelette for pet collection
          </label>
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

      <details className="advanced-details">
        <summary>Show recipe demand</summary>
        <ItemGoalDemandList result={result} targetCanonicalKey={profile.canonicalKey} />
      </details>

      <details className="advanced-details">
        <summary>Show source paths</summary>
        <ItemGoalSourceRows result={result} />
      </details>
    </section>
  );
}

export function ItemProfilePage() {
  const { canonicalKey: canonicalKeyParam } = useParams();
  const canonicalKey = decodeItemProfileParam(canonicalKeyParam);
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

    void Promise.all([
      getLatestSnapshot(),
      loadItemCatalog(),
      loadTowerRequirements(),
      loadRecipeGraph(),
      loadDropRateReference().catch(() => null),
      loadPetSourceReference().catch(() => null),
      loadOpenableContentsReference().catch(() => null),
      loadWishingWellReference().catch(() => null),
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

  const icon = profile ? getItemIcon(profile.canonicalKey) : null;
  const burdenResult = useMemo(() => {
    if (
      !profile ||
      !resourcesState.resources?.snapshot ||
      !resourcesState.resources.recipeGraph ||
      !resourcesState.resources.towerRequirementsData
    ) {
      return null;
    }

    return calculateRecursiveIngredientBurden({
      snapshot: resourcesState.resources.snapshot,
      recipeGraph: resourcesState.resources.recipeGraph,
      modifierState,
      towerRequirementsData: resourcesState.resources.towerRequirementsData,
    });
  }, [modifierState, profile, resourcesState.resources]);
  const burdenTargets = useMemo(() => (profile ? buildBurdenTargets(profile, burdenResult) : []), [
    burdenResult,
    profile,
  ]);
  const acquisitionContext = useMemo(() => {
    if (!profile) {
      return null;
    }

    return deriveItemAcquisitionContext({
      canonicalKey: profile.canonicalKey,
      acquisitionState,
      burdenResult,
      dropRateReference: resourcesState.resources?.dropRateReference ?? null,
    });
  }, [acquisitionState, burdenResult, profile, resourcesState.resources?.dropRateReference]);
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
    <div className="page-stack">
      <PageIntro
        title="Item Profile"
        description="Open one item to see its mastery progress, Tower need, Pumpkin Juice estimate, and recipe context."
        storageKey="item-profile"
      />

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
          <section className="page-card page-stack" aria-labelledby="item-profile-title">
            <div className="item-profile-header">
              <div className="item-profile-header__identity">
                {icon ? <img className="item-profile-header__icon" src={icon.src} alt="" aria-hidden="true" /> : null}
                <div>
                  <h2 id="item-profile-title">{profile.itemName}</h2>
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
                <span className="item-mastery-progress__label">Current mastery</span>
                <strong>
                  {formatMastery(profile.currentMastery)} / 1,000,000
                </strong>
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
          </section>

          <section className="page-card page-stack" aria-labelledby="item-profile-tower-title">
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

          <section className="page-card page-stack" aria-labelledby="item-profile-recipe-title">
            <h2 id="item-profile-recipe-title">Made From</h2>
            {profile.directRecipe ? (
              <>
                <p className="supporting-text">{formatRecipeType(profile.directRecipe.recipeType)} recipe</p>
                <ul className="data-list data-list--clickable">
                  {profile.directRecipe.inputs.map((input) => (
                    <RecipeInputRow key={`${input.inputOrder}-${input.canonicalKey}`} input={input} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="empty-state">No direct recipe found in local recipe data.</p>
            )}
          </section>

          <section className="page-card page-stack" aria-labelledby="item-profile-burden-title">
            <div>
              <h2 id="item-profile-burden-title">Materials Needed</h2>
              <p className="supporting-text">
                Estimated recipe materials for each mastery or Tower target, using your saved crafting settings.
              </p>
            </div>
            {burdenTargets.length > 0 ? (
              <details className="advanced-details">
                <summary>Show material estimates</summary>
                <div className="item-burden-grid">
                  {burdenTargets.map((target) => (
                    <ItemBurdenTargetCard key={target.scope} target={target} />
                  ))}
                </div>
              </details>
            ) : (
              <p className="empty-state">Import a mastery snapshot to estimate recursive material needs.</p>
            )}
          </section>

          {resourcesState.resources?.recipeGraph ? (
            <ItemMaterialSinkPanel
              profile={profile}
              recipeGraph={resourcesState.resources.recipeGraph}
              towerRequirementsData={resourcesState.resources.towerRequirementsData}
              snapshot={resourcesState.resources.snapshot}
            />
          ) : null}

          <section className="page-card page-stack" aria-labelledby="item-profile-used-in-title">
            <h2 id="item-profile-used-in-title">Used In</h2>
            {profile.usedInRecipes.length > 0 ? (
              <ul className="data-list data-list--clickable">
                {profile.usedInRecipes.map((recipe) => (
                  <UsedInRecipeRow key={recipe.outputCanonicalKey} recipe={recipe} />
                ))}
              </ul>
            ) : (
              <p className="empty-state">No local recipes use this item directly.</p>
            )}
          </section>

          {acquisitionContext ? (
            <ItemAcquisitionContextSection context={acquisitionContext} profile={profile} />
          ) : null}

          <ItemQuestFutureDemandPanel demand={questFutureDemand} />

          {resourcesState.resources?.recipeGraph ? (
            <ItemGoalCalculatorSection
              profile={profile}
              acquisitionState={acquisitionState}
              modifierState={modifierState}
              recipeGraph={resourcesState.resources.recipeGraph}
              petSourceReference={resourcesState.resources.petSourceReference}
              openableContentsReference={resourcesState.resources.openableContentsReference}
              wishingWellReference={resourcesState.resources.wishingWellReference}
            />
          ) : null}

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
        </>
      ) : null}
    </div>
  );
}
