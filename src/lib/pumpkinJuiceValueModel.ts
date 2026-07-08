import type { ConsumableAcquisitionEstimate } from './acquisitionEstimates';
import type { PumpkinJuiceEstimate, PumpkinJuiceEstimateStatus } from './pumpkinJuiceEstimator';
import type { PumpkinJuiceValueThresholdState } from './pumpkinJuicePlannerState';

export type PumpkinJuiceValueEstimate = {
  status: PumpkinJuiceEstimateStatus;
  nextItemsSaved: number | null;
  totalItemsSaved: number | null;
  nextArnoldPalmersSaved: number | null;
  totalArnoldPalmersSaved: number | null;
  nextStaminaSaved: number | null;
  totalStaminaSaved: number | null;
  assumptions: string[];
};

export type PumpkinJuiceValueThresholdResult = {
  isHighlighted: boolean;
  reasons: string[];
};

function findEstimate(
  estimates: ConsumableAcquisitionEstimate[],
  sourceKey: ConsumableAcquisitionEstimate['sourceKey'],
): ConsumableAcquisitionEstimate | null {
  return estimates.find((estimate) => estimate.sourceKey === sourceKey) ?? null;
}

function getEffectiveItemsPerUse(estimate: ConsumableAcquisitionEstimate | null): number | null {
  if (!estimate) {
    return null;
  }

  if (estimate.totalUses > 0 && estimate.totalItemCapacity > 0) {
    return estimate.totalItemCapacity / estimate.totalUses;
  }

  return estimate.standardItemsPerUse > 0 ? estimate.standardItemsPerUse : null;
}

function estimateUsesSaved(itemsSaved: number | null, itemsPerUse: number | null): number | null {
  if (itemsSaved === null || itemsPerUse === null || itemsPerUse <= 0) {
    return null;
  }

  return itemsSaved > 0 ? Math.ceil(itemsSaved / itemsPerUse) : 0;
}

function estimateStaminaSaved(
  itemsSaved: number | null,
  appleCiderEstimate: ConsumableAcquisitionEstimate | null,
): number | null {
  const itemsPerUse = getEffectiveItemsPerUse(appleCiderEstimate);
  const staminaPerUse = appleCiderEstimate?.staminaPerUse ?? null;

  if (itemsSaved === null || itemsPerUse === null || staminaPerUse === null || itemsPerUse <= 0) {
    return null;
  }

  return itemsSaved > 0 ? Math.ceil((itemsSaved / itemsPerUse) * staminaPerUse) : 0;
}

function getItemsSaved(
  estimate: PumpkinJuiceEstimate,
): Pick<PumpkinJuiceValueEstimate, 'nextItemsSaved' | 'totalItemsSaved'> {
  if (estimate.status === 'needs_baseline') {
    return {
      nextItemsSaved: null,
      totalItemsSaved: null,
    };
  }

  if (estimate.status === 'complete') {
    return {
      nextItemsSaved: 0,
      totalItemsSaved: 0,
    };
  }

  const remainingItems = Math.max(0, estimate.targetMastery - estimate.currentMastery);
  const nextGain = estimate.nextPumpkinJuiceGain ?? 0;

  return {
    nextItemsSaved: Math.min(nextGain, remainingItems),
    totalItemsSaved: remainingItems,
  };
}

export function derivePumpkinJuiceValueEstimate(
  estimate: PumpkinJuiceEstimate,
  consumableEstimates: ConsumableAcquisitionEstimate[],
): PumpkinJuiceValueEstimate {
  const { nextItemsSaved, totalItemsSaved } = getItemsSaved(estimate);
  const arnoldPalmerEstimate = findEstimate(consumableEstimates, 'arnold_palmer');
  const appleCiderEstimate = findEstimate(consumableEstimates, 'apple_cider');
  const arnoldPalmerItemsPerUse = getEffectiveItemsPerUse(arnoldPalmerEstimate);
  const appleCiderItemsPerUse = getEffectiveItemsPerUse(appleCiderEstimate);
  const assumptions: string[] = [];

  if (arnoldPalmerItemsPerUse !== null) {
    assumptions.push(
      `Arnold Palmer value uses ${Math.round(arnoldPalmerItemsPerUse).toLocaleString()} items per use from saved acquisition assumptions.`,
    );
  }

  if (appleCiderItemsPerUse !== null && appleCiderEstimate && appleCiderEstimate.staminaPerUse !== null) {
    assumptions.push(
      `Stamina value uses ${Math.round(appleCiderItemsPerUse).toLocaleString()} items and ${appleCiderEstimate.staminaPerUse.toLocaleString()} stamina per Apple Cider from saved acquisition assumptions.`,
    );
  }

  return {
    status: estimate.status,
    nextItemsSaved,
    totalItemsSaved,
    nextArnoldPalmersSaved: estimateUsesSaved(nextItemsSaved, arnoldPalmerItemsPerUse),
    totalArnoldPalmersSaved: estimateUsesSaved(totalItemsSaved, arnoldPalmerItemsPerUse),
    nextStaminaSaved: estimateStaminaSaved(nextItemsSaved, appleCiderEstimate),
    totalStaminaSaved: estimateStaminaSaved(totalItemsSaved, appleCiderEstimate),
    assumptions,
  };
}

function shouldHighlight(value: number | null, threshold: number): boolean {
  return threshold > 0 && value !== null && value >= threshold;
}

export function evaluatePumpkinJuiceValueThresholds(
  estimate: PumpkinJuiceValueEstimate,
  thresholds: PumpkinJuiceValueThresholdState,
): PumpkinJuiceValueThresholdResult {
  if (!thresholds.enabled || estimate.status !== 'calculable') {
    return {
      isHighlighted: false,
      reasons: [],
    };
  }

  const reasons: string[] = [];

  if (shouldHighlight(estimate.nextArnoldPalmersSaved, thresholds.minNextApSaved)) {
    reasons.push(`Next PJ saves about ${estimate.nextArnoldPalmersSaved?.toLocaleString()} Arnold Palmers.`);
  }

  if (shouldHighlight(estimate.totalArnoldPalmersSaved, thresholds.minTotalApSaved)) {
    reasons.push(`Goal saves about ${estimate.totalArnoldPalmersSaved?.toLocaleString()} Arnold Palmers.`);
  }

  if (shouldHighlight(estimate.nextStaminaSaved, thresholds.minNextStaminaSaved)) {
    reasons.push(`Next PJ saves about ${estimate.nextStaminaSaved?.toLocaleString()} stamina.`);
  }

  if (shouldHighlight(estimate.totalStaminaSaved, thresholds.minTotalStaminaSaved)) {
    reasons.push(`Goal saves about ${estimate.totalStaminaSaved?.toLocaleString()} stamina.`);
  }

  return {
    isHighlighted: reasons.length > 0,
    reasons,
  };
}
