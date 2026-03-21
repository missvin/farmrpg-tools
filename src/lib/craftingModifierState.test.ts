import { describe, expect, it } from 'vitest';

import {
  CRAFTING_MODIFIER_STATE_STORAGE_KEY,
  clearCraftingModifierState,
  createDefaultCraftingModifierState,
  getActiveCraftingModifierStateEntries,
  loadCraftingModifierState,
  normalizeCraftingModifierState,
  saveCraftingModifierState,
} from './craftingModifierState';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe('craftingModifierState', () => {
  it('creates a sensible default local modifier state', () => {
    expect(createDefaultCraftingModifierState()).toEqual({
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
    });
  });

  it('normalizes malformed or partial user state into the supported BL-032 shape', () => {
    expect(
      normalizeCraftingModifierState({
        schemaVersion: 999,
        persistent: {
          resourceSaver1Unlocked: true,
          resourceSaver2Unlocked: 'yes',
          resourceSaver3Unlocked: 1,
        },
        temporary: {
          mushroomStewActive: true,
          eventMasteryBonusPercent: '0.17',
          eventResourceSaverBonusPercent: -0.2,
        },
        planning: {
          includeExcludedRecipes: 'yes',
          ironDepotActive: true,
        },
      }),
    ).toEqual({
      schemaVersion: 1,
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: false,
      },
      temporary: {
        mushroomStewActive: true,
        eventMasteryBonusPercent: 0.17,
        eventResourceSaverBonusPercent: 0,
      },
      planning: {
        includeExcludedRecipes: false,
        ironDepotActive: true,
      },
    });

    expect(normalizeCraftingModifierState(null)).toEqual(createDefaultCraftingModifierState());
  });

  it('persists and reloads normalized single-profile modifier state through storage', () => {
    const storage = createMemoryStorage();

    const savedState = saveCraftingModifierState(
      {
        schemaVersion: 1,
        persistent: {
          resourceSaver1Unlocked: true,
          resourceSaver2Unlocked: false,
          resourceSaver3Unlocked: true,
        },
        temporary: {
          mushroomStewActive: true,
          eventMasteryBonusPercent: 0.17,
          eventResourceSaverBonusPercent: 0.05,
        },
        planning: {
          includeExcludedRecipes: true,
          ironDepotActive: true,
        },
      },
      storage,
    );

    expect(savedState).toEqual({
      schemaVersion: 1,
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: true,
      },
      temporary: {
        mushroomStewActive: true,
        eventMasteryBonusPercent: 0.17,
        eventResourceSaverBonusPercent: 0.05,
      },
      planning: {
        includeExcludedRecipes: true,
        ironDepotActive: true,
      },
    });
    expect(storage.getItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY)).toBe(
      JSON.stringify(savedState),
    );
    expect(loadCraftingModifierState(storage)).toEqual(savedState);
  });

  it('falls back safely for missing or malformed stored state and can be cleared', () => {
    const storage = createMemoryStorage();

    expect(loadCraftingModifierState(storage)).toEqual(createDefaultCraftingModifierState());

    storage.setItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY, '{bad json');
    expect(loadCraftingModifierState(storage)).toEqual(createDefaultCraftingModifierState());

    saveCraftingModifierState(createDefaultCraftingModifierState(), storage);
    clearCraftingModifierState(storage);
    expect(storage.getItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY)).toBeNull();
  });

  it('expands active user state into BL-031 modifier definitions without mixing modifier families', () => {
    const activeEntries = getActiveCraftingModifierStateEntries({
      schemaVersion: 1,
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: true,
      },
      temporary: {
        mushroomStewActive: true,
        eventMasteryBonusPercent: 0.17,
        eventResourceSaverBonusPercent: 0.05,
      },
      planning: {
        includeExcludedRecipes: false,
        ironDepotActive: true,
      },
    });

    expect(activeEntries.map((entry) => entry.key)).toEqual([
      'resource_saver_i',
      'resource_saver_iii',
      'mushroom_stew_mastery_bonus',
      'event_item_mastery_bonus',
      'event_resource_saver_bonus',
    ]);
    expect(activeEntries.map((entry) => entry.definition.familyKey)).toEqual([
      'resource_saver',
      'resource_saver',
      'mastery_bonus',
      'mastery_bonus',
      'resource_saver',
    ]);
    expect(activeEntries.map((entry) => entry.percent)).toEqual([
      null,
      null,
      null,
      0.17,
      0.05,
    ]);
  });
});
