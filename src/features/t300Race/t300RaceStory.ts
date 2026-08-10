import generatedStoryData from './generatedStoryData.json';

export const T300_TARGET = 1_000_000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const STORY_TIME_ZONE = 'America/Los_Angeles';

export type T300RequirementStory = {
  towerLevel: number;
  slotIndex: number;
  itemName: string;
  canonicalKey: string;
  masteryAtStart: number;
  masteryAtLatest: number;
  completedBeforeTracking: boolean;
  firstObservedMmAt: string | null;
  previousObservedAt: string | null;
};

export type T300CampaignSnapshot = {
  observedAt: string;
  mmCount: number;
};

export type T300Finalist = {
  canonicalKey: string;
  itemName: string;
  towerLevel: number;
};

export type T300FinalistCheckpoint = {
  observedAt: string;
  source: 'backup' | 'chat' | 'backup+chat';
  approximate: boolean;
  values: Record<string, number>;
};

export type T300StoryData = {
  schemaVersion: 1;
  title: string;
  profileLabel: string;
  trackingStartedAt: string;
  deadlineAt: string;
  generatedAt: string;
  summary: {
    requirementCount: number;
    startMmCount: number;
    startingGapCount: number;
    latestMmCount: number;
    observedCompletionCount: number;
    remainingCount: number;
    rawBackupSnapshotCount: number;
    campaignSnapshotCount: number;
    matchedRequirementCount: number;
  };
  requirements: T300RequirementStory[];
  campaignSnapshots: T300CampaignSnapshot[];
  finalists: T300Finalist[];
  finalistSeries: T300FinalistCheckpoint[];
  warnings: string[];
};

export type T300RaceMetric = {
  canonicalKey: string;
  itemName: string;
  color: string;
  latestMastery: number;
  remaining: number;
  pacePerDay: number | null;
  requiredPerDay: number;
  paceRatio: number | null;
  projectedFinishAt: string | null;
};

export type T300ForecastPoint = {
  observedAt: string;
  projectedFinishAt: string;
  daysFromDeadline: number;
};

export type T300ProgressInterval = {
  startedAt: string;
  endedAt: string;
  gain: number;
  perDay: number;
  approximate: boolean;
};

export const FINALIST_COLORS: Record<string, string> = {
  'red trunk': '#ff5d5d',
  'water lily': '#42d6c3',
  'wizard hat': '#b88cff',
};

export const t300StoryData = generatedStoryData as T300StoryData;

export function getCompletionColor(requirement: T300RequirementStory): string {
  if (requirement.completedBeforeTracking) {
    return '#667085';
  }
  if (!requirement.firstObservedMmAt) {
    return FINALIST_COLORS[requirement.canonicalKey] ?? '#f6f1df';
  }

  const month = new Date(requirement.firstObservedMmAt).getUTCMonth();
  if (month <= 2) return '#35b9a8';
  if (month === 4) return '#efc45b';
  if (month === 5) return '#61a8ff';
  if (month === 6) return '#ff8a5b';
  return '#d977d8';
}

export function formatStoryDate(value: string, includeYear = false): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: STORY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(new Date(value));
}

export function formatStoryDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: STORY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function getConsolidatedFinalistSeries(
  series: T300FinalistCheckpoint[],
): T300FinalistCheckpoint[] {
  const sorted = [...series].sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
  const consolidated: T300FinalistCheckpoint[] = [];

  for (const checkpoint of sorted) {
    const previous = consolidated[consolidated.length - 1];
    const sameValues = previous
      && Object.keys(FINALIST_COLORS).every((key) => previous.values[key] === checkpoint.values[key]);
    const withinOneHour = previous
      && Date.parse(checkpoint.observedAt) - Date.parse(previous.observedAt) <= 60 * 60 * 1000;

    if (sameValues && withinOneHour) {
      consolidated[consolidated.length - 1] = {
        ...checkpoint,
        source: previous.source === checkpoint.source ? checkpoint.source : 'backup+chat',
      };
    } else {
      consolidated.push(checkpoint);
    }
  }

  return consolidated;
}

export function getRollingSlope(
  series: T300FinalistCheckpoint[],
  canonicalKey: string,
  endIndex: number,
  minimumPoints = 3,
): number | null {
  const current = series[endIndex];
  if (!current) {
    return null;
  }

  const currentAt = Date.parse(current.observedAt);
  const window = series
    .slice(0, endIndex + 1)
    .filter((point) => currentAt - Date.parse(point.observedAt) <= 30 * DAY_MS);
  if (window.length < minimumPoints) {
    return null;
  }

  const firstAt = Date.parse(window[0].observedAt);
  const points = window.map((point) => ({
    x: (Date.parse(point.observedAt) - firstAt) / DAY_MS,
    y: point.values[canonicalKey] ?? 0,
  }));
  const meanX = points.reduce((total, point) => total + point.x, 0) / points.length;
  const meanY = points.reduce((total, point) => total + point.y, 0) / points.length;
  const denominator = points.reduce((total, point) => total + (point.x - meanX) ** 2, 0);

  if (denominator === 0) {
    return null;
  }

  const slope = points.reduce(
    (total, point) => total + (point.x - meanX) * (point.y - meanY),
    0,
  ) / denominator;
  return Number.isFinite(slope) && slope > 0 ? slope : null;
}

export function buildRaceMetrics(story: T300StoryData): T300RaceMetric[] {
  const series = getConsolidatedFinalistSeries(story.finalistSeries);
  const latest = series[series.length - 1];
  if (!latest) {
    return [];
  }

  const latestAt = Date.parse(latest.observedAt);
  const deadlineAt = Date.parse(story.deadlineAt);
  const daysToDeadline = Math.max((deadlineAt - latestAt) / DAY_MS, 0.0001);

  return story.finalists.map((finalist) => {
    const latestMastery = latest.values[finalist.canonicalKey] ?? 0;
    const remaining = Math.max(0, T300_TARGET - latestMastery);
    const pacePerDay = getRollingSlope(series, finalist.canonicalKey, series.length - 1);
    const requiredPerDay = remaining / daysToDeadline;
    const projectedFinishAt = pacePerDay
      ? new Date(latestAt + (remaining / pacePerDay) * DAY_MS).toISOString()
      : null;

    return {
      canonicalKey: finalist.canonicalKey,
      itemName: finalist.itemName,
      color: FINALIST_COLORS[finalist.canonicalKey] ?? '#ffffff',
      latestMastery,
      remaining,
      pacePerDay,
      requiredPerDay,
      paceRatio: pacePerDay ? pacePerDay / requiredPerDay : null,
      projectedFinishAt,
    };
  });
}

export function buildForecastHistory(
  story: T300StoryData,
  canonicalKey: string,
): T300ForecastPoint[] {
  const series = getConsolidatedFinalistSeries(story.finalistSeries);
  const deadlineAt = Date.parse(story.deadlineAt);

  return series.flatMap((checkpoint, index) => {
    const pace = getRollingSlope(series, canonicalKey, index);
    const mastery = checkpoint.values[canonicalKey] ?? 0;
    if (!pace || mastery >= T300_TARGET) {
      return [];
    }

    const projectedAt = Date.parse(checkpoint.observedAt) + ((T300_TARGET - mastery) / pace) * DAY_MS;
    return [{
      observedAt: checkpoint.observedAt,
      projectedFinishAt: new Date(projectedAt).toISOString(),
      daysFromDeadline: (projectedAt - deadlineAt) / DAY_MS,
    }];
  });
}

export function buildProgressIntervals(
  story: T300StoryData,
  canonicalKey: string,
): T300ProgressInterval[] {
  const series = getConsolidatedFinalistSeries(story.finalistSeries);

  return series.slice(1).map((checkpoint, index) => {
    const previous = series[index];
    const elapsedDays = Math.max((Date.parse(checkpoint.observedAt) - Date.parse(previous.observedAt)) / DAY_MS, 0.0001);
    const gain = (checkpoint.values[canonicalKey] ?? 0) - (previous.values[canonicalKey] ?? 0);

    return {
      startedAt: previous.observedAt,
      endedAt: checkpoint.observedAt,
      gain,
      perDay: gain / elapsedDays,
      approximate: checkpoint.approximate || previous.approximate,
    };
  });
}

export function getRequirementStateAt(
  requirement: T300RequirementStory,
  observedAt: string,
): 'foundation' | 'completed' | 'remaining' {
  if (requirement.completedBeforeTracking) {
    return 'foundation';
  }
  if (requirement.firstObservedMmAt && Date.parse(requirement.firstObservedMmAt) <= Date.parse(observedAt)) {
    return 'completed';
  }
  return 'remaining';
}

function escapeCsv(value: string | number | boolean | null): string {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

export function buildStoryCsv(story: T300StoryData): string {
  const rows: Array<Array<string | number | boolean | null>> = [[
    'record_type', 'observed_at', 'tower_level', 'slot_index', 'item_name', 'canonical_key',
    'mastery', 'mm_count', 'completed_before_tracking', 'first_observed_mm_at',
    'previous_observed_at', 'source', 'approximate',
  ]];

  for (const requirement of story.requirements) {
    rows.push([
      'requirement', null, requirement.towerLevel, requirement.slotIndex, requirement.itemName,
      requirement.canonicalKey, requirement.masteryAtLatest, null, requirement.completedBeforeTracking,
      requirement.firstObservedMmAt, requirement.previousObservedAt, null, false,
    ]);
  }
  for (const snapshot of story.campaignSnapshots) {
    rows.push(['campaign_snapshot', snapshot.observedAt, null, null, null, null, null, snapshot.mmCount, null, null, null, 'backup', false]);
  }
  for (const checkpoint of story.finalistSeries) {
    for (const finalist of story.finalists) {
      rows.push([
        'finalist_checkpoint', checkpoint.observedAt, finalist.towerLevel, null, finalist.itemName,
        finalist.canonicalKey, checkpoint.values[finalist.canonicalKey] ?? 0, null, null, null, null,
        checkpoint.source, checkpoint.approximate,
      ]);
    }
  }

  return `${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}\n`;
}
