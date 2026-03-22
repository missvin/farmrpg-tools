import {
  ACQUISITION_SOURCE_CATALOG,
  type AcquisitionSourceKey,
} from './acquisitionSourceCatalog';
import type { UserCraftingModifierState } from './craftingModifierState';

export type AcquisitionSourcePolicyOverride = 'default' | 'force_included' | 'force_excluded';

export type AcquisitionPlanningHorizon = 'immediate_only' | 'include_future';

export type AcquisitionSourcePolicyState = {
  planningHorizon: AcquisitionPlanningHorizon;
  sourceOverrides: Record<AcquisitionSourceKey, AcquisitionSourcePolicyOverride>;
};

export type AcquisitionExplorePlannerState = {
  runeCubeActive: boolean;
  availableStamina: number;
  wandererPercent: number;
  exploringEffectivenessPercent: number;
  cinnamonSticksActive: boolean;
  neighActive: boolean;
};

export type AcquisitionConsumableAvailabilityState = {
  ownedCount: number;
  craftableNowCount: number;
  futureCraftableCount: number;
};

export type AppleCiderPlannerState = AcquisitionConsumableAvailabilityState;

export type LemonadePlannerState = AcquisitionConsumableAvailabilityState & {
  lemonSqueezerActive: boolean;
  quandaryChowderActive: boolean;
};

export type ArnoldPalmerPlannerState = AcquisitionConsumableAvailabilityState & {
  lemonSqueezerActive: boolean;
  quandaryChowderActive: boolean;
  lemonSeltzerUsesRemaining: number;
  lemonCreamPieActive: boolean;
};

export type OrangeJuicePlannerState = AcquisitionConsumableAvailabilityState;

export type AcquisitionConsumablePlannerState = {
  appleCider: AppleCiderPlannerState;
  lemonade: LemonadePlannerState;
  arnoldPalmer: ArnoldPalmerPlannerState;
  orangeJuice: OrangeJuicePlannerState;
};

export type AcquisitionOwnedNowPlannerState = {
  stockpileItemCountsByCanonicalKey: Record<string, number>;
  containerItemCountsByCanonicalKey: Record<string, number>;
};

export type AcquisitionPetPlannerState = {
  storedInventoryByCanonicalKey: Record<string, number>;
  futureProduction: {
    enabled: boolean;
    horizonDays: number;
    petLevelsByCanonicalKey: Record<string, number>;
    respectSeasonality: boolean;
    offlineHoursCap: number;
  };
};

export type AcquisitionPlannerInputState = {
  schemaVersion: 1;
  sourcePolicy: AcquisitionSourcePolicyState;
  explore: AcquisitionExplorePlannerState;
  consumables: AcquisitionConsumablePlannerState;
  ownedNow: AcquisitionOwnedNowPlannerState;
  pets: AcquisitionPetPlannerState;
};

export type ResolvedAcquisitionSharedAssumptions = {
  runeCubeActive: boolean;
  ironDepotActive: boolean;
};

type PartialAcquisitionSourcePolicyState = Partial<AcquisitionSourcePolicyState>;
type PartialAcquisitionExplorePlannerState = Partial<AcquisitionExplorePlannerState>;
type PartialAcquisitionConsumablePlannerState = Partial<AcquisitionConsumablePlannerState>;
type PartialAcquisitionOwnedNowPlannerState = Partial<AcquisitionOwnedNowPlannerState>;
type PartialAcquisitionPetPlannerState = Partial<AcquisitionPetPlannerState>;
type PartialFuturePetProductionState = Partial<AcquisitionPetPlannerState['futureProduction']>;

function createDefaultSourceOverrides(): Record<AcquisitionSourceKey, AcquisitionSourcePolicyOverride> {
  return ACQUISITION_SOURCE_CATALOG.sources.reduce(
    (result, source) => {
      result[source.key] = 'default';
      return result;
    },
    {} as Record<AcquisitionSourceKey, AcquisitionSourcePolicyOverride>,
  );
}

const DEFAULT_ACQUISITION_PLANNER_INPUT_STATE: AcquisitionPlannerInputState = {
  schemaVersion: 1,
  sourcePolicy: {
    planningHorizon: 'include_future',
    sourceOverrides: createDefaultSourceOverrides(),
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
};

function toBoolean(value: unknown): boolean {
  return value === true;
}

function clampNonNegativeNumber(value: unknown, fallback = 0): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return numericValue;
}

function normalizeRecordOfCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((result, [key, entry]) => {
    const normalizedKey = key.trim();
    const normalizedValue = clampNonNegativeNumber(entry, -1);

    if (normalizedKey.length > 0 && normalizedValue >= 0) {
      result[normalizedKey] = normalizedValue;
    }

    return result;
  }, {});
}

function normalizeSourcePolicyOverride(value: unknown): AcquisitionSourcePolicyOverride {
  return value === 'force_included' || value === 'force_excluded' || value === 'default' ? value : 'default';
}

function normalizeSourcePolicyOverrides(value: unknown): Record<AcquisitionSourceKey, AcquisitionSourcePolicyOverride> {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const normalized = createDefaultSourceOverrides();

  for (const source of ACQUISITION_SOURCE_CATALOG.sources) {
    normalized[source.key] = normalizeSourcePolicyOverride(record[source.key]);
  }

  return normalized;
}

function normalizePlanningHorizon(value: unknown): AcquisitionPlanningHorizon {
  return value === 'immediate_only' || value === 'include_future' ? value : 'include_future';
}

function normalizeConsumableAvailabilityState(value: unknown): AcquisitionConsumableAvailabilityState {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    ownedCount: clampNonNegativeNumber(record.ownedCount),
    craftableNowCount: clampNonNegativeNumber(record.craftableNowCount),
    futureCraftableCount: clampNonNegativeNumber(record.futureCraftableCount),
  };
}

export function createDefaultAcquisitionPlannerInputState(): AcquisitionPlannerInputState {
  return structuredClone(DEFAULT_ACQUISITION_PLANNER_INPUT_STATE);
}

export function normalizeAcquisitionPlannerInputState(value: unknown): AcquisitionPlannerInputState {
  if (!value || typeof value !== 'object') {
    return createDefaultAcquisitionPlannerInputState();
  }

  const record = value as Partial<AcquisitionPlannerInputState>;
  const sourcePolicy: PartialAcquisitionSourcePolicyState =
    record.sourcePolicy && typeof record.sourcePolicy === 'object' ? record.sourcePolicy : {};
  const explore: PartialAcquisitionExplorePlannerState =
    record.explore && typeof record.explore === 'object' ? record.explore : {};
  const consumables: PartialAcquisitionConsumablePlannerState =
    record.consumables && typeof record.consumables === 'object' ? record.consumables : {};
  const ownedNow: PartialAcquisitionOwnedNowPlannerState =
    record.ownedNow && typeof record.ownedNow === 'object' ? record.ownedNow : {};
  const pets: PartialAcquisitionPetPlannerState =
    record.pets && typeof record.pets === 'object' ? record.pets : {};
  const futureProduction: PartialFuturePetProductionState =
    pets.futureProduction && typeof pets.futureProduction === 'object' ? pets.futureProduction : {};

  const normalizedLemonade = normalizeConsumableAvailabilityState(consumables.lemonade);
  const normalizedArnoldPalmer = normalizeConsumableAvailabilityState(consumables.arnoldPalmer);

  return {
    schemaVersion: 1,
    sourcePolicy: {
      planningHorizon: normalizePlanningHorizon(sourcePolicy.planningHorizon),
      sourceOverrides: normalizeSourcePolicyOverrides(sourcePolicy.sourceOverrides),
    },
    explore: {
      runeCubeActive: toBoolean(explore.runeCubeActive),
      availableStamina: clampNonNegativeNumber(explore.availableStamina),
      wandererPercent: clampNonNegativeNumber(explore.wandererPercent),
      exploringEffectivenessPercent: clampNonNegativeNumber(explore.exploringEffectivenessPercent),
      cinnamonSticksActive: toBoolean(explore.cinnamonSticksActive),
      neighActive: toBoolean(explore.neighActive),
    },
    consumables: {
      appleCider: normalizeConsumableAvailabilityState(consumables.appleCider),
      lemonade: {
        ...normalizedLemonade,
        lemonSqueezerActive: toBoolean(consumables.lemonade?.lemonSqueezerActive),
        quandaryChowderActive: toBoolean(consumables.lemonade?.quandaryChowderActive),
      },
      arnoldPalmer: {
        ...normalizedArnoldPalmer,
        lemonSqueezerActive: toBoolean(consumables.arnoldPalmer?.lemonSqueezerActive),
        quandaryChowderActive: toBoolean(consumables.arnoldPalmer?.quandaryChowderActive),
        lemonSeltzerUsesRemaining: clampNonNegativeNumber(
          consumables.arnoldPalmer?.lemonSeltzerUsesRemaining,
        ),
        lemonCreamPieActive: toBoolean(consumables.arnoldPalmer?.lemonCreamPieActive),
      },
      orangeJuice: normalizeConsumableAvailabilityState(consumables.orangeJuice),
    },
    ownedNow: {
      stockpileItemCountsByCanonicalKey: normalizeRecordOfCounts(ownedNow.stockpileItemCountsByCanonicalKey),
      containerItemCountsByCanonicalKey: normalizeRecordOfCounts(ownedNow.containerItemCountsByCanonicalKey),
    },
    pets: {
      storedInventoryByCanonicalKey: normalizeRecordOfCounts(pets.storedInventoryByCanonicalKey),
      futureProduction: {
        enabled: toBoolean(futureProduction.enabled),
        horizonDays: clampNonNegativeNumber(futureProduction.horizonDays, 7),
        petLevelsByCanonicalKey: normalizeRecordOfCounts(futureProduction.petLevelsByCanonicalKey),
        respectSeasonality: futureProduction.respectSeasonality !== false,
        offlineHoursCap: clampNonNegativeNumber(futureProduction.offlineHoursCap, 48),
      },
    },
  };
}

export function resolveAcquisitionSourceInclusion(
  sourceKey: AcquisitionSourceKey,
  state: AcquisitionPlannerInputState,
): boolean {
  const source = ACQUISITION_SOURCE_CATALOG.sources.find((entry) => entry.key === sourceKey);

  if (!source) {
    return false;
  }

  const override = state.sourcePolicy.sourceOverrides[sourceKey];

  if (override === 'force_included') {
    return true;
  }

  if (override === 'force_excluded') {
    return false;
  }

  return source.defaultPolicy === 'included_by_default';
}

export function resolveAcquisitionSourceInclusionMap(
  state: AcquisitionPlannerInputState,
): Record<AcquisitionSourceKey, boolean> {
  return ACQUISITION_SOURCE_CATALOG.sources.reduce(
    (result, source) => {
      result[source.key] = resolveAcquisitionSourceInclusion(source.key, state);
      return result;
    },
    {} as Record<AcquisitionSourceKey, boolean>,
  );
}

export function getResolvedAcquisitionSharedAssumptions(
  state: AcquisitionPlannerInputState,
  craftingModifierState?: Pick<UserCraftingModifierState, 'planning'> | null,
): ResolvedAcquisitionSharedAssumptions {
  return {
    runeCubeActive: state.explore.runeCubeActive,
    ironDepotActive: craftingModifierState?.planning.ironDepotActive ?? false,
  };
}
