export type MasteryTargetTier = 'M' | 'GM' | 'MM';

export type MasteryGoalSourceScope = 'tower' | 'personal';

export type MasteryTargetInput = {
  itemName: string;
  canonicalKey: string;
  currentMastery: number | null | undefined;
  targetTier: MasteryTargetTier;
  targetMastery?: number;
  sourceScope: MasteryGoalSourceScope;
};

export type PumpkinJuiceEstimateStatus = 'complete' | 'calculable' | 'needs_baseline';

export type PumpkinJuiceEstimate = {
  itemName: string;
  canonicalKey: string;
  currentMastery: number;
  targetTier: MasteryTargetTier;
  targetMastery: number;
  sourceScope: MasteryGoalSourceScope;
  status: PumpkinJuiceEstimateStatus;
  totalPumpkinJuices: number | null;
  nextPumpkinJuiceGain: number | null;
  projectedFinalMastery: number | null;
  blockerReason: string | null;
};

const TARGET_MASTERY_BY_TIER: Record<MasteryTargetTier, number> = {
  M: 10_000,
  GM: 100_000,
  MM: 1_000_000,
};

export function getMasteryTargetForTier(tier: MasteryTargetTier): number {
  return TARGET_MASTERY_BY_TIER[tier];
}

export function getMasteryTierForTarget(targetMastery: number): MasteryTargetTier {
  if (targetMastery <= TARGET_MASTERY_BY_TIER.M) {
    return 'M';
  }

  if (targetMastery <= TARGET_MASTERY_BY_TIER.GM) {
    return 'GM';
  }

  return 'MM';
}

function normalizeCurrentMastery(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function calculatePumpkinJuiceGain(currentMastery: number): number {
  return Math.round(currentMastery * 0.1);
}

export function estimatePumpkinJuiceForTarget(input: MasteryTargetInput): PumpkinJuiceEstimate {
  const currentMastery = normalizeCurrentMastery(input.currentMastery);
  const targetMastery = input.targetMastery ?? getMasteryTargetForTier(input.targetTier);

  if (currentMastery >= targetMastery) {
    return {
      itemName: input.itemName,
      canonicalKey: input.canonicalKey,
      currentMastery,
      targetTier: input.targetTier,
      targetMastery,
      sourceScope: input.sourceScope,
      status: 'complete',
      totalPumpkinJuices: 0,
      nextPumpkinJuiceGain: null,
      projectedFinalMastery: currentMastery,
      blockerReason: null,
    };
  }

  const firstGain = calculatePumpkinJuiceGain(currentMastery);

  if (firstGain <= 0) {
    return {
      itemName: input.itemName,
      canonicalKey: input.canonicalKey,
      currentMastery,
      targetTier: input.targetTier,
      targetMastery,
      sourceScope: input.sourceScope,
      status: 'needs_baseline',
      totalPumpkinJuices: null,
      nextPumpkinJuiceGain: null,
      projectedFinalMastery: null,
      blockerReason: 'Needs baseline mastery before Pumpkin Juice can add progress.',
    };
  }

  let projectedMastery = currentMastery;
  let totalPumpkinJuices = 0;

  while (projectedMastery < targetMastery) {
    const gain = calculatePumpkinJuiceGain(projectedMastery);

    if (gain <= 0) {
      return {
        itemName: input.itemName,
        canonicalKey: input.canonicalKey,
        currentMastery,
        targetTier: input.targetTier,
        targetMastery,
        sourceScope: input.sourceScope,
        status: 'needs_baseline',
        totalPumpkinJuices: null,
        nextPumpkinJuiceGain: null,
        projectedFinalMastery: null,
        blockerReason: 'Needs baseline mastery before Pumpkin Juice can add progress.',
      };
    }

    projectedMastery += gain;
    totalPumpkinJuices += 1;
  }

  return {
    itemName: input.itemName,
    canonicalKey: input.canonicalKey,
    currentMastery,
    targetTier: input.targetTier,
    targetMastery,
    sourceScope: input.sourceScope,
    status: 'calculable',
    totalPumpkinJuices,
    nextPumpkinJuiceGain: firstGain,
    projectedFinalMastery: projectedMastery,
    blockerReason: null,
  };
}

export function estimatePumpkinJuiceForTargets(inputs: MasteryTargetInput[]): PumpkinJuiceEstimate[] {
  return inputs.map(estimatePumpkinJuiceForTarget);
}
