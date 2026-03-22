export type AcquisitionSourceKey =
  | 'manual_explore'
  | 'stamina'
  | 'apple_cider'
  | 'lemonade'
  | 'arnold_palmer'
  | 'orange_juice'
  | 'owned_containers'
  | 'owned_stockpiles'
  | 'stored_pet_inventory'
  | 'future_pet_production'
  | 'one_time_rewards'
  | 'flea_market'
  | 'exchange_center';

export type AcquisitionSourceCategory =
  | 'explore'
  | 'supporting_resource'
  | 'consumable'
  | 'owned_source'
  | 'pet_source'
  | 'reward'
  | 'excluded_source';

export type AcquisitionSourceDefaultPolicy =
  | 'included_by_default'
  | 'optional'
  | 'excluded_by_default'
  | 'deferred';

export type AcquisitionSourceAvailability = 'immediate' | 'future' | 'both';

export type AcquisitionSourceUserInputDependence = 'none' | 'optional' | 'required';

export type AcquisitionSourceModelingStatus =
  | 'catalog_only'
  | 'planned_engine'
  | 'deferred'
  | 'unsupported';

export type AcquisitionSourceBurdenSupport = 'direct' | 'supporting_only' | 'direct_and_supporting';

export type AcquisitionMissingMetadataBehavior = 'warn_and_continue' | 'not_applicable';

export type AcquisitionAssumptionFamilyKey =
  | 'source_policy'
  | 'manual_explore_state'
  | 'stamina_budget'
  | 'rune_cube'
  | 'iron_depot'
  | 'cider_explore_modifiers'
  | 'lemonade_yield_modifiers'
  | 'arnold_palmer_yield_modifiers'
  | 'orange_juice_yield_modifiers'
  | 'crafting_output_modifiers'
  | 'mastery_bonus_modifiers'
  | 'owned_stockpile_counts'
  | 'stored_pet_inventory_counts'
  | 'future_pet_levels_and_seasonality'
  | 'pet_quantity_modifiers'
  | 'excluded_source_policy';

export type AcquisitionAssumptionFamilyDefinition = {
  key: AcquisitionAssumptionFamilyKey;
  label: string;
  notes: string[];
};

export type AcquisitionSourceDefinition = {
  key: AcquisitionSourceKey;
  label: string;
  category: AcquisitionSourceCategory;
  defaultPolicy: AcquisitionSourceDefaultPolicy;
  availability: AcquisitionSourceAvailability;
  userInputDependence: AcquisitionSourceUserInputDependence;
  modelingStatus: AcquisitionSourceModelingStatus;
  burdenSupport: AcquisitionSourceBurdenSupport;
  relevantAssumptionFamilies: AcquisitionAssumptionFamilyKey[];
  warningSafeMissingMetadata: AcquisitionMissingMetadataBehavior;
  notes: string[];
};

export type AcquisitionSourceCatalog = {
  assumptionFamilies: AcquisitionAssumptionFamilyDefinition[];
  sources: AcquisitionSourceDefinition[];
  scopeNotes: string[];
};

export const ACQUISITION_SOURCE_CATALOG: AcquisitionSourceCatalog = {
  assumptionFamilies: [
    {
      key: 'source_policy',
      label: 'Source policy',
      notes: [
        'Later acquisition planning should optimize only over allowed source classes under explicit assumptions.',
      ],
    },
    {
      key: 'manual_explore_state',
      label: 'Manual explore state',
      notes: ['Covers zone-specific manual explore assumptions and expected-value inputs.'],
    },
    {
      key: 'stamina_budget',
      label: 'Stamina budget',
      notes: ['Tracks stamina availability or usage assumptions for explore-derived acquisition.'],
    },
    {
      key: 'rune_cube',
      label: 'Rune Cube',
      notes: ['Rune Cube is relevant to drop-rate-sensitive explore-derived sources and should remain a planner assumption family.'],
    },
    {
      key: 'iron_depot',
      label: 'Iron Depot',
      notes: ['Iron Depot can remove Iron from manual explore drop pools while making Iron effectively auto-supplied for planning.'],
    },
    {
      key: 'cider_explore_modifiers',
      label: 'Cider explore modifiers',
      notes: ['Groups Apple Cider-specific explore assumptions such as Wanderer, Cinnamon Sticks, EE, Neigh, and related cider efficiency rules.'],
    },
    {
      key: 'lemonade_yield_modifiers',
      label: 'Lemonade yield modifiers',
      notes: ['Groups Lemonade quantity assumptions such as Lemon Squeezer and Quandary Chowder.'],
    },
    {
      key: 'arnold_palmer_yield_modifiers',
      label: 'Arnold Palmer yield modifiers',
      notes: ['Groups Arnold Palmer quantity assumptions such as Lemon Squeezer, Quandary Chowder, and Lemon Seltzer.'],
    },
    {
      key: 'orange_juice_yield_modifiers',
      label: 'Orange Juice yield modifiers',
      notes: ['Reserved for Orange Juice-specific source assumptions once that source class is modeled beyond the catalog.'],
    },
    {
      key: 'crafting_output_modifiers',
      label: 'Crafting output modifiers',
      notes: ['Covers crafting-side modifiers such as Resource Saver when a source depends on crafted supply.'],
    },
    {
      key: 'mastery_bonus_modifiers',
      label: 'Mastery bonus modifiers',
      notes: ['Covers shared mastery-gain modifiers such as Mushroom Stew or event mastery bonuses for eligible source classes.'],
    },
    {
      key: 'owned_stockpile_counts',
      label: 'Owned stockpile counts',
      notes: ['Covers user-supplied owned-now inventory quantities for containers, consumables, and similar immediate sources.'],
    },
    {
      key: 'stored_pet_inventory_counts',
      label: 'Stored pet inventory counts',
      notes: ['Covers already-produced pet inventory that can satisfy burden immediately.'],
    },
    {
      key: 'future_pet_levels_and_seasonality',
      label: 'Future pet levels and seasonality',
      notes: ['Covers owned pets, pet levels, offline cap assumptions, and seasonal availability for future pet production.'],
    },
    {
      key: 'pet_quantity_modifiers',
      label: 'Pet quantity modifiers',
      notes: ['Covers pet-specific quantity effects such as Crunchy Omelette and similar production modifiers.'],
    },
    {
      key: 'excluded_source_policy',
      label: 'Excluded source policy',
      notes: ['Documents source classes intentionally excluded or deferred from default recommendation logic.'],
    },
  ],
  sources: [
    {
      key: 'manual_explore',
      label: 'Manual Explore',
      category: 'explore',
      defaultPolicy: 'included_by_default',
      availability: 'immediate',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct',
      relevantAssumptionFamilies: [
        'source_policy',
        'manual_explore_state',
        'stamina_budget',
        'rune_cube',
        'iron_depot',
        'mastery_bonus_modifiers',
      ],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Uses normal zone drop behavior and should remain distinct from consumable-driven explore sources.',
        'Missing source coverage should degrade as warnings rather than failures.',
      ],
    },
    {
      key: 'stamina',
      label: 'Stamina',
      category: 'supporting_resource',
      defaultPolicy: 'optional',
      availability: 'immediate',
      userInputDependence: 'required',
      modelingStatus: 'catalog_only',
      burdenSupport: 'supporting_only',
      relevantAssumptionFamilies: ['stamina_budget', 'source_policy'],
      warningSafeMissingMetadata: 'not_applicable',
      notes: [
        'Stamina is not itself an acquisition source for burden items, but it constrains explore-derived acquisition classes.',
      ],
    },
    {
      key: 'apple_cider',
      label: 'Apple Cider',
      category: 'consumable',
      defaultPolicy: 'included_by_default',
      availability: 'both',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct_and_supporting',
      relevantAssumptionFamilies: [
        'source_policy',
        'owned_stockpile_counts',
        'cider_explore_modifiers',
        'stamina_budget',
        'rune_cube',
        'crafting_output_modifiers',
        'mastery_bonus_modifiers',
      ],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Keep Apple Cider distinct from manual explore and other consumables even when later implementations share helpers.',
        'Apple Cider can be owned now or crafted later, so availability should remain explicit.',
      ],
    },
    {
      key: 'lemonade',
      label: 'Lemonade',
      category: 'consumable',
      defaultPolicy: 'included_by_default',
      availability: 'both',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct_and_supporting',
      relevantAssumptionFamilies: [
        'source_policy',
        'owned_stockpile_counts',
        'lemonade_yield_modifiers',
        'crafting_output_modifiers',
        'mastery_bonus_modifiers',
      ],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Lemonade should remain a distinct source class even if later views present it near Arnold Palmer.',
      ],
    },
    {
      key: 'arnold_palmer',
      label: 'Arnold Palmer',
      category: 'consumable',
      defaultPolicy: 'included_by_default',
      availability: 'both',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct_and_supporting',
      relevantAssumptionFamilies: [
        'source_policy',
        'owned_stockpile_counts',
        'arnold_palmer_yield_modifiers',
        'crafting_output_modifiers',
        'mastery_bonus_modifiers',
      ],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Arnold Palmer is both a direct source class and a crafted object, so later planners should keep crafted supply and direct source effects separate.',
      ],
    },
    {
      key: 'orange_juice',
      label: 'Orange Juice',
      category: 'consumable',
      defaultPolicy: 'optional',
      availability: 'both',
      userInputDependence: 'required',
      modelingStatus: 'deferred',
      burdenSupport: 'direct_and_supporting',
      relevantAssumptionFamilies: [
        'source_policy',
        'owned_stockpile_counts',
        'orange_juice_yield_modifiers',
        'mastery_bonus_modifiers',
      ],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Orange Juice is included in the shared vocabulary now so later acquisition work does not have to add a one-off source class.',
        'Detailed quantity or efficiency modeling is intentionally deferred.',
      ],
    },
    {
      key: 'owned_containers',
      label: 'Owned Containers',
      category: 'owned_source',
      defaultPolicy: 'included_by_default',
      availability: 'immediate',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct',
      relevantAssumptionFamilies: ['source_policy', 'owned_stockpile_counts', 'mastery_bonus_modifiers'],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Represents bags, chests, and similar already-owned container sources.',
      ],
    },
    {
      key: 'owned_stockpiles',
      label: 'Owned Stockpiles',
      category: 'owned_source',
      defaultPolicy: 'included_by_default',
      availability: 'immediate',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct',
      relevantAssumptionFamilies: ['source_policy', 'owned_stockpile_counts', 'mastery_bonus_modifiers'],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Keeps owned-now inventory distinct from future craftable or future farmable acquisition.',
      ],
    },
    {
      key: 'stored_pet_inventory',
      label: 'Stored Pet Inventory',
      category: 'pet_source',
      defaultPolicy: 'included_by_default',
      availability: 'immediate',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct',
      relevantAssumptionFamilies: [
        'source_policy',
        'stored_pet_inventory_counts',
        'pet_quantity_modifiers',
        'mastery_bonus_modifiers',
      ],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Stored pet inventory should be treated as an immediate stockpile source and kept separate from future pet estimates.',
      ],
    },
    {
      key: 'future_pet_production',
      label: 'Future Pet Production',
      category: 'pet_source',
      defaultPolicy: 'optional',
      availability: 'future',
      userInputDependence: 'required',
      modelingStatus: 'planned_engine',
      burdenSupport: 'direct',
      relevantAssumptionFamilies: [
        'source_policy',
        'future_pet_levels_and_seasonality',
        'pet_quantity_modifiers',
        'mastery_bonus_modifiers',
      ],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Future pet production should be reported separately from stored inventory and can remain a simple estimate before any time-aware planner exists.',
      ],
    },
    {
      key: 'one_time_rewards',
      label: 'One-time Rewards',
      category: 'reward',
      defaultPolicy: 'excluded_by_default',
      availability: 'immediate',
      userInputDependence: 'required',
      modelingStatus: 'unsupported',
      burdenSupport: 'direct',
      relevantAssumptionFamilies: ['source_policy', 'excluded_source_policy'],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Includes sources such as one-time Tower rewards that should stay excluded by default from practical planning recommendations.',
      ],
    },
    {
      key: 'flea_market',
      label: 'Flea Market',
      category: 'excluded_source',
      defaultPolicy: 'excluded_by_default',
      availability: 'both',
      userInputDependence: 'required',
      modelingStatus: 'unsupported',
      burdenSupport: 'direct',
      relevantAssumptionFamilies: ['source_policy', 'excluded_source_policy'],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Flea Market remains excluded by default from the practical planner source policy.',
      ],
    },
    {
      key: 'exchange_center',
      label: 'Exchange Center',
      category: 'excluded_source',
      defaultPolicy: 'excluded_by_default',
      availability: 'both',
      userInputDependence: 'required',
      modelingStatus: 'unsupported',
      burdenSupport: 'direct',
      relevantAssumptionFamilies: ['source_policy', 'excluded_source_policy'],
      warningSafeMissingMetadata: 'warn_and_continue',
      notes: [
        'Exchange Center remains excluded by default from the practical planner source policy.',
      ],
    },
  ],
  scopeNotes: [
    'BL-061 defines a shared source-class vocabulary and planner-facing rule metadata for non-crafting acquisition planning.',
    'BL-062 should add the user-provided planner-input model that activates or configures these assumption families.',
    'This catalog is intentionally warning-safe and non-authoritative relative to canonical gameplay reference data or future source-engine implementations.',
  ],
};

export function getAcquisitionSourceDefinition(
  key: AcquisitionSourceKey,
): AcquisitionSourceDefinition | undefined {
  return ACQUISITION_SOURCE_CATALOG.sources.find((source) => source.key === key);
}

export function getAcquisitionAssumptionFamilyDefinition(
  key: AcquisitionAssumptionFamilyKey,
): AcquisitionAssumptionFamilyDefinition | undefined {
  return ACQUISITION_SOURCE_CATALOG.assumptionFamilies.find((family) => family.key === key);
}

export function getDefaultIncludedAcquisitionSources(): AcquisitionSourceDefinition[] {
  return ACQUISITION_SOURCE_CATALOG.sources.filter((source) => source.defaultPolicy === 'included_by_default');
}

export function getDeferredOrUnsupportedAcquisitionSources(): AcquisitionSourceDefinition[] {
  return ACQUISITION_SOURCE_CATALOG.sources.filter(
    (source) => source.modelingStatus === 'deferred' || source.modelingStatus === 'unsupported',
  );
}
