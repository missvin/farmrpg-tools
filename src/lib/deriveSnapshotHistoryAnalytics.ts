import type { MasterySnapshot } from './storage/masterySnapshots';

export type SnapshotHistoryTimelinePoint = {
  snapshotId: string;
  savedAt: string;
  timestamp: number;
  itemCount: number;
  totalMastery: number;
  totalDelta: number;
  elapsedDays: number | null;
  masteryPerDay: number | null;
  percentGainPerDay: number | null;
};

export type SnapshotHistoryItemPoint = {
  snapshotId: string;
  savedAt: string;
  timestamp: number;
  value: number;
  delta: number;
  elapsedDays: number | null;
  gainPerDay: number | null;
  percentToNextThreshold: number;
};

export type SnapshotHistoryThresholdCrossing = {
  threshold: number;
  label: 'Mastered' | 'GM' | 'MM';
  snapshotId: string;
  savedAt: string;
};

export type SnapshotHistoryItemRow = {
  canonicalKey: string;
  itemName: string;
  latestValue: number;
  firstValue: number;
  totalDelta: number;
  recentDelta: number;
  totalGainPerDay: number | null;
  recentGainPerDay: number | null;
  percentGain: number | null;
  nextThreshold: number | null;
  nextThresholdLabel: string | null;
  remainingToNextThreshold: number | null;
  latestPercentToNextThreshold: number;
  crossedThresholds: SnapshotHistoryThresholdCrossing[];
  latestThresholdCrossings: SnapshotHistoryThresholdCrossing[];
  suggestionReasons: string[];
  points: SnapshotHistoryItemPoint[];
};

export type SnapshotHistorySuggestionBucket = {
  id:
    | 'fastest_recent_gainers'
    | 'recent_thresholds'
    | 'closest_threshold'
    | 'tower_needed'
    | 'biggest_percent_gain'
    | 'breakouts'
    | 'streak_movers';
  label: string;
  itemKeys: string[];
};

export type SnapshotHistoryCallout = {
  id: 'best_interval' | 'fastest_recent_item' | 'recent_thresholds' | 'longest_active_streak';
  title: string;
  value: string;
  detail: string;
  evidence: SnapshotHistoryCalloutEvidence[];
};

export type SnapshotHistoryCalloutEvidence = {
  label: string;
  value: string;
  canonicalKey?: string;
  itemName?: string;
};

export type SnapshotHistoryAnalytics = {
  snapshotPoints: SnapshotHistoryTimelinePoint[];
  itemRows: SnapshotHistoryItemRow[];
  defaultSelectedCanonicalKeys: string[];
  suggestionBuckets: SnapshotHistorySuggestionBucket[];
  milestoneCallouts: SnapshotHistoryCallout[];
};

type ThresholdDefinition = {
  threshold: number;
  label: SnapshotHistoryThresholdCrossing['label'];
};

type ItemSeed = {
  canonicalKey: string;
  itemName: string;
  points: SnapshotHistoryItemPoint[];
  crossedThresholds: SnapshotHistoryThresholdCrossing[];
  latestThresholdCrossings: SnapshotHistoryThresholdCrossing[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ITEM_LIMIT = 10;
export const MEGA_MASTERED_THRESHOLD = 1_000_000;
const THRESHOLDS: ThresholdDefinition[] = [
  { threshold: 10_000, label: 'Mastered' },
  { threshold: 100_000, label: 'GM' },
  { threshold: MEGA_MASTERED_THRESHOLD, label: 'MM' },
];

const LEGACY_MOJIBAKE_REPLACEMENTS: Record<string, string> = {
  'ÃƒÂ±': 'Ã±',
};

function normalizeLegacyComparisonKey(canonicalKey: string): string {
  return Object.entries(LEGACY_MOJIBAKE_REPLACEMENTS).reduce(
    (normalizedKey, [legacyText, correctedText]) => normalizedKey.split(legacyText).join(correctedText),
    canonicalKey,
  );
}

function formatFallbackItemName(canonicalKey: string): string {
  return canonicalKey
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function getSnapshotSavedAt(snapshot: MasterySnapshot): string {
  return snapshot.savedAt ?? snapshot.createdAt;
}

function getTimestamp(snapshot: MasterySnapshot): number {
  const timestamp = Date.parse(getSnapshotSavedAt(snapshot));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getElapsedDays(fromTimestamp: number, toTimestamp: number): number | null {
  const elapsedDays = (toTimestamp - fromTimestamp) / DAY_IN_MS;
  return elapsedDays > 0 ? elapsedDays : null;
}

function getRate(delta: number, elapsedDays: number | null): number | null {
  return elapsedDays && elapsedDays > 0 ? delta / elapsedDays : null;
}

function getPercentGain(delta: number, baseline: number): number | null {
  if (baseline <= 0) {
    return null;
  }

  return (delta / baseline) * 100;
}

function getNextThreshold(value: number): ThresholdDefinition | null {
  return THRESHOLDS.find((threshold) => value < threshold.threshold) ?? null;
}

function getPercentToThreshold(value: number): number {
  const nextThreshold = getNextThreshold(value);

  if (!nextThreshold) {
    return 100;
  }

  return Math.max(0, Math.min(100, (value / nextThreshold.threshold) * 100));
}

function buildOrderedSnapshots(snapshots: MasterySnapshot[]): MasterySnapshot[] {
  return [...snapshots].sort((left, right) => {
    const savedAtComparison = getSnapshotSavedAt(left).localeCompare(getSnapshotSavedAt(right));

    if (savedAtComparison !== 0) {
      return savedAtComparison;
    }

    return left.snapshotId.localeCompare(right.snapshotId);
  });
}

function buildDisplayNames(snapshots: MasterySnapshot[]): Map<string, string> {
  const displayNames = new Map<string, string>();

  for (const snapshot of snapshots) {
    for (const row of snapshot.parsedRows ?? []) {
      const comparisonKey = normalizeLegacyComparisonKey(row.canonicalKey);
      const displayName = normalizeLegacyComparisonKey(row.rawItemName);

      if (!displayNames.has(comparisonKey)) {
        displayNames.set(comparisonKey, displayName);
      }
    }

    for (const canonicalKey of Object.keys(snapshot.masteryByItem)) {
      const comparisonKey = normalizeLegacyComparisonKey(canonicalKey);

      if (!displayNames.has(comparisonKey)) {
        displayNames.set(comparisonKey, formatFallbackItemName(comparisonKey));
      }
    }
  }

  return displayNames;
}

function buildMasteryByComparisonKey(snapshot: MasterySnapshot): Record<string, number> {
  const masteryByComparisonKey: Record<string, number> = {};

  for (const [canonicalKey, mastery] of Object.entries(snapshot.masteryByItem)) {
    const comparisonKey = normalizeLegacyComparisonKey(canonicalKey);
    masteryByComparisonKey[comparisonKey] = Math.max(masteryByComparisonKey[comparisonKey] ?? 0, mastery);
  }

  return masteryByComparisonKey;
}

function getThresholdCrossings(
  previousValue: number,
  nextValue: number,
  snapshot: MasterySnapshot,
): SnapshotHistoryThresholdCrossing[] {
  if (nextValue <= previousValue) {
    return [];
  }

  return THRESHOLDS.filter(
    (threshold) => previousValue < threshold.threshold && nextValue >= threshold.threshold,
  ).map((threshold) => ({
    threshold: threshold.threshold,
    label: threshold.label,
    snapshotId: snapshot.snapshotId,
    savedAt: getSnapshotSavedAt(snapshot),
  }));
}

function compareByNullableDesc(
  getValue: (row: SnapshotHistoryItemRow) => number | null,
): (left: SnapshotHistoryItemRow, right: SnapshotHistoryItemRow) => number {
  return (left, right) => {
    const leftValue = getValue(left);
    const rightValue = getValue(right);

    if (leftValue === null && rightValue === null) {
      return left.itemName.localeCompare(right.itemName);
    }

    if (leftValue === null) {
      return 1;
    }

    if (rightValue === null) {
      return -1;
    }

    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }

    return left.itemName.localeCompare(right.itemName);
  };
}

function takeKeys(rows: SnapshotHistoryItemRow[], limit = DEFAULT_ITEM_LIMIT): string[] {
  return rows.slice(0, limit).map((row) => row.canonicalKey);
}

function countTrailingPositiveIntervals(row: SnapshotHistoryItemRow): number {
  let count = 0;

  for (let index = row.points.length - 1; index >= 1; index -= 1) {
    if (row.points[index]?.delta > 0) {
      count += 1;
      continue;
    }

    break;
  }

  return count;
}

function buildSuggestionSets(
  rows: SnapshotHistoryItemRow[],
  towerNeededCanonicalKeys: Set<string>,
): Record<string, Set<string>> {
  const positiveRecentGainers = rows.filter((row) => row.recentDelta > 0);
  const fastestRecent = takeKeys(
    [...positiveRecentGainers].sort(compareByNullableDesc((row) => row.recentGainPerDay ?? row.recentDelta)),
  );
  const biggestPercentGain = takeKeys(
    rows
      .filter((row) => row.percentGain !== null && row.percentGain > 0)
      .sort(compareByNullableDesc((row) => row.percentGain)),
  );
  const recentThresholds = takeKeys(
    rows
      .filter((row) => row.latestThresholdCrossings.length > 0)
      .sort((left, right) => right.latestThresholdCrossings.length - left.latestThresholdCrossings.length),
  );
  const closestThreshold = takeKeys(
    rows
      .filter((row) => row.remainingToNextThreshold !== null && row.remainingToNextThreshold > 0)
      .sort((left, right) => {
        const remainingDifference =
          (left.remainingToNextThreshold ?? Number.POSITIVE_INFINITY) -
          (right.remainingToNextThreshold ?? Number.POSITIVE_INFINITY);

        if (remainingDifference !== 0) {
          return remainingDifference;
        }

        return right.latestPercentToNextThreshold - left.latestPercentToNextThreshold;
      }),
  );
  const towerNeeded = takeKeys(
    rows
      .filter((row) => towerNeededCanonicalKeys.has(row.canonicalKey))
      .sort((left, right) => {
        const leftRemaining = left.remainingToNextThreshold ?? Number.POSITIVE_INFINITY;
        const rightRemaining = right.remainingToNextThreshold ?? Number.POSITIVE_INFINITY;

        if (leftRemaining !== rightRemaining) {
          return leftRemaining - rightRemaining;
        }

        return left.itemName.localeCompare(right.itemName);
      }),
  );
  const breakouts = takeKeys(
    rows
      .filter((row) => {
        const previousPoint = row.points[row.points.length - 2];
        return previousPoint && previousPoint.value === 0 && row.latestValue > 0;
      })
      .sort(compareByNullableDesc((row) => row.recentGainPerDay ?? row.recentDelta)),
  );
  const streakMovers = takeKeys(
    rows
      .filter((row) => countTrailingPositiveIntervals(row) >= 2)
      .sort((left, right) => {
        const countDifference = countTrailingPositiveIntervals(right) - countTrailingPositiveIntervals(left);

        if (countDifference !== 0) {
          return countDifference;
        }

        return (right.recentGainPerDay ?? 0) - (left.recentGainPerDay ?? 0);
      }),
  );

  return {
    fastestRecent: new Set(fastestRecent),
    biggestPercentGain: new Set(biggestPercentGain),
    recentThresholds: new Set(recentThresholds),
    closestThreshold: new Set(closestThreshold),
    towerNeeded: new Set(towerNeeded),
    breakouts: new Set(breakouts),
    streakMovers: new Set(streakMovers),
  };
}

function addSuggestionReasons(
  row: SnapshotHistoryItemRow,
  suggestionSets: Record<string, Set<string>>,
): SnapshotHistoryItemRow {
  const reasons: string[] = [];

  if (suggestionSets.fastestRecent.has(row.canonicalKey)) {
    reasons.push('Fast gainer');
  }

  if (suggestionSets.recentThresholds.has(row.canonicalKey)) {
    reasons.push('New threshold');
  }

  if (suggestionSets.closestThreshold.has(row.canonicalKey) && row.nextThresholdLabel) {
    reasons.push(`Close to ${row.nextThresholdLabel}`);
  }

  if (suggestionSets.towerNeeded.has(row.canonicalKey)) {
    reasons.push('Tower');
  }

  if (suggestionSets.biggestPercentGain.has(row.canonicalKey)) {
    reasons.push('Big % gain');
  }

  if (suggestionSets.breakouts.has(row.canonicalKey)) {
    reasons.push('Breakout');
  }

  if (suggestionSets.streakMovers.has(row.canonicalKey)) {
    reasons.push('Streak');
  }

  return {
    ...row,
    suggestionReasons: reasons,
  };
}

function buildSuggestionBuckets(suggestionSets: Record<string, Set<string>>): SnapshotHistorySuggestionBucket[] {
  return [
    {
      id: 'fastest_recent_gainers',
      label: 'Fastest recent gainers',
      itemKeys: [...suggestionSets.fastestRecent],
    },
    {
      id: 'recent_thresholds',
      label: 'Recently reached thresholds',
      itemKeys: [...suggestionSets.recentThresholds],
    },
    {
      id: 'closest_threshold',
      label: 'Closest to next threshold',
      itemKeys: [...suggestionSets.closestThreshold],
    },
    {
      id: 'tower_needed',
      label: 'Needed for Tower',
      itemKeys: [...suggestionSets.towerNeeded],
    },
    {
      id: 'biggest_percent_gain',
      label: 'Biggest percent gain',
      itemKeys: [...suggestionSets.biggestPercentGain],
    },
    {
      id: 'breakouts',
      label: 'Newly moving from zero',
      itemKeys: [...suggestionSets.breakouts],
    },
    {
      id: 'streak_movers',
      label: 'Longest active streaks',
      itemKeys: [...suggestionSets.streakMovers],
    },
  ];
}

function formatCalloutDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function formatElapsedDays(value: number | null): string {
  if (value === null) {
    return 'Same saved time';
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} days`;
}
function formatCompactNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function buildCallouts(
  snapshotPoints: SnapshotHistoryTimelinePoint[],
  itemRows: SnapshotHistoryItemRow[],
): SnapshotHistoryCallout[] {
  if (snapshotPoints.length < 2) {
    return [];
  }

  const bestInterval = [...snapshotPoints]
    .slice(1)
    .filter((point) => point.masteryPerDay !== null)
    .sort((left, right) => (right.masteryPerDay ?? 0) - (left.masteryPerDay ?? 0))[0];
  const topRecentItem = [...itemRows]
    .filter((row) => row.recentDelta > 0)
    .sort(compareByNullableDesc((row) => row.recentGainPerDay ?? row.recentDelta))[0];
  const recentThresholdRows = itemRows.filter((row) => row.latestThresholdCrossings.length > 0);
  const streakItem = [...itemRows]
    .filter((row) => countTrailingPositiveIntervals(row) >= 2)
    .sort((left, right) => countTrailingPositiveIntervals(right) - countTrailingPositiveIntervals(left))[0];
  const callouts: SnapshotHistoryCallout[] = [];

  if (bestInterval?.masteryPerDay !== null && bestInterval?.masteryPerDay !== undefined) {
    const bestIntervalIndex = snapshotPoints.findIndex((point) => point.snapshotId === bestInterval.snapshotId);
    const previousPoint = snapshotPoints[bestIntervalIndex - 1];

    callouts.push({
      id: 'best_interval',
      title: 'Best interval',
      value: `${formatCompactNumber(bestInterval.masteryPerDay)} / day`,
      detail: `${formatCompactNumber(bestInterval.totalDelta)} mastery gained by ${new Date(
        bestInterval.savedAt,
      ).toLocaleDateString()}.`,
      evidence: [
        {
          label: 'Snapshot range',
          value: previousPoint
            ? `${formatCalloutDate(previousPoint.savedAt)} to ${formatCalloutDate(bestInterval.savedAt)}`
            : formatCalloutDate(bestInterval.savedAt),
        },
        { label: 'Mastery gained', value: formatCompactNumber(bestInterval.totalDelta) },
        { label: 'Elapsed time', value: formatElapsedDays(bestInterval.elapsedDays) },
        { label: 'Average rate', value: `${formatCompactNumber(bestInterval.masteryPerDay)} / day` },
      ],
    });
  }

  if (topRecentItem) {
    const latestPoint = topRecentItem.points[topRecentItem.points.length - 1];
    const previousPoint =
      topRecentItem.points[topRecentItem.points.length - 2];

    callouts.push({
      id: 'fastest_recent_item',
      title: 'Fastest recent item',
      value: topRecentItem.itemName,
      detail: `${formatCompactNumber(topRecentItem.recentDelta)} gained in the latest interval.`,
      evidence: [
        {
          label: 'Item',
          value: `${formatCompactNumber(topRecentItem.recentDelta)} gained`,
          canonicalKey: topRecentItem.canonicalKey,
          itemName: topRecentItem.itemName,
        },
        {
          label: 'Snapshot range',
          value: previousPoint && latestPoint
            ? `${formatCalloutDate(previousPoint.savedAt)} to ${formatCalloutDate(latestPoint.savedAt)}`
            : 'Latest interval',
        },
        { label: 'Before', value: formatCompactNumber(previousPoint?.value ?? topRecentItem.firstValue) },
        { label: 'After', value: formatCompactNumber(latestPoint?.value ?? topRecentItem.latestValue) },
        {
          label: 'Average rate',
          value: topRecentItem.recentGainPerDay === null
            ? 'n/a'
            : `${formatCompactNumber(topRecentItem.recentGainPerDay)} / day`,
        },
      ],
    });
  }

  if (recentThresholdRows.length > 0) {
    callouts.push({
      id: 'recent_thresholds',
      title: 'Recent thresholds',
      value: recentThresholdRows.length.toLocaleString(),
      detail: 'Items crossed a mastery threshold in the latest interval.',
      evidence: recentThresholdRows.flatMap((row) =>
        row.latestThresholdCrossings.map((crossing) => ({
          label: `${crossing.label} reached`,
          value: formatCalloutDate(crossing.savedAt),
          canonicalKey: row.canonicalKey,
          itemName: row.itemName,
        }))),
    });
  }

  if (streakItem) {
    const positiveIntervalCount = countTrailingPositiveIntervals(streakItem);
    const startPoint = streakItem.points[Math.max(0, streakItem.points.length - positiveIntervalCount - 1)];
    const latestPoint = streakItem.points[streakItem.points.length - 1];
    const elapsedDays = startPoint && latestPoint
      ? getElapsedDays(new Date(startPoint.savedAt).getTime(), new Date(latestPoint.savedAt).getTime())
      : null;

    callouts.push({
      id: 'longest_active_streak',
      title: 'Longest active streak',
      value: streakItem.itemName,
      detail: `${positiveIntervalCount.toLocaleString()} positive intervals in a row.`,
      evidence: [
        {
          label: 'Item',
          value: `${positiveIntervalCount.toLocaleString()} positive intervals`,
          canonicalKey: streakItem.canonicalKey,
          itemName: streakItem.itemName,
        },
        {
          label: 'Active range',
          value: startPoint && latestPoint
            ? `${formatCalloutDate(startPoint.savedAt)} to ${formatCalloutDate(latestPoint.savedAt)}`
            : 'Current snapshot history',
        },
        { label: 'Elapsed time', value: formatElapsedDays(elapsedDays) },
        { label: 'Started at', value: formatCompactNumber(startPoint?.value ?? streakItem.firstValue) },
        { label: 'Current mastery', value: formatCompactNumber(latestPoint?.value ?? streakItem.latestValue) },
      ],
    });
  }

  return callouts;
}

export function isSnapshotHistoryMegaMastered(row: SnapshotHistoryItemRow): boolean {
  return row.latestValue >= MEGA_MASTERED_THRESHOLD;
}

export function filterSnapshotHistoryAnalyticsItems(
  analytics: SnapshotHistoryAnalytics,
  options: { showMegaMasteredItems: boolean },
): SnapshotHistoryAnalytics {
  if (options.showMegaMasteredItems) {
    return analytics;
  }

  const itemRows = analytics.itemRows.filter((row) => !isSnapshotHistoryMegaMastered(row));
  const includedKeys = new Set(itemRows.map((row) => row.canonicalKey));

  return {
    ...analytics,
    itemRows,
    defaultSelectedCanonicalKeys: analytics.defaultSelectedCanonicalKeys.filter((canonicalKey) =>
      includedKeys.has(canonicalKey),
    ),
    suggestionBuckets: analytics.suggestionBuckets.map((bucket) => ({
      ...bucket,
      itemKeys: bucket.itemKeys.filter((canonicalKey) => includedKeys.has(canonicalKey)),
    })),
    milestoneCallouts: buildCallouts(analytics.snapshotPoints, itemRows),
  };
}

export function deriveSnapshotHistoryAnalytics(
  snapshots: MasterySnapshot[],
  options: { towerNeededCanonicalKeys?: Iterable<string> } = {},
): SnapshotHistoryAnalytics {
  const orderedSnapshots = buildOrderedSnapshots(snapshots);
  const displayNames = buildDisplayNames(orderedSnapshots);
  const masteryBySnapshot = orderedSnapshots.map(buildMasteryByComparisonKey);
  const allKeys = new Set(masteryBySnapshot.flatMap((masteryByItem) => Object.keys(masteryByItem)));
  const snapshotPoints = orderedSnapshots.map((snapshot, index) => {
    const timestamp = getTimestamp(snapshot);
    const previousSnapshot = orderedSnapshots[index - 1];
    const previousTimestamp = previousSnapshot ? getTimestamp(previousSnapshot) : timestamp;
    const totalMastery = Object.values(masteryBySnapshot[index] ?? {}).reduce((sum, value) => sum + value, 0);
    const previousTotalMastery =
      index > 0 ? Object.values(masteryBySnapshot[index - 1] ?? {}).reduce((sum, value) => sum + value, 0) : totalMastery;
    const totalDelta = index > 0 ? totalMastery - previousTotalMastery : 0;
    const elapsedDays = index > 0 ? getElapsedDays(previousTimestamp, timestamp) : null;

    return {
      snapshotId: snapshot.snapshotId,
      savedAt: getSnapshotSavedAt(snapshot),
      timestamp,
      itemCount: snapshot.parseSummary.itemsParsed,
      totalMastery,
      totalDelta,
      elapsedDays,
      masteryPerDay: index > 0 ? getRate(totalDelta, elapsedDays) : null,
      percentGainPerDay:
        index > 0 && previousTotalMastery > 0 && elapsedDays
          ? (getPercentGain(totalDelta, previousTotalMastery) ?? 0) / elapsedDays
          : null,
    } satisfies SnapshotHistoryTimelinePoint;
  });

  const itemSeeds: ItemSeed[] = [...allKeys].map((canonicalKey) => {
    const points: SnapshotHistoryItemPoint[] = [];
    const crossedThresholds: SnapshotHistoryThresholdCrossing[] = [];
    let latestThresholdCrossings: SnapshotHistoryThresholdCrossing[] = [];

    orderedSnapshots.forEach((snapshot, index) => {
      const timestamp = getTimestamp(snapshot);
      const previousSnapshot = orderedSnapshots[index - 1];
      const previousTimestamp = previousSnapshot ? getTimestamp(previousSnapshot) : timestamp;
      const value = masteryBySnapshot[index]?.[canonicalKey] ?? 0;
      const previousValue = index > 0 ? masteryBySnapshot[index - 1]?.[canonicalKey] ?? 0 : value;
      const delta = index > 0 ? value - previousValue : 0;
      const elapsedDays = index > 0 ? getElapsedDays(previousTimestamp, timestamp) : null;
      const thresholdCrossings = getThresholdCrossings(previousValue, value, snapshot);

      crossedThresholds.push(...thresholdCrossings);

      if (index === orderedSnapshots.length - 1) {
        latestThresholdCrossings = thresholdCrossings;
      }

      points.push({
        snapshotId: snapshot.snapshotId,
        savedAt: getSnapshotSavedAt(snapshot),
        timestamp,
        value,
        delta,
        elapsedDays,
        gainPerDay: index > 0 ? getRate(delta, elapsedDays) : null,
        percentToNextThreshold: getPercentToThreshold(value),
      });
    });

    return {
      canonicalKey,
      itemName: displayNames.get(canonicalKey) ?? formatFallbackItemName(canonicalKey),
      points,
      crossedThresholds,
      latestThresholdCrossings,
    };
  });

  const firstTimestamp = orderedSnapshots[0] ? getTimestamp(orderedSnapshots[0]) : 0;
  const latestTimestamp = orderedSnapshots[orderedSnapshots.length - 1]
    ? getTimestamp(orderedSnapshots[orderedSnapshots.length - 1])
    : firstTimestamp;
  const totalElapsedDays = getElapsedDays(firstTimestamp, latestTimestamp);
  const itemRowsWithoutReasons = itemSeeds
    .map((seed) => {
      const firstPoint = seed.points[0];
      const latestPoint = seed.points[seed.points.length - 1];
      const nextThreshold = latestPoint ? getNextThreshold(latestPoint.value) : null;
      const totalDelta = latestPoint && firstPoint ? latestPoint.value - firstPoint.value : 0;

      return {
        canonicalKey: seed.canonicalKey,
        itemName: seed.itemName,
        latestValue: latestPoint?.value ?? 0,
        firstValue: firstPoint?.value ?? 0,
        totalDelta,
        recentDelta: latestPoint?.delta ?? 0,
        totalGainPerDay: getRate(totalDelta, totalElapsedDays),
        recentGainPerDay: latestPoint?.gainPerDay ?? null,
        percentGain: firstPoint ? getPercentGain(totalDelta, firstPoint.value) : null,
        nextThreshold: nextThreshold?.threshold ?? null,
        nextThresholdLabel: nextThreshold?.label ?? null,
        remainingToNextThreshold: nextThreshold && latestPoint ? nextThreshold.threshold - latestPoint.value : null,
        latestPercentToNextThreshold: latestPoint?.percentToNextThreshold ?? 0,
        crossedThresholds: seed.crossedThresholds,
        latestThresholdCrossings: seed.latestThresholdCrossings,
        suggestionReasons: [],
        points: seed.points,
      } satisfies SnapshotHistoryItemRow;
    })
    .sort((left, right) => {
      const recentDifference = right.recentDelta - left.recentDelta;

      if (recentDifference !== 0) {
        return recentDifference;
      }

      return left.itemName.localeCompare(right.itemName);
    });
  const towerNeededCanonicalKeys = new Set(
    [...(options.towerNeededCanonicalKeys ?? [])].map(normalizeLegacyComparisonKey),
  );
  const suggestionSets = buildSuggestionSets(itemRowsWithoutReasons, towerNeededCanonicalKeys);
  const itemRows = itemRowsWithoutReasons.map((row) => addSuggestionReasons(row, suggestionSets));

  return {
    snapshotPoints,
    itemRows,
    defaultSelectedCanonicalKeys: [...suggestionSets.fastestRecent],
    suggestionBuckets: buildSuggestionBuckets(suggestionSets),
    milestoneCallouts: buildCallouts(snapshotPoints, itemRows),
  };
}
