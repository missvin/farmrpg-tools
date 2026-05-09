import { describe, expect, it } from 'vitest';

import {
  estimatePumpkinJuiceForTarget,
  getMasteryTierForTarget,
} from './pumpkinJuiceEstimator';

describe('estimatePumpkinJuiceForTarget', () => {
  it('returns zero Pumpkin Juice for already-complete targets', () => {
    expect(
      estimatePumpkinJuiceForTarget({
        itemName: 'Board',
        canonicalKey: 'board',
        currentMastery: 100_000,
        targetTier: 'GM',
        sourceScope: 'personal',
      }),
    ).toMatchObject({
      status: 'complete',
      totalPumpkinJuices: 0,
      nextPumpkinJuiceGain: null,
      projectedFinalMastery: 100_000,
    });
  });

  it('calculates repeated rounded ten-percent gains until the target is reached', () => {
    expect(
      estimatePumpkinJuiceForTarget({
        itemName: 'Gold Cucumber',
        canonicalKey: 'gold cucumber',
        currentMastery: 100_000,
        targetTier: 'MM',
        sourceScope: 'tower',
      }),
    ).toMatchObject({
      status: 'calculable',
      totalPumpkinJuices: 25,
      nextPumpkinJuiceGain: 10_000,
      projectedFinalMastery: 1_083_474,
    });
  });

  it('uses normal rounding for each Pumpkin Juice gain', () => {
    expect(
      estimatePumpkinJuiceForTarget({
        itemName: 'Spoon',
        canonicalKey: 'spoon',
        currentMastery: 17_744,
        targetTier: 'GM',
        sourceScope: 'personal',
      }),
    ).toMatchObject({
      status: 'calculable',
      nextPumpkinJuiceGain: 1_774,
      totalPumpkinJuices: 19,
      projectedFinalMastery: 108_527,
    });
  });

  it('blocks zero or too-low mastery that cannot gain progress', () => {
    expect(
      estimatePumpkinJuiceForTarget({
        itemName: 'Unknown',
        canonicalKey: 'unknown',
        currentMastery: 0,
        targetTier: 'M',
        sourceScope: 'personal',
      }),
    ).toMatchObject({
      status: 'needs_baseline',
      totalPumpkinJuices: null,
      nextPumpkinJuiceGain: null,
      projectedFinalMastery: null,
      blockerReason: 'Needs baseline mastery before Pumpkin Juice can add progress.',
    });

    expect(
      estimatePumpkinJuiceForTarget({
        itemName: 'Tiny Progress',
        canonicalKey: 'tiny progress',
        currentMastery: 4,
        targetTier: 'M',
        sourceScope: 'personal',
      }),
    ).toMatchObject({
      status: 'needs_baseline',
    });
  });

  it('matches the known low-mastery table shape at five mastery', () => {
    expect(
      estimatePumpkinJuiceForTarget({
        itemName: 'Very Low',
        canonicalKey: 'very low',
        currentMastery: 5,
        targetTier: 'MM',
        sourceScope: 'personal',
      }),
    ).toMatchObject({
      status: 'calculable',
      nextPumpkinJuiceGain: 1,
      totalPumpkinJuices: 126,
    });
  });
});

describe('getMasteryTierForTarget', () => {
  it('maps known mastery targets to tier labels', () => {
    expect(getMasteryTierForTarget(10_000)).toBe('M');
    expect(getMasteryTierForTarget(100_000)).toBe('GM');
    expect(getMasteryTierForTarget(1_000_000)).toBe('MM');
  });
});
