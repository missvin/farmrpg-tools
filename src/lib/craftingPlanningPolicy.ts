import type { UserCraftingModifierState } from './craftingModifierState';

export type PlanningRecipePolicyRule = {
  outputCanonicalKey: string;
  policyKey: 'dominated_recipe';
  defaultBehavior: 'exclude';
  reason: string;
  notes: string;
};

export type CraftingPlanningPolicy = {
  excludedCraftRecipeOutputKeys: Set<string>;
  autoSuppliedIngredientKeys: Set<string>;
  excludedRecipeRules: PlanningRecipePolicyRule[];
};

const DEFAULT_EXCLUDED_RECIPE_RULES: PlanningRecipePolicyRule[] = [
  {
    outputCanonicalKey: 'unpolished shimmer stone',
    policyKey: 'dominated_recipe',
    defaultBehavior: 'exclude',
    reason: 'Crafting Unpolished Shimmer Stone from Emberstone and Sandstone is a dominated planning trade.',
    notes:
      'Keep the canonical recipe in reference data, but exclude it from default planning expansion so recursive burden does not depend on it as a normal craft path.',
  },
  {
    outputCanonicalKey: 'magna core',
    policyKey: 'dominated_recipe',
    defaultBehavior: 'exclude',
    reason: 'Magna Core is technically craftable in canonical data, but it should not be treated as a practical planner craft path by default.',
    notes:
      'Keep the canonical recipe in reference data, but exclude Magna Core from default planning expansion so recursive burden treats it as a leaf demand unless the planner explicitly opts back in.',
  },
];

export function getCraftingPlanningPolicy(
  modifierState: UserCraftingModifierState,
): CraftingPlanningPolicy {
  const excludedCraftRecipeOutputKeys = new Set<string>();

  if (!modifierState.planning.includeExcludedRecipes) {
    for (const rule of DEFAULT_EXCLUDED_RECIPE_RULES) {
      excludedCraftRecipeOutputKeys.add(rule.outputCanonicalKey);
    }
  }

  const autoSuppliedIngredientKeys = new Set<string>();

  if (modifierState.planning.ironDepotActive) {
    autoSuppliedIngredientKeys.add('iron');
  }

  return {
    excludedCraftRecipeOutputKeys,
    autoSuppliedIngredientKeys,
    excludedRecipeRules: DEFAULT_EXCLUDED_RECIPE_RULES,
  };
}
