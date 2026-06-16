import { getTowerRequirementThreshold } from './deriveTowerRequirements';
import { toItemProfilePath } from './itemProfileRoutes';
import type { RecipeGraph, RecipeInput, RecipeNode, RecipeType } from './loadRecipeGraph';
import type { TowerMasteryLevelNeeded, TowerRequirementEntry, TowerRequirementsData } from './loadTowerRequirements';
import type { MasterySnapshot } from './storage/masterySnapshots';

export type CraftMaterialMatrixPathType = 'direct' | 'one_step_downstream';

export type CraftMaterialMatrixTowerTarget = {
  masteryLevelNeeded: TowerMasteryLevelNeeded;
  requiredThreshold: number;
  currentMastery: number;
  remainingToRequirement: number;
  achieved: boolean;
  levels: number[];
  entries: TowerRequirementEntry[];
};

export type CraftMaterialMatrixPathStep = {
  inputItemName: string;
  inputCanonicalKey: string;
  outputItemName: string;
  outputCanonicalKey: string;
  quantity: number;
};

export type CraftMaterialMatrixRow = {
  seedItemName: string;
  seedCanonicalKey: string;
  outputItemName: string;
  outputCanonicalKey: string;
  outputProfilePath: string;
  recipeType: RecipeType;
  pathType: CraftMaterialMatrixPathType;
  depth: number;
  consumedSeedQuantity: number;
  outputRecipe: RecipeNode;
  matchedInput: RecipeInput;
  intermediateOutput: {
    itemName: string;
    canonicalKey: string;
    recipe: RecipeNode;
  } | null;
  path: CraftMaterialMatrixPathStep[];
  currentMastery: number;
  matchedSnapshotRow: boolean;
  towerRelevant: boolean;
  towerTargets: CraftMaterialMatrixTowerTarget[];
};

export type DeriveCraftMaterialMatrixInput = {
  seedCanonicalKeys: string[];
  recipeGraph: RecipeGraph;
  towerRequirementsData?: TowerRequirementsData | null;
  snapshot?: MasterySnapshot | null;
  maxDepth?: 0 | 1;
};

export type CraftMaterialMatrixResult = {
  seedCanonicalKeys: string[];
  rows: CraftMaterialMatrixRow[];
};

function uniqueCanonicalKeys(canonicalKeys: string[]): string[] {
  return [...new Set(canonicalKeys.map((key) => key.trim()).filter(Boolean))];
}

function findRecipeInput(recipe: RecipeNode, canonicalKey: string): RecipeInput {
  const recipeInput = recipe.inputs.find((input) => input.canonicalKey === canonicalKey);

  if (!recipeInput) {
    throw new Error(`Recipe "${recipe.outputItemName}" is missing expected input "${canonicalKey}".`);
  }

  return recipeInput;
}

function compareTowerTargets(
  left: CraftMaterialMatrixTowerTarget,
  right: CraftMaterialMatrixTowerTarget,
): number {
  if (left.requiredThreshold !== right.requiredThreshold) {
    return right.requiredThreshold - left.requiredThreshold;
  }

  return (left.levels[0] ?? 0) - (right.levels[0] ?? 0);
}

function buildTowerTargets(
  canonicalKey: string,
  currentMastery: number,
  towerRequirementsData?: TowerRequirementsData | null,
): CraftMaterialMatrixTowerTarget[] {
  const entries = towerRequirementsData?.byCanonicalKey[canonicalKey] ?? [];
  const entriesByThreshold = new Map<number, TowerRequirementEntry[]>();

  for (const entry of entries) {
    const requiredThreshold = getTowerRequirementThreshold(entry.masteryLevelNeeded);
    entriesByThreshold.set(requiredThreshold, [...(entriesByThreshold.get(requiredThreshold) ?? []), entry]);
  }

  return [...entriesByThreshold.entries()]
    .map(([requiredThreshold, matchingEntries]) => {
      const remainingToRequirement = Math.max(0, requiredThreshold - currentMastery);

      return {
        masteryLevelNeeded: matchingEntries[0].masteryLevelNeeded,
        requiredThreshold,
        currentMastery,
        remainingToRequirement,
        achieved: remainingToRequirement === 0,
        levels: [...new Set(matchingEntries.map((entry) => entry.towerLevel))].sort((left, right) => left - right),
        entries: [...matchingEntries].sort((left, right) => {
          if (left.towerLevel !== right.towerLevel) {
            return left.towerLevel - right.towerLevel;
          }

          return left.slotIndex - right.slotIndex;
        }),
      };
    })
    .sort(compareTowerTargets);
}

function buildRow(input: {
  seedInput: RecipeInput;
  outputRecipe: RecipeNode;
  pathType: CraftMaterialMatrixPathType;
  consumedSeedQuantity: number;
  path: CraftMaterialMatrixPathStep[];
  intermediateOutput: CraftMaterialMatrixRow['intermediateOutput'];
  snapshot?: MasterySnapshot | null;
  towerRequirementsData?: TowerRequirementsData | null;
}): CraftMaterialMatrixRow {
  const currentMastery = input.snapshot?.masteryByItem[input.outputRecipe.outputCanonicalKey] ?? 0;
  const towerTargets = buildTowerTargets(
    input.outputRecipe.outputCanonicalKey,
    currentMastery,
    input.towerRequirementsData,
  );

  return {
    seedItemName: input.seedInput.itemName,
    seedCanonicalKey: input.seedInput.canonicalKey,
    outputItemName: input.outputRecipe.outputItemName,
    outputCanonicalKey: input.outputRecipe.outputCanonicalKey,
    outputProfilePath: toItemProfilePath(input.outputRecipe.outputCanonicalKey),
    recipeType: input.outputRecipe.recipeType,
    pathType: input.pathType,
    depth: input.pathType === 'direct' ? 0 : 1,
    consumedSeedQuantity: input.consumedSeedQuantity,
    outputRecipe: input.outputRecipe,
    matchedInput:
      input.pathType === 'direct'
        ? input.seedInput
        : findRecipeInput(input.outputRecipe, input.path[input.path.length - 1]?.inputCanonicalKey ?? ''),
    intermediateOutput: input.intermediateOutput,
    path: input.path,
    currentMastery,
    matchedSnapshotRow: input.outputRecipe.outputCanonicalKey in (input.snapshot?.masteryByItem ?? {}),
    towerRelevant: towerTargets.length > 0,
    towerTargets,
  };
}

function compareRows(left: CraftMaterialMatrixRow, right: CraftMaterialMatrixRow): number {
  if (left.seedItemName !== right.seedItemName) {
    return left.seedItemName.localeCompare(right.seedItemName);
  }

  if (left.pathType !== right.pathType) {
    return left.pathType === 'direct' ? -1 : 1;
  }

  if (left.outputItemName !== right.outputItemName) {
    return left.outputItemName.localeCompare(right.outputItemName);
  }

  return left.consumedSeedQuantity - right.consumedSeedQuantity;
}

export function deriveCraftMaterialMatrix(input: DeriveCraftMaterialMatrixInput): CraftMaterialMatrixResult {
  const seedCanonicalKeys = uniqueCanonicalKeys(input.seedCanonicalKeys);
  const maxDepth = input.maxDepth ?? 1;
  const rows: CraftMaterialMatrixRow[] = [];

  for (const seedCanonicalKey of seedCanonicalKeys) {
    const directRecipes = input.recipeGraph.byInputCanonicalKey[seedCanonicalKey] ?? [];

    for (const directRecipe of directRecipes) {
      const seedInput = findRecipeInput(directRecipe, seedCanonicalKey);
      const directStep: CraftMaterialMatrixPathStep = {
        inputItemName: seedInput.itemName,
        inputCanonicalKey: seedInput.canonicalKey,
        outputItemName: directRecipe.outputItemName,
        outputCanonicalKey: directRecipe.outputCanonicalKey,
        quantity: seedInput.quantity,
      };

      rows.push(
        buildRow({
          seedInput,
          outputRecipe: directRecipe,
          pathType: 'direct',
          consumedSeedQuantity: seedInput.quantity,
          path: [directStep],
          intermediateOutput: null,
          snapshot: input.snapshot,
          towerRequirementsData: input.towerRequirementsData,
        }),
      );

      if (maxDepth < 1) {
        continue;
      }

      const downstreamRecipes = input.recipeGraph.byInputCanonicalKey[directRecipe.outputCanonicalKey] ?? [];

      for (const downstreamRecipe of downstreamRecipes) {
        const downstreamInput = findRecipeInput(downstreamRecipe, directRecipe.outputCanonicalKey);
        const downstreamStep: CraftMaterialMatrixPathStep = {
          inputItemName: downstreamInput.itemName,
          inputCanonicalKey: downstreamInput.canonicalKey,
          outputItemName: downstreamRecipe.outputItemName,
          outputCanonicalKey: downstreamRecipe.outputCanonicalKey,
          quantity: downstreamInput.quantity,
        };

        rows.push(
          buildRow({
            seedInput,
            outputRecipe: downstreamRecipe,
            pathType: 'one_step_downstream',
            consumedSeedQuantity: seedInput.quantity * downstreamInput.quantity,
            path: [directStep, downstreamStep],
            intermediateOutput: {
              itemName: directRecipe.outputItemName,
              canonicalKey: directRecipe.outputCanonicalKey,
              recipe: directRecipe,
            },
            snapshot: input.snapshot,
            towerRequirementsData: input.towerRequirementsData,
          }),
        );
      }
    }
  }

  return {
    seedCanonicalKeys,
    rows: rows.sort(compareRows),
  };
}
