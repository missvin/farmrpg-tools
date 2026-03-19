import { calculateCraftRecipeRequiredCraftCount, calculateEffectiveMasteryGain, getCraftingModifierTotals, type CraftingModifierTotals } from './craftingMasteryEngine';
import { type RecipeGraph } from './loadRecipeGraph';
import { getTowerRequirementThreshold } from './deriveTowerRequirements';
import { type TowerRequirementsData, type TowerMasteryLevelNeeded } from './loadTowerRequirements';
import { type MasterySnapshot } from './storage/masterySnapshots';
import { type UserCraftingModifierState } from './craftingModifierState';

export type IngredientBurdenGoalScope = 'M' | 'GM' | 'MM' | 'Tower';

export type TowerIngredientBurdenTarget = {
  maxTowerLevel: number | null;
};

export type IngredientBurdenRootGoal = {
  goalId: string;
  scope: IngredientBurdenGoalScope;
  outputCanonicalKey: string;
  outputItemName: string;
  currentMastery: number;
  targetMastery: number;
  remainingMastery: number;
  desiredEffectiveOutput: number;
  requiredCraftOperations: number;
  towerTarget: TowerIngredientBurdenTarget | null;
  towerRequirementRows: Array<{
    towerLevel: number;
    towerLevelRange: string;
    slotIndex: number;
    masteryLevelNeeded: TowerMasteryLevelNeeded;
    requiredThreshold: number;
  }>;
};

export type IngredientBurdenUnresolvedGoal = {
  scope: IngredientBurdenGoalScope;
  outputCanonicalKey: string;
  outputItemName: string;
  currentMastery: number;
  targetMastery: number;
  remainingMastery: number;
  reason: 'not_craft_recipe' | 'missing_recipe';
  towerTarget: TowerIngredientBurdenTarget | null;
};

export type IngredientBurdenContribution = {
  scope: IngredientBurdenGoalScope;
  rootGoalId: string;
  rootOutputCanonicalKey: string;
  rootOutputItemName: string;
  requiredEffectiveOutput: number;
};

export type IngredientBurdenEntry = {
  canonicalKey: string;
  itemName: string;
  isCraftable: boolean;
  totalRequiredEffectiveOutput: number;
  totalRequiredCraftOperations: number;
  contributions: IngredientBurdenContribution[];
};

export type IngredientBurdenScopeResult = {
  scope: IngredientBurdenGoalScope;
  rootGoals: IngredientBurdenRootGoal[];
  unresolvedGoals: IngredientBurdenUnresolvedGoal[];
  ingredientBurdenByCanonicalKey: Record<string, IngredientBurdenEntry>;
};

export type IngredientBurdenAggregateEntry = {
  canonicalKey: string;
  itemName: string;
  isCraftable: boolean;
  totalRequiredEffectiveOutput: number;
  totalRequiredCraftOperations: number;
  byScope: Partial<
    Record<
      IngredientBurdenGoalScope,
      {
        requiredEffectiveOutput: number;
        requiredCraftOperations: number;
      }
    >
  >;
};

export type RecursiveIngredientBurdenResult = {
  modifierTotals: CraftingModifierTotals;
  masteryGainPerEffectiveOutput: number;
  scopeResults: Record<IngredientBurdenGoalScope, IngredientBurdenScopeResult>;
  ingredientBurdenByCanonicalKey: Record<string, IngredientBurdenAggregateEntry>;
};

export type RecursiveIngredientBurdenInput = {
  recipeGraph: RecipeGraph;
  snapshot: MasterySnapshot;
  modifierState: UserCraftingModifierState;
  towerRequirementsData?: TowerRequirementsData | null;
  towerTarget?: TowerIngredientBurdenTarget | null;
};

type InternalDemandNode = {
  canonicalKey: string;
  itemName: string;
  totalRequiredEffectiveOutput: number;
  contributions: Map<string, IngredientBurdenContribution>;
  isCraftable: boolean;
  totalRequiredCraftOperations: number;
};

type TowerGoalRow = IngredientBurdenRootGoal['towerRequirementRows'][number];

const MASTERY_TARGETS: Record<Exclude<IngredientBurdenGoalScope, 'Tower'>, number> = {
  M: 10_000,
  GM: 100_000,
  MM: 1_000_000,
};

function buildItemNameLookup(
  recipeGraph: RecipeGraph,
  towerRequirementsData?: TowerRequirementsData | null,
): Record<string, string> {
  const lookup: Record<string, string> = {};

  for (const recipe of recipeGraph.recipes) {
    lookup[recipe.outputCanonicalKey] = recipe.outputItemName;

    for (const input of recipe.inputs) {
      lookup[input.canonicalKey] = input.itemName;
    }
  }

  for (const towerEntry of towerRequirementsData?.entries ?? []) {
    lookup[towerEntry.canonicalKey] = towerEntry.itemName;
  }

  return lookup;
}

function getItemName(itemNameLookup: Record<string, string>, canonicalKey: string): string {
  return itemNameLookup[canonicalKey] ?? canonicalKey;
}

function validateAcyclicCraftRecipeGraph(recipeGraph: RecipeGraph): string[] {
  const craftKeys = recipeGraph.craftRecipes.map((recipe) => recipe.outputCanonicalKey);
  const state = new Map<string, 'visiting' | 'visited'>();
  const orderedKeys: string[] = [];

  function visit(canonicalKey: string, path: string[]): void {
    const currentState = state.get(canonicalKey);

    if (currentState === 'visited') {
      return;
    }

    if (currentState === 'visiting') {
      throw new Error(`Craft recipe graph contains a cycle: ${[...path, canonicalKey].join(' -> ')}.`);
    }

    state.set(canonicalKey, 'visiting');

    const recipe = recipeGraph.byOutputCanonicalKey[canonicalKey];
    if (recipe?.recipeType === 'craft') {
      for (const input of recipe.inputs) {
        const childRecipe = recipeGraph.byOutputCanonicalKey[input.canonicalKey];
        if (childRecipe?.recipeType === 'craft') {
          visit(childRecipe.outputCanonicalKey, [...path, canonicalKey]);
        }
      }
    }

    state.set(canonicalKey, 'visited');
    orderedKeys.push(canonicalKey);
  }

  for (const canonicalKey of craftKeys) {
    visit(canonicalKey, []);
  }

  return orderedKeys.reverse();
}

function createDemandNode(
  canonicalKey: string,
  itemName: string,
  isCraftable: boolean,
): InternalDemandNode {
  return {
    canonicalKey,
    itemName,
    totalRequiredEffectiveOutput: 0,
    contributions: new Map<string, IngredientBurdenContribution>(),
    isCraftable,
    totalRequiredCraftOperations: 0,
  };
}

function addDemandContribution(
  demandMap: Map<string, InternalDemandNode>,
  input: {
    canonicalKey: string;
    itemName: string;
    isCraftable: boolean;
    contribution: IngredientBurdenContribution;
  },
): void {
  const node =
    demandMap.get(input.canonicalKey) ??
    createDemandNode(input.canonicalKey, input.itemName, input.isCraftable);

  node.totalRequiredEffectiveOutput += input.contribution.requiredEffectiveOutput;
  const existingContribution = node.contributions.get(input.contribution.rootGoalId);

  if (existingContribution) {
    existingContribution.requiredEffectiveOutput += input.contribution.requiredEffectiveOutput;
  } else {
    node.contributions.set(input.contribution.rootGoalId, { ...input.contribution });
  }

  demandMap.set(input.canonicalKey, node);
}

function buildMasteryRootGoals(
  scope: Exclude<IngredientBurdenGoalScope, 'Tower'>,
  input: RecursiveIngredientBurdenInput,
  itemNameLookup: Record<string, string>,
  masteryGainPerEffectiveOutput: number,
): { rootGoals: IngredientBurdenRootGoal[]; unresolvedGoals: IngredientBurdenUnresolvedGoal[] } {
  const targetMastery = MASTERY_TARGETS[scope];
  const rootGoals: IngredientBurdenRootGoal[] = [];
  const unresolvedGoals: IngredientBurdenUnresolvedGoal[] = [];

  for (const [canonicalKey, currentMastery] of Object.entries(input.snapshot.masteryByItem)) {
    if (currentMastery >= targetMastery) {
      continue;
    }

    const recipe = input.recipeGraph.byOutputCanonicalKey[canonicalKey];
    if (!recipe) {
      continue;
    }

    const remainingMastery = targetMastery - currentMastery;
    const outputItemName = getItemName(itemNameLookup, canonicalKey);

    if (recipe.recipeType !== 'craft') {
      unresolvedGoals.push({
        scope,
        outputCanonicalKey: canonicalKey,
        outputItemName,
        currentMastery,
        targetMastery,
        remainingMastery,
        reason: 'not_craft_recipe',
        towerTarget: null,
      });
      continue;
    }

    const desiredEffectiveOutput = remainingMastery / masteryGainPerEffectiveOutput;
    const craftCalculation = calculateCraftRecipeRequiredCraftCount({
      recipeGraph: input.recipeGraph,
      outputCanonicalKey: canonicalKey,
      desiredEffectiveOutput,
      modifierState: input.modifierState,
    });

    if (!('requiredCraftCount' in craftCalculation.result)) {
      throw new Error(`Missing required craft-count result for "${outputItemName}".`);
    }

    rootGoals.push({
      goalId: `${scope}:${canonicalKey}`,
      scope,
      outputCanonicalKey: canonicalKey,
      outputItemName,
      currentMastery,
      targetMastery,
      remainingMastery,
      desiredEffectiveOutput,
      requiredCraftOperations: craftCalculation.result.requiredCraftCount,
      towerTarget: null,
      towerRequirementRows: [],
    });
  }

  return { rootGoals, unresolvedGoals };
}

function buildTowerRootGoals(
  input: RecursiveIngredientBurdenInput,
  itemNameLookup: Record<string, string>,
  masteryGainPerEffectiveOutput: number,
): { rootGoals: IngredientBurdenRootGoal[]; unresolvedGoals: IngredientBurdenUnresolvedGoal[] } {
  const towerEntries = input.towerRequirementsData?.entries ?? [];
  const maxTowerLevel = input.towerTarget?.maxTowerLevel ?? null;
  const filteredEntries = maxTowerLevel === null
    ? towerEntries
    : towerEntries.filter((entry) => entry.towerLevel <= maxTowerLevel);

  const groupedRows = filteredEntries.reduce<Map<string, TowerGoalRow[]>>(
    (groups, entry) => {
      const rows = groups.get(entry.canonicalKey) ?? [];
      rows.push({
        towerLevel: entry.towerLevel,
        towerLevelRange: entry.towerLevelRange,
        slotIndex: entry.slotIndex,
        masteryLevelNeeded: entry.masteryLevelNeeded,
        requiredThreshold: getTowerRequirementThreshold(entry.masteryLevelNeeded),
      });
      groups.set(entry.canonicalKey, rows);
      return groups;
    },
    new Map(),
  );

  const rootGoals: IngredientBurdenRootGoal[] = [];
  const unresolvedGoals: IngredientBurdenUnresolvedGoal[] = [];

  for (const [canonicalKey, towerRequirementRows] of groupedRows.entries()) {
    const targetMastery = towerRequirementRows.reduce(
      (maxThreshold, row) => Math.max(maxThreshold, row.requiredThreshold),
      0,
    );
    const currentMastery = input.snapshot.masteryByItem[canonicalKey] ?? 0;

    if (currentMastery >= targetMastery) {
      continue;
    }

    const outputItemName = getItemName(itemNameLookup, canonicalKey);
    const recipe = input.recipeGraph.byOutputCanonicalKey[canonicalKey];
    const remainingMastery = targetMastery - currentMastery;

    if (!recipe || recipe.recipeType !== 'craft') {
      unresolvedGoals.push({
        scope: 'Tower',
        outputCanonicalKey: canonicalKey,
        outputItemName,
        currentMastery,
        targetMastery,
        remainingMastery,
        reason: recipe ? 'not_craft_recipe' : 'missing_recipe',
        towerTarget: {
          maxTowerLevel,
        },
      });
      continue;
    }

    const desiredEffectiveOutput = remainingMastery / masteryGainPerEffectiveOutput;
    const craftCalculation = calculateCraftRecipeRequiredCraftCount({
      recipeGraph: input.recipeGraph,
      outputCanonicalKey: canonicalKey,
      desiredEffectiveOutput,
      modifierState: input.modifierState,
    });

    if (!('requiredCraftCount' in craftCalculation.result)) {
      throw new Error(`Missing required craft-count result for tower item "${outputItemName}".`);
    }

    rootGoals.push({
      goalId: `Tower:${maxTowerLevel ?? 'all'}:${canonicalKey}`,
      scope: 'Tower',
      outputCanonicalKey: canonicalKey,
      outputItemName,
      currentMastery,
      targetMastery,
      remainingMastery,
      desiredEffectiveOutput,
      requiredCraftOperations: craftCalculation.result.requiredCraftCount,
      towerTarget: {
        maxTowerLevel,
      },
      towerRequirementRows: towerRequirementRows.sort((left, right) => {
        if (left.towerLevel !== right.towerLevel) {
          return left.towerLevel - right.towerLevel;
        }

        return left.slotIndex - right.slotIndex;
      }),
    });
  }

  return { rootGoals, unresolvedGoals };
}

function buildScopeResult(
  scope: IngredientBurdenGoalScope,
  rootGoals: IngredientBurdenRootGoal[],
  unresolvedGoals: IngredientBurdenUnresolvedGoal[],
  input: RecursiveIngredientBurdenInput,
  itemNameLookup: Record<string, string>,
  craftRecipeTopologicalOrder: string[],
): IngredientBurdenScopeResult {
  const demandMap = new Map<string, InternalDemandNode>();

  for (const rootGoal of rootGoals) {
    addDemandContribution(demandMap, {
      canonicalKey: rootGoal.outputCanonicalKey,
      itemName: rootGoal.outputItemName,
      isCraftable: true,
      contribution: {
        scope,
        rootGoalId: rootGoal.goalId,
        rootOutputCanonicalKey: rootGoal.outputCanonicalKey,
        rootOutputItemName: rootGoal.outputItemName,
        requiredEffectiveOutput: rootGoal.desiredEffectiveOutput,
      },
    });
  }

  for (const canonicalKey of craftRecipeTopologicalOrder) {
    const node = demandMap.get(canonicalKey);

    if (!node || node.totalRequiredEffectiveOutput <= 0) {
      continue;
    }

    const craftCalculation = calculateCraftRecipeRequiredCraftCount({
      recipeGraph: input.recipeGraph,
      outputCanonicalKey: canonicalKey,
      desiredEffectiveOutput: node.totalRequiredEffectiveOutput,
      modifierState: input.modifierState,
    });

    if (!('requiredCraftCount' in craftCalculation.result)) {
      throw new Error(`Missing required craft-count result for "${node.itemName}".`);
    }

    const requiredCraftOperations = craftCalculation.result.requiredCraftCount;
    node.totalRequiredCraftOperations = requiredCraftOperations;

    if (requiredCraftOperations === 0) {
      continue;
    }

    const contributionEntries = [...node.contributions.values()];
    const contributionTotal = contributionEntries.reduce(
      (total, contribution) => total + contribution.requiredEffectiveOutput,
      0,
    );

    for (const recipeInput of input.recipeGraph.byOutputCanonicalKey[canonicalKey].inputs) {
      const inputIsCraftable = input.recipeGraph.byOutputCanonicalKey[recipeInput.canonicalKey]?.recipeType === 'craft';
      const childDemand = requiredCraftOperations * recipeInput.quantity;

      for (const contribution of contributionEntries) {
        const childContribution =
          contributionTotal === 0
            ? 0
            : (childDemand * contribution.requiredEffectiveOutput) / contributionTotal;

        addDemandContribution(demandMap, {
          canonicalKey: recipeInput.canonicalKey,
          itemName: getItemName(itemNameLookup, recipeInput.canonicalKey),
          isCraftable: inputIsCraftable,
          contribution: {
            ...contribution,
            requiredEffectiveOutput: childContribution,
          },
        });
      }
    }
  }

  const ingredientBurdenEntries = [...demandMap.values()]
    .sort((left, right) => left.itemName.localeCompare(right.itemName))
    .map<IngredientBurdenEntry>((node) => ({
      canonicalKey: node.canonicalKey,
      itemName: node.itemName,
      isCraftable: node.isCraftable,
      totalRequiredEffectiveOutput: node.totalRequiredEffectiveOutput,
      totalRequiredCraftOperations: node.totalRequiredCraftOperations,
      contributions: [...node.contributions.values()].sort((left, right) =>
        left.rootOutputItemName.localeCompare(right.rootOutputItemName),
      ),
    }));

  return {
    scope,
    rootGoals: [...rootGoals].sort((left, right) =>
      left.outputItemName.localeCompare(right.outputItemName),
    ),
    unresolvedGoals: [...unresolvedGoals].sort((left, right) =>
      left.outputItemName.localeCompare(right.outputItemName),
    ),
    ingredientBurdenByCanonicalKey: ingredientBurdenEntries.reduce<Record<string, IngredientBurdenEntry>>(
      (entriesByKey, entry) => {
        entriesByKey[entry.canonicalKey] = entry;
        return entriesByKey;
      },
      {},
    ),
  };
}

function aggregateAcrossScopes(
  scopeResults: Record<IngredientBurdenGoalScope, IngredientBurdenScopeResult>,
): Record<string, IngredientBurdenAggregateEntry> {
  const aggregateByKey = new Map<string, IngredientBurdenAggregateEntry>();

  for (const [scope, scopeResult] of Object.entries(scopeResults) as Array<
    [IngredientBurdenGoalScope, IngredientBurdenScopeResult]
  >) {
    for (const entry of Object.values(scopeResult.ingredientBurdenByCanonicalKey)) {
      const aggregateEntry =
        aggregateByKey.get(entry.canonicalKey) ??
        {
          canonicalKey: entry.canonicalKey,
          itemName: entry.itemName,
          isCraftable: entry.isCraftable,
          totalRequiredEffectiveOutput: 0,
          totalRequiredCraftOperations: 0,
          byScope: {},
        };

      aggregateEntry.totalRequiredEffectiveOutput += entry.totalRequiredEffectiveOutput;
      aggregateEntry.totalRequiredCraftOperations += entry.totalRequiredCraftOperations;
      aggregateEntry.byScope[scope] = {
        requiredEffectiveOutput: entry.totalRequiredEffectiveOutput,
        requiredCraftOperations: entry.totalRequiredCraftOperations,
      };
      aggregateByKey.set(entry.canonicalKey, aggregateEntry);
    }
  }

  return [...aggregateByKey.values()]
    .sort((left, right) => left.itemName.localeCompare(right.itemName))
    .reduce<Record<string, IngredientBurdenAggregateEntry>>((entriesByKey, entry) => {
      entriesByKey[entry.canonicalKey] = entry;
      return entriesByKey;
    }, {});
}

export function calculateRecursiveIngredientBurden(
  input: RecursiveIngredientBurdenInput,
): RecursiveIngredientBurdenResult {
  const craftRecipeTopologicalOrder = validateAcyclicCraftRecipeGraph(input.recipeGraph);
  const itemNameLookup = buildItemNameLookup(input.recipeGraph, input.towerRequirementsData);
  const modifierTotals = getCraftingModifierTotals(input.modifierState);
  const masteryGainPerEffectiveOutput = calculateEffectiveMasteryGain({
    baseMasteryGain: 1,
    modifierState: input.modifierState,
  }).effectiveMasteryGain;

  const masteryScopeResults = (['M', 'GM', 'MM'] as const).map((scope) => {
    const { rootGoals, unresolvedGoals } = buildMasteryRootGoals(
      scope,
      input,
      itemNameLookup,
      masteryGainPerEffectiveOutput,
    );

    return [
      scope,
      buildScopeResult(scope, rootGoals, unresolvedGoals, input, itemNameLookup, craftRecipeTopologicalOrder),
    ] as const;
  });

  const { rootGoals: towerRootGoals, unresolvedGoals: towerUnresolvedGoals } = buildTowerRootGoals(
    input,
    itemNameLookup,
    masteryGainPerEffectiveOutput,
  );

  const scopeResults = Object.fromEntries([
    ...masteryScopeResults,
    [
      'Tower',
      buildScopeResult(
        'Tower',
        towerRootGoals,
        towerUnresolvedGoals,
        input,
        itemNameLookup,
        craftRecipeTopologicalOrder,
      ),
    ],
  ]) as Record<IngredientBurdenGoalScope, IngredientBurdenScopeResult>;

  return {
    modifierTotals,
    masteryGainPerEffectiveOutput,
    scopeResults,
    ingredientBurdenByCanonicalKey: aggregateAcrossScopes(scopeResults),
  };
}
