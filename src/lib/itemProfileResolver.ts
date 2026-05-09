import { getTowerRequirementThreshold } from './deriveTowerRequirements';
import type { ItemCatalogData } from './loadItemCatalog';
import type { RecipeGraph, RecipeNode } from './loadRecipeGraph';
import type { TowerRequirementEntry, TowerRequirementsData } from './loadTowerRequirements';
import {
  estimatePumpkinJuiceForTarget,
  getMasteryTargetForTier,
  getMasteryTierForTarget,
  type MasteryTargetTier,
  type PumpkinJuiceEstimate,
} from './pumpkinJuiceEstimator';
import type { MasterySnapshot } from './storage/masterySnapshots';

export type ItemProfileSource = 'catalog' | 'snapshot' | 'tower' | 'recipe_output' | 'recipe_input';

export type ItemProfileMasteryTarget = {
  tier: MasteryTargetTier;
  targetMastery: number;
  estimate: PumpkinJuiceEstimate;
};

export type ItemProfileTowerTarget = {
  requiredThreshold: number;
  masteryLevelLabel: MasteryTargetTier;
  levels: number[];
  entries: TowerRequirementEntry[];
  estimate: PumpkinJuiceEstimate;
};

export type ItemProfile = {
  canonicalKey: string;
  itemName: string;
  known: boolean;
  sources: ItemProfileSource[];
  currentMastery: number;
  matchedSnapshotRow: boolean;
  masteryTargets: ItemProfileMasteryTarget[];
  towerTarget: ItemProfileTowerTarget | null;
  directRecipe: RecipeNode | null;
  usedInRecipes: RecipeNode[];
};

export type ResolveItemProfileInput = {
  canonicalKey: string;
  snapshot?: MasterySnapshot | null;
  itemCatalog?: ItemCatalogData | null;
  towerRequirementsData?: TowerRequirementsData | null;
  recipeGraph?: RecipeGraph | null;
};

function formatFallbackItemName(canonicalKey: string): string {
  return canonicalKey
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function collectSources(input: ResolveItemProfileInput): ItemProfileSource[] {
  const sources: ItemProfileSource[] = [];
  const canonicalKey = input.canonicalKey;

  if (input.itemCatalog?.byCanonicalKey[canonicalKey]) {
    sources.push('catalog');
  }

  if (canonicalKey in (input.snapshot?.masteryByItem ?? {})) {
    sources.push('snapshot');
  }

  if ((input.towerRequirementsData?.byCanonicalKey[canonicalKey] ?? []).length > 0) {
    sources.push('tower');
  }

  if (input.recipeGraph?.byOutputCanonicalKey[canonicalKey]) {
    sources.push('recipe_output');
  }

  if ((input.recipeGraph?.byInputCanonicalKey[canonicalKey] ?? []).length > 0) {
    sources.push('recipe_input');
  }

  return sources;
}

function resolveItemName(input: ResolveItemProfileInput): string {
  const canonicalKey = input.canonicalKey;
  const snapshotRow = input.snapshot?.parsedRows?.find((row) => row.canonicalKey === canonicalKey);
  const towerEntry = input.towerRequirementsData?.byCanonicalKey[canonicalKey]?.[0];
  const recipeOutput = input.recipeGraph?.byOutputCanonicalKey[canonicalKey];
  const recipeInput = input.recipeGraph?.byInputCanonicalKey[canonicalKey]?.[0]?.inputs.find(
    (inputRow) => inputRow.canonicalKey === canonicalKey,
  );

  return (
    input.itemCatalog?.byCanonicalKey[canonicalKey]?.itemName ??
    snapshotRow?.rawItemName ??
    towerEntry?.itemName ??
    recipeOutput?.outputItemName ??
    recipeInput?.itemName ??
    formatFallbackItemName(canonicalKey)
  );
}

function buildMasteryTargets(
  itemName: string,
  canonicalKey: string,
  currentMastery: number,
): ItemProfileMasteryTarget[] {
  return (['M', 'GM', 'MM'] as const).map((tier) => {
    const targetMastery = getMasteryTargetForTier(tier);

    return {
      tier,
      targetMastery,
      estimate: estimatePumpkinJuiceForTarget({
        itemName,
        canonicalKey,
        currentMastery,
        targetTier: tier,
        targetMastery,
        sourceScope: 'personal',
      }),
    };
  });
}

function buildTowerTarget(
  itemName: string,
  canonicalKey: string,
  currentMastery: number,
  entries: TowerRequirementEntry[],
): ItemProfileTowerTarget | null {
  if (entries.length === 0) {
    return null;
  }

  const requiredThreshold = Math.max(...entries.map((entry) => getTowerRequirementThreshold(entry.masteryLevelNeeded)));
  const masteryLevelLabel = getMasteryTierForTarget(requiredThreshold);
  const matchingEntries = entries.filter(
    (entry) => getTowerRequirementThreshold(entry.masteryLevelNeeded) === requiredThreshold,
  );

  return {
    requiredThreshold,
    masteryLevelLabel,
    levels: [...new Set(matchingEntries.map((entry) => entry.towerLevel))].sort((left, right) => left - right),
    entries: matchingEntries,
    estimate: estimatePumpkinJuiceForTarget({
      itemName,
      canonicalKey,
      currentMastery,
      targetTier: masteryLevelLabel,
      targetMastery: requiredThreshold,
      sourceScope: 'tower',
    }),
  };
}

export function resolveItemProfile(input: ResolveItemProfileInput): ItemProfile {
  const canonicalKey = input.canonicalKey;
  const itemName = resolveItemName(input);
  const sources = collectSources(input);
  const currentMastery = input.snapshot?.masteryByItem[canonicalKey] ?? 0;
  const towerEntries = input.towerRequirementsData?.byCanonicalKey[canonicalKey] ?? [];

  return {
    canonicalKey,
    itemName,
    known: sources.length > 0,
    sources,
    currentMastery,
    matchedSnapshotRow: canonicalKey in (input.snapshot?.masteryByItem ?? {}),
    masteryTargets: buildMasteryTargets(itemName, canonicalKey, currentMastery),
    towerTarget: buildTowerTarget(itemName, canonicalKey, currentMastery, towerEntries),
    directRecipe: input.recipeGraph?.byOutputCanonicalKey[canonicalKey] ?? null,
    usedInRecipes: input.recipeGraph?.byInputCanonicalKey[canonicalKey] ?? [],
  };
}
