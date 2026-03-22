import { describe, expect, it } from 'vitest';

import {
  createDefaultAcquisitionPlannerInputState,
  normalizeAcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import {
  CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER,
  deriveFuturePetProductionForecast,
} from './deriveFuturePetProductionForecast';

describe('deriveFuturePetProductionForecast', () => {
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

    const result = deriveFuturePetProductionForecast(state);

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
        forecastQuantity: 576,
        sourcePetCount: 1,
        petDetails: [
          expect.objectContaining({
            petName: 'Owl',
            petLevel: 6,
            baseQuantity: 288,
            specialRuleMultiplier: 2,
            collectionMultiplier: 1,
            forecastQuantity: 576,
          }),
        ],
      },
      {
        canonicalItemKey: 'steel',
        itemName: 'Steel',
        forecastQuantity: 240,
        sourcePetCount: 1,
        petDetails: [
          expect.objectContaining({
            petName: 'Snake',
            petLevel: 5,
            baseQuantity: 240,
            specialRuleMultiplier: 1,
            collectionMultiplier: 1,
            forecastQuantity: 240,
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

    expect(withoutBuff.entries[0]?.forecastQuantity).toBe(96);
    expect(withBuff.entries[0]?.forecastQuantity).toBe(96 * CRUNCHY_OMELETTE_COLLECTION_MULTIPLIER);
    expect(withBuff.crunchyOmeletteActive).toBe(true);
  });
});
