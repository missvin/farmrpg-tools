import { describe, expect, it } from 'vitest';

import { ACQUISITION_SOURCE_CATALOG } from './acquisitionSourceCatalog';
import {
  createDefaultAcquisitionPlannerInputState,
  getResolvedAcquisitionSharedAssumptions,
  normalizeAcquisitionPlannerInputState,
  resolveAcquisitionSourceInclusion,
  resolveAcquisitionSourceInclusionMap,
} from './acquisitionPlannerState';
import { createDefaultCraftingModifierState } from './craftingModifierState';

describe('acquisitionPlannerState', () => {
  it('creates a safe default planner input state with explicit source, explore, consumable, owned-now, and pet sections', () => {
    expect(createDefaultAcquisitionPlannerInputState()).toEqual({
      schemaVersion: 1,
      sourcePolicy: {
        planningHorizon: 'include_future',
        sourceOverrides: Object.fromEntries(
          ACQUISITION_SOURCE_CATALOG.sources.map((source) => [source.key, 'default']),
        ),
      },
      explore: {
        runeCubeActive: false,
        availableStamina: 0,
        wandererPercent: 0,
        exploringEffectivenessPercent: 0,
        cinnamonSticksActive: false,
        neighActive: false,
      },
      consumables: {
        appleCider: {
          ownedCount: 0,
          craftableNowCount: 0,
          futureCraftableCount: 0,
        },
        lemonade: {
          ownedCount: 0,
          craftableNowCount: 0,
          futureCraftableCount: 0,
          lemonSqueezerActive: false,
          quandaryChowderActive: false,
        },
        arnoldPalmer: {
          ownedCount: 0,
          craftableNowCount: 0,
          futureCraftableCount: 0,
          lemonSqueezerActive: false,
          quandaryChowderActive: false,
          lemonSeltzerUsesRemaining: 0,
          lemonCreamPieActive: false,
        },
        orangeJuice: {
          ownedCount: 0,
          craftableNowCount: 0,
          futureCraftableCount: 0,
        },
      },
      ownedNow: {
        stockpileItemCountsByCanonicalKey: {},
        containerItemCountsByCanonicalKey: {},
      },
      pets: {
        storedInventoryByCanonicalKey: {},
        futureProduction: {
          enabled: false,
          horizonDays: 7,
          petLevelsByCanonicalKey: {},
          respectSeasonality: true,
          offlineHoursCap: 48,
        },
      },
    });
  });

  it('normalizes partial or malformed input into a full safe planner state', () => {
    expect(
      normalizeAcquisitionPlannerInputState({
        sourcePolicy: {
          planningHorizon: 'immediate_only',
          sourceOverrides: {
            manual_explore: 'force_excluded',
            apple_cider: 'force_included',
            unknown_source: 'force_included',
          },
        },
        explore: {
          runeCubeActive: true,
          availableStamina: '1200',
          wandererPercent: -10,
          exploringEffectivenessPercent: '25',
          cinnamonSticksActive: true,
          neighActive: 'yes',
        },
        consumables: {
          lemonade: {
            ownedCount: '5',
            craftableNowCount: -3,
            futureCraftableCount: '12',
            lemonSqueezerActive: true,
            quandaryChowderActive: 1,
          },
          arnoldPalmer: {
            lemonSeltzerUsesRemaining: '50',
            lemonCreamPieActive: true,
          },
        },
        ownedNow: {
          stockpileItemCountsByCanonicalKey: {
            twine: '10',
            rope: -2,
            '': 99,
          },
        },
        pets: {
          futureProduction: {
            enabled: true,
            horizonDays: '14',
            respectSeasonality: false,
            offlineHoursCap: '72',
          },
        },
      }),
    ).toMatchObject({
      schemaVersion: 1,
      sourcePolicy: {
        planningHorizon: 'immediate_only',
        sourceOverrides: expect.objectContaining({
          manual_explore: 'force_excluded',
          apple_cider: 'force_included',
          lemonade: 'default',
        }),
      },
      explore: {
        runeCubeActive: true,
        availableStamina: 1200,
        wandererPercent: 0,
        exploringEffectivenessPercent: 25,
        cinnamonSticksActive: true,
        neighActive: false,
      },
      consumables: {
        lemonade: {
          ownedCount: 5,
          craftableNowCount: 0,
          futureCraftableCount: 12,
          lemonSqueezerActive: true,
          quandaryChowderActive: false,
        },
        arnoldPalmer: {
          lemonSeltzerUsesRemaining: 50,
          lemonCreamPieActive: true,
        },
      },
      ownedNow: {
        stockpileItemCountsByCanonicalKey: {
          twine: 10,
        },
      },
      pets: {
        futureProduction: {
          enabled: true,
          horizonDays: 14,
          respectSeasonality: false,
          offlineHoursCap: 72,
        },
      },
    });
  });

  it('keeps source policy aligned with BL-061 source classes and resolves default-versus-override inclusion cleanly', () => {
    const state = normalizeAcquisitionPlannerInputState({
      sourcePolicy: {
        sourceOverrides: {
          future_pet_production: 'force_included',
          arnold_palmer: 'force_excluded',
        },
      },
    });

    expect(resolveAcquisitionSourceInclusion('manual_explore', state)).toBe(true);
    expect(resolveAcquisitionSourceInclusion('future_pet_production', state)).toBe(true);
    expect(resolveAcquisitionSourceInclusion('arnold_palmer', state)).toBe(false);

    expect(resolveAcquisitionSourceInclusionMap(state)).toMatchObject({
      manual_explore: true,
      apple_cider: true,
      future_pet_production: true,
      flea_market: false,
      exchange_center: false,
      arnold_palmer: false,
    });
  });

  it('represents Rune Cube explicitly and keeps consumable assumptions separate for Cider, Lemonade, Arnold Palmer, and Orange Juice', () => {
    const state = normalizeAcquisitionPlannerInputState({
      explore: {
        runeCubeActive: true,
      },
      consumables: {
        appleCider: {
          ownedCount: 1,
        },
        lemonade: {
          ownedCount: 2,
          lemonSqueezerActive: true,
        },
        arnoldPalmer: {
          ownedCount: 3,
          quandaryChowderActive: true,
          lemonSeltzerUsesRemaining: 12,
        },
        orangeJuice: {
          ownedCount: 4,
          futureCraftableCount: 5,
        },
      },
    });

    expect(state.explore.runeCubeActive).toBe(true);
    expect(state.consumables.appleCider.ownedCount).toBe(1);
    expect(state.consumables.lemonade).toMatchObject({
      ownedCount: 2,
      lemonSqueezerActive: true,
    });
    expect(state.consumables.arnoldPalmer).toMatchObject({
      ownedCount: 3,
      quandaryChowderActive: true,
      lemonSeltzerUsesRemaining: 12,
    });
    expect(state.consumables.orangeJuice).toMatchObject({
      ownedCount: 4,
      futureCraftableCount: 5,
    });
  });

  it('reuses Iron Depot from the existing crafting planner state instead of duplicating it in acquisition state', () => {
    const acquisitionState = normalizeAcquisitionPlannerInputState({
      explore: {
        runeCubeActive: true,
      },
    });
    const craftingModifierState = {
      ...createDefaultCraftingModifierState(),
      planning: {
        includeExcludedRecipes: false,
        ironDepotActive: true,
      },
    };

    expect(getResolvedAcquisitionSharedAssumptions(acquisitionState, craftingModifierState)).toEqual({
      runeCubeActive: true,
      ironDepotActive: true,
    });

    expect(getResolvedAcquisitionSharedAssumptions(acquisitionState)).toEqual({
      runeCubeActive: true,
      ironDepotActive: false,
    });
  });
});
