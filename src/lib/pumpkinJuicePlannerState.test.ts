import { describe, expect, it } from 'vitest';

import {
  createDefaultPumpkinJuicePlannerState,
  normalizePumpkinJuicePlannerState,
  savePumpkinJuicePlannerState,
  loadPumpkinJuicePlannerState,
} from './pumpkinJuicePlannerState';

describe('pumpkinJuicePlannerState', () => {
  it('defaults to zero owned Pumpkin Juice and disabled thresholds', () => {
    expect(createDefaultPumpkinJuicePlannerState()).toEqual({
      schemaVersion: 1,
      ownedPumpkinJuiceCount: 0,
      valueThresholds: {
        enabled: false,
        minNextApSaved: 0,
        minTotalApSaved: 0,
        minNextStaminaSaved: 0,
        minTotalStaminaSaved: 0,
      },
    });
  });

  it('normalizes malformed state safely', () => {
    expect(
      normalizePumpkinJuicePlannerState({
        ownedPumpkinJuiceCount: '12.8',
        valueThresholds: {
          enabled: true,
          minNextApSaved: '1000',
          minTotalApSaved: -5,
          minNextStaminaSaved: 'bad',
          minTotalStaminaSaved: 500,
        },
      }),
    ).toEqual({
      schemaVersion: 1,
      ownedPumpkinJuiceCount: 12,
      valueThresholds: {
        enabled: true,
        minNextApSaved: 1000,
        minTotalApSaved: 0,
        minNextStaminaSaved: 0,
        minTotalStaminaSaved: 500,
      },
    });
  });

  it('saves and loads normalized local state', () => {
    const storage = window.localStorage;
    storage.clear();

    savePumpkinJuicePlannerState(
      {
        schemaVersion: 1,
        ownedPumpkinJuiceCount: 3,
        valueThresholds: {
          enabled: false,
          minNextApSaved: 0,
          minTotalApSaved: 0,
          minNextStaminaSaved: 0,
          minTotalStaminaSaved: 0,
        },
      },
      storage,
    );

    expect(loadPumpkinJuicePlannerState(storage).ownedPumpkinJuiceCount).toBe(3);
  });
});
