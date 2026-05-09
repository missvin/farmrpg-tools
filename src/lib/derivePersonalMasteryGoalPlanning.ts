import type { MasteryRaceCountEntry } from './masteryRaceCounts';
import type { PersonalMasteryGoal } from './personalMasteryGoals';
import {
  estimatePumpkinJuiceForTarget,
  getMasteryTargetForTier,
  type PumpkinJuiceEstimate,
} from './pumpkinJuiceEstimator';
import type { MasterySnapshot } from './storage/masterySnapshots';

export type PersonalMasteryGoalPlanRow = PersonalMasteryGoal & {
  currentMastery: number;
  targetMastery: number;
  remainingMastery: number;
  matchedSnapshotRow: boolean;
  pumpkinJuiceEstimate: PumpkinJuiceEstimate;
  raceCountEntry: MasteryRaceCountEntry | null;
  targetTierPublicCount: number | null;
};

export function derivePersonalMasteryGoalPlanning(
  goals: PersonalMasteryGoal[],
  snapshot: MasterySnapshot | null,
  raceCountByCanonicalKey: Record<string, MasteryRaceCountEntry> = {},
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

    return {
      ...goal,
      currentMastery,
      targetMastery,
      remainingMastery,
      matchedSnapshotRow: Boolean(snapshot && goal.canonicalKey in snapshot.masteryByItem),
      raceCountEntry,
      targetTierPublicCount,
      pumpkinJuiceEstimate: estimatePumpkinJuiceForTarget({
        itemName: goal.itemName,
        canonicalKey: goal.canonicalKey,
        currentMastery,
        targetTier: goal.targetTier,
        targetMastery,
        sourceScope: 'personal',
      }),
    };
  });
}
