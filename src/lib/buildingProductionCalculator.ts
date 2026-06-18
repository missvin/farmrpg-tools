import type {
  BuildingProductConversion,
  BuildingProductionInput,
  BuildingProductionProcess,
  BuildingProductionReferenceData,
} from './loadBuildingProductionReference';
import type { BuildingProductionState } from './buildingProductionState';
import type { AvailableSupplyPool } from './availableSupply';

export type BuildingProductionRequirement = {
  itemName: string;
  canonicalKey: string;
  requiredQuantity: number;
  availableQuantity: number;
  remainingQuantity: number;
};

export type ItemGoalBuildingSource = {
  sourceKey: string;
  role: 'target' | 'conversion';
  buildingName: string;
  outputItemName: string;
  outputCanonicalKey: string;
  finalItemName: string;
  finalCanonicalKey: string;
  requiredFinalQuantity: number;
  requiredBuildingOutputQuantity: number;
  availableBuildingOutputQuantity: number;
  queuedOutputQuantity: number;
  remainingBuildingOutputQuantity: number;
  batchesRequired: number;
  effectiveOutputPerBatch: number;
  processingMinutes: number;
  inputRequirements: BuildingProductionRequirement[];
  secondaryRequirements: BuildingProductionRequirement[];
  perksApplied: string[];
  notes: string[];
};

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatQuantity(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function getAvailableQuantity(supplyPool: AvailableSupplyPool, canonicalKey: string): number {
  return supplyPool.byCanonicalKey[canonicalKey]?.effectiveQuantity ?? 0;
}

function getQueuedQuantity(state: BuildingProductionState, canonicalKey: string): number {
  return clampNonNegative(state.queuedOutputByCanonicalKey[canonicalKey] ?? 0);
}

function getProductionMultipliers(process: BuildingProductionProcess, state: BuildingProductionState): {
  outputMultiplier: number;
  speedMultiplier: number;
  perksApplied: string[];
} {
  if (process.perkGroup === 'sugar_cane_mill') {
    return {
      outputMultiplier: state.perkSettings.sugarBoostII ? 2 : 1,
      speedMultiplier: state.perkSettings.sugarBoostI ? 2 : 1,
      perksApplied: [
        ...(state.perkSettings.sugarBoostI ? ['Sugar Boost I'] : []),
        ...(state.perkSettings.sugarBoostII ? ['Sugar Boost II'] : []),
      ],
    };
  }

  if (process.perkGroup === 'sawmill') {
    return {
      outputMultiplier: 1,
      speedMultiplier: state.perkSettings.pineBoost ? 2 : 1,
      perksApplied: state.perkSettings.pineBoost ? ['Pine Boost'] : [],
    };
  }

  return {
    outputMultiplier: 1,
    speedMultiplier: 1,
    perksApplied: [],
  };
}

function buildRequirements(input: {
  requiredUnits: number;
  inputs: BuildingProductionInput[];
  supplyPool: AvailableSupplyPool;
}): BuildingProductionRequirement[] {
  return input.inputs.map((entry) => {
    const requiredQuantity = input.requiredUnits * entry.quantity;
    const availableQuantity = getAvailableQuantity(input.supplyPool, entry.canonicalKey);

    return {
      itemName: entry.itemName,
      canonicalKey: entry.canonicalKey,
      requiredQuantity,
      availableQuantity,
      remainingQuantity: Math.max(0, requiredQuantity - availableQuantity),
    };
  });
}

function buildDirectSource(input: {
  process: BuildingProductionProcess;
  requiredQuantity: number;
  state: BuildingProductionState;
  supplyPool: AvailableSupplyPool;
  role: 'target' | 'conversion';
  finalItemName: string;
  finalCanonicalKey: string;
  secondaryInputs?: BuildingProductionInput[];
  sourceKey: string;
}): ItemGoalBuildingSource | null {
  const requiredFinalQuantity = clampNonNegative(input.requiredQuantity);

  if (requiredFinalQuantity <= 0) {
    return null;
  }

  const multipliers = getProductionMultipliers(input.process, input.state);
  const effectiveOutputPerBatch = input.process.outputQuantity * multipliers.outputMultiplier;
  const availableBuildingOutputQuantity =
    input.role === 'target' ? 0 : getAvailableQuantity(input.supplyPool, input.process.outputCanonicalKey);
  const queuedOutputQuantity = getQueuedQuantity(input.state, input.process.outputCanonicalKey);
  const remainingBuildingOutputQuantity = Math.max(
    0,
    requiredFinalQuantity - availableBuildingOutputQuantity - queuedOutputQuantity,
  );
  const batchesRequired = Math.ceil(remainingBuildingOutputQuantity / effectiveOutputPerBatch);
  const processingMinutes = batchesRequired * (input.process.processingMinutes / multipliers.speedMultiplier);

  return {
    sourceKey: input.sourceKey,
    role: input.role,
    buildingName: input.process.buildingName,
    outputItemName: input.process.outputItemName,
    outputCanonicalKey: input.process.outputCanonicalKey,
    finalItemName: input.finalItemName,
    finalCanonicalKey: input.finalCanonicalKey,
    requiredFinalQuantity,
    requiredBuildingOutputQuantity: requiredFinalQuantity,
    availableBuildingOutputQuantity,
    queuedOutputQuantity,
    remainingBuildingOutputQuantity,
    batchesRequired,
    effectiveOutputPerBatch,
    processingMinutes,
    inputRequirements: buildRequirements({
      requiredUnits: batchesRequired,
      inputs: input.process.inputs,
      supplyPool: input.supplyPool,
    }),
    secondaryRequirements: buildRequirements({
      requiredUnits: requiredFinalQuantity,
      inputs: input.secondaryInputs ?? [],
      supplyPool: input.supplyPool,
    }),
    perksApplied: multipliers.perksApplied,
    notes: [
      `${formatQuantity(effectiveOutputPerBatch)} ${input.process.outputItemName} per batch.`,
      `${formatQuantity(input.process.processingMinutes / multipliers.speedMultiplier)} min/batch.`,
      ...input.process.notes,
    ],
  };
}

function buildConversionSource(input: {
  conversion: BuildingProductConversion;
  process: BuildingProductionProcess;
  requiredFinalQuantity: number;
  state: BuildingProductionState;
  supplyPool: AvailableSupplyPool;
}): ItemGoalBuildingSource | null {
  const requiredFinalQuantity = clampNonNegative(input.requiredFinalQuantity);

  if (requiredFinalQuantity <= 0) {
    return null;
  }

  const requiredBuildingOutputQuantity =
    (requiredFinalQuantity / input.conversion.finalOutputQuantity) * input.conversion.buildingOutputQuantity;
  const multipliers = getProductionMultipliers(input.process, input.state);
  const effectiveOutputPerBatch = input.process.outputQuantity * multipliers.outputMultiplier;
  const availableBuildingOutputQuantity = getAvailableQuantity(input.supplyPool, input.process.outputCanonicalKey);
  const queuedOutputQuantity = getQueuedQuantity(input.state, input.process.outputCanonicalKey);
  const remainingBuildingOutputQuantity = Math.max(
    0,
    requiredBuildingOutputQuantity - availableBuildingOutputQuantity - queuedOutputQuantity,
  );
  const batchesRequired = Math.ceil(remainingBuildingOutputQuantity / effectiveOutputPerBatch);
  const processingMinutes = batchesRequired * (input.process.processingMinutes / multipliers.speedMultiplier);

  return {
    sourceKey: input.conversion.conversionKey,
    role: 'conversion',
    buildingName: input.process.buildingName,
    outputItemName: input.process.outputItemName,
    outputCanonicalKey: input.process.outputCanonicalKey,
    finalItemName: input.conversion.finalItemName,
    finalCanonicalKey: input.conversion.finalCanonicalKey,
    requiredFinalQuantity,
    requiredBuildingOutputQuantity,
    availableBuildingOutputQuantity,
    queuedOutputQuantity,
    remainingBuildingOutputQuantity,
    batchesRequired,
    effectiveOutputPerBatch,
    processingMinutes,
    inputRequirements: buildRequirements({
      requiredUnits: batchesRequired,
      inputs: input.process.inputs,
      supplyPool: input.supplyPool,
    }),
    secondaryRequirements: buildRequirements({
      requiredUnits: requiredFinalQuantity / input.conversion.finalOutputQuantity,
      inputs: input.conversion.secondaryInputs,
      supplyPool: input.supplyPool,
    }),
    perksApplied: multipliers.perksApplied,
    notes: [
      `${formatQuantity(input.conversion.buildingOutputQuantity)} ${input.conversion.buildingOutputItemName} per ${formatQuantity(input.conversion.finalOutputQuantity)} ${input.conversion.finalItemName}.`,
      `${formatQuantity(effectiveOutputPerBatch)} ${input.process.outputItemName} per batch.`,
      `${formatQuantity(input.process.processingMinutes / multipliers.speedMultiplier)} min/batch.`,
      ...input.conversion.notes,
    ],
  };
}

export function deriveItemGoalBuildingSources(input: {
  targetCanonicalKey: string;
  targetItemName: string;
  targetRemainingQuantity: number;
  buildingProductionReference: BuildingProductionReferenceData | null;
  buildingProductionState: BuildingProductionState;
  supplyPool: AvailableSupplyPool;
}): ItemGoalBuildingSource[] {
  if (!input.buildingProductionReference) {
    return [];
  }

  const targetRemainingQuantity = clampNonNegative(input.targetRemainingQuantity);
  const directSources = (input.buildingProductionReference.byOutputCanonicalKey[input.targetCanonicalKey] ?? [])
    .map((process) => buildDirectSource({
      process,
      requiredQuantity: targetRemainingQuantity,
      state: input.buildingProductionState,
      supplyPool: input.supplyPool,
      role: 'target',
      finalItemName: input.targetItemName,
      finalCanonicalKey: input.targetCanonicalKey,
      sourceKey: process.productionKey,
    }))
    .filter((source): source is ItemGoalBuildingSource => Boolean(source));

  const conversionSources = (input.buildingProductionReference.conversionsByFinalCanonicalKey[input.targetCanonicalKey] ?? [])
    .flatMap((conversion) => {
      return (input.buildingProductionReference?.byOutputCanonicalKey[conversion.buildingOutputCanonicalKey] ?? [])
        .map((process) => buildConversionSource({
          conversion,
          process,
          requiredFinalQuantity: targetRemainingQuantity,
          state: input.buildingProductionState,
          supplyPool: input.supplyPool,
        }))
        .filter((source): source is ItemGoalBuildingSource => Boolean(source));
    });

  return [...directSources, ...conversionSources].sort((left, right) => {
    return left.processingMinutes - right.processingMinutes || left.finalItemName.localeCompare(right.finalItemName);
  });
}
