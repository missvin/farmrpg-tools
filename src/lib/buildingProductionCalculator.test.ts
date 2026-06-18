import { describe, expect, it } from 'vitest';

import { deriveAvailableSupplyPool } from './availableSupply';
import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { deriveItemGoalBuildingSources } from './buildingProductionCalculator';
import { createDefaultBuildingProductionState } from './buildingProductionState';
import type { BuildingProductionReferenceData } from './loadBuildingProductionReference';

const REFERENCE: BuildingProductionReferenceData = {
  productions: [
    {
      productionKey: 'sugar_cane_mill_unrefined_sugar',
      buildingName: 'Sugar Cane Mill',
      outputItemName: 'Unrefined Sugar',
      outputCanonicalKey: 'unrefined sugar',
      outputQuantity: 1,
      processingMinutes: 1,
      perkGroup: 'sugar_cane_mill',
      evidence: 'user_confirmed',
      notes: [],
      inputs: [
        { itemName: 'Sugar Cane', canonicalKey: 'sugar cane', quantity: 7 },
        { itemName: 'Machine Press', canonicalKey: 'machine press', quantity: 1 },
      ],
    },
    {
      productionKey: 'sawmill_pine_board',
      buildingName: 'Sawmill',
      outputItemName: 'Pine Board',
      outputCanonicalKey: 'pine board',
      outputQuantity: 4.8,
      processingMinutes: 4.8,
      perkGroup: 'sawmill',
      evidence: 'user_confirmed',
      notes: [],
      inputs: [{ itemName: 'Pine Tree', canonicalKey: 'pine tree', quantity: 1 }],
    },
  ],
  conversions: [
    {
      conversionKey: 'sugar_cane_mill_molasses',
      buildingOutputItemName: 'Unrefined Sugar',
      buildingOutputCanonicalKey: 'unrefined sugar',
      finalItemName: 'Molasses',
      finalCanonicalKey: 'molasses',
      buildingOutputQuantity: 3,
      finalOutputQuantity: 1,
      secondaryInputs: [{ itemName: 'Glass Jar', canonicalKey: 'glass jar', quantity: 1 }],
      evidence: 'user_confirmed',
      notes: [],
    },
  ],
  byOutputCanonicalKey: {},
  conversionsByFinalCanonicalKey: {},
};
REFERENCE.byOutputCanonicalKey = {
  'unrefined sugar': [REFERENCE.productions[0]],
  'pine board': [REFERENCE.productions[1]],
};
REFERENCE.conversionsByFinalCanonicalKey = {
  molasses: [REFERENCE.conversions[0]],
};

function createSupplyPool(entries: { canonicalItemKey: string; itemName: string; inventoryCount: number }[]) {
  return deriveAvailableSupplyPool({
    acquisitionState: {
      ...createDefaultAcquisitionPlannerInputState(),
      inventory: { entries },
    },
  });
}

describe('deriveItemGoalBuildingSources', () => {
  it('estimates Sugar Cane Mill inputs and processing time for Molasses conversions with boosts', () => {
    const state = {
      ...createDefaultBuildingProductionState(),
      perkSettings: {
        sugarBoostI: true,
        sugarBoostII: true,
        pineBoost: false,
      },
      queuedOutputByCanonicalKey: {
        'unrefined sugar': 100,
      },
    };

    const sources = deriveItemGoalBuildingSources({
      targetCanonicalKey: 'molasses',
      targetItemName: 'Molasses',
      targetRemainingQuantity: 500,
      buildingProductionReference: REFERENCE,
      buildingProductionState: state,
      supplyPool: createSupplyPool([
        { canonicalItemKey: 'unrefined sugar', itemName: 'Unrefined Sugar', inventoryCount: 200 },
        { canonicalItemKey: 'glass jar', itemName: 'Glass Jar', inventoryCount: 450 },
      ]),
    });

    expect(sources[0]).toMatchObject({
      role: 'conversion',
      buildingName: 'Sugar Cane Mill',
      requiredBuildingOutputQuantity: 1500,
      availableBuildingOutputQuantity: 200,
      queuedOutputQuantity: 100,
      remainingBuildingOutputQuantity: 1200,
      batchesRequired: 600,
      processingMinutes: 300,
      perksApplied: ['Sugar Boost I', 'Sugar Boost II'],
    });
    expect(sources[0].inputRequirements).toEqual([
      { itemName: 'Sugar Cane', canonicalKey: 'sugar cane', requiredQuantity: 4200, availableQuantity: 0, remainingQuantity: 4200 },
      { itemName: 'Machine Press', canonicalKey: 'machine press', requiredQuantity: 600, availableQuantity: 0, remainingQuantity: 600 },
    ]);
    expect(sources[0].secondaryRequirements[0]).toMatchObject({
      itemName: 'Glass Jar',
      requiredQuantity: 500,
      availableQuantity: 450,
      remainingQuantity: 50,
    });
  });

  it('estimates Sawmill Pine Board time with Pine Boost', () => {
    const state = {
      ...createDefaultBuildingProductionState(),
      perkSettings: {
        sugarBoostI: false,
        sugarBoostII: false,
        pineBoost: true,
      },
    };

    const sources = deriveItemGoalBuildingSources({
      targetCanonicalKey: 'pine board',
      targetItemName: 'Pine Board',
      targetRemainingQuantity: 100,
      buildingProductionReference: REFERENCE,
      buildingProductionState: state,
      supplyPool: createSupplyPool([]),
    });

    expect(sources[0]).toMatchObject({
      buildingName: 'Sawmill',
      remainingBuildingOutputQuantity: 100,
      batchesRequired: 21,
      effectiveOutputPerBatch: 4.8,
      processingMinutes: 50.4,
    });
    expect(sources[0].inputRequirements[0]).toMatchObject({
      itemName: 'Pine Tree',
      requiredQuantity: 21,
    });
  });
});
