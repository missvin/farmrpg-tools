import {
  calculateCraftRecipeRequiredCraftCount,
  getCraftingModifierTotals,
  type CraftingModifierTotals,
} from './craftingMasteryEngine';
import type { UserCraftingModifierState } from './craftingModifierState';
import type { RecipeGraph, RecipeType } from './loadRecipeGraph';

export type TargetOutputKind = 'craft_recipe_output' | 'cooking_recipe_output' | 'leaf_item';

export type TargetOutputPlanningGoalInput = {
  targetId?: string;
  targetLabel?: string;
  itemName: string;
  canonicalKey: string;
  desiredQuantity: number;
};

export type TargetOutputPlanningGoal = {
  targetId: string;
  targetLabel: string;
  itemName: string;
  canonicalKey: string;
  desiredQuantity: number;
  targetKind: TargetOutputKind;
  recipeType: RecipeType | null;
  outputPerCraftAssumption: number | null;
  requiredCraftOperations: number | null;
  projectedOutputQuantity: number | null;
  projectedExcessQuantity: number | null;
};

export type TargetOutputPlanningProblem = {
  goals: TargetOutputPlanningGoal[];
  goalById: Record<string, TargetOutputPlanningGoal>;
  goalIdsByCanonicalKey: Record<string, string[]>;
  modifierTotals: CraftingModifierTotals;
};

export type BuildTargetOutputPlanningProblemInput = {
  goals: TargetOutputPlanningGoalInput[];
  recipeGraph: RecipeGraph;
  modifierState: UserCraftingModifierState;
};

function assertFiniteNonNegativeQuantity(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
}

function createTargetId(goal: TargetOutputPlanningGoalInput, index: number): string {
  const trimmedTargetId = goal.targetId?.trim();
  return trimmedTargetId || `target:${index + 1}:${goal.canonicalKey}`;
}

function getTargetKind(recipeType: RecipeType | null): TargetOutputKind {
  if (recipeType === 'craft') {
    return 'craft_recipe_output';
  }

  if (recipeType === 'cooking') {
    return 'cooking_recipe_output';
  }

  return 'leaf_item';
}

function buildGoal(
  goal: TargetOutputPlanningGoalInput,
  index: number,
  input: BuildTargetOutputPlanningProblemInput,
): TargetOutputPlanningGoal {
  assertFiniteNonNegativeQuantity(goal.desiredQuantity, `desiredQuantity for "${goal.itemName}"`);

  const targetId = createTargetId(goal, index);
  const targetLabel = goal.targetLabel?.trim() || goal.itemName;
  const recipe = input.recipeGraph.byOutputCanonicalKey[goal.canonicalKey] ?? null;
  const recipeType = recipe?.recipeType ?? null;
  const targetKind = getTargetKind(recipeType);

  if (recipeType !== 'craft') {
    return {
      targetId,
      targetLabel,
      itemName: goal.itemName,
      canonicalKey: goal.canonicalKey,
      desiredQuantity: goal.desiredQuantity,
      targetKind,
      recipeType,
      outputPerCraftAssumption: null,
      requiredCraftOperations: null,
      projectedOutputQuantity: null,
      projectedExcessQuantity: null,
    };
  }

  const calculation = calculateCraftRecipeRequiredCraftCount({
    recipeGraph: input.recipeGraph,
    outputCanonicalKey: goal.canonicalKey,
    desiredEffectiveOutput: goal.desiredQuantity,
    modifierState: input.modifierState,
  });

  if (!('requiredCraftCount' in calculation.result)) {
    throw new Error(`Missing required craft-count result for target "${goal.itemName}".`);
  }

  return {
    targetId,
    targetLabel,
    itemName: goal.itemName,
    canonicalKey: goal.canonicalKey,
    desiredQuantity: goal.desiredQuantity,
    targetKind,
    recipeType,
    outputPerCraftAssumption: calculation.outputPerCraftAssumption,
    requiredCraftOperations: calculation.result.requiredCraftCount,
    projectedOutputQuantity: calculation.result.projectedEffectiveOutput,
    projectedExcessQuantity: calculation.result.projectedExcessEffectiveOutput,
  };
}

export function buildTargetOutputPlanningProblem(
  input: BuildTargetOutputPlanningProblemInput,
): TargetOutputPlanningProblem {
  const goals = input.goals.map((goal, index) => buildGoal(goal, index, input));
  const goalIds = new Set<string>();
  const goalById: Record<string, TargetOutputPlanningGoal> = {};
  const goalIdsByCanonicalKey: Record<string, string[]> = {};

  for (const goal of goals) {
    if (goalIds.has(goal.targetId)) {
      throw new Error(`Duplicate target output goal id "${goal.targetId}".`);
    }

    goalIds.add(goal.targetId);
    goalById[goal.targetId] = goal;
    goalIdsByCanonicalKey[goal.canonicalKey] = [
      ...(goalIdsByCanonicalKey[goal.canonicalKey] ?? []),
      goal.targetId,
    ];
  }

  return {
    goals,
    goalById,
    goalIdsByCanonicalKey,
    modifierTotals: getCraftingModifierTotals(input.modifierState),
  };
}
