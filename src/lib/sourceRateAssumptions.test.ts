import { describe, expect, it } from 'vitest';

import {
  SOURCE_RATE_ASSUMPTIONS_STORAGE_KEY,
  createDefaultSourceRateAssumptionsState,
  getSourceRatePerDay,
  loadSourceRateAssumptionsState,
  normalizeSourceRateAssumptionsState,
  removeCustomSourceRateAssumption,
  saveSourceRateAssumptionsState,
  upsertSourceRateAssumption,
} from './sourceRateAssumptions';

describe('sourceRateAssumptions', () => {
  it('defaults to shared zero-rate assumptions for constrained source units', () => {
    expect(createDefaultSourceRateAssumptionsState()).toEqual({
      schemaVersion: 1,
      rates: [
        {
          sourceKey: 'arnold_palmers',
          label: 'Arnold Palmers',
          unitLabel: 'Arnold Palmers/day',
          dailyQuantity: 0,
          custom: false,
        },
        {
          sourceKey: 'large_nets',
          label: 'Large Nets',
          unitLabel: 'Large Nets/day',
          dailyQuantity: 0,
          custom: false,
        },
        {
          sourceKey: 'apple_ciders',
          label: 'Apple Ciders',
          unitLabel: 'Apple Ciders/day',
          dailyQuantity: 0,
          custom: false,
        },
        {
          sourceKey: 'explores',
          label: 'Explores',
          unitLabel: 'Explores/day',
          dailyQuantity: 0,
          custom: false,
        },
        {
          sourceKey: 'pet_days',
          label: 'Pet Days',
          unitLabel: 'Pet days/day',
          dailyQuantity: 0,
          custom: false,
        },
        {
          sourceKey: 'wishing_well_throws',
          label: 'Wishing Well Throws',
          unitLabel: 'Throws/day',
          dailyQuantity: 0,
          custom: false,
        },
      ],
    });
  });

  it('normalizes partial and malformed stored state safely', () => {
    expect(
      normalizeSourceRateAssumptionsState({
        rates: [
          {
            sourceKey: ' large nets ',
            label: 'Something else',
            unitLabel: 'ignored',
            dailyQuantity: '2000',
            custom: true,
          },
          {
            label: 'Salt Rock',
            unitLabel: 'Salt Rock/day',
            dailyQuantity: '123.5',
          },
          {
            label: 'Bad Rate',
            dailyQuantity: -1,
          },
        ],
      }),
    ).toMatchObject({
      schemaVersion: 1,
      rates: expect.arrayContaining([
        {
          sourceKey: 'large_nets',
          label: 'Large Nets',
          unitLabel: 'Large Nets/day',
          dailyQuantity: 2000,
          custom: false,
        },
        {
          sourceKey: 'salt_rock',
          label: 'Salt Rock',
          unitLabel: 'Salt Rock/day',
          dailyQuantity: 123.5,
          custom: true,
        },
      ]),
    });
  });

  it('upserts standard and custom rates and exposes lookup helpers', () => {
    let state = createDefaultSourceRateAssumptionsState();

    state = upsertSourceRateAssumption(state, {
      sourceKey: 'arnold_palmers',
      label: 'Ignored',
      dailyQuantity: 200,
    });
    state = upsertSourceRateAssumption(state, {
      label: 'Salt Rock',
      unitLabel: 'Salt Rock/day',
      dailyQuantity: 44,
    });

    expect(getSourceRatePerDay(state, 'arnold palmers')).toBe(200);
    expect(getSourceRatePerDay(state, 'Salt Rock')).toBe(44);
    expect(getSourceRatePerDay(state, 'not configured')).toBeNull();
  });

  it('only removes custom source rates', () => {
    let state = createDefaultSourceRateAssumptionsState();

    state = upsertSourceRateAssumption(state, {
      sourceKey: 'large_nets',
      label: 'Large Nets',
      dailyQuantity: 2000,
    });
    state = upsertSourceRateAssumption(state, {
      label: 'Salt Rock',
      unitLabel: 'Salt Rock/day',
      dailyQuantity: 44,
    });

    state = removeCustomSourceRateAssumption(state, 'large nets');
    expect(getSourceRatePerDay(state, 'large nets')).toBe(2000);

    state = removeCustomSourceRateAssumption(state, 'salt rock');
    expect(getSourceRatePerDay(state, 'salt rock')).toBeNull();
  });

  it('saves and loads normalized local state', () => {
    const storage = window.localStorage;
    storage.clear();

    saveSourceRateAssumptionsState(
      upsertSourceRateAssumption(createDefaultSourceRateAssumptionsState(), {
        sourceKey: 'wishing_well_throws',
        label: 'Wishing Well Throws',
        dailyQuantity: 30,
      }),
      storage,
    );

    expect(loadSourceRateAssumptionsState(storage).rates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: 'wishing_well_throws',
          dailyQuantity: 30,
        }),
      ]),
    );

    storage.setItem(SOURCE_RATE_ASSUMPTIONS_STORAGE_KEY, '{bad json');
    expect(loadSourceRateAssumptionsState(storage)).toEqual(createDefaultSourceRateAssumptionsState());
  });
});
