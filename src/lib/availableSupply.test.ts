import { describe, expect, it } from 'vitest';

import {
  createDefaultAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import { deriveAvailableSupplyPool } from './availableSupply';

function createSupplyState(): AcquisitionPlannerInputState {
  return {
    ...createDefaultAcquisitionPlannerInputState(),
    sourcePolicy: {
      planningHorizon: 'include_future',
      sourceOverrides: {
        ...createDefaultAcquisitionPlannerInputState().sourcePolicy.sourceOverrides,
        future_pet_production: 'force_included',
      },
    },
    ownedNow: {
      entries: [
        {
          canonicalItemKey: 'wood',
          itemName: 'Wood',
          ownedCount: 10,
          sourceCategory: 'stockpile',
        },
        {
          canonicalItemKey: 'wood',
          itemName: 'Wood',
          ownedCount: 5,
          sourceCategory: 'container',
        },
      ],
    },
    inventory: {
      entries: [
        {
          canonicalItemKey: 'wood',
          itemName: 'Wood',
          inventoryCount: 7,
        },
      ],
    },
    pets: {
      storedInventoryEntries: [
        {
          canonicalItemKey: 'wood',
          itemName: 'Wood',
          storedCount: 3,
        },
      ],
      futureProduction: {
        enabled: true,
        horizonDays: 1,
        entries: [
          {
            canonicalItemKey: 'wood',
            itemName: 'Wood',
            petName: 'Test Pet',
            petLevel: 6,
            seasonalActive: true,
          },
        ],
        respectSeasonality: true,
        offlineHoursCap: 24,
        crunchyOmeletteActive: false,
      },
    },
  };
}

describe('deriveAvailableSupplyPool', () => {
  it('aggregates enabled stockpile, container, current inventory, stored pet, and future pet supply by canonical item', () => {
    const pool = deriveAvailableSupplyPool({
      acquisitionState: createSupplyState(),
      petSourceReference: null,
    });

    expect(pool.byCanonicalKey.wood).toMatchObject({
      itemName: 'Wood',
      derivedQuantity: 37,
      effectiveQuantity: 37,
      overrideQuantity: null,
    });
    expect(pool.byCanonicalKey.wood.breakdowns.map((entry) => entry.sourceKey)).toEqual([
      'owned_stockpiles',
      'owned_containers',
      'current_inventory',
      'stored_pet_inventory',
      'future_pet_production',
    ]);
  });

  it('lets a manual override replace effective supply while preserving derived supply detail', () => {
    const pool = deriveAvailableSupplyPool({
      acquisitionState: createSupplyState(),
      petSourceReference: null,
      overrides: [
        {
          canonicalKey: 'wood',
          itemName: 'Wood',
          quantity: 12,
        },
      ],
    });

    expect(pool.byCanonicalKey.wood).toMatchObject({
      derivedQuantity: 37,
      effectiveQuantity: 12,
      overrideQuantity: 12,
    });
    expect(pool.byCanonicalKey.wood.breakdowns.at(-1)).toMatchObject({
      sourceKey: 'manual_override',
      quantity: 12,
    });
  });

  it('accepts explicit extra source breakdowns from source adapters', () => {
    const pool = deriveAvailableSupplyPool({
      acquisitionState: createSupplyState(),
      petSourceReference: null,
      extraBreakdowns: [
        {
          canonicalKey: 'wood',
          itemName: 'Wood',
          sourceKey: 'openable_contents',
          timing: 'immediate',
          quantity: 20,
          notes: ['Opened containers.'],
        },
      ],
    });

    expect(pool.byCanonicalKey.wood.effectiveQuantity).toBe(57);
    expect(pool.byCanonicalKey.wood.breakdowns.at(-1)).toMatchObject({
      sourceKey: 'openable_contents',
      label: 'Openable Contents',
      quantity: 20,
    });
  });
});
