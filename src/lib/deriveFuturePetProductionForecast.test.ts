import { describe, expect, it } from 'vitest';

import {
  createDefaultAcquisitionPlannerInputState,
  normalizeAcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import {
  CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER,
  deriveFuturePetProductionForecast,
  getAvailablePetItemPoolSize,
} from './deriveFuturePetProductionForecast';
import { parsePetSourceReferenceCsv } from './loadPetSourceReference';

const PET_SOURCE_HEADER =
  'pet_name,pet_canonical_key,item_name,item_canonical_key,unlock_level,source_url,page_data_url,coverage_status,notes';

function createPetSourceReference() {
  return parsePetSourceReferenceCsv(`${PET_SOURCE_HEADER}
Owl,owl,Honey,honey,1,https://buddy.farm/i/honey/,https://buddy.farm/page-data/i/honey/page-data.json,reviewed,
Snake,snake,Steel,steel,3,https://buddy.farm/i/steel/,https://buddy.farm/page-data/i/steel/page-data.json,reviewed,
Seal,seal,Frost Snapper Shell,frost snapper shell,6,https://buddy.farm/i/frost-snapper-shell/,https://buddy.farm/page-data/i/frost-snapper-shell/page-data.json,reviewed,`);
}

describe('deriveFuturePetProductionForecast', () => {
  it('uses FarmRPG pet output pool sizes by level band', () => {
    expect(getAvailablePetItemPoolSize(1)).toBe(4);
    expect(getAvailablePetItemPoolSize(2)).toBe(4);
    expect(getAvailablePetItemPoolSize(3)).toBe(8);
    expect(getAvailablePetItemPoolSize(5)).toBe(8);
    expect(getAvailablePetItemPoolSize(6)).toBe(12);
    expect(getAvailablePetItemPoolSize(9)).toBe(12);
  });

  it('returns an empty disabled forecast by default and stays separate from stored pet inventory', () => {
    const state = normalizeAcquisitionPlannerInputState({
      pets: {
        storedInventoryEntries: [
          {
            canonicalItemKey: 'honey',
            itemName: 'Honey',
            storedCount: 500,
          },
        ],
      },
    });

    expect(deriveFuturePetProductionForecast(state)).toEqual({
      enabled: false,
      forecastHours: 0,
      crunchyOmeletteActive: false,
      entries: [],
      warnings: [],
    });
    expect(state.pets.storedInventoryEntries).toEqual([
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        storedCount: 500,
      },
    ]);
  });

  it('forecasts future pet production using the first assumption set, including owl honey and seasonality handling', () => {
    const state = normalizeAcquisitionPlannerInputState({
      pets: {
        futureProduction: {
          enabled: true,
          horizonDays: 7,
          offlineHoursCap: 48,
          respectSeasonality: true,
          crunchyOmeletteActive: false,
          entries: [
            {
              canonicalItemKey: 'honey',
              itemName: 'Honey',
              petName: 'Owl',
              petLevel: 6,
              seasonalActive: true,
            },
            {
              canonicalItemKey: 'steel',
              itemName: 'Steel',
              petName: 'Snake',
              petLevel: 5,
              seasonalActive: true,
            },
            {
              canonicalItemKey: 'apple',
              itemName: 'Apple',
              petName: 'Seasonal Bird',
              petLevel: 10,
              seasonalActive: false,
            },
          ],
        },
      },
    });

    const result = deriveFuturePetProductionForecast(state, {
      petSourceReference: createPetSourceReference(),
    });

    expect(result.enabled).toBe(true);
    expect(result.forecastHours).toBe(48);
    expect(result.entries).toEqual([
      {
        canonicalItemKey: 'apple',
        itemName: 'Apple',
        forecastQuantity: 0,
        sourcePetCount: 1,
        petDetails: [
          expect.objectContaining({
            petName: 'Seasonal Bird',
            forecastHours: 0,
            baseQuantity: 0,
            forecastQuantity: 0,
          }),
        ],
      },
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        forecastQuantity: 48,
        sourcePetCount: 1,
        petDetails: [
          expect.objectContaining({
            petName: 'Owl',
            petLevel: 6,
            availableItemPoolSize: 12,
            baseQuantity: 24,
            specialRuleMultiplier: 2,
            collectionMultiplier: 1,
            forecastQuantity: 48,
            petSourceUnlockLevel: 1,
          }),
        ],
      },
      {
        canonicalItemKey: 'steel',
        itemName: 'Steel',
        forecastQuantity: 30,
        sourcePetCount: 1,
        petDetails: [
          expect.objectContaining({
            petName: 'Snake',
            petLevel: 5,
            availableItemPoolSize: 8,
            baseQuantity: 30,
            specialRuleMultiplier: 1,
            collectionMultiplier: 1,
            forecastQuantity: 30,
            petSourceUnlockLevel: 3,
          }),
        ],
      },
    ]);
  });

  it('applies the Crunchy Omelette collection-time multiplier at 1.5x', () => {
    const baseState = createDefaultAcquisitionPlannerInputState();
    const withoutBuff = deriveFuturePetProductionForecast(
      normalizeAcquisitionPlannerInputState({
        ...baseState,
        pets: {
          ...baseState.pets,
          futureProduction: {
            enabled: true,
            horizonDays: 1,
            offlineHoursCap: 24,
            respectSeasonality: true,
            crunchyOmeletteActive: false,
            entries: [
              {
                canonicalItemKey: 'steel',
                itemName: 'Steel',
                petName: 'Snake',
                petLevel: 4,
                seasonalActive: true,
              },
            ],
          },
        },
      }),
    );
    const withBuff = deriveFuturePetProductionForecast(
      normalizeAcquisitionPlannerInputState({
        ...baseState,
        pets: {
          ...baseState.pets,
          futureProduction: {
            enabled: true,
            horizonDays: 1,
            offlineHoursCap: 24,
            respectSeasonality: true,
            crunchyOmeletteActive: true,
            entries: [
              {
                canonicalItemKey: 'steel',
                itemName: 'Steel',
                petName: 'Snake',
                petLevel: 4,
                seasonalActive: true,
              },
            ],
          },
        },
      }),
    );

    expect(withoutBuff.entries[0]?.forecastQuantity).toBe(12);
    expect(withBuff.entries[0]?.forecastQuantity).toBe(12 * CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER);
    expect(withBuff.crunchyOmeletteActive).toBe(true);
  });

  it('uses Buddy pet-source unlock levels when local coverage is available', () => {
    const state = normalizeAcquisitionPlannerInputState({
      pets: {
        futureProduction: {
          enabled: true,
          horizonDays: 1,
          offlineHoursCap: 24,
          respectSeasonality: true,
          crunchyOmeletteActive: false,
          entries: [
            {
              canonicalItemKey: 'frost snapper shell',
              itemName: 'Frost Snapper Shell',
              petName: 'Seal',
              petLevel: 5,
              seasonalActive: true,
            },
          ],
        },
      },
    });

    const result = deriveFuturePetProductionForecast(state, {
      petSourceReference: createPetSourceReference(),
    });

    expect(result.entries[0]?.forecastQuantity).toBe(0);
    expect(result.entries[0]?.petDetails[0]).toMatchObject({
      availableItemPoolSize: 8,
      petSourceUnlockLevel: 6,
      forecastQuantity: 0,
    });
    expect(result.entries[0]?.petDetails[0]?.appliedRuleNotes).toContain(
      'Pet level 5 is below the local unlock level, so this pet contributes 0 in the current forecast.',
    );
  });

  it('estimates a level 9 Seal as roughly 18 Frost Snapper Shell per day before collection modifiers', () => {
    const state = normalizeAcquisitionPlannerInputState({
      pets: {
        futureProduction: {
          enabled: true,
          horizonDays: 1,
          offlineHoursCap: 24,
          respectSeasonality: true,
          crunchyOmeletteActive: false,
          entries: [
            {
              canonicalItemKey: 'frost snapper shell',
              itemName: 'Frost Snapper Shell',
              petName: 'Seal',
              petLevel: 9,
              seasonalActive: true,
            },
          ],
        },
      },
    });

    const result = deriveFuturePetProductionForecast(state, {
      petSourceReference: createPetSourceReference(),
    });

    expect(result.entries[0]?.forecastQuantity).toBe(18);
    expect(result.entries[0]?.petDetails[0]).toMatchObject({
      availableItemPoolSize: 12,
      baseQuantity: 18,
      petSourceUnlockLevel: 6,
    });
  });

  it('warns but still estimates from the level pool when pet-source coverage is missing', () => {
    const state = normalizeAcquisitionPlannerInputState({
      pets: {
        futureProduction: {
          enabled: true,
          horizonDays: 1,
          offlineHoursCap: 24,
          respectSeasonality: true,
          crunchyOmeletteActive: false,
          entries: [
            {
              canonicalItemKey: 'mystery shell',
              itemName: 'Mystery Shell',
              petName: 'Mystery Pet',
              petLevel: 6,
              seasonalActive: true,
            },
          ],
        },
      },
    });

    const result = deriveFuturePetProductionForecast(state, {
      petSourceReference: createPetSourceReference(),
    });

    expect(result.entries[0]?.forecastQuantity).toBe(12);
    expect(result.warnings).toEqual([
      'Pet source coverage is missing for Mystery Pet -> Mystery Shell; using the level-based item pool and assuming the item is available.',
    ]);
  });
});
