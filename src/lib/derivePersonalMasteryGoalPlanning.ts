import type { ConsumableAcquisitionEstimate } from './acquisitionEstimates';
import type { MasteryRaceCountEntry } from './masteryRaceCounts';
import type { PersonalMasteryGoal } from './personalMasteryGoals';
import {
  estimatePumpkinJuiceForTarget,
  getMasteryTargetForTier,
  type PumpkinJuiceEstimate,
} from './pumpkinJuiceEstimator';
import type { PumpkinJuiceValueThresholdState } from './pumpkinJuicePlannerState';
import {
  derivePumpkinJuiceValueEstimate,
  evaluatePumpkinJuiceValueThresholds,
  type PumpkinJuiceValueEstimate,
  type PumpkinJuiceValueThresholdResult,
} from './pumpkinJuiceValueModel';
import type { MasterySnapshot } from './storage/masterySnapshots';

export type PersonalMasteryGoalPlanRow = PersonalMasteryGoal & {
  currentMastery: number;
  targetMastery: number;
  remainingMastery: number;
  matchedSnapshotRow: boolean;
  pumpkinJuiceEstimate: PumpkinJuiceEstimate;
  pumpkinJuiceValueEstimate: PumpkinJuiceValueEstimate;
  pumpkinJuiceValueThreshold: PumpkinJuiceValueThresholdResult;
  raceCountEntry: MasteryRaceCountEntry | null;
  targetTierPublicCount: number | null;
};

export type PersonalMasteryGoalPlanningOptions = {
  consumableEstimates?: ConsumableAcquisitionEstimate[];
  pumpkinJuiceValueThresholds?: PumpkinJuiceValueThresholdState;
};

const DEFAULT_VALUE_THRESHOLDS: PumpkinJuiceValueThresholdState = {
  enabled: false,
  minNextApSaved: 0,
  minTotalApSaved: 0,
  minNextStaminaSaved: 0,
  minTotalStaminaSaved: 0,
};

export function derivePersonalMasteryGoalPlanning(
  goals: PersonalMasteryGoal[],
  snapshot: MasterySnapshot | null,
  raceCountByCanonicalKey: Record<string, MasteryRaceCountEntry> = {},
  options: PersonalMasteryGoalPlanningOptions = {},
): PersonalMasteryGoalPlanRow[] {
  return goals.map((goal) => {
    const currentMastery = snapshot?.masteryByItem[goal.canonicalKey] ?? 0;
    const targetMastery = getMasteryTargetForTier(goal.targetTier);
    const remainingMastery = Math.max(0, targetMastery - currentMastery);
    const raceCountEntry = raceCountByCanonicalKey[goal.canonicalKey] ?? null;
    const targetTierPublicCount =
      goal.targetTier === 'M'
        ? raceCountEntry?.masteredCount ?? null
        : goal.targetTier === 'GM'
          ? raceCountEntry?.grandMasteredCount ?? null
          : raceCountEntry?.megaMasteredCount ?? null;
    const pumpkinJuiceEstimate = estimatePumpkinJuiceForTarget({
      itemName: goal.itemName,
      canonicalKey: goal.canonicalKey,
      currentMastery,
      targetTier: goal.targetTier,
      targetMastery,
      sourceScope: 'personal',
    });
    const pumpkinJuiceValueEstimate = derivePumpkinJuiceValueEstimate(
      pumpkinJuiceEstimate,
      options.consumableEstimates ?? [],
    );

    return {
      ...goal,
      currentMastery,
      targetMastery,
      remainingMastery,
      matchedSnapshotRow: Boolean(snapshot && goal.canonicalKey in snapshot.masteryByItem),
      raceCountEntry,
      targetTierPublicCount,
      pumpkinJuiceEstimate,
      pumpkinJuiceValueEstimate,
      pumpkinJuiceValueThreshold: evaluatePumpkinJuiceValueThresholds(
        pumpkinJuiceValueEstimate,
        options.pumpkinJuiceValueThresholds ?? DEFAULT_VALUE_THRESHOLDS,
      ),
    };
  });
}
