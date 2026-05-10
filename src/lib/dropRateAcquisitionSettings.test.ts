import { describe, expect, it } from 'vitest';

import {
  DROP_RATE_ACQUISITION_SETTINGS_STORAGE_KEY,
  createDefaultDropRateAcquisitionSettings,
  loadDropRateAcquisitionSettings,
  normalizeDropRateAcquisitionSettings,
  saveDropRateAcquisitionSettings,
} from './dropRateAcquisitionSettings';

describe('dropRateAcquisitionSettings', () => {
  it('defaults to Rebecca all-perks drop-rate testing assumptions', () => {
    expect(createDefaultDropRateAcquisitionSettings()).toEqual({
      schemaVersion: 1,
      perks: {
        ironDepotActive: true,
        wandererPercent: 33,
        cinnamonSticksActive: true,
        lemonSqueezerActive: true,
        reinforcedNettingActive: true,
        fishingTrawlActive: true,
        resourceSaverPercent: 45,
        eagleEyeRunecubeActive: true,
      },
      units: {
        exploring: 'arnold_palmers',
        fishing: 'large_nets',
        farming: 'crops',
      },
    });
  });

  it('normalizes malformed or partial state safely', () => {
    expect(
      normalizeDropRateAcquisitionSettings({
        perks: {
          ironDepotActive: false,
          wandererPercent: '42.5',
          cinnamonSticksActive: 'yes',
          lemonSqueezerActive: false,
          reinforcedNettingActive: true,
          fishingTrawlActive: false,
          resourceSaverPercent: 150,
          eagleEyeRunecubeActive: false,
        },
        units: {
          exploring: 'stamina',
          fishing: 'fish',
          farming: 'unknown',
        },
      }),
    ).toEqual({
      schemaVersion: 1,
      perks: {
        ironDepotActive: false,
        wandererPercent: 42.5,
        cinnamonSticksActive: true,
        lemonSqueezerActive: false,
        reinforcedNettingActive: true,
        fishingTrawlActive: false,
        resourceSaverPercent: 100,
        eagleEyeRunecubeActive: false,
      },
      units: {
        exploring: 'stamina',
        fishing: 'fish',
        farming: 'crops',
      },
    });
  });

  it('loads defaults when stored JSON cannot be parsed', () => {
    const storage = window.localStorage;
    storage.clear();

    storage.setItem(DROP_RATE_ACQUISITION_SETTINGS_STORAGE_KEY, '{bad json');

    expect(loadDropRateAcquisitionSettings(storage)).toEqual(
      createDefaultDropRateAcquisitionSettings(),
    );
  });

  it('saves and loads normalized local state', () => {
    const storage = window.localStorage;
    storage.clear();

    saveDropRateAcquisitionSettings(
      {
        ...createDefaultDropRateAcquisitionSettings(),
        perks: {
          ...createDefaultDropRateAcquisitionSettings().perks,
          wandererPercent: 7,
          resourceSaverPercent: -5,
        },
        units: {
          exploring: 'lemonades',
          fishing: 'fishing_nets',
          farming: 'harvest_alls',
        },
      },
      storage,
    );

    expect(loadDropRateAcquisitionSettings(storage)).toMatchObject({
      perks: {
        wandererPercent: 7,
        resourceSaverPercent: 0,
      },
      units: {
        exploring: 'lemonades',
        fishing: 'fishing_nets',
        farming: 'harvest_alls',
      },
    });
  });
});
