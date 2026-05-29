import { describe, expect, it } from 'vitest';

import {
  ACQUISITION_SOURCE_CATALOG,
  getAcquisitionAssumptionFamilyDefinition,
  getAcquisitionSourceDefinition,
  getDefaultIncludedAcquisitionSources,
  getDeferredOrUnsupportedAcquisitionSources,
} from './acquisitionSourceCatalog';

describe('ACQUISITION_SOURCE_CATALOG', () => {
  it('defines the planned first-pass non-crafting source classes', () => {
    expect(ACQUISITION_SOURCE_CATALOG.sources.map((source) => source.key)).toEqual(
      expect.arrayContaining([
        'manual_explore',
        'stamina',
        'apple_cider',
        'lemonade',
        'arnold_palmer',
        'orange_juice',
        'owned_containers',
        'owned_stockpiles',
        'current_inventory',
        'stored_pet_inventory',
        'future_pet_production',
        'one_time_rewards',
        'flea_market',
        'exchange_center',
      ]),
    );
  });

  it('captures default source policy and immediate versus future availability metadata', () => {
    expect(getAcquisitionSourceDefinition('manual_explore')).toMatchObject({
      label: 'Manual Explore',
      defaultPolicy: 'included_by_default',
      availability: 'immediate',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct',
    });

    expect(getAcquisitionSourceDefinition('apple_cider')).toMatchObject({
      defaultPolicy: 'included_by_default',
      availability: 'both',
      burdenSupport: 'direct_and_supporting',
    });

    expect(getAcquisitionSourceDefinition('future_pet_production')).toMatchObject({
      defaultPolicy: 'optional',
      availability: 'future',
      modelingStatus: 'planned_engine',
    });

    expect(getAcquisitionSourceDefinition('current_inventory')).toMatchObject({
      defaultPolicy: 'included_by_default',
      availability: 'immediate',
      modelingStatus: 'planned_engine',
    });

    expect(getAcquisitionSourceDefinition('flea_market')).toMatchObject({
      defaultPolicy: 'excluded_by_default',
      modelingStatus: 'unsupported',
    });
  });

  it('keeps explore-related assumption families explicit, including Rune Cube and Iron Depot', () => {
    expect(getAcquisitionAssumptionFamilyDefinition('rune_cube')).toMatchObject({
      label: 'Rune Cube',
      notes: expect.arrayContaining([
        'Rune Cube is relevant to drop-rate-sensitive explore-derived sources and should remain a planner assumption family.',
      ]),
    });

    expect(getAcquisitionSourceDefinition('manual_explore')?.relevantAssumptionFamilies).toEqual(
      expect.arrayContaining(['manual_explore_state', 'stamina_budget', 'rune_cube', 'iron_depot']),
    );

    expect(getAcquisitionSourceDefinition('apple_cider')?.relevantAssumptionFamilies).toEqual(
      expect.arrayContaining(['cider_explore_modifiers', 'rune_cube']),
    );
  });

  it('returns default included sources and deferred or unsupported sources through small lookup helpers', () => {
    expect(getDefaultIncludedAcquisitionSources().map((source) => source.key)).toEqual(
      expect.arrayContaining([
        'manual_explore',
        'apple_cider',
        'lemonade',
        'arnold_palmer',
        'owned_containers',
        'owned_stockpiles',
        'current_inventory',
        'stored_pet_inventory',
      ]),
    );

    expect(getDeferredOrUnsupportedAcquisitionSources().map((source) => source.key)).toEqual(
      expect.arrayContaining([
        'orange_juice',
        'one_time_rewards',
        'flea_market',
        'exchange_center',
      ]),
    );
  });

  it('keeps BL-061 scoped to shared source vocabulary rather than planner UI or source engines', () => {
    expect(ACQUISITION_SOURCE_CATALOG.scopeNotes).toEqual(
      expect.arrayContaining([
        'BL-061 defines a shared source-class vocabulary and planner-facing rule metadata for non-crafting acquisition planning.',
        'BL-062 should add the user-provided planner-input model that activates or configures these assumption families.',
      ]),
    );
  });
});
