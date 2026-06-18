import {
  CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER,
  deriveFuturePetProductionForecast,
  type FuturePetProductionForecastItem,
} from './deriveFuturePetProductionForecast';
import {
  deriveAvailableSupplyPool,
  type AvailableSupplyBreakdownEntry,
  type AvailableSupplyExtraBreakdownInput,
  type AvailableSupplyPool,
} from './availableSupply';
import type { AcquisitionPlannerInputState } from './acquisitionPlannerState';
import {
  deriveItemGoalBuildingSources,
  type ItemGoalBuildingSource,
} from './buildingProductionCalculator';
import type { BuildingProductionState } from './buildingProductionState';
import type { UserCraftingModifierState } from './craftingModifierState';
import type { OpenableContentsReferenceData, OpenableContentsReferenceEntry } from './loadOpenableContentsReference';
import type { BuildingProductionReferenceData } from './loadBuildingProductionReference';
import type { PetSourceReferenceData } from './loadPetSourceReference';
import type { RecipeGraph } from './loadRecipeGraph';
import type { WishingWellReferenceData, WishingWellReferenceEntry } from './loadWishingWellReference';
import { buildTargetOutputPlannerResult, type TargetOutputPlannerResult } from './targetOutputPlannerEngine';
import { toCanonicalItemKey } from './normalizeItemKey';

export type ItemGoalMode = 'mastery' | 'quantity';

export type ItemGoalCalculatorSettings = {
  goalMode: ItemGoalMode;
  targetMastery: number;
  targetQuantity: number;
  waitDays: number | null;
  includeOpenableContents: boolean;
  crunchyOmeletteActive: boolean;
  towerAntlersPerDay: number;
  wishingWellThrowsPerDay: number;
  wishingWellRewardMultiplier: number;
};

export type ItemGoalOpenableSource = {
  entry: OpenableContentsReferenceEntry;
  ownedOpenableCount: number;
  projectedContentQuantity: number;
};

export type ItemGoalWishingWellSource = {
  entry: WishingWellReferenceEntry;
  throwsPerDay: number;
  rewardMultiplier: number;
  expectedDailyQuantity: number;
  thrownItemAvailableQuantity: number;
};

export type ItemGoalPetSource = {
  canonicalKey: string;
  itemName: string;
  role: 'target' | 'ingredient';
  forecastQuantity: number;
  sourcePetCount: number;
  forecast: FuturePetProductionForecastItem;
};

export type ItemGoalActiveRemainingRow = {
  canonicalKey: string;
  itemName: string;
  remainingQuantity: number;
  grossRequiredQuantity: number;
  sourceSummary: string;
};

export type ItemGoalWaitProjection = {
  waitDays: number;
  futurePetQuantity: number;
  towerAntlerQuantity: number;
  expectedWishingWellQuantity: number;
  projectedRemainingQuantity: number;
  activeRemainingRows: ItemGoalActiveRemainingRow[];
  warnings: string[];
};

export type ItemGoalCalculatorResult = {
  goalMode: ItemGoalMode;
  desiredQuantity: number;
  totalAvailableQuantity: number;
  remainingQuantity: number;
  openableQuantity: number;
  crunchyStoredPetBonusQuantity: number;
  expectedWishingWellQuantityPerDay: number;
  plannerResult: TargetOutputPlannerResult;
  supplyPool: AvailableSupplyPool;
  openableSources: ItemGoalOpenableSource[];
  wishingWellSources: ItemGoalWishingWellSource[];
  petSources: ItemGoalPetSource[];
  buildingSources: ItemGoalBuildingSource[];
  waitProjection: ItemGoalWaitProjection;
  warnings: string[];
};

export const DEFAULT_ITEM_GOAL_CALCULATOR_SETTINGS: ItemGoalCalculatorSettings = {
  goalMode: 'mastery',
  targetMastery: 100_000,
  targetQuantity: 10_000,
  waitDays: null,
  includeOpenableContents: true,
  crunchyOmeletteActive: false,
  towerAntlersPerDay: 0,
  wishingWellThrowsPerDay: 30,
  wishingWellRewardMultiplier: 1,
};

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampOptionalWaitDays(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return clampNonNegative(value);
}

function cloneAcquisitionStateWithGoalSettings(
  acquisitionState: AcquisitionPlannerInputState,
  settings: ItemGoalCalculatorSettings,
): AcquisitionPlannerInputState {
  const waitDays = clampOptionalWaitDays(settings.waitDays);

  return {
    ...acquisitionState,
    pets: {
      ...acquisitionState.pets,
      futureProduction: {
        ...acquisitionState.pets.futureProduction,
        horizonDays: waitDays === null ? acquisitionState.pets.futureProduction.horizonDays : waitDays,
        crunchyOmeletteActive: settings.crunchyOmeletteActive,
      },
    },
  };
}

function getDesiredQuantity(input: {
  currentMastery: number;
  settings: ItemGoalCalculatorSettings;
}): number {
  if (input.settings.goalMode === 'quantity') {
    return clampNonNegative(input.settings.targetQuantity);
  }

  return Math.max(0, clampNonNegative(input.settings.targetMastery) - Math.max(0, input.currentMastery));
}

function deriveOpenableSources(input: {
  acquisitionState: AcquisitionPlannerInputState;
  openableContentsReference: OpenableContentsReferenceData | null;
  includeOpenableContents: boolean;
}): ItemGoalOpenableSource[] {
  if (!input.includeOpenableContents || !input.openableContentsReference) {
    return [];
  }

  const ownedContainerEntries = input.acquisitionState.ownedNow.entries.filter(
    (entry) => entry.sourceCategory === 'container' && entry.ownedCount > 0,
  );
  const openableSources: ItemGoalOpenableSource[] = [];

  for (const ownedEntry of ownedContainerEntries) {
    const contentEntries = input.openableContentsReference.byOpenableCanonicalKey[ownedEntry.canonicalItemKey] ?? [];

    for (const contentEntry of contentEntries) {
      openableSources.push({
        entry: contentEntry,
        ownedOpenableCount: ownedEntry.ownedCount,
        projectedContentQuantity: ownedEntry.ownedCount * contentEntry.quantityPerOpen,
      });
    }
  }

  return openableSources.sort((left, right) => {
    return right.projectedContentQuantity - left.projectedContentQuantity ||
      left.entry.openableItemName.localeCompare(right.entry.openableItemName);
  });
}

function buildOpenableExtraBreakdowns(openableSources: ItemGoalOpenableSource[]): AvailableSupplyExtraBreakdownInput[] {
  return openableSources.map((source) => ({
    canonicalKey: source.entry.contentCanonicalKey,
    itemName: source.entry.contentItemName,
    sourceKey: 'openable_contents',
    timing: 'immediate',
    quantity: source.projectedContentQuantity,
    notes: [
      `${source.ownedOpenableCount.toLocaleString()} ${source.entry.openableItemName} at ${source.entry.quantityPerOpen.toLocaleString()} ${source.entry.contentItemName} each.`,
      ...source.entry.notes,
    ],
  }));
}

function buildCrunchyStoredPetBonusBreakdowns(input: {
  acquisitionState: AcquisitionPlannerInputState;
  crunchyOmeletteActive: boolean;
}): AvailableSupplyExtraBreakdownInput[] {
  if (!input.crunchyOmeletteActive) {
    return [];
  }

  return input.acquisitionState.pets.storedInventoryEntries
    .map((entry) => ({
      canonicalKey: entry.canonicalItemKey,
      itemName: entry.itemName,
      sourceKey: 'stored_pet_inventory' as const,
      timing: 'immediate' as const,
      quantity: entry.storedCount * (CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER - 1),
      notes: ['Crunchy Omelette collection bonus on stored pet inventory.'],
    }))
    .filter((entry) => entry.quantity > 0);
}

function buildTowerAntlerBreakdown(input: {
  towerAntlersPerDay: number;
  waitDays: number | null;
}): AvailableSupplyExtraBreakdownInput[] {
  const dayMultiplier = input.waitDays === null ? 1 : input.waitDays;
  const quantity = clampNonNegative(input.towerAntlersPerDay) * dayMultiplier;

  if (quantity <= 0) {
    return [];
  }

  return [
    {
      canonicalKey: 'antler',
      itemName: 'Antler',
      sourceKey: 'recurring_antlers',
      timing: 'future',
      quantity,
      notes: [
        input.waitDays === null
          ? 'Tower artifact recurring Antlers entered as a daily amount.'
          : `${input.towerAntlersPerDay.toLocaleString()} Tower artifact Antlers/day for ` +
            `${input.waitDays.toLocaleString()} day${input.waitDays === 1 ? '' : 's'}.`,
      ],
    },
  ];
}

function deriveWishingWellSources(input: {
  targetCanonicalKey: string;
  wishingWellReference: WishingWellReferenceData | null;
  supplyPool: AvailableSupplyPool;
  settings: ItemGoalCalculatorSettings;
}): ItemGoalWishingWellSource[] {
  if (!input.wishingWellReference) {
    return [];
  }

  const throwsPerDay = clampNonNegative(input.settings.wishingWellThrowsPerDay);
  const rewardMultiplier = Math.max(1, clampNonNegative(input.settings.wishingWellRewardMultiplier) || 1);

  if (throwsPerDay <= 0) {
    return [];
  }

  return (input.wishingWellReference.byRewardCanonicalKey[input.targetCanonicalKey] ?? [])
    .map((entry) => ({
      entry,
      throwsPerDay,
      rewardMultiplier,
      expectedDailyQuantity: throwsPerDay * entry.rewardChance * entry.rewardQuantity * rewardMultiplier,
      thrownItemAvailableQuantity: input.supplyPool.byCanonicalKey[entry.thrownCanonicalKey]?.effectiveQuantity ?? 0,
    }))
    .sort((left, right) => {
      return right.expectedDailyQuantity - left.expectedDailyQuantity ||
        left.entry.thrownItemName.localeCompare(right.entry.thrownItemName);
    });
}

function getDemandedCanonicalKeys(plannerResult: TargetOutputPlannerResult): Set<string> {
  return new Set(plannerResult.rows.map((row) => row.canonicalKey));
}

function derivePetSources(input: {
  acquisitionState: AcquisitionPlannerInputState;
  petSourceReference: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
  plannerResult: TargetOutputPlannerResult;
  targetCanonicalKey: string;
}): ItemGoalPetSource[] {
  const demandedKeys = getDemandedCanonicalKeys(input.plannerResult);

  if (demandedKeys.size === 0) {
    return [];
  }

  const forecast = deriveFuturePetProductionForecast(input.acquisitionState, {
    petSourceReference: input.petSourceReference,
  });

  return forecast.entries
    .filter((entry) => demandedKeys.has(entry.canonicalItemKey))
    .map((entry) => ({
      canonicalKey: entry.canonicalItemKey,
      itemName: entry.itemName,
      role: entry.canonicalItemKey === input.targetCanonicalKey ? 'target' as const : 'ingredient' as const,
      forecastQuantity: entry.forecastQuantity,
      sourcePetCount: entry.sourcePetCount,
      forecast: entry,
    }))
    .sort((left, right) => {
      if (left.role !== right.role) {
        return left.role === 'target' ? -1 : 1;
      }

      return right.forecastQuantity - left.forecastQuantity || left.itemName.localeCompare(right.itemName);
    });
}

function sumBreakdowns(
  breakdowns: AvailableSupplyBreakdownEntry[] | undefined,
  predicate: (entry: AvailableSupplyBreakdownEntry) => boolean,
): number {
  return (breakdowns ?? []).reduce((total, entry) => {
    return total + (predicate(entry) ? entry.quantity : 0);
  }, 0);
}

function summarizeRowSource(row: {
  supply: { breakdowns: AvailableSupplyBreakdownEntry[] } | null;
}): string {
  const labels = [...new Set((row.supply?.breakdowns ?? []).map((breakdown) => breakdown.label))];

  return labels.length === 0 ? 'No counted supply' : labels.slice(0, 3).join(', ');
}

function buildWaitProjection(input: {
  settings: ItemGoalCalculatorSettings;
  plannerResult: TargetOutputPlannerResult;
  targetCanonicalKey: string;
  remainingQuantity: number;
  wishingWellSources: ItemGoalWishingWellSource[];
}): ItemGoalWaitProjection {
  const waitDays = clampOptionalWaitDays(input.settings.waitDays) ?? 0;
  const expectedWishingWellQuantity = input.wishingWellSources.reduce((total, source) => {
    return total + (source.expectedDailyQuantity * waitDays);
  }, 0);
  const projectedRemainingQuantity = Math.max(0, input.remainingQuantity - expectedWishingWellQuantity);
  const warnings: string[] = [];

  for (const source of input.wishingWellSources) {
    const neededThrows = source.throwsPerDay * waitDays;

    if (neededThrows > 0 && source.thrownItemAvailableQuantity < neededThrows) {
      warnings.push(
        `${source.entry.thrownItemName} Wishing Well plan needs ${neededThrows.toLocaleString()} throws over ` +
          `${waitDays.toLocaleString()} day${waitDays === 1 ? '' : 's'}, but only ` +
          `${source.thrownItemAvailableQuantity.toLocaleString()} are counted as available.`,
      );
    }
  }

  const activeRemainingRows = input.plannerResult.rows
    .map((row): ItemGoalActiveRemainingRow => {
      const remainingQuantity = row.canonicalKey === input.targetCanonicalKey
        ? Math.max(0, row.remainingQuantity - expectedWishingWellQuantity)
        : row.remainingQuantity;

      return {
        canonicalKey: row.canonicalKey,
        itemName: row.itemName,
        remainingQuantity,
        grossRequiredQuantity: row.grossRequiredQuantity,
        sourceSummary: summarizeRowSource(row),
      };
    })
    .filter((row) => row.remainingQuantity > 0)
    .sort((left, right) => {
      if (left.canonicalKey === input.targetCanonicalKey && right.canonicalKey !== input.targetCanonicalKey) {
        return -1;
      }

      if (right.canonicalKey === input.targetCanonicalKey && left.canonicalKey !== input.targetCanonicalKey) {
        return 1;
      }

      return right.remainingQuantity - left.remainingQuantity || left.itemName.localeCompare(right.itemName);
    });

  return {
    waitDays,
    futurePetQuantity: input.plannerResult.rows.reduce((total, row) => {
      return total + sumBreakdowns(row.supply?.breakdowns, (entry) => entry.sourceKey === 'future_pet_production');
    }, 0),
    towerAntlerQuantity: input.plannerResult.rows.reduce((total, row) => {
      return total + sumBreakdowns(row.supply?.breakdowns, (entry) => entry.sourceKey === 'recurring_antlers');
    }, 0),
    expectedWishingWellQuantity,
    projectedRemainingQuantity,
    activeRemainingRows,
    warnings,
  };
}

export function buildItemGoalCalculatorResult(input: {
  itemName: string;
  canonicalKey: string;
  currentMastery: number;
  acquisitionState: AcquisitionPlannerInputState;
  modifierState: UserCraftingModifierState;
  recipeGraph: RecipeGraph;
  petSourceReference?: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
  openableContentsReference?: OpenableContentsReferenceData | null;
  wishingWellReference?: WishingWellReferenceData | null;
  buildingProductionReference?: BuildingProductionReferenceData | null;
  buildingProductionState?: BuildingProductionState | null;
  settings?: Partial<ItemGoalCalculatorSettings>;
}): ItemGoalCalculatorResult {
  const settings = {
    ...DEFAULT_ITEM_GOAL_CALCULATOR_SETTINGS,
    ...input.settings,
  };
  const canonicalKey = toCanonicalItemKey(input.canonicalKey);
  const acquisitionState = cloneAcquisitionStateWithGoalSettings(
    input.acquisitionState,
    settings,
  );
  const waitDays = clampOptionalWaitDays(settings.waitDays);
  const desiredQuantity = getDesiredQuantity({
    currentMastery: input.currentMastery,
    settings,
  });
  const openableSources = deriveOpenableSources({
    acquisitionState,
    openableContentsReference: input.openableContentsReference ?? null,
    includeOpenableContents: settings.includeOpenableContents,
  });
  const extraBreakdowns = [
    ...buildOpenableExtraBreakdowns(openableSources),
    ...buildCrunchyStoredPetBonusBreakdowns({
      acquisitionState,
      crunchyOmeletteActive: settings.crunchyOmeletteActive,
    }),
    ...buildTowerAntlerBreakdown({
      towerAntlersPerDay: settings.towerAntlersPerDay,
      waitDays,
    }),
  ];
  const supplyPool = deriveAvailableSupplyPool({
    acquisitionState,
    petSourceReference: input.petSourceReference ?? null,
    extraBreakdowns,
  });
  const plannerResult = buildTargetOutputPlannerResult({
    goals: [
      {
        targetId: `item-goal:${canonicalKey}`,
        targetLabel: input.itemName,
        itemName: input.itemName,
        canonicalKey,
        desiredQuantity,
      },
    ],
    recipeGraph: input.recipeGraph,
    modifierState: input.modifierState,
    supplyPool,
  });
  const targetRow = plannerResult.rowsByCanonicalKey[canonicalKey] ?? null;
  const targetSupplyBreakdowns = targetRow?.supply?.breakdowns ?? [];
  const openableQuantity = sumBreakdowns(targetSupplyBreakdowns, (entry) => entry.sourceKey === 'openable_contents');
  const crunchyStoredPetBonusQuantity = sumBreakdowns(
    targetSupplyBreakdowns,
    (entry) => entry.sourceKey === 'stored_pet_inventory' &&
      entry.notes.some((note) => note.includes('Crunchy Omelette')),
  );
  const wishingWellSources = deriveWishingWellSources({
    targetCanonicalKey: canonicalKey,
    wishingWellReference: input.wishingWellReference ?? null,
    supplyPool,
    settings,
  });
  const expectedWishingWellQuantityPerDay = wishingWellSources.reduce((total, source) => {
    return total + source.expectedDailyQuantity;
  }, 0);
  const petSources = derivePetSources({
    acquisitionState,
    petSourceReference: input.petSourceReference ?? null,
    plannerResult,
    targetCanonicalKey: canonicalKey,
  });
  const buildingSources = input.buildingProductionState
    ? deriveItemGoalBuildingSources({
      targetCanonicalKey: canonicalKey,
      targetItemName: input.itemName,
      targetRemainingQuantity: targetRow?.remainingQuantity ?? desiredQuantity,
      buildingProductionReference: input.buildingProductionReference ?? null,
      buildingProductionState: input.buildingProductionState,
      supplyPool,
    })
    : [];
  const waitProjection = buildWaitProjection({
    settings,
    plannerResult,
    targetCanonicalKey: canonicalKey,
    remainingQuantity: targetRow?.remainingQuantity ?? desiredQuantity,
    wishingWellSources,
  });
  const warnings = [...plannerResult.warnings];

  if (input.openableContentsReference === null || input.openableContentsReference === undefined) {
    warnings.push('Openable contents reference data was not loaded, so container contents are not counted.');
  }

  if (input.wishingWellReference === null || input.wishingWellReference === undefined) {
    warnings.push('Wishing Well reference data was not loaded, so expected Wishing Well rewards are not shown.');
  }

  if (input.buildingProductionReference === null || input.buildingProductionReference === undefined) {
    warnings.push('Building production reference data was not loaded, so timed building sources are not shown.');
  }

  return {
    goalMode: settings.goalMode,
    desiredQuantity,
    totalAvailableQuantity: targetRow?.availableQuantity ?? 0,
    remainingQuantity: targetRow?.remainingQuantity ?? desiredQuantity,
    openableQuantity,
    crunchyStoredPetBonusQuantity,
    expectedWishingWellQuantityPerDay,
    plannerResult,
    supplyPool,
    openableSources,
    wishingWellSources,
    petSources,
    buildingSources,
    waitProjection,
    warnings,
  };
}
