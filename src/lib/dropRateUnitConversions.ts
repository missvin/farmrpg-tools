import type {
  DropRateAcquisitionSettings,
  DropRateExploringUnit,
  DropRateFarmingUnit,
  DropRateFishingUnit,
} from './dropRateAcquisitionSettings';

export type DropRateSourceType = 'explore' | 'fishing' | 'farming';

export type DropRateDisplayUnit =
  | DropRateExploringUnit
  | DropRateFishingUnit
  | DropRateFarmingUnit;

export type DropRateDirection = 'items_per_unit' | 'units_per_item';

export type DropRateUnitConversionInput = {
  rate: number;
  sourceType: string;
  fromUnit: DropRateDisplayUnit;
  toUnit: DropRateDisplayUnit;
  direction: DropRateDirection;
  settings: DropRateAcquisitionSettings;
  baseDropRate?: number | null;
};

export type DropRateUnitBasis = {
  unit: DropRateDisplayUnit;
  label: string;
  sourceQuantity: number;
};

export type DropRateUnitConversionResult = {
  calculable: boolean;
  rate: number;
  fromUnit: DropRateDisplayUnit;
  toUnit: DropRateDisplayUnit;
  fromBasis: DropRateUnitBasis | null;
  toBasis: DropRateUnitBasis | null;
  blockerReason: string | null;
};

const DEFAULT_BASE_DROP_RATE = 1;
const APPLE_CIDER_BUDDY_BASE_EXPLORES = 1000;
const APPLE_CIDER_BUDDY_CINNAMON_EXPLORES = 1250;
const APPLE_CIDER_DROP_RATE = 0.4;
const ORANGE_JUICE_STAMINA = 100;
const LEMONADE_BASE_ITEMS = 10;
const LEMONADE_SQUEEZER_ITEMS = 20;
const ARNOLD_PALMER_BASE_ITEMS = 200;
const ARNOLD_PALMER_SQUEEZER_ITEMS = 500;
const FISHING_NET_FISH = 10;
const LARGE_NET_BASE_FISH = 250;
const LARGE_NET_REINFORCED_FISH = 400;
const LARGE_NET_TRAWL_FISH = 500;
const BUDDY_MATCHING_HARVEST_ALL_CROPS = 40;

const EXPLORING_UNITS = new Set<DropRateDisplayUnit>([
  'explores',
  'stamina',
  'orange_juices',
  'apple_ciders',
  'lemonades',
  'arnold_palmers',
]);
const FISHING_UNITS = new Set<DropRateDisplayUnit>(['fish', 'fishing_nets', 'large_nets']);
const FARMING_UNITS = new Set<DropRateDisplayUnit>(['crops', 'seeds', 'harvest_alls']);

function clampPositive(value: number | null | undefined, fallback = DEFAULT_BASE_DROP_RATE): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function getExploresPerStamina(settings: DropRateAcquisitionSettings): number {
  const staminaMultiplier = 1 - clampPercent(settings.perks.wandererPercent) / 100;
  return staminaMultiplier > 0 ? 1 / staminaMultiplier : 1;
}

function getLargeNetFish(settings: DropRateAcquisitionSettings): number {
  if (settings.perks.fishingTrawlActive) {
    return LARGE_NET_TRAWL_FISH;
  }

  if (settings.perks.reinforcedNettingActive) {
    return LARGE_NET_REINFORCED_FISH;
  }

  return LARGE_NET_BASE_FISH;
}

function getAppleCiderSourceQuantity(settings: DropRateAcquisitionSettings): number {
  const explores = settings.perks.cinnamonSticksActive
    ? APPLE_CIDER_BUDDY_CINNAMON_EXPLORES
    : APPLE_CIDER_BUDDY_BASE_EXPLORES;

  return explores * APPLE_CIDER_DROP_RATE;
}

function getExploringUnitBasis(
  unit: DropRateDisplayUnit,
  settings: DropRateAcquisitionSettings,
  baseDropRate: number | null | undefined,
): DropRateUnitBasis | null {
  if (!EXPLORING_UNITS.has(unit)) {
    return null;
  }

  const itemRollsPerExplore = clampPositive(baseDropRate);
  const exploresPerStamina = getExploresPerStamina(settings);

  switch (unit) {
    case 'explores':
      return { unit, label: 'explore', sourceQuantity: itemRollsPerExplore };
    case 'stamina':
      return {
        unit,
        label: 'stamina',
        sourceQuantity: itemRollsPerExplore * exploresPerStamina,
      };
    case 'orange_juices':
      return {
        unit,
        label: 'Orange Juice',
        sourceQuantity: itemRollsPerExplore * exploresPerStamina * ORANGE_JUICE_STAMINA,
      };
    case 'apple_ciders':
      return {
        unit,
        label: 'Apple Cider',
        sourceQuantity: getAppleCiderSourceQuantity(settings),
      };
    case 'lemonades':
      return {
        unit,
        label: 'Lemonade',
        sourceQuantity: settings.perks.lemonSqueezerActive
          ? LEMONADE_SQUEEZER_ITEMS
          : LEMONADE_BASE_ITEMS,
      };
    case 'arnold_palmers':
      return {
        unit,
        label: 'Arnold Palmer',
        sourceQuantity: settings.perks.lemonSqueezerActive
          ? ARNOLD_PALMER_SQUEEZER_ITEMS
          : ARNOLD_PALMER_BASE_ITEMS,
      };
    default:
      return null;
  }
}

function getFishingUnitBasis(
  unit: DropRateDisplayUnit,
  settings: DropRateAcquisitionSettings,
): DropRateUnitBasis | null {
  if (!FISHING_UNITS.has(unit)) {
    return null;
  }

  switch (unit) {
    case 'fish':
      return { unit, label: 'fish', sourceQuantity: 1 };
    case 'fishing_nets':
      return { unit, label: 'Fishing Net', sourceQuantity: FISHING_NET_FISH };
    case 'large_nets':
      return { unit, label: 'Large Net', sourceQuantity: getLargeNetFish(settings) };
    default:
      return null;
  }
}

function getFarmingUnitBasis(unit: DropRateDisplayUnit): DropRateUnitBasis | null {
  if (!FARMING_UNITS.has(unit)) {
    return null;
  }

  switch (unit) {
    case 'crops':
      return { unit, label: 'crop', sourceQuantity: 1 };
    case 'seeds':
      return { unit, label: 'seed', sourceQuantity: 1 };
    case 'harvest_alls':
      return {
        unit,
        label: 'Harvest All',
        sourceQuantity: BUDDY_MATCHING_HARVEST_ALL_CROPS,
      };
    default:
      return null;
  }
}

export function normalizeDropRateSourceType(sourceType: string): DropRateSourceType | null {
  const normalizedSourceType = sourceType.trim().toLowerCase();

  if (['explore', 'exploring'].includes(normalizedSourceType)) {
    return 'explore';
  }

  if (['fishing', 'fish'].includes(normalizedSourceType)) {
    return 'fishing';
  }

  if (['farming', 'farm', 'seed'].includes(normalizedSourceType)) {
    return 'farming';
  }

  return null;
}

export function getPreferredDropRateUnit(
  sourceType: string,
  settings: DropRateAcquisitionSettings,
): DropRateDisplayUnit | null {
  const normalizedSourceType = normalizeDropRateSourceType(sourceType);

  if (normalizedSourceType === 'explore') {
    return settings.units.exploring;
  }

  if (normalizedSourceType === 'fishing') {
    return settings.units.fishing;
  }

  if (normalizedSourceType === 'farming') {
    return settings.units.farming;
  }

  return null;
}

export function getDropRateUnitBasis(
  sourceType: string,
  unit: DropRateDisplayUnit,
  settings: DropRateAcquisitionSettings,
  baseDropRate?: number | null,
): DropRateUnitBasis | null {
  const normalizedSourceType = normalizeDropRateSourceType(sourceType);

  if (normalizedSourceType === 'explore') {
    return getExploringUnitBasis(unit, settings, baseDropRate);
  }

  if (normalizedSourceType === 'fishing') {
    return getFishingUnitBasis(unit, settings);
  }

  if (normalizedSourceType === 'farming') {
    return getFarmingUnitBasis(unit);
  }

  return null;
}

export function convertDropRateUnit(
  input: DropRateUnitConversionInput,
): DropRateUnitConversionResult {
  const fromBasis = getDropRateUnitBasis(
    input.sourceType,
    input.fromUnit,
    input.settings,
    input.baseDropRate,
  );
  const toBasis = getDropRateUnitBasis(
    input.sourceType,
    input.toUnit,
    input.settings,
    input.baseDropRate,
  );

  if (!Number.isFinite(input.rate) || input.rate < 0) {
    return {
      calculable: false,
      rate: 0,
      fromUnit: input.fromUnit,
      toUnit: input.toUnit,
      fromBasis,
      toBasis,
      blockerReason: 'Drop rate must be a non-negative number.',
    };
  }

  if (!fromBasis || !toBasis) {
    return {
      calculable: false,
      rate: 0,
      fromUnit: input.fromUnit,
      toUnit: input.toUnit,
      fromBasis,
      toBasis,
      blockerReason: 'Drop-rate units do not match the source type.',
    };
  }

  if (fromBasis.sourceQuantity <= 0 || toBasis.sourceQuantity <= 0) {
    return {
      calculable: false,
      rate: 0,
      fromUnit: input.fromUnit,
      toUnit: input.toUnit,
      fromBasis,
      toBasis,
      blockerReason: 'Drop-rate unit conversion has an invalid source quantity.',
    };
  }

  const rate = input.direction === 'items_per_unit'
    ? input.rate * (toBasis.sourceQuantity / fromBasis.sourceQuantity)
    : input.rate * (fromBasis.sourceQuantity / toBasis.sourceQuantity);

  return {
    calculable: true,
    rate,
    fromUnit: input.fromUnit,
    toUnit: input.toUnit,
    fromBasis,
    toBasis,
    blockerReason: null,
  };
}
