import {
  getCraftingModifierDefinition,
  type CraftingModifierDefinition,
} from './craftingMasteryRules';

export const CRAFTING_MODIFIER_STATE_STORAGE_KEY = 'farmrpg-tools.craftingModifierState';

export type PersistentCraftingModifierState = {
  resourceSaver1Unlocked: boolean;
  resourceSaver2Unlocked: boolean;
  resourceSaver3Unlocked: boolean;
};

export type TemporaryCraftingModifierState = {
  mushroomStewActive: boolean;
  eventMasteryBonusPercent: number;
  eventResourceSaverBonusPercent: number;
};

export type PlanningCraftingModifierState = {
  includeExcludedRecipes: boolean;
  ironDepotActive: boolean;
};

export type UserCraftingModifierState = {
  schemaVersion: 1;
  persistent: PersistentCraftingModifierState;
  temporary: TemporaryCraftingModifierState;
  planning: PlanningCraftingModifierState;
};

export type ActiveCraftingModifierStateEntry = {
  key: CraftingModifierDefinition['key'];
  percent: number | null;
  definition: CraftingModifierDefinition;
};

const DEFAULT_USER_CRAFTING_MODIFIER_STATE: UserCraftingModifierState = {
  schemaVersion: 1,
  persistent: {
    resourceSaver1Unlocked: false,
    resourceSaver2Unlocked: false,
    resourceSaver3Unlocked: false,
  },
  temporary: {
    mushroomStewActive: false,
    eventMasteryBonusPercent: 0,
    eventResourceSaverBonusPercent: 0,
  },
  planning: {
    includeExcludedRecipes: false,
    ironDepotActive: false,
  },
};

function clampPercent(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

export function createDefaultCraftingModifierState(): UserCraftingModifierState {
  return structuredClone(DEFAULT_USER_CRAFTING_MODIFIER_STATE);
}

export function normalizeCraftingModifierState(value: unknown): UserCraftingModifierState {
  if (!value || typeof value !== 'object') {
    return createDefaultCraftingModifierState();
  }

  const record = value as Partial<UserCraftingModifierState>;
  const persistent = record.persistent && typeof record.persistent === 'object' ? record.persistent : {};
  const temporary = record.temporary && typeof record.temporary === 'object' ? record.temporary : {};
  const planning = record.planning && typeof record.planning === 'object' ? record.planning : {};

  return {
    schemaVersion: 1,
    persistent: {
      resourceSaver1Unlocked: toBoolean(
        (persistent as Partial<PersistentCraftingModifierState>).resourceSaver1Unlocked,
      ),
      resourceSaver2Unlocked: toBoolean(
        (persistent as Partial<PersistentCraftingModifierState>).resourceSaver2Unlocked,
      ),
      resourceSaver3Unlocked: toBoolean(
        (persistent as Partial<PersistentCraftingModifierState>).resourceSaver3Unlocked,
      ),
    },
    temporary: {
      mushroomStewActive: toBoolean(
        (temporary as Partial<TemporaryCraftingModifierState>).mushroomStewActive,
      ),
      eventMasteryBonusPercent: clampPercent(
        (temporary as Partial<TemporaryCraftingModifierState>).eventMasteryBonusPercent,
      ),
      eventResourceSaverBonusPercent: clampPercent(
        (temporary as Partial<TemporaryCraftingModifierState>).eventResourceSaverBonusPercent,
      ),
    },
    planning: {
      includeExcludedRecipes: toBoolean(
        (planning as Partial<PlanningCraftingModifierState>).includeExcludedRecipes,
      ),
      ironDepotActive: toBoolean(
        (planning as Partial<PlanningCraftingModifierState>).ironDepotActive,
      ),
    },
  };
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

export function loadCraftingModifierState(storage?: Storage): UserCraftingModifierState {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultCraftingModifierState();
  }

  try {
    return normalizeCraftingModifierState(JSON.parse(rawValue));
  } catch {
    return createDefaultCraftingModifierState();
  }
}

export function saveCraftingModifierState(state: UserCraftingModifierState, storage?: Storage): UserCraftingModifierState {
  const normalizedState = normalizeCraftingModifierState(state);
  const activeStorage = getLocalStorage(storage);

  activeStorage.setItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearCraftingModifierState(storage?: Storage): void {
  const activeStorage = getLocalStorage(storage);
  activeStorage.removeItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY);
}

export function getActiveCraftingModifierStateEntries(
  state: UserCraftingModifierState,
): ActiveCraftingModifierStateEntry[] {
  const activeKeys: Array<{ key: CraftingModifierDefinition['key']; percent: number | null }> = [];

  if (state.persistent.resourceSaver1Unlocked) {
    activeKeys.push({ key: 'resource_saver_i', percent: null });
  }

  if (state.persistent.resourceSaver2Unlocked) {
    activeKeys.push({ key: 'resource_saver_ii', percent: null });
  }

  if (state.persistent.resourceSaver3Unlocked) {
    activeKeys.push({ key: 'resource_saver_iii', percent: null });
  }

  if (state.temporary.mushroomStewActive) {
    activeKeys.push({ key: 'mushroom_stew_mastery_bonus', percent: null });
  }

  if (state.temporary.eventMasteryBonusPercent > 0) {
    activeKeys.push({
      key: 'event_item_mastery_bonus',
      percent: state.temporary.eventMasteryBonusPercent,
    });
  }

  if (state.temporary.eventResourceSaverBonusPercent > 0) {
    activeKeys.push({
      key: 'event_resource_saver_bonus',
      percent: state.temporary.eventResourceSaverBonusPercent,
    });
  }

  return activeKeys.flatMap((entry) => {
    const definition = getCraftingModifierDefinition(entry.key);
    return definition ? [{ ...entry, definition }] : [];
  });
}
