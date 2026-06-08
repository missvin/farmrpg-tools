import { describe, expect, it } from 'vitest';

import {
  buildLargeNetPlanner,
  calculateDailyLargeNetsFromAntlers,
} from './largeNetPlanner';
import {
  createDefaultAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import { createDefaultDropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import type { DropRateReferenceData, DropRateReferenceEntry } from './loadDropRateReference';

function createFishingDropRateRow(
  targetItemName: string,
  targetCanonicalKey: string,
  rawRate: number,
): DropRateReferenceEntry {
  return {
    targetItemName,
    targetCanonicalKey,
    sourceName: 'Large Net',
    sourceCanonicalKey: 'large_net',
    sourceType: 'fishing',
    sourceKind: 'location',
    rowKind: 'location_item',
    rawRate,
    baseDropRate: null,
    sourcePageType: 'location',
    sourcePageName: 'Fishing',
    sourcePageUrl: 'https://buddy.farm/fishing/',
    pageDataUrl: 'https://buddy.farm/fishing/data/',
    targetItemId: null,
    targetItemImage: null,
    sourceImage: null,
    ironDepot: null,
    manualFishing: false,
    runecube: null,
    flags: [],
    notes: [],
  };
}

function createDropRateReference(rows: DropRateReferenceEntry[]): DropRateReferenceData {
  return {
    entries: rows,
    byTargetCanonicalKey: rows.reduce<Record<string, DropRateReferenceEntry[]>>((result, row) => {
      result[row.targetCanonicalKey] = [...(result[row.targetCanonicalKey] ?? []), row];
      return result;
    }, {}),
  };
}

describe('calculateDailyLargeNetsFromAntlers', () => {
  it('applies the crafting multiplier at the antler and fishing net stages', () => {
    expect(calculateDailyLargeNetsFromAntlers({
      dailyAntlers: 1000,
      craftOutputMultiplier: 1.45,
    })).toBeCloseTo(84.1, 3);
  });
});

describe('buildLargeNetPlanner', () => {
  it('splits regular inventory, stored pet inventory, and daily pet production', () => {
    const acquisitionState: AcquisitionPlannerInputState = {
      ...createDefaultAcquisitionPlannerInputState(),
      inventory: {
        entries: [
          {
            canonicalItemKey: 'frost snapper shell',
            itemName: 'Frost Snapper Shell',
            inventoryCount: 515,
          },
        ],
      },
      pets: {
        storedInventoryEntries: [
          {
            canonicalItemKey: 'frost snapper shell',
            itemName: 'Frost Snapper Shell',
            storedCount: 5730,
          },
        ],
        futureProduction: {
          enabled: true,
          horizonDays: 7,
          entries: [
            {
              canonicalItemKey: 'frost snapper shell',
              itemName: 'Frost Snapper Shell',
              petName: 'Seal',
              petLevel: 9,
              seasonalActive: true,
            },
          ],
          respectSeasonality: true,
          offlineHoursCap: 48,
          crunchyOmeletteActive: true,
        },
      },
    };

    const result = buildLargeNetPlanner({
      acquisitionState,
      dropRateReference: null,
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
      petSourceReference: null,
      targets: [
        {
          itemName: 'Frost Snapper Shell',
          targetQuantity: 15000,
          manualLargeNetsPerDrop: 39.46,
        },
      ],
      dailyAntlers: 0,
      directLargeNetsPerDay: 2000,
      catchMultiplier: 1.1,
      petCollectionMultiplier: 1.5,
      crunchyOmeletteActive: true,
    });

    expect(result.targets[0]).toMatchObject({
      regularInventoryQuantity: 515,
      storedPetInventoryQuantity: 5730,
      effectiveStoredPetInventoryQuantity: 8595,
      immediateQuantity: 9110,
      dailyPetQuantity: 27,
      remainingAfterImmediateQuantity: 5890,
    });
    expect(result.targets[0]?.soloDays).toBeCloseTo(71.2, 1);
  });

  it('applies Crunchy Omelette to stored pet inventory when no separate collection multiplier is entered', () => {
    const acquisitionState: AcquisitionPlannerInputState = {
      ...createDefaultAcquisitionPlannerInputState(),
      pets: {
        ...createDefaultAcquisitionPlannerInputState().pets,
        storedInventoryEntries: [
          {
            canonicalItemKey: 'frost snapper shell',
            itemName: 'Frost Snapper Shell',
            storedCount: 100,
          },
        ],
      },
    };

    const result = buildLargeNetPlanner({
      acquisitionState,
      dropRateReference: null,
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
      targets: [
        {
          itemName: 'Frost Snapper Shell',
          targetQuantity: 200,
          manualLargeNetsPerDrop: 39.46,
        },
      ],
      dailyAntlers: 0,
      directLargeNetsPerDay: 100,
      crunchyOmeletteActive: true,
    });

    expect(result.petCollectionMultiplier).toBe(1.5);
    expect(result.targets[0]?.effectiveStoredPetInventoryQuantity).toBe(150);
    expect(result.targets[0]?.remainingAfterImmediateQuantity).toBe(50);
  });

  it('uses target-row inventory and pet-level overrides without changing imported state assumptions', () => {
    const acquisitionState: AcquisitionPlannerInputState = {
      ...createDefaultAcquisitionPlannerInputState(),
      inventory: {
        entries: [
          {
            canonicalItemKey: 'frost snapper shell',
            itemName: 'Frost Snapper Shell',
            inventoryCount: 1,
          },
        ],
      },
      pets: {
        ...createDefaultAcquisitionPlannerInputState().pets,
        storedInventoryEntries: [
          {
            canonicalItemKey: 'frost snapper shell',
            itemName: 'Frost Snapper Shell',
            storedCount: 1,
          },
        ],
      },
    };

    const result = buildLargeNetPlanner({
      acquisitionState,
      dropRateReference: null,
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
      petSourceReference: null,
      targets: [
        {
          itemName: 'Frost Snapper Shell',
          targetQuantity: 1000,
          regularInventoryOverride: 100,
          storedPetInventoryOverride: 200,
          petForecastOverride: {
            petName: 'Seal',
            petLevel: 9,
          },
          manualLargeNetsPerDrop: 39.46,
        },
      ],
      dailyAntlers: 0,
      directLargeNetsPerDay: 100,
      crunchyOmeletteActive: true,
    });

    expect(result.targets[0]).toMatchObject({
      regularInventoryQuantity: 100,
      regularInventoryQuantitySource: 'override',
      storedPetInventoryQuantity: 200,
      storedPetInventoryQuantitySource: 'override',
      effectiveStoredPetInventoryQuantity: 300,
      immediateQuantity: 400,
      dailyPetQuantity: 27,
      dailyPetQuantitySource: 'override',
      remainingAfterImmediateQuantity: 600,
    });
  });

  it('projects remaining quantity and Large Nets needed after a wait horizon', () => {
    const result = buildLargeNetPlanner({
      acquisitionState: createDefaultAcquisitionPlannerInputState(),
      dropRateReference: null,
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
      petSourceReference: null,
      targets: [
        {
          itemName: 'Frost Snapper Shell',
          targetQuantity: 1000,
          regularInventoryOverride: 100,
          storedPetInventoryOverride: 100,
          petForecastOverride: {
            petName: 'Seal',
            petLevel: 9,
          },
          manualLargeNetsPerDrop: 10,
        },
      ],
      dailyAntlers: 0,
      directLargeNetsPerDay: 100,
      catchMultiplier: 1,
      waitDays: 3,
      crunchyOmeletteActive: true,
    });

    expect(result.waitDays).toBe(3);
    expect(result.targets[0]).toMatchObject({
      remainingAfterImmediateQuantity: 750,
      projectedFishingQuantityDuringWait: 30,
      projectedPetQuantityDuringWait: 81,
      remainingAfterWaitQuantity: 639,
      largeNetsNeededAfterWait: 6390,
    });
  });

  it('separates competing target time from incidental drop time', () => {
    const acquisitionState = createDefaultAcquisitionPlannerInputState();
    const result = buildLargeNetPlanner({
      acquisitionState,
      dropRateReference: null,
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
      targets: [
        {
          itemName: 'Frost Snapper Shell',
          targetQuantity: 100,
          manualLargeNetsPerDrop: 2,
        },
        {
          itemName: 'Spiked Shell',
          targetQuantity: 60,
          manualLargeNetsPerDrop: 1,
        },
      ],
      dailyAntlers: 0,
      directLargeNetsPerDay: 10,
      catchMultiplier: 1,
    });

    expect(result.incidentalDays).toBe(20);
    expect(result.competingDays).toBeCloseTo(26, 6);
  });

  it('uses fishing drop-rate reference rows when a manual rate is not entered', () => {
    const result = buildLargeNetPlanner({
      acquisitionState: createDefaultAcquisitionPlannerInputState(),
      dropRateReference: createDropRateReference([
        createFishingDropRateRow('Frost Snapper Shell', 'frost snapper shell', 20100),
        createFishingDropRateRow('Frost Snapper Shell', 'frost snapper shell', 19730),
      ]),
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
      targets: [
        {
          itemName: 'Frost Snapper Shell',
          targetQuantity: 1,
        },
      ],
      dailyAntlers: 0,
      directLargeNetsPerDay: 100,
      catchMultiplier: 1,
    });

    expect(result.targets[0]?.largeNetsPerDrop).toBeCloseTo(39.46, 4);
    expect(result.targets[0]?.largeNetsPerDropSource).toBe('drop_rate_reference');
    expect(result.targets[0]?.largeNetsPerDropSourceUrl).toBe('https://buddy.farm/fishing/');
  });

  it('does not compute a competing estimate for a remaining target with no source rate or pet production', () => {
    const result = buildLargeNetPlanner({
      acquisitionState: createDefaultAcquisitionPlannerInputState(),
      dropRateReference: null,
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
      targets: [
        {
          itemName: 'Unknown Shell',
          targetQuantity: 1,
        },
      ],
      dailyAntlers: 0,
      directLargeNetsPerDay: 100,
    });

    expect(result.targets[0]?.warnings).toContain(
      'Enter Large Nets per drop or add reviewed fishing drop-rate coverage.',
    );
    expect(result.competingDays).toBeNull();
  });
});
