import {
  createDefaultAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import { deriveAvailableSupplyPool } from './availableSupply';
import type { UserCraftingModifierState } from './craftingModifierState';
import type { TowerProgressItem } from './deriveTowerProgress';
import type { DropRateReferenceData } from './loadDropRateReference';
import type { MasteryDifficultyData } from './loadMasteryDifficulty';
import type { PetSourceReferenceData } from './loadPetSourceReference';
import type { QuestItemSourceHintEntry } from './loadQuestReference';
import type { RecipeGraph } from './loadRecipeGraph';
import type { QuestFutureDemandRow } from './questHistoryPlanning';
import {
  buildTargetOutputPlannerResult,
  type TargetOutputPlannerUnresolvedReason,
} from './targetOutputPlannerEngine';

export type GameAreaKey =
  | 'meals'
  | 'crops'
  | 'fish'
  | 'crafting'
  | 'exploring'
  | 'pet_reliant'
  | 'unclassified';

export const GAME_AREA_ORDER: GameAreaKey[] = [
  'meals',
  'crops',
  'fish',
  'crafting',
  'exploring',
  'pet_reliant',
  'unclassified',
];

export type GameAreaClassification = {
  areas: GameAreaKey[];
  evidence: Partial<Record<GameAreaKey, string[]>>;
};

export type GameAreaClassificationSources = {
  recipeGraph?: RecipeGraph | null;
  dropRateReference?: DropRateReferenceData | null;
  petSourceReference?: PetSourceReferenceData | null;
  masteryDifficulty?: MasteryDifficultyData | null;
  sourceHintsByCanonicalKey?: Record<string, QuestItemSourceHintEntry[]>;
};

export type QuestGameAreaNeedRow = {
  canonicalKey: string;
  itemName: string;
  requiredQuantity: number;
  questCount: number;
  questNames: string[];
  currentInventoryQuantity: number | null;
  storedPetQuantity: number | null;
  immediatelyAvailableQuantity: number | null;
  missingQuantity: number | null;
  classification: GameAreaClassification;
};

export type QuestGameAreaNeedGroup = {
  area: GameAreaKey;
  label: string;
  rows: QuestGameAreaNeedRow[];
  totalRequiredQuantity: number;
};

export type QuestGameAreaNeeds = {
  groups: QuestGameAreaNeedGroup[];
  hasCurrentInventory: boolean;
  hasStoredPetInventory: boolean;
  warnings: string[];
};

export type QuestMealNeedRow = {
  canonicalKey: string;
  itemName: string;
  requiredQuantity: number;
  currentInventoryQuantity: number | null;
  inventoryUsedQuantity: number | null;
  missingQuantity: number | null;
  questCount: number;
  questNames: string[];
};

export type QuestMealIngredientNeedRow = {
  canonicalKey: string;
  itemName: string;
  grossRequiredQuantity: number;
  inventoryQuantity: number;
  inventoryUsedQuantity: number;
  missingQuantity: number;
  requiredCraftOperations: number;
  isDirectMealInput: boolean;
  mealNames: string[];
  unresolvedReason: TargetOutputPlannerUnresolvedReason | null;
};

export type QuestMealNeeds = {
  rows: QuestMealNeedRow[];
  ingredientRows: QuestMealIngredientNeedRow[];
  hasCurrentInventory: boolean;
  isQuestHistoryPersonalized: boolean;
  totalRequiredQuantity: number;
  totalInventoryUsedQuantity: number | null;
  totalMissingQuantity: number | null;
  warnings: string[];
};

export type TowerGameAreaNeedGroup = {
  area: GameAreaKey;
  label: string;
  rows: TowerProgressItem[];
  totalMasteryRemaining: number;
};

export function getGameAreaLabel(area: GameAreaKey): string {
  switch (area) {
    case 'meals':
      return 'Meals';
    case 'crops':
      return 'Crops';
    case 'fish':
      return 'Fish';
    case 'crafting':
      return 'Crafting';
    case 'exploring':
      return 'Exploring';
    case 'pet_reliant':
      return 'Pet-reliant';
    case 'unclassified':
      return 'Unclassified';
  }
}

function includesMethod(method: string | null | undefined, expected: string): boolean {
  return method?.trim().toLowerCase().includes(expected) ?? false;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function classifyItemGameAreas(
  canonicalKey: string,
  sources: GameAreaClassificationSources,
  methodOverride?: string | null,
): GameAreaClassification {
  const recipe = sources.recipeGraph?.byOutputCanonicalKey[canonicalKey] ?? null;
  const dropRows = sources.dropRateReference?.byTargetCanonicalKey[canonicalKey] ?? [];
  const petRows = sources.petSourceReference?.byItemCanonicalKey[canonicalKey] ?? [];
  const sourceHints = sources.sourceHintsByCanonicalKey?.[canonicalKey] ?? [];
  const method = methodOverride ?? sources.masteryDifficulty?.byCanonicalKey[canonicalKey]?.method ?? null;
  const areas: GameAreaKey[] = [];
  const evidence: GameAreaClassification['evidence'] = {};

  function addArea(area: GameAreaKey, reason: string): void {
    if (!areas.includes(area)) {
      areas.push(area);
    }

    evidence[area] = unique([...(evidence[area] ?? []), reason]);
  }

  if (recipe?.recipeType === 'cooking') {
    addArea('meals', 'Reviewed cooking recipe output.');
  }

  if (recipe?.recipeType === 'craft' || includesMethod(method, 'craft')) {
    addArea('crafting', recipe?.recipeType === 'craft' ? 'Reviewed craft recipe output.' : `Mastery method: ${method}.`);
  }

  if (dropRows.some((row) => row.sourceType.trim().toLowerCase() === 'farming') || includesMethod(method, 'farm')) {
    addArea('crops', includesMethod(method, 'farm') ? `Mastery method: ${method}.` : 'Reviewed farming source.');
  }

  if (dropRows.some((row) => row.sourceType.trim().toLowerCase() === 'fishing') || includesMethod(method, 'fish')) {
    addArea('fish', includesMethod(method, 'fish') ? `Mastery method: ${method}.` : 'Reviewed fishing source.');
  }

  if (dropRows.some((row) => row.sourceType.trim().toLowerCase() === 'explore') || includesMethod(method, 'explor')) {
    addArea('exploring', includesMethod(method, 'explor') ? `Mastery method: ${method}.` : 'Reviewed exploring source.');
  }

  const nonPetSourceHints = sourceHints.filter((hint) => hint.sourceType.trim().toLowerCase() !== 'pet');
  const hasReviewedNonPetPath = Boolean(recipe) || dropRows.length > 0 || nonPetSourceHints.length > 0;

  if (petRows.length > 0 && !hasReviewedNonPetPath) {
    addArea(
      'pet_reliant',
      `Reviewed pet source${petRows.length === 1 ? '' : 's'} with no other reviewed local source.`,
    );
  }

  if (areas.length === 0) {
    addArea('unclassified', 'No reviewed game-area classification matched this item.');
  }

  return {
    areas: GAME_AREA_ORDER.filter((area) => areas.includes(area)),
    evidence,
  };
}

function buildCurrentInventoryLookup(acquisitionState: AcquisitionPlannerInputState): Record<string, number> {
  return Object.fromEntries(
    acquisitionState.inventory.entries.map((entry) => [entry.canonicalItemKey, entry.inventoryCount]),
  );
}

function buildStoredPetInventoryLookup(acquisitionState: AcquisitionPlannerInputState): Record<string, number> {
  return Object.fromEntries(
    acquisitionState.pets.storedInventoryEntries.map((entry) => [entry.canonicalItemKey, entry.storedCount]),
  );
}

function getQuestNames(row: QuestFutureDemandRow): string[] {
  return unique(row.requirements.map((requirement) => requirement.questName)).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function deriveQuestGameAreaNeeds(input: {
  demandRows: QuestFutureDemandRow[];
  acquisitionState: AcquisitionPlannerInputState;
  classificationSources: GameAreaClassificationSources;
}): QuestGameAreaNeeds {
  const hasCurrentInventory = input.acquisitionState.inventory.entries.length > 0;
  const hasStoredPetInventory = input.acquisitionState.pets.storedInventoryEntries.length > 0;
  const inventoryByKey = buildCurrentInventoryLookup(input.acquisitionState);
  const storedPetByKey = buildStoredPetInventoryLookup(input.acquisitionState);
  const rows = input.demandRows.map<QuestGameAreaNeedRow>((demandRow) => {
    const classification = classifyItemGameAreas(demandRow.canonicalKey, input.classificationSources);
    const currentInventoryQuantity = hasCurrentInventory ? inventoryByKey[demandRow.canonicalKey] ?? 0 : null;
    const storedPetQuantity = hasStoredPetInventory ? storedPetByKey[demandRow.canonicalKey] ?? 0 : null;
    const usesStoredPetSupply = classification.areas.includes('pet_reliant');
    const canCalculateMissing = hasCurrentInventory && (!usesStoredPetSupply || hasStoredPetInventory);
    const immediatelyAvailableQuantity = canCalculateMissing
      ? (currentInventoryQuantity ?? 0) + (usesStoredPetSupply ? storedPetQuantity ?? 0 : 0)
      : null;

    return {
      canonicalKey: demandRow.canonicalKey,
      itemName: demandRow.itemName,
      requiredQuantity: demandRow.totalQuantity,
      questCount: demandRow.questCount,
      questNames: getQuestNames(demandRow),
      currentInventoryQuantity,
      storedPetQuantity: usesStoredPetSupply ? storedPetQuantity : null,
      immediatelyAvailableQuantity,
      missingQuantity:
        immediatelyAvailableQuantity === null
          ? null
          : Math.max(0, demandRow.totalQuantity - immediatelyAvailableQuantity),
      classification,
    };
  });

  const groups = GAME_AREA_ORDER.map<QuestGameAreaNeedGroup>((area) => {
    const areaRows = rows
      .filter((row) => row.classification.areas.includes(area))
      .sort((left, right) => {
        const leftMissing = left.missingQuantity ?? left.requiredQuantity;
        const rightMissing = right.missingQuantity ?? right.requiredQuantity;
        return rightMissing - leftMissing || left.itemName.localeCompare(right.itemName);
      });

    return {
      area,
      label: getGameAreaLabel(area),
      rows: areaRows,
      totalRequiredQuantity: areaRows.reduce((total, row) => total + row.requiredQuantity, 0),
    };
  });
  const warnings: string[] = [];

  if (!hasCurrentInventory) {
    warnings.push('Import current inventory to calculate owned quantities and shortfalls.');
  }

  if (groups.find((group) => group.area === 'pet_reliant')?.rows.length && !hasStoredPetInventory) {
    warnings.push('Import stored pet inventory to calculate pet-reliant shortfalls.');
  }

  return {
    groups,
    hasCurrentInventory,
    hasStoredPetInventory,
    warnings,
  };
}

function createCurrentInventoryOnlyState(
  acquisitionState: AcquisitionPlannerInputState,
): AcquisitionPlannerInputState {
  const currentInventoryOnly = createDefaultAcquisitionPlannerInputState();
  currentInventoryOnly.inventory.entries = acquisitionState.inventory.entries;
  return currentInventoryOnly;
}

export function deriveQuestMealNeeds(input: {
  demandRows: QuestFutureDemandRow[];
  acquisitionState: AcquisitionPlannerInputState;
  recipeGraph: RecipeGraph;
  modifierState: UserCraftingModifierState;
  isQuestHistoryPersonalized: boolean;
}): QuestMealNeeds {
  const hasCurrentInventory = input.acquisitionState.inventory.entries.length > 0;
  const inventoryByKey = buildCurrentInventoryLookup(input.acquisitionState);
  const warnings: string[] = [];
  const rows = input.demandRows
    .filter((row) => input.recipeGraph.byOutputCanonicalKey[row.canonicalKey]?.recipeType === 'cooking')
    .map<QuestMealNeedRow>((row) => {
      const currentInventoryQuantity = hasCurrentInventory ? inventoryByKey[row.canonicalKey] ?? 0 : null;
      const inventoryUsedQuantity =
        currentInventoryQuantity === null ? null : Math.min(row.totalQuantity, currentInventoryQuantity);

      return {
        canonicalKey: row.canonicalKey,
        itemName: row.itemName,
        requiredQuantity: row.totalQuantity,
        currentInventoryQuantity,
        inventoryUsedQuantity,
        missingQuantity:
          inventoryUsedQuantity === null ? null : Math.max(0, row.totalQuantity - inventoryUsedQuantity),
        questCount: row.questCount,
        questNames: getQuestNames(row),
      };
    })
    .sort((left, right) => {
      const leftMissing = left.missingQuantity ?? left.requiredQuantity;
      const rightMissing = right.missingQuantity ?? right.requiredQuantity;
      return rightMissing - leftMissing || left.itemName.localeCompare(right.itemName);
    });

  if (!input.isQuestHistoryPersonalized) {
    warnings.push('Quest history is not imported; these totals are an unpersonalized upper bound over known quests.');
  }

  if (!hasCurrentInventory) {
    warnings.push('Import current inventory to calculate meal and ingredient shortfalls.');
  }

  const directInputKeys = new Set<string>();
  const ingredientGoals = hasCurrentInventory
    ? rows.flatMap((mealRow) => {
        if (!mealRow.missingQuantity) {
          return [];
        }

        const recipe = input.recipeGraph.byOutputCanonicalKey[mealRow.canonicalKey];
        if (!recipe || recipe.recipeType !== 'cooking') {
          warnings.push(`No reviewed cooking recipe is available for ${mealRow.itemName}.`);
          return [];
        }

        return recipe.inputs.map((recipeInput) => {
          directInputKeys.add(recipeInput.canonicalKey);
          return {
            targetId: `quest-meal:${mealRow.canonicalKey}:${recipeInput.canonicalKey}`,
            targetLabel: mealRow.itemName,
            itemName: recipeInput.itemName,
            canonicalKey: recipeInput.canonicalKey,
            desiredQuantity: recipeInput.quantity * mealRow.missingQuantity!,
          };
        });
      })
    : [];

  let ingredientRows: QuestMealIngredientNeedRow[] = [];

  if (ingredientGoals.length > 0) {
    const plannerResult = buildTargetOutputPlannerResult({
      goals: ingredientGoals,
      recipeGraph: input.recipeGraph,
      modifierState: input.modifierState,
      supplyPool: deriveAvailableSupplyPool({
        acquisitionState: createCurrentInventoryOnlyState(input.acquisitionState),
      }),
    });

    warnings.push(...plannerResult.warnings);
    ingredientRows = plannerResult.rows
      .map((row) => ({
        canonicalKey: row.canonicalKey,
        itemName: row.itemName,
        grossRequiredQuantity: row.grossRequiredQuantity,
        inventoryQuantity: row.availableQuantity,
        inventoryUsedQuantity: row.availableUsedQuantity,
        missingQuantity: row.remainingQuantity,
        requiredCraftOperations: row.requiredCraftOperations,
        isDirectMealInput: directInputKeys.has(row.canonicalKey),
        mealNames: unique(row.contributions.map((contribution) => contribution.targetLabel)).sort((left, right) =>
          left.localeCompare(right),
        ),
        unresolvedReason: row.unresolvedReason,
      }))
      .sort((left, right) => {
        if (left.isDirectMealInput !== right.isDirectMealInput) {
          return left.isDirectMealInput ? -1 : 1;
        }

        return right.missingQuantity - left.missingQuantity || left.itemName.localeCompare(right.itemName);
      });
  }

  return {
    rows,
    ingredientRows,
    hasCurrentInventory,
    isQuestHistoryPersonalized: input.isQuestHistoryPersonalized,
    totalRequiredQuantity: rows.reduce((total, row) => total + row.requiredQuantity, 0),
    totalInventoryUsedQuantity: hasCurrentInventory
      ? rows.reduce((total, row) => total + (row.inventoryUsedQuantity ?? 0), 0)
      : null,
    totalMissingQuantity: hasCurrentInventory
      ? rows.reduce((total, row) => total + (row.missingQuantity ?? 0), 0)
      : null,
    warnings: unique(warnings),
  };
}

export function deriveTowerGameAreaNeeds(
  items: TowerProgressItem[],
  classificationSources: GameAreaClassificationSources,
): TowerGameAreaNeedGroup[] {
  const rowsByArea = new Map<GameAreaKey, TowerProgressItem[]>();

  for (const area of GAME_AREA_ORDER) {
    rowsByArea.set(area, []);
  }

  for (const item of items) {
    const classification = classifyItemGameAreas(
      item.canonicalKey,
      classificationSources,
      item.method,
    );

    for (const area of classification.areas) {
      rowsByArea.get(area)?.push(item);
    }
  }

  return GAME_AREA_ORDER.map((area) => {
    const rows = (rowsByArea.get(area) ?? []).sort((left, right) => {
      return right.remainingToTarget - left.remainingToTarget || left.itemName.localeCompare(right.itemName);
    });

    return {
      area,
      label: getGameAreaLabel(area),
      rows,
      totalMasteryRemaining: rows.reduce((total, row) => total + row.remainingToTarget, 0),
    };
  });
}
