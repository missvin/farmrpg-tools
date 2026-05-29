import type { AcquisitionPlannerInputState } from './acquisitionPlannerState';
import type {
  QuestCatalogEntry,
  QuestItemSourceHintEntry,
  QuestReferenceData,
  QuestRequirementEntry,
  QuestRewardEntry,
} from './loadQuestReference';
import type { RecipeGraph, RecipeNode } from './loadRecipeGraph';
import type { TowerRequirementEntry, TowerRequirementsData } from './loadTowerRequirements';
import { toCanonicalItemKey } from './normalizeItemKey';
import { getQuestState, type QuestPlannerState, type QuestPlannerStatus } from './questPlannerState';
import type { MasterySnapshot } from './storage/masterySnapshots';

export type QuestAvailableSupplyEntry = {
  canonicalKey: string;
  itemName: string;
  quantity: number;
  sources: {
    label: string;
    quantity: number;
  }[];
};

export type QuestRequirementProgress = QuestRequirementEntry & {
  availableQuantity: number;
  missingQuantity: number;
  supplySources: QuestAvailableSupplyEntry['sources'];
  sourceHints: QuestItemSourceHintEntry[];
};

export type QuestProgress = {
  quest: QuestCatalogEntry;
  status: QuestPlannerStatus;
  hidden: boolean;
  observedCompletionPercent: number | null;
  requirements: QuestRequirementProgress[];
  rewards: QuestRewardEntry[];
  requiredQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  missingItemTypes: number;
  completionPercent: number;
  warnings: string[];
};

export type QuestNextSuggestion = {
  fromQuest: QuestCatalogEntry;
  quest: QuestCatalogEntry;
};

export type QuestBottleneck = {
  canonicalKey: string;
  itemName: string;
  missingQuantity: number;
  questNames: string[];
  sourceHints: QuestItemSourceHintEntry[];
};

export type QuestSourcePressure = {
  sourceKey: string;
  sourceType: string;
  preferredUnit: string;
  label: string;
  missingQuantity: number;
  itemNames: string[];
  questNames: string[];
};

export type QuestSynergyHint = {
  sourceName: string;
  sourceType: string;
  questItemName: string;
  relatedItemName: string;
  targetItemName: string;
  targetLabel: string;
  sourceUrl: string;
};

export type QuestPlanningViewModel = {
  activeQuestProgress: QuestProgress[];
  watchedQuestProgress: QuestProgress[];
  completedQuestProgress: QuestProgress[];
  nextSuggestions: QuestNextSuggestion[];
  bottlenecks: QuestBottleneck[];
  sourcePressure: QuestSourcePressure[];
  synergyHints: QuestSynergyHint[];
  availableSupply: QuestAvailableSupplyEntry[];
  warnings: string[];
};

export function buildQuestAvailableSupply(
  acquisitionState: AcquisitionPlannerInputState,
): QuestAvailableSupplyEntry[] {
  const supplyByCanonicalKey = new Map<string, QuestAvailableSupplyEntry>();

  function addSupply(canonicalKeyInput: string, itemName: string, quantity: number, label: string): void {
    const canonicalKey = toCanonicalItemKey(canonicalKeyInput || itemName);

    if (!canonicalKey || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    const existingSupply = supplyByCanonicalKey.get(canonicalKey);

    if (existingSupply) {
      existingSupply.quantity += quantity;
      existingSupply.sources.push({ label, quantity });
      return;
    }

    supplyByCanonicalKey.set(canonicalKey, {
      canonicalKey,
      itemName: itemName || canonicalKey,
      quantity,
      sources: [{ label, quantity }],
    });
  }

  for (const entry of acquisitionState.ownedNow.entries) {
    addSupply(
      entry.canonicalItemKey,
      entry.itemName,
      entry.ownedCount,
      entry.sourceCategory === 'container' ? 'Owned container' : 'Owned stockpile',
    );
  }

  for (const entry of acquisitionState.inventory.entries) {
    addSupply(entry.canonicalItemKey, entry.itemName, entry.inventoryCount, 'Current inventory');
  }

  for (const entry of acquisitionState.pets.storedInventoryEntries) {
    addSupply(entry.canonicalItemKey, entry.itemName, entry.storedCount, 'Stored pet inventory');
  }

  return Array.from(supplyByCanonicalKey.values()).sort((left, right) => {
    return left.itemName.localeCompare(right.itemName) || left.canonicalKey.localeCompare(right.canonicalKey);
  });
}

function getSupplyLookup(availableSupply: QuestAvailableSupplyEntry[]): Record<string, QuestAvailableSupplyEntry> {
  return availableSupply.reduce<Record<string, QuestAvailableSupplyEntry>>((lookup, entry) => {
    lookup[entry.canonicalKey] = entry;
    return lookup;
  }, {});
}

function deriveQuestProgress(
  quest: QuestCatalogEntry,
  referenceData: QuestReferenceData,
  state: QuestPlannerState,
  supplyLookup: Record<string, QuestAvailableSupplyEntry>,
): QuestProgress {
  const questState = getQuestState(state, quest.questKey);
  const requirements = (referenceData.requirementsByQuestKey[quest.questKey] ?? []).map((requirement) => {
    const supply = supplyLookup[requirement.canonicalKey];
    const availableQuantity = Math.min(requirement.quantity, supply?.quantity ?? 0);

    return {
      ...requirement,
      availableQuantity,
      missingQuantity: Math.max(0, requirement.quantity - availableQuantity),
      supplySources: supply?.sources ?? [],
      sourceHints: referenceData.sourceHintsByCanonicalKey[requirement.canonicalKey] ?? [],
    };
  });
  const requiredQuantity = requirements.reduce((sum, requirement) => sum + requirement.quantity, 0);
  const availableQuantity = requirements.reduce((sum, requirement) => sum + requirement.availableQuantity, 0);
  const missingQuantity = requirements.reduce((sum, requirement) => sum + requirement.missingQuantity, 0);
  const missingItemTypes = requirements.filter((requirement) => requirement.missingQuantity > 0).length;
  const warnings: string[] = [];

  if (quest.coverageStatus === 'partial') {
    warnings.push('This quest has partial local requirement coverage.');
  }

  if (requirements.length === 0) {
    warnings.push('No local item requirements are available yet.');
  }

  return {
    quest,
    status: questState.status,
    hidden: questState.hidden,
    observedCompletionPercent: questState.observedCompletionPercent,
    requirements,
    rewards: referenceData.rewardsByQuestKey[quest.questKey] ?? [],
    requiredQuantity,
    availableQuantity,
    missingQuantity,
    missingItemTypes,
    completionPercent: requiredQuantity > 0 ? (availableQuantity / requiredQuantity) * 100 : 0,
    warnings,
  };
}

function isDemandQuest(progress: QuestProgress): boolean {
  return progress.status === 'active' || progress.status === 'watched';
}

function deriveNextSuggestions(
  referenceData: QuestReferenceData,
  state: QuestPlannerState,
  includeHidden: boolean,
): QuestNextSuggestion[] {
  const suggestions: QuestNextSuggestion[] = [];

  for (const quest of referenceData.quests) {
    const questState = getQuestState(state, quest.questKey);

    if (questState.status !== 'completed') {
      continue;
    }

    for (const nextQuestKey of quest.nextQuestKeys) {
      const nextQuest = referenceData.questsByKey[nextQuestKey];

      if (!nextQuest) {
        continue;
      }

      const nextQuestState = getQuestState(state, nextQuest.questKey);

      if (
        nextQuestState.status === 'completed' ||
        nextQuestState.status === 'active' ||
        nextQuestState.status === 'watched' ||
        (nextQuestState.hidden && !includeHidden)
      ) {
        continue;
      }

      suggestions.push({
        fromQuest: quest,
        quest: nextQuest,
      });
    }
  }

  return suggestions.sort((left, right) => {
    return left.quest.questName.localeCompare(right.quest.questName);
  });
}

function deriveBottlenecks(progressRows: QuestProgress[]): QuestBottleneck[] {
  const bottlenecksByCanonicalKey = new Map<string, QuestBottleneck>();

  for (const progress of progressRows.filter(isDemandQuest)) {
    for (const requirement of progress.requirements) {
      if (requirement.missingQuantity <= 0) {
        continue;
      }

      const existingBottleneck = bottlenecksByCanonicalKey.get(requirement.canonicalKey);

      if (existingBottleneck) {
        existingBottleneck.missingQuantity += requirement.missingQuantity;
        existingBottleneck.questNames = [...new Set([...existingBottleneck.questNames, progress.quest.questName])];
      } else {
        bottlenecksByCanonicalKey.set(requirement.canonicalKey, {
          canonicalKey: requirement.canonicalKey,
          itemName: requirement.itemName,
          missingQuantity: requirement.missingQuantity,
          questNames: [progress.quest.questName],
          sourceHints: requirement.sourceHints,
        });
      }
    }
  }

  return Array.from(bottlenecksByCanonicalKey.values()).sort((left, right) => {
    if (right.missingQuantity !== left.missingQuantity) {
      return right.missingQuantity - left.missingQuantity;
    }

    return left.itemName.localeCompare(right.itemName);
  });
}

function deriveSourcePressure(progressRows: QuestProgress[]): QuestSourcePressure[] {
  const sourcePressureByKey = new Map<string, QuestSourcePressure>();

  for (const progress of progressRows.filter(isDemandQuest)) {
    for (const requirement of progress.requirements) {
      if (requirement.missingQuantity <= 0) {
        continue;
      }

      for (const sourceHint of requirement.sourceHints) {
        const sourceKey = `${sourceHint.sourceType}:${sourceHint.preferredUnit}`;
        const existingPressure = sourcePressureByKey.get(sourceKey);

        if (existingPressure) {
          existingPressure.missingQuantity += requirement.missingQuantity;
          existingPressure.itemNames = [...new Set([...existingPressure.itemNames, requirement.itemName])];
          existingPressure.questNames = [...new Set([...existingPressure.questNames, progress.quest.questName])];
        } else {
          sourcePressureByKey.set(sourceKey, {
            sourceKey,
            sourceType: sourceHint.sourceType,
            preferredUnit: sourceHint.preferredUnit,
            label: `${sourceHint.sourceType} / ${sourceHint.preferredUnit}`,
            missingQuantity: requirement.missingQuantity,
            itemNames: [requirement.itemName],
            questNames: [progress.quest.questName],
          });
        }
      }
    }
  }

  return Array.from(sourcePressureByKey.values()).sort((left, right) => {
    if (right.itemNames.length !== left.itemNames.length) {
      return right.itemNames.length - left.itemNames.length;
    }

    return right.missingQuantity - left.missingQuantity;
  });
}

function getIncompleteTowerEntries(
  canonicalKey: string,
  towerRequirementsData: TowerRequirementsData | null | undefined,
  snapshot: MasterySnapshot | null | undefined,
): TowerRequirementEntry[] {
  const entries = towerRequirementsData?.byCanonicalKey[canonicalKey] ?? [];
  const currentMastery = snapshot?.masteryByItem[canonicalKey] ?? 0;

  return entries.filter((entry) => {
    const threshold = entry.masteryLevelNeeded === 'GM' ? 100_000 : 1_000_000;
    return currentMastery < threshold;
  });
}

function findTowerRecipeSynergies(input: {
  questRequirement: QuestRequirementProgress;
  sourceHint: QuestItemSourceHintEntry;
  referenceData: QuestReferenceData;
  recipeGraph: RecipeGraph | null | undefined;
  towerRequirementsData: TowerRequirementsData | null | undefined;
  snapshot: MasterySnapshot | null | undefined;
}): QuestSynergyHint[] {
  const synergyHints: QuestSynergyHint[] = [];
  const allSourceHints = Object.values(input.referenceData.sourceHintsByCanonicalKey).flat();
  const relatedSourceHints = allSourceHints.filter((sourceHint) => {
    return (
      sourceHint.sourceCanonicalKey === input.sourceHint.sourceCanonicalKey &&
      sourceHint.canonicalKey !== input.questRequirement.canonicalKey
    );
  });

  for (const relatedSourceHint of relatedSourceHints) {
    const usedInRecipes = input.recipeGraph?.byInputCanonicalKey[relatedSourceHint.canonicalKey] ?? [];

    for (const recipe of usedInRecipes) {
      const towerEntries = getIncompleteTowerEntries(
        recipe.outputCanonicalKey,
        input.towerRequirementsData,
        input.snapshot,
      );

      if (towerEntries.length === 0) {
        continue;
      }

      synergyHints.push({
        sourceName: input.sourceHint.sourceName,
        sourceType: input.sourceHint.sourceType,
        questItemName: input.questRequirement.itemName,
        relatedItemName: relatedSourceHint.itemName,
        targetItemName: recipe.outputItemName,
        targetLabel: `Tower ${towerEntries.map((entry) => entry.towerLevel).join(', ')}`,
        sourceUrl: relatedSourceHint.sourceUrl,
      });
    }
  }

  return synergyHints;
}

function uniqueSynergyKey(synergyHint: QuestSynergyHint): string {
  return [
    synergyHint.sourceName,
    synergyHint.questItemName,
    synergyHint.relatedItemName,
    synergyHint.targetItemName,
    synergyHint.targetLabel,
  ].join('|');
}

function deriveSynergyHints(input: {
  progressRows: QuestProgress[];
  referenceData: QuestReferenceData;
  recipeGraph: RecipeGraph | null | undefined;
  towerRequirementsData: TowerRequirementsData | null | undefined;
  snapshot: MasterySnapshot | null | undefined;
}): QuestSynergyHint[] {
  const synergyHintsByKey = new Map<string, QuestSynergyHint>();

  for (const progress of input.progressRows.filter(isDemandQuest)) {
    for (const requirement of progress.requirements) {
      if (requirement.missingQuantity <= 0) {
        continue;
      }

      for (const sourceHint of requirement.sourceHints) {
        const synergyHints = findTowerRecipeSynergies({
          questRequirement: requirement,
          sourceHint,
          referenceData: input.referenceData,
          recipeGraph: input.recipeGraph,
          towerRequirementsData: input.towerRequirementsData,
          snapshot: input.snapshot,
        });

        for (const synergyHint of synergyHints) {
          synergyHintsByKey.set(uniqueSynergyKey(synergyHint), synergyHint);
        }
      }
    }
  }

  return Array.from(synergyHintsByKey.values()).sort((left, right) => {
    return (
      left.sourceName.localeCompare(right.sourceName) ||
      left.questItemName.localeCompare(right.questItemName) ||
      left.targetItemName.localeCompare(right.targetItemName)
    );
  });
}

export function buildQuestPlanningViewModel(input: {
  referenceData: QuestReferenceData;
  questPlannerState: QuestPlannerState;
  acquisitionState: AcquisitionPlannerInputState;
  recipeGraph?: RecipeGraph | null;
  towerRequirementsData?: TowerRequirementsData | null;
  snapshot?: MasterySnapshot | null;
  includeHidden?: boolean;
}): QuestPlanningViewModel {
  const availableSupply = buildQuestAvailableSupply(input.acquisitionState);
  const supplyLookup = getSupplyLookup(availableSupply);
  const progressRows = input.referenceData.quests.map((quest) => {
    return deriveQuestProgress(quest, input.referenceData, input.questPlannerState, supplyLookup);
  });
  const visibleProgressRows = input.includeHidden
    ? progressRows
    : progressRows.filter((progress) => !progress.hidden || isDemandQuest(progress));
  const activeQuestProgress = visibleProgressRows.filter((progress) => progress.status === 'active');
  const watchedQuestProgress = visibleProgressRows.filter((progress) => progress.status === 'watched');
  const completedQuestProgress = visibleProgressRows.filter((progress) => progress.status === 'completed');
  const demandProgressRows = [...activeQuestProgress, ...watchedQuestProgress];
  const warnings: string[] = [];

  if (input.acquisitionState.pets.futureProduction.enabled) {
    warnings.push('Future pet production is not counted here until the corrected pet item-pool model lands.');
  }

  return {
    activeQuestProgress,
    watchedQuestProgress,
    completedQuestProgress,
    nextSuggestions: deriveNextSuggestions(input.referenceData, input.questPlannerState, input.includeHidden ?? false),
    bottlenecks: deriveBottlenecks(demandProgressRows),
    sourcePressure: deriveSourcePressure(demandProgressRows),
    synergyHints: deriveSynergyHints({
      progressRows: demandProgressRows,
      referenceData: input.referenceData,
      recipeGraph: input.recipeGraph,
      towerRequirementsData: input.towerRequirementsData,
      snapshot: input.snapshot,
    }),
    availableSupply,
    warnings,
  };
}

export function questMatchesSearch(quest: QuestCatalogEntry, searchText: string): boolean {
  const normalizedSearch = searchText.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableValues = [
    quest.questName,
    quest.questlineName,
    quest.stageLabel ?? '',
    quest.npc ?? '',
    ...quest.questlineAliases,
  ];

  return searchableValues.some((value) => value.toLowerCase().includes(normalizedSearch));
}

export function describeRecipeNode(recipe: RecipeNode): string {
  return `${recipe.outputItemName} (${recipe.recipeType === 'cooking' ? 'cooking' : 'crafting'})`;
}
