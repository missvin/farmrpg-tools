import { normalizeName } from './normalizeItemKey';

export const DROP_RATE_ACQUISITION_SETTINGS_STORAGE_KEY =
  'farmrpg-tools.dropRateAcquisitionSettings';

export type DropRateExploringUnit =
  | 'explores'
  | 'stamina'
  | 'orange_juices'
  | 'apple_ciders'
  | 'lemonades'
  | 'arnold_palmers';

export type DropRateFishingUnit = 'fish' | 'fishing_nets' | 'large_nets';

export type DropRateFarmingUnit = 'crops' | 'seeds' | 'harvest_alls';

export type DropRateZoneExploringEffectiveness = {
  sourceName: string;
  sourceCanonicalKey: string;
  effectivenessPercent: number;
};

export type DropRateAcquisitionSettings = {
  schemaVersion: 1;
  perks: {
    ironDepotActive: boolean;
    wandererPercent: number;
    cinnamonSticksActive: boolean;
    lemonSqueezerActive: boolean;
    reinforcedNettingActive: boolean;
    fishingTrawlActive: boolean;
    resourceSaverPercent: number;
    eagleEyeRunecubeActive: boolean;
  };
  units: {
    exploring: DropRateExploringUnit;
    fishing: DropRateFishingUnit;
    farming: DropRateFarmingUnit;
  };
  zoneExploringEffectiveness: DropRateZoneExploringEffectiveness[];
  meals: {
    quandaryChowderActive: boolean;
    seaPincherSpecialActive: boolean;
    seaPincherSpecialPercent: number;
  };
};

type PartialDropRateAcquisitionPerks = Partial<DropRateAcquisitionSettings['perks']>;
type PartialDropRateAcquisitionUnits = Partial<DropRateAcquisitionSettings['units']>;
type PartialDropRateAcquisitionMeals = Partial<DropRateAcquisitionSettings['meals']>;

const EXPLORING_UNITS = new Set<DropRateExploringUnit>([
  'explores',
  'stamina',
  'orange_juices',
  'apple_ciders',
  'lemonades',
  'arnold_palmers',
]);

const FISHING_UNITS = new Set<DropRateFishingUnit>(['fish', 'fishing_nets', 'large_nets']);

const FARMING_UNITS = new Set<DropRateFarmingUnit>(['crops', 'seeds', 'harvest_alls']);

const DEFAULT_DROP_RATE_ACQUISITION_SETTINGS: DropRateAcquisitionSettings = {
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
  zoneExploringEffectiveness: [],
  meals: {
    quandaryChowderActive: false,
    seaPincherSpecialActive: false,
    seaPincherSpecialPercent: 10,
  },
};

function toBoolean(value: unknown, fallback = false): boolean {
  return value === true ? true : value === false ? false : fallback;
}

function clampPercent(value: unknown, fallback = 0): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, numericValue));
}

function toCanonicalSourceKey(value: string): string {
  return normalizeName(value);
}

function normalizeZoneExploringEffectiveness(value: unknown): DropRateZoneExploringEffectiveness[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byCanonicalKey = new Map<string, DropRateZoneExploringEffectiveness>();

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as Partial<DropRateZoneExploringEffectiveness>;
    const sourceName = typeof record.sourceName === 'string' ? record.sourceName.trim() : '';
    const sourceCanonicalKey = toCanonicalSourceKey(
      typeof record.sourceCanonicalKey === 'string' ? record.sourceCanonicalKey : sourceName,
    );

    if (!sourceName || !sourceCanonicalKey) {
      continue;
    }

    byCanonicalKey.set(sourceCanonicalKey, {
      sourceName,
      sourceCanonicalKey,
      effectivenessPercent: clampPercent(record.effectivenessPercent),
    });
  }

  return [...byCanonicalKey.values()].sort((left, right) => left.sourceName.localeCompare(right.sourceName));
}

function normalizeExploringUnit(value: unknown): DropRateExploringUnit {
  return typeof value === 'string' && EXPLORING_UNITS.has(value as DropRateExploringUnit)
    ? (value as DropRateExploringUnit)
    : DEFAULT_DROP_RATE_ACQUISITION_SETTINGS.units.exploring;
}

function normalizeFishingUnit(value: unknown): DropRateFishingUnit {
  return typeof value === 'string' && FISHING_UNITS.has(value as DropRateFishingUnit)
    ? (value as DropRateFishingUnit)
    : DEFAULT_DROP_RATE_ACQUISITION_SETTINGS.units.fishing;
}

function normalizeFarmingUnit(value: unknown): DropRateFarmingUnit {
  return typeof value === 'string' && FARMING_UNITS.has(value as DropRateFarmingUnit)
    ? (value as DropRateFarmingUnit)
    : DEFAULT_DROP_RATE_ACQUISITION_SETTINGS.units.farming;
}

function getLocalStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

export function createDefaultDropRateAcquisitionSettings(): DropRateAcquisitionSettings {
  return structuredClone(DEFAULT_DROP_RATE_ACQUISITION_SETTINGS);
}

export function normalizeDropRateAcquisitionSettings(value: unknown): DropRateAcquisitionSettings {
  if (!value || typeof value !== 'object') {
    return createDefaultDropRateAcquisitionSettings();
  }

  const record = value as Partial<DropRateAcquisitionSettings>;
  const perks: PartialDropRateAcquisitionPerks =
    record.perks && typeof record.perks === 'object' ? record.perks : {};
  const units: PartialDropRateAcquisitionUnits =
    record.units && typeof record.units === 'object' ? record.units : {};
  const meals: PartialDropRateAcquisitionMeals =
    record.meals && typeof record.meals === 'object' ? record.meals : {};
  const defaultSettings = createDefaultDropRateAcquisitionSettings();

  return {
    schemaVersion: 1,
    perks: {
      ironDepotActive: toBoolean(perks.ironDepotActive, defaultSettings.perks.ironDepotActive),
      wandererPercent: clampPercent(
        perks.wandererPercent,
        defaultSettings.perks.wandererPercent,
      ),
      cinnamonSticksActive: toBoolean(
        perks.cinnamonSticksActive,
        defaultSettings.perks.cinnamonSticksActive,
      ),
      lemonSqueezerActive: toBoolean(
        perks.lemonSqueezerActive,
        defaultSettings.perks.lemonSqueezerActive,
      ),
      reinforcedNettingActive: toBoolean(
        perks.reinforcedNettingActive,
        defaultSettings.perks.reinforcedNettingActive,
      ),
      fishingTrawlActive: toBoolean(
        perks.fishingTrawlActive,
        defaultSettings.perks.fishingTrawlActive,
      ),
      resourceSaverPercent: clampPercent(
        perks.resourceSaverPercent,
        defaultSettings.perks.resourceSaverPercent,
      ),
      eagleEyeRunecubeActive: toBoolean(
        perks.eagleEyeRunecubeActive,
        defaultSettings.perks.eagleEyeRunecubeActive,
      ),
    },
    units: {
      exploring: normalizeExploringUnit(units.exploring),
      fishing: normalizeFishingUnit(units.fishing),
      farming: normalizeFarmingUnit(units.farming),
    },
    zoneExploringEffectiveness: normalizeZoneExploringEffectiveness(record.zoneExploringEffectiveness),
    meals: {
      quandaryChowderActive: toBoolean(
        meals.quandaryChowderActive,
        defaultSettings.meals.quandaryChowderActive,
      ),
      seaPincherSpecialActive: toBoolean(
        meals.seaPincherSpecialActive,
        defaultSettings.meals.seaPincherSpecialActive,
      ),
      seaPincherSpecialPercent: clampPercent(
        meals.seaPincherSpecialPercent,
        defaultSettings.meals.seaPincherSpecialPercent,
      ),
    },
  };
}

export function upsertZoneExploringEffectiveness(
  settings: DropRateAcquisitionSettings,
  input: { sourceName: string; effectivenessPercent: number },
): DropRateAcquisitionSettings {
  const sourceName = input.sourceName.trim();
  const sourceCanonicalKey = toCanonicalSourceKey(sourceName);

  if (!sourceName || !sourceCanonicalKey) {
    return normalizeDropRateAcquisitionSettings(settings);
  }

  return normalizeDropRateAcquisitionSettings({
    ...settings,
    zoneExploringEffectiveness: [
      ...settings.zoneExploringEffectiveness.filter((entry) => entry.sourceCanonicalKey !== sourceCanonicalKey),
      { sourceName, sourceCanonicalKey, effectivenessPercent: input.effectivenessPercent },
    ],
  });
}

export function removeZoneExploringEffectiveness(
  settings: DropRateAcquisitionSettings,
  sourceCanonicalKey: string,
): DropRateAcquisitionSettings {
  return normalizeDropRateAcquisitionSettings({
    ...settings,
    zoneExploringEffectiveness: settings.zoneExploringEffectiveness.filter(
      (entry) => entry.sourceCanonicalKey !== sourceCanonicalKey,
    ),
  });
}

export function loadDropRateAcquisitionSettings(storage?: Storage): DropRateAcquisitionSettings {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(DROP_RATE_ACQUISITION_SETTINGS_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultDropRateAcquisitionSettings();
  }

  try {
    return normalizeDropRateAcquisitionSettings(JSON.parse(rawValue));
  } catch {
    return createDefaultDropRateAcquisitionSettings();
  }
}

export function saveDropRateAcquisitionSettings(
  settings: DropRateAcquisitionSettings,
  storage?: Storage,
): DropRateAcquisitionSettings {
  const normalizedSettings = normalizeDropRateAcquisitionSettings(settings);
  const activeStorage = getLocalStorage(storage);

  activeStorage.setItem(
    DROP_RATE_ACQUISITION_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizedSettings),
  );
  return normalizedSettings;
}

export function clearDropRateAcquisitionSettings(storage?: Storage): void {
  const activeStorage = getLocalStorage(storage);
  activeStorage.removeItem(DROP_RATE_ACQUISITION_SETTINGS_STORAGE_KEY);
}
