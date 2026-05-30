import type { AvailableSupplyItem, AvailableSupplyPool } from './availableSupply';
import { calculateCraftRecipeRequiredCraftCount } from './craftingMasteryEngine';
import type { UserCraftingModifierState } from './craftingModifierState';
import { getCraftingPlanningPolicy } from './craftingPlanningPolicy';
import type { RecipeGraph, RecipeNode, RecipeType } from './loadRecipeGraph';
import {
  buildTargetOutputPlanningProblem,
  type TargetOutputPlanningGoal,
  type TargetOutputPlanningGoalInput,
  type TargetOutputPlanningProblem,
} from './targetOutputPlanningModel';

export type TargetOutputPlannerContribution = {
  targetId: string;
  targetLabel: string;
  quantity: number;
};

export type TargetOutputPlannerUnresolvedReason =
  | 'leaf_item'
  | 'cooking_recipe_not_expanded'
  | 'excluded_recipe'
  | 'auto_supplied'
  | 'no_remaining_quantity';

export type TargetOutputPlannerItemRow = {
  canonicalKey: string;
  itemName: string;
  grossRequiredQuantity: number;
  availableQuantity: number;
  availableUsedQuantity: number;
  remainingQuantity: number;
  requiredCraftOperations: number;
  projectedOutputQuantity: number | null;
  recipeType: RecipeType | null;
  isCraftable: boolean;
  unresolvedReason: TargetOutputPlannerUnresolvedReason | null;
  supply: AvailableSupplyItem | null;
  contributions: TargetOutputPlannerContribution[];
};

export type TargetOutputPlannerTargetSummary = {
  goal: TargetOutputPlanningGoal;
  row: TargetOutputPlannerItemRow | null;
};

export type TargetOutputPlannerExpansionEdge = {
  fromCanonicalKey: string;
  fromItemName: string;
  toCanonicalKey: string;
  toItemName: string;
  quantity: number;
  craftOperations: number;
  recipeType: RecipeType;
  contributions: TargetOutputPlannerContribution[];
};

export type TargetOutputPlannerResult = {
  problem: TargetOutputPlanningProblem;
  rows: TargetOutputPlannerItemRow[];
  rowsByCanonicalKey: Record<string, TargetOutputPlannerItemRow>;
  expansionEdges: TargetOutputPlannerExpansionEdge[];
  targetSummaries: TargetOutputPlannerTargetSummary[];
  warnings: string[];
};

export type BuildTargetOutputPlannerResultInput = {
  goals: TargetOutputPlanningGoalInput[];
  recipeGraph: RecipeGraph;
  modifierState: UserCraftingModifierState;
  supplyPool: AvailableSupplyPool;
};

type DemandContribution = {
  targetId: string;
  targetLabel: string;
  quantity: number;
};

type DemandEntry = {
  canonicalKey: string;
  itemName: string;
  contributions: Map<string, DemandContribution>;
};

type MutableRow = Omit<TargetOutputPlannerItemRow, 'contributions'> & {
  contributions: Map<string, TargetOutputPlannerContribution>;
};

const EPSILON = 0.000001;

function roundPlannerQuantity(value: number): number {
  return Math.abs(value) < EPSILON ? 0 : value;
}

function getDemandTotal(demand: DemandEntry): number {
  return Array.from(demand.contributions.values()).reduce((total, contribution) => {
    return total + contribution.quantity;
  }, 0);
}

function getOrCreateDemand(
  demands: Map<string, DemandEntry>,
  canonicalKey: string,
  itemName: string,
): DemandEntry {
  const existingDemand = demands.get(canonicalKey);

  if (existingDemand) {
    return existingDemand;
  }

  const demand: DemandEntry = {
    canonicalKey,
    itemName,
    contributions: new Map<string, DemandContribution>(),
  };

  demands.set(canonicalKey, demand);
  return demand;
}

function addDemand(
  demands: Map<string, DemandEntry>,
  queue: string[],
  queuedKeys: Set<string>,
  processedKeys: Set<string>,
  input: {
    canonicalKey: string;
    itemName: string;
    contributions: DemandContribution[];
  },
): void {
  const demand = getOrCreateDemand(demands, input.canonicalKey, input.itemName);

  for (const contribution of input.contributions) {
    const currentContribution = demand.contributions.get(contribution.targetId);
    demand.contributions.set(contribution.targetId, {
      targetId: contribution.targetId,
      targetLabel: contribution.targetLabel,
      quantity: (currentContribution?.quantity ?? 0) + contribution.quantity,
    });
  }

  if (!queuedKeys.has(input.canonicalKey)) {
    queue.push(input.canonicalKey);
    queuedKeys.add(input.canonicalKey);
  } else if (processedKeys.has(input.canonicalKey)) {
    processedKeys.delete(input.canonicalKey);
  }
}

function getOrCreateRow(
  rows: Map<string, MutableRow>,
  demand: DemandEntry,
  supply: AvailableSupplyItem | null,
): MutableRow {
  const existingRow = rows.get(demand.canonicalKey);

  if (existingRow) {
    return existingRow;
  }

  const row: MutableRow = {
    canonicalKey: demand.canonicalKey,
    itemName: demand.itemName,
    grossRequiredQuantity: 0,
    availableQuantity: supply?.effectiveQuantity ?? 0,
    availableUsedQuantity: 0,
    remainingQuantity: 0,
    requiredCraftOperations: 0,
    projectedOutputQuantity: null,
    recipeType: null,
    isCraftable: false,
    unresolvedReason: null,
    supply,
    contributions: new Map<string, TargetOutputPlannerContribution>(),
  };

  rows.set(demand.canonicalKey, row);
  return row;
}

function addRowContribution(row: MutableRow, contribution: TargetOutputPlannerContribution): void {
  const existingContribution = row.contributions.get(contribution.targetId);
  row.contributions.set(contribution.targetId, {
    targetId: contribution.targetId,
    targetLabel: contribution.targetLabel,
    quantity: (existingContribution?.quantity ?? 0) + contribution.quantity,
  });
}

function getRecipeExpansionState(
  recipe: RecipeNode | null,
  excludedRecipeOutputKeys: Set<string>,
): {
  canExpand: boolean;
  recipeType: RecipeType | null;
  isCraftable: boolean;
  unresolvedReason: TargetOutputPlannerUnresolvedReason | null;
} {
  if (!recipe) {
    return {
      canExpand: false,
      recipeType: null,
      isCraftable: false,
      unresolvedReason: 'leaf_item',
    };
  }

  if (recipe.recipeType === 'cooking') {
    return {
      canExpand: false,
      recipeType: 'cooking',
      isCraftable: false,
      unresolvedReason: 'cooking_recipe_not_expanded',
    };
  }

  if (excludedRecipeOutputKeys.has(recipe.outputCanonicalKey)) {
    return {
      canExpand: false,
      recipeType: 'craft',
      isCraftable: false,
      unresolvedReason: 'excluded_recipe',
    };
  }

  return {
    canExpand: true,
    recipeType: 'craft',
    isCraftable: true,
    unresolvedReason: null,
  };
}

function toPublicRow(row: MutableRow): TargetOutputPlannerItemRow {
  return {
    ...row,
    grossRequiredQuantity: roundPlannerQuantity(row.grossRequiredQuantity),
    availableQuantity: roundPlannerQuantity(row.availableQuantity),
    availableUsedQuantity: roundPlannerQuantity(row.availableUsedQuantity),
    remainingQuantity: roundPlannerQuantity(row.remainingQuantity),
    projectedOutputQuantity:
      row.projectedOutputQuantity === null ? null : roundPlannerQuantity(row.projectedOutputQuantity),
    contributions: Array.from(row.contributions.values())
      .map((contribution) => ({
        ...contribution,
        quantity: roundPlannerQuantity(contribution.quantity),
      }))
      .sort((left, right) => {
        return right.quantity - left.quantity || left.targetLabel.localeCompare(right.targetLabel);
      }),
  };
}

export function buildTargetOutputPlannerResult(
  input: BuildTargetOutputPlannerResultInput,
): TargetOutputPlannerResult {
  const problem = buildTargetOutputPlanningProblem({
    goals: input.goals,
    recipeGraph: input.recipeGraph,
    modifierState: input.modifierState,
  });
  const planningPolicy = getCraftingPlanningPolicy(input.modifierState);
  const supplyRemainingByCanonicalKey = new Map<string, number>(
    input.supplyPool.items.map((item) => [item.canonicalKey, item.effectiveQuantity]),
  );
  const demands = new Map<string, DemandEntry>();
  const rows = new Map<string, MutableRow>();
  const expansionEdges: TargetOutputPlannerExpansionEdge[] = [];
  const queue: string[] = [];
  const queuedKeys = new Set<string>();
  const processedKeys = new Set<string>();
  const warnings = [...input.supplyPool.warnings];

  for (const goal of problem.goals) {
    addDemand(demands, queue, queuedKeys, processedKeys, {
      canonicalKey: goal.canonicalKey,
      itemName: goal.itemName,
      contributions: [
        {
          targetId: goal.targetId,
          targetLabel: goal.targetLabel,
          quantity: goal.desiredQuantity,
        },
      ],
    });
  }

  let processedIterationCount = 0;
  const maxIterations = Math.max(1000, input.recipeGraph.recipes.length * 4);

  while (queue.length > 0) {
    const canonicalKey = queue.shift()!;
    queuedKeys.delete(canonicalKey);

    if (processedKeys.has(canonicalKey)) {
      continue;
    }

    processedIterationCount += 1;
    if (processedIterationCount > maxIterations) {
      warnings.push('Target planning stopped early because recipe expansion appears cyclic or too large.');
      break;
    }

    const demand = demands.get(canonicalKey);
    if (!demand) {
      continue;
    }

    processedKeys.add(canonicalKey);

    const grossRequiredQuantity = getDemandTotal(demand);
    const supply = input.supplyPool.byCanonicalKey[canonicalKey] ?? null;
    const row = getOrCreateRow(rows, demand, supply);
    const recipe = input.recipeGraph.byOutputCanonicalKey[canonicalKey] ?? null;
    const recipeState = getRecipeExpansionState(recipe, planningPolicy.excludedCraftRecipeOutputKeys);
    const autoSupplied = planningPolicy.autoSuppliedIngredientKeys.has(canonicalKey);
    const availableQuantity = autoSupplied
      ? grossRequiredQuantity
      : supplyRemainingByCanonicalKey.get(canonicalKey) ?? 0;
    const availableUsedQuantity = Math.min(availableQuantity, grossRequiredQuantity);
    const remainingQuantity = Math.max(0, grossRequiredQuantity - availableUsedQuantity);

    row.grossRequiredQuantity = grossRequiredQuantity;
    row.availableQuantity = autoSupplied
      ? grossRequiredQuantity
      : supply?.effectiveQuantity ?? row.availableQuantity;
    row.availableUsedQuantity = availableUsedQuantity;
    row.remainingQuantity = remainingQuantity;
    row.recipeType = recipeState.recipeType;
    row.isCraftable = recipeState.isCraftable;
    row.unresolvedReason = autoSupplied
      ? 'auto_supplied'
      : remainingQuantity <= EPSILON
        ? 'no_remaining_quantity'
        : recipeState.unresolvedReason;

    for (const contribution of demand.contributions.values()) {
      addRowContribution(row, contribution);
    }

    if (!autoSupplied) {
      supplyRemainingByCanonicalKey.set(
        canonicalKey,
        Math.max(0, availableQuantity - availableUsedQuantity),
      );
    }

    if (!recipeState.canExpand || remainingQuantity <= EPSILON || !recipe) {
      continue;
    }

    const calculation = calculateCraftRecipeRequiredCraftCount({
      recipeGraph: input.recipeGraph,
      outputCanonicalKey: canonicalKey,
      desiredEffectiveOutput: remainingQuantity,
      modifierState: input.modifierState,
    });

    if (!('requiredCraftCount' in calculation.result)) {
      throw new Error(`Missing required craft-count result for target output "${demand.itemName}".`);
    }

    row.requiredCraftOperations = calculation.result.requiredCraftCount;
    row.projectedOutputQuantity = calculation.result.projectedEffectiveOutput;

    for (const recipeInput of recipe.inputs) {
      const inputQuantity = recipeInput.quantity * calculation.result.requiredCraftCount;
      const childContributions = Array.from(demand.contributions.values()).map((contribution) => ({
        targetId: contribution.targetId,
        targetLabel: contribution.targetLabel,
        quantity: grossRequiredQuantity > 0
          ? inputQuantity * (contribution.quantity / grossRequiredQuantity)
          : 0,
      }));

      expansionEdges.push({
        fromCanonicalKey: canonicalKey,
        fromItemName: demand.itemName,
        toCanonicalKey: recipeInput.canonicalKey,
        toItemName: recipeInput.itemName,
        quantity: roundPlannerQuantity(inputQuantity),
        craftOperations: calculation.result.requiredCraftCount,
        recipeType: recipe.recipeType,
        contributions: childContributions
          .map((contribution) => ({
            ...contribution,
            quantity: roundPlannerQuantity(contribution.quantity),
          }))
          .sort((left, right) => {
            return right.quantity - left.quantity || left.targetLabel.localeCompare(right.targetLabel);
          }),
      });

      addDemand(demands, queue, queuedKeys, processedKeys, {
        canonicalKey: recipeInput.canonicalKey,
        itemName: recipeInput.itemName,
        contributions: childContributions,
      });
    }
  }

  const publicRows = Array.from(rows.values())
    .map(toPublicRow)
    .sort((left, right) => {
      return (
        right.remainingQuantity - left.remainingQuantity ||
        right.grossRequiredQuantity - left.grossRequiredQuantity ||
        left.itemName.localeCompare(right.itemName)
      );
    });
  const rowsByCanonicalKey = Object.fromEntries(publicRows.map((row) => [row.canonicalKey, row]));

  return {
    problem,
    rows: publicRows,
    rowsByCanonicalKey,
    expansionEdges,
    targetSummaries: problem.goals.map((goal) => ({
      goal,
      row: rowsByCanonicalKey[goal.canonicalKey] ?? null,
    })),
    warnings,
  };
}
