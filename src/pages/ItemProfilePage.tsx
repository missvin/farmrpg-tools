import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  createDefaultCraftingModifierState,
  loadCraftingModifierState,
  type UserCraftingModifierState,
} from '../lib/craftingModifierState';
import { decodeItemProfileParam, toItemProfilePath } from '../lib/itemProfileRoutes';
import { getItemIcon } from '../lib/itemIconManifest';
import { resolveItemProfile, type ItemProfile, type ItemProfileTowerTarget } from '../lib/itemProfileResolver';
import { loadItemCatalog, type ItemCatalogData } from '../lib/loadItemCatalog';
import { loadRecipeGraph, type RecipeGraph, type RecipeInput, type RecipeNode } from '../lib/loadRecipeGraph';
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

function formatPumpkinJuiceCount(value: number | null): string {
  return value === null ? 'Needs baseline mastery' : value.toLocaleString();
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

export function ItemProfilePage() {
  const { canonicalKey: canonicalKeyParam } = useParams();
  const canonicalKey = decodeItemProfileParam(canonicalKeyParam);
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

    void Promise.all([getLatestSnapshot(), loadItemCatalog(), loadTowerRequirements(), loadRecipeGraph()])
      .then(([snapshot, itemCatalog, towerRequirementsData, recipeGraph]) => {
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
                  <span className="subtle-text">Not in your latest import; counted from 0 mastery.</span>
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
              <h2 id="item-profile-burden-title">Material Burden</h2>
              <p className="supporting-text">
                Recursive crafting estimate using your saved crafting assumptions.
              </p>
            </div>
            {burdenTargets.length > 0 ? (
              <div className="item-burden-grid">
                {burdenTargets.map((target) => (
                  <ItemBurdenTargetCard key={target.scope} target={target} />
                ))}
              </div>
            ) : (
              <p className="empty-state">Import a mastery snapshot to estimate recursive material needs.</p>
            )}
          </section>

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
              <Link
                className="quick-link-card"
                to={`/acquisition-breakdown?item=${encodeURIComponent(profile.canonicalKey)}`}
              >
                <span className="quick-link-card__title">Acquisition Breakdown</span>
                <span className="quick-link-card__description">Compare saved sources for this item.</span>
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
