import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import { decodeItemProfileParam } from '../lib/itemProfileRoutes';
import { getItemIcon } from '../lib/itemIconManifest';
import { resolveItemProfile, type ItemProfile } from '../lib/itemProfileResolver';
import { loadItemCatalog, type ItemCatalogData } from '../lib/loadItemCatalog';
import { loadRecipeGraph, type RecipeGraph } from '../lib/loadRecipeGraph';
import { loadTowerRequirements, type TowerRequirementsData } from '../lib/loadTowerRequirements';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';

type ItemProfileResources = {
  snapshot: MasterySnapshot | null;
  itemCatalog: ItemCatalogData | null;
  towerRequirementsData: TowerRequirementsData | null;
  recipeGraph: RecipeGraph | null;
};

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

function formatRecipeType(recipeType: string): string {
  return recipeType === 'cooking' ? 'Cooking' : 'Crafting';
}

function getSelectedTarget(profile: ItemProfile, tier: 'M' | 'GM' | 'MM') {
  return profile.masteryTargets.find((target) => target.tier === tier);
}

export function ItemProfilePage() {
  const { canonicalKey: canonicalKeyParam } = useParams();
  const canonicalKey = decodeItemProfileParam(canonicalKeyParam);
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

  return (
    <div className="page-stack">
      <PageIntro
        title="Item Profile"
        description="Open one item to see its mastery status, Tower need, Pumpkin Juice estimates, and direct recipe inputs."
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
          </section>

          <section className="page-card page-stack" aria-labelledby="item-profile-mastery-title">
            <h2 id="item-profile-mastery-title">Mastery Status</h2>
            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Current mastery</dt>
                <dd>{formatMastery(profile.currentMastery)}</dd>
                {!profile.matchedSnapshotRow ? (
                  <p className="subtle-text">Not in your latest import; counted from 0 mastery.</p>
                ) : null}
              </div>
              {(['M', 'GM', 'MM'] as const).map((tier) => {
                const target = getSelectedTarget(profile, tier);

                return (
                  <div key={tier} className="summary-grid__item">
                    <dt>{tier} target</dt>
                    <dd>{formatMastery(target?.targetMastery ?? 0)}</dd>
                    <p className="subtle-text">
                      PJs: {formatPumpkinJuiceCount(target?.estimate.totalPumpkinJuices ?? null)}
                    </p>
                  </div>
                );
              })}
            </dl>
          </section>

          <section className="page-card page-stack" aria-labelledby="item-profile-tower-title">
            <h2 id="item-profile-tower-title">Tower Need</h2>
            {profile.towerTarget ? (
              <dl className="summary-grid">
                <div className="summary-grid__item">
                  <dt>Highest Tower target</dt>
                  <dd>{profile.towerTarget.masteryLevelLabel}</dd>
                  <p className="subtle-text">{formatTowerLevels(profile.towerTarget.levels)}</p>
                </div>
                <div className="summary-grid__item">
                  <dt>Mastery needed</dt>
                  <dd>{formatMastery(Math.max(0, profile.towerTarget.requiredThreshold - profile.currentMastery))}</dd>
                </div>
                <div className="summary-grid__item">
                  <dt>Pumpkin Juice</dt>
                  <dd>{formatPumpkinJuiceCount(profile.towerTarget.estimate.totalPumpkinJuices)}</dd>
                  {profile.towerTarget.estimate.nextPumpkinJuiceGain ? (
                    <p className="subtle-text">
                      Next PJ: +{profile.towerTarget.estimate.nextPumpkinJuiceGain.toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </dl>
            ) : (
              <p className="empty-state">No Tower requirement found for this item.</p>
            )}
          </section>

          <section className="page-card page-stack" aria-labelledby="item-profile-recipe-title">
            <h2 id="item-profile-recipe-title">Direct Recipe Inputs</h2>
            {profile.directRecipe ? (
              <>
                <p className="supporting-text">{formatRecipeType(profile.directRecipe.recipeType)} recipe</p>
                <ul className="data-list">
                  {profile.directRecipe.inputs.map((input) => (
                    <li key={`${input.inputOrder}-${input.canonicalKey}`}>
                      <ItemProfileLink canonicalKey={input.canonicalKey} itemName={input.itemName} />
                      <strong>{input.quantity.toLocaleString()}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="empty-state">No direct recipe found in local recipe data.</p>
            )}
          </section>

          <section className="page-card page-stack" aria-labelledby="item-profile-links-title">
            <h2 id="item-profile-links-title">Open In</h2>
            <div className="quick-link-grid">
              {profile.towerTarget ? (
                <>
                  <Link className="quick-link-card" to="/tower-progress">
                    <span className="quick-link-card__title">Tower Progress</span>
                    <span className="quick-link-card__description">See this item in the unique Tower list.</span>
                  </Link>
                  <Link className="quick-link-card" to="/tower">
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
