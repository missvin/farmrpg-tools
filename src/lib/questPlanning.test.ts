import { describe, expect, it } from 'vitest';

import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { buildQuestAvailableSupply } from './questPlanning';

describe('buildQuestAvailableSupply', () => {
  it('counts current inventory as immediate quest-planning supply alongside saved stockpiles and pet storage', () => {
    const availableSupply = buildQuestAvailableSupply({
      ...createDefaultAcquisitionPlannerInputState(),
      ownedNow: {
        entries: [
          {
            canonicalItemKey: 'strange ring',
            itemName: 'Strange Ring',
            ownedCount: 400,
            sourceCategory: 'stockpile',
          },
        ],
      },
      inventory: {
        entries: [
          {
            canonicalItemKey: 'strange ring',
            itemName: 'Strange Ring',
            inventoryCount: 1000,
          },
        ],
      },
      pets: {
        ...createDefaultAcquisitionPlannerInputState().pets,
        storedInventoryEntries: [
          {
            canonicalItemKey: 'honey',
            itemName: 'Honey',
            storedCount: 12,
          },
        ],
      },
    });

    expect(availableSupply).toEqual([
      {
        canonicalKey: 'honey',
        itemName: 'Honey',
        quantity: 12,
        sources: [
          {
            label: 'Stored pet inventory',
            quantity: 12,
          },
        ],
      },
      {
        canonicalKey: 'strange ring',
        itemName: 'Strange Ring',
        quantity: 1400,
        sources: [
          {
            label: 'Owned stockpile',
            quantity: 400,
          },
          {
            label: 'Current inventory',
            quantity: 1000,
          },
        ],
      },
    ]);
  });
});
