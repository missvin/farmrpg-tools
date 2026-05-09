import { describe, expect, it } from 'vitest';

import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import {
  deriveConsumableAcquisitionEstimates,
  estimateManualExploreAcquisition,
} from './acquisitionEstimates';

describe('deriveConsumableAcquisitionEstimates', () => {
  it('estimates Lemonade and Arnold Palmer yield modifiers from saved assumptions', () => {
    const state = createDefaultAcquisitionPlannerInputState();

    state.consumables.lemonade = {
      ownedCount: 2,
      craftableNowCount: 1,
      futureCraftableCount: 1,
      lemonSqueezerActive: true,
      quandaryChowderActive: true,
    };
    state.consumables.arnoldPalmer = {
      ownedCount: 1,
      craftableNowCount: 1,
      futureCraftableCount: 1,
      lemonSqueezerActive: true,
      quandaryChowderActive: true,
      lemonSeltzerUsesRemaining: 2,
      lemonCreamPieActive: false,
    };

    const estimates = deriveConsumableAcquisitionEstimates(state);
    const lemonade = estimates.find((estimate) => estimate.sourceKey === 'lemonade');
    const arnoldPalmer = estimates.find((estimate) => estimate.sourceKey === 'arnold_palmer');

    expect(lemonade?.standardItemsPerUse).toBe(22);
    expect(lemonade?.totalItemCapacity).toBe(88);
    expect(arnoldPalmer?.standardItemsPerUse).toBe(550);
    expect(arnoldPalmer?.boostedItemsPerUse).toBe(825);
    expect(arnoldPalmer?.boostedUsesApplied).toBe(2);
    expect(arnoldPalmer?.totalItemCapacity).toBe(2200);
  });

  it('limits immediate Apple Cider use by available stamina when stamina is configured', () => {
    const state = createDefaultAcquisitionPlannerInputState();

    state.explore.availableStamina = 2500;
    state.explore.wandererPercent = 20;
    state.explore.cinnamonSticksActive = true;
    state.explore.exploringEffectivenessPercent = 10;
    state.consumables.appleCider = {
      ownedCount: 5,
      craftableNowCount: 0,
      futureCraftableCount: 1,
    };

    const cider = deriveConsumableAcquisitionEstimates(state).find(
      (estimate) => estimate.sourceKey === 'apple_cider',
    );

    expect(cider?.staminaPerUse).toBe(1111);
    expect(cider?.standardItemsPerUse).toBe(555);
    expect(cider?.immediateUses).toBe(2);
    expect(cider?.futureUses).toBe(1);
    expect(cider?.totalItemCapacity).toBe(1665);
  });
});

describe('estimateManualExploreAcquisition', () => {
  it('returns a blocker when item-specific drop assumptions are missing', () => {
    const estimate = estimateManualExploreAcquisition({
      itemName: 'Green Dye',
      requiredItemCount: 100,
      dropRatePercent: 0,
      itemsPerDrop: 1,
      availableStamina: 0,
      wandererPercent: 0,
    });

    expect(estimate.calculable).toBe(false);
    expect(estimate.blockerReason).toContain('Enter a drop rate');
    expect(estimate.remainingAfterAvailableStamina).toBe(100);
  });

  it('estimates explores and stamina from user-entered expected value assumptions', () => {
    const estimate = estimateManualExploreAcquisition({
      itemName: 'Green Dye',
      requiredItemCount: 75,
      dropRatePercent: 25,
      itemsPerDrop: 1,
      availableStamina: 240,
      wandererPercent: 20,
    });

    expect(estimate.calculable).toBe(true);
    expect(estimate.expectedItemsPerExplore).toBe(0.25);
    expect(estimate.exploresNeeded).toBe(300);
    expect(estimate.staminaNeeded).toBe(240);
    expect(estimate.coveredByAvailableStamina).toBe(75);
    expect(estimate.remainingAfterAvailableStamina).toBe(0);
  });
});
