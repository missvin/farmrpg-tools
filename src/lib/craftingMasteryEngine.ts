import { type RecipeGraph, type RecipeNode } from './loadRecipeGraph';
import {
  getCraftingModifierFamilyDefinition,
  type CraftingModifierDefinition,
} from './craftingMasteryRules';
import {
  getActiveCraftingModifierStateEntries,
  type ActiveCraftingModifierStateEntry,
  type UserCraftingModifierState,
} from './craftingModifierState';

export type CraftingModifierTotals = {
  activeModifiers: ActiveCraftingModifierStateEntry[];
  resourceSaverModifiers: ActiveCraftingModifierStateEntry[];
  masteryBonusModifiers: ActiveCraftingModifierStateEntry[];
  totalResourceSaverPercent: number;
  totalMasteryBonusPercent: number;
};

export type CraftedOutputCalculation = {
  craftCount: number;
  baseOutputPerCraft: number;
  effectiveOutputPerCraft: number;
  effectiveOutput: number;
  modifierTotals: CraftingModifierTotals;
};

export type RequiredCraftCountCalculation = {
  desiredEffectiveOutput: number;
  baseOutputPerCraft: number;
  requiredCraftCount: number;
  effectiveOutputPerCraft: number;
  projectedEffectiveOutput: number;
  projectedExcessEffectiveOutput: number;
  modifierTotals: CraftingModifierTotals;
};

export type MasteryGainCalculation = {
  baseMasteryGain: number;
  effectiveMasteryGain: number;
  modifierTotals: CraftingModifierTotals;
};

export type RecipeCraftPlanningCalculation = {
  recipe: RecipeNode;
  outputPerCraftAssumption: number;
  result: CraftedOutputCalculation | RequiredCraftCountCalculation;
};

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite positive number.`);
  }
}

function sumPercentModifiers(
  entries: ActiveCraftingModifierStateEntry[],
  familyKey: CraftingModifierDefinition['familyKey'],
): number {
  return entries.reduce((total, entry) => {
    if (entry.definition.familyKey !== familyKey) {
      return total;
    }

    if (entry.definition.value.kind !== 'percent_additive') {
      throw new Error(`Unsupported non-percent modifier "${entry.definition.key}" in family "${familyKey}".`);
    }

    const percent = entry.percent ?? entry.definition.value.percent;

    if (percent === null) {
      throw new Error(`Modifier "${entry.definition.key}" is missing a percent value.`);
    }

    return total + percent;
  }, 0);
}

export function getCraftingModifierTotals(
  modifierState: UserCraftingModifierState,
): CraftingModifierTotals {
  const activeModifiers = getActiveCraftingModifierStateEntries(modifierState);
  const resourceSaverFamily = getCraftingModifierFamilyDefinition('resource_saver');
  const masteryBonusFamily = getCraftingModifierFamilyDefinition('mastery_bonus');

  if (!resourceSaverFamily || !masteryBonusFamily) {
    throw new Error('Missing crafting modifier family definitions.');
  }

  if (
    resourceSaverFamily.stackingRule !== 'additive' ||
    !resourceSaverFamily.deterministicPlanningInterpretation
  ) {
    throw new Error('Resource saver family is not configured for additive deterministic planning.');
  }

  if (
    masteryBonusFamily.stackingRule !== 'additive' ||
    !masteryBonusFamily.deterministicPlanningInterpretation
  ) {
    throw new Error('Mastery bonus family is not configured for additive deterministic planning.');
  }

  const resourceSaverModifiers = activeModifiers.filter(
    (entry) => entry.definition.familyKey === 'resource_saver',
  );
  const masteryBonusModifiers = activeModifiers.filter(
    (entry) => entry.definition.familyKey === 'mastery_bonus',
  );

  return {
    activeModifiers,
    resourceSaverModifiers,
    masteryBonusModifiers,
    totalResourceSaverPercent: sumPercentModifiers(activeModifiers, 'resource_saver'),
    totalMasteryBonusPercent: sumPercentModifiers(activeModifiers, 'mastery_bonus'),
  };
}

export function calculateEffectiveCraftedOutput(input: {
  craftCount: number;
  baseOutputPerCraft: number;
  modifierState: UserCraftingModifierState;
}): CraftedOutputCalculation {
  assertFiniteNonNegative(input.craftCount, 'craftCount');
  assertFinitePositive(input.baseOutputPerCraft, 'baseOutputPerCraft');

  const modifierTotals = getCraftingModifierTotals(input.modifierState);
  const effectiveOutputPerCraft =
    input.baseOutputPerCraft * (1 + modifierTotals.totalResourceSaverPercent);

  return {
    craftCount: input.craftCount,
    baseOutputPerCraft: input.baseOutputPerCraft,
    effectiveOutputPerCraft,
    effectiveOutput: input.craftCount * effectiveOutputPerCraft,
    modifierTotals,
  };
}

export function calculateRequiredCraftCountForEffectiveOutput(input: {
  desiredEffectiveOutput: number;
  baseOutputPerCraft: number;
  modifierState: UserCraftingModifierState;
}): RequiredCraftCountCalculation {
  assertFiniteNonNegative(input.desiredEffectiveOutput, 'desiredEffectiveOutput');
  assertFinitePositive(input.baseOutputPerCraft, 'baseOutputPerCraft');

  const modifierTotals = getCraftingModifierTotals(input.modifierState);
  const effectiveOutputPerCraft =
    input.baseOutputPerCraft * (1 + modifierTotals.totalResourceSaverPercent);
  const requiredCraftCount =
    input.desiredEffectiveOutput === 0
      ? 0
      : Math.ceil(input.desiredEffectiveOutput / effectiveOutputPerCraft);
  const projectedEffectiveOutput = requiredCraftCount * effectiveOutputPerCraft;

  return {
    desiredEffectiveOutput: input.desiredEffectiveOutput,
    baseOutputPerCraft: input.baseOutputPerCraft,
    requiredCraftCount,
    effectiveOutputPerCraft,
    projectedEffectiveOutput,
    projectedExcessEffectiveOutput: projectedEffectiveOutput - input.desiredEffectiveOutput,
    modifierTotals,
  };
}

export function calculateEffectiveMasteryGain(input: {
  baseMasteryGain: number;
  modifierState: UserCraftingModifierState;
}): MasteryGainCalculation {
  assertFiniteNonNegative(input.baseMasteryGain, 'baseMasteryGain');

  const modifierTotals = getCraftingModifierTotals(input.modifierState);

  return {
    baseMasteryGain: input.baseMasteryGain,
    effectiveMasteryGain:
      input.baseMasteryGain * (1 + modifierTotals.totalMasteryBonusPercent),
    modifierTotals,
  };
}

function requireCraftRecipeNode(recipeGraph: RecipeGraph, outputCanonicalKey: string): RecipeNode {
  const recipe = recipeGraph.byOutputCanonicalKey[outputCanonicalKey];

  if (!recipe) {
    throw new Error(`Unknown recipe output "${outputCanonicalKey}".`);
  }

  if (recipe.recipeType !== 'craft') {
    throw new Error(`Recipe "${recipe.outputItemName}" is not a craft recipe.`);
  }

  return recipe;
}

export function calculateCraftRecipeEffectiveOutput(input: {
  recipeGraph: RecipeGraph;
  outputCanonicalKey: string;
  craftCount: number;
  modifierState: UserCraftingModifierState;
}): RecipeCraftPlanningCalculation {
  const recipe = requireCraftRecipeNode(input.recipeGraph, input.outputCanonicalKey);
  const outputPerCraftAssumption = 1;

  return {
    recipe,
    outputPerCraftAssumption,
    result: calculateEffectiveCraftedOutput({
      craftCount: input.craftCount,
      baseOutputPerCraft: outputPerCraftAssumption,
      modifierState: input.modifierState,
    }),
  };
}

export function calculateCraftRecipeRequiredCraftCount(input: {
  recipeGraph: RecipeGraph;
  outputCanonicalKey: string;
  desiredEffectiveOutput: number;
  modifierState: UserCraftingModifierState;
}): RecipeCraftPlanningCalculation {
  const recipe = requireCraftRecipeNode(input.recipeGraph, input.outputCanonicalKey);
  const outputPerCraftAssumption = 1;

  return {
    recipe,
    outputPerCraftAssumption,
    result: calculateRequiredCraftCountForEffectiveOutput({
      desiredEffectiveOutput: input.desiredEffectiveOutput,
      baseOutputPerCraft: outputPerCraftAssumption,
      modifierState: input.modifierState,
    }),
  };
}
