import { describe, expect, it } from 'vitest';

import { deriveConsumableAcquisitionEstimates } from './acquisitionEstimates';
import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { estimatePumpkinJuiceForTarget } from './pumpkinJuiceEstimator';
import {
  derivePumpkinJuiceValueEstimate,
  evaluatePumpkinJuiceValueThresholds,
} from './pumpkinJuiceValueModel';

describe('pumpkinJuiceValueModel', () => {
  it('derives Arnold Palmer and stamina value from saved acquisition estimate outputs', () => {
    const consumableEstimates = deriveConsumableAcquisitionEstimates(createDefaultAcquisitionPlannerInputState());
    const pumpkinJuiceEstimate = estimatePumpkinJuiceForTarget({
      itemName: 'Board',
      canonicalKey: 'board',
      currentMastery: 50_000,
      targetTier: 'GM',
      targetMastery: 100_000,
      sourceScope: 'personal',
    });

    const valueEstimate = derivePumpkinJuiceValueEstimate(pumpkinJuiceEstimate, consumableEstimates);

    expect(valueEstimate).toMatchObject({
      status: 'calculable',
      nextItemsSaved: 5_000,
      totalItemsSaved: 50_000,
      nextArnoldPalmersSaved: 25,
      totalArnoldPalmersSaved: 250,
      nextStaminaSaved: 12_500,
      totalStaminaSaved: 125_000,
    });
    expect(valueEstimate.assumptions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Arnold Palmer value uses 200 items per use'),
        expect.stringContaining('Stamina value uses 404 items and 1,010 stamina'),
      ]),
    );
  });

  it('keeps missing baseline values unknown and never highlights them', () => {
    const consumableEstimates = deriveConsumableAcquisitionEstimates(createDefaultAcquisitionPlannerInputState());
    const pumpkinJuiceEstimate = estimatePumpkinJuiceForTarget({
      itemName: 'Rare Thing',
      canonicalKey: 'rare thing',
      currentMastery: 0,
      targetTier: 'MM',
      targetMastery: 1_000_000,
      sourceScope: 'personal',
    });

    const valueEstimate = derivePumpkinJuiceValueEstimate(pumpkinJuiceEstimate, consumableEstimates);
    const thresholdResult = evaluatePumpkinJuiceValueThresholds(valueEstimate, {
      enabled: true,
      minNextApSaved: 1,
      minTotalApSaved: 1,
      minNextStaminaSaved: 1,
      minTotalStaminaSaved: 1,
    });

    expect(valueEstimate).toMatchObject({
      status: 'needs_baseline',
      nextItemsSaved: null,
      totalItemsSaved: null,
      nextArnoldPalmersSaved: null,
      totalArnoldPalmersSaved: null,
      nextStaminaSaved: null,
      totalStaminaSaved: null,
    });
    expect(thresholdResult).toEqual({ isHighlighted: false, reasons: [] });
  });

  it('returns threshold reasons for enabled high-value Pumpkin Juice saves', () => {
    const consumableEstimates = deriveConsumableAcquisitionEstimates(createDefaultAcquisitionPlannerInputState());
    const pumpkinJuiceEstimate = estimatePumpkinJuiceForTarget({
      itemName: 'Board',
      canonicalKey: 'board',
      currentMastery: 50_000,
      targetTier: 'GM',
      targetMastery: 100_000,
      sourceScope: 'personal',
    });
    const valueEstimate = derivePumpkinJuiceValueEstimate(pumpkinJuiceEstimate, consumableEstimates);

    expect(
      evaluatePumpkinJuiceValueThresholds(valueEstimate, {
        enabled: true,
        minNextApSaved: 25,
        minTotalApSaved: 0,
        minNextStaminaSaved: 15_000,
        minTotalStaminaSaved: 120_000,
      }),
    ).toEqual({
      isHighlighted: true,
      reasons: ['Next PJ saves about 25 Arnold Palmers.', 'Goal saves about 125,000 stamina.'],
    });
  });
});
