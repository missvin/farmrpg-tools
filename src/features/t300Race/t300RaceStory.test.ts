import { describe, expect, it } from 'vitest';

import {
  buildForecastHistory,
  buildRaceMetrics,
  buildStoryCsv,
  getConsolidatedFinalistSeries,
  getRequirementStateAt,
  t300StoryData,
} from './t300RaceStory';

describe('T300 race story derivation', () => {
  it('loads the reviewed campaign invariants', () => {
    expect(t300StoryData.summary).toMatchObject({
      requirementCount: 169,
      startMmCount: 147,
      startingGapCount: 22,
      latestMmCount: 166,
      observedCompletionCount: 19,
      remainingCount: 3,
      matchedRequirementCount: 169,
    });
    expect(t300StoryData.requirements.filter((row) => row.masteryAtLatest < 1_000_000).map((row) => row.itemName).sort())
      .toEqual(['Red Trunk', 'Water Lily', 'Wizard Hat']);
  });

  it('collapses near-duplicate finalist observations before pace calculations', () => {
    expect(t300StoryData.finalistSeries).toHaveLength(33);
    expect(getConsolidatedFinalistSeries(t300StoryData.finalistSeries)).toHaveLength(29);
  });

  it('matches the latest reviewed pace tracker', () => {
    const metrics = buildRaceMetrics(t300StoryData);

    expect(metrics.map((metric) => Math.round(metric.pacePerDay ?? 0))).toEqual([17759, 11076, 7713]);
    expect(metrics.find((metric) => metric.canonicalKey === 'red trunk')?.paceRatio).toBeGreaterThan(2.8);
    expect(metrics.find((metric) => metric.canonicalKey === 'water lily')?.paceRatio).toBeGreaterThan(1);
    expect(metrics.find((metric) => metric.canonicalKey === 'wizard hat')?.paceRatio).toBeLessThan(0.5);
  });

  it('builds forecast history only after meaningful positive windows exist', () => {
    const forecast = buildForecastHistory(t300StoryData, 'red trunk');

    expect(forecast.length).toBeGreaterThan(0);
    expect(forecast.every((point) => Number.isFinite(point.daysFromDeadline))).toBe(true);
  });

  it('changes requirement status only at observed completion checkpoints', () => {
    const wrench = t300StoryData.requirements.find((row) => row.canonicalKey === 'wrench');
    expect(wrench).toBeDefined();
    expect(getRequirementStateAt(wrench!, wrench!.previousObservedAt!)).toBe('remaining');
    expect(getRequirementStateAt(wrench!, wrench!.firstObservedMmAt!)).toBe('completed');
  });

  it('exports all public story record types without private backup fields', () => {
    const csv = buildStoryCsv(t300StoryData);

    expect(csv).toContain('requirement');
    expect(csv).toContain('campaign_snapshot');
    expect(csv).toContain('finalist_checkpoint');
    expect(csv).not.toContain('rawText');
    expect(csv).not.toContain('profileId');
  });
});
