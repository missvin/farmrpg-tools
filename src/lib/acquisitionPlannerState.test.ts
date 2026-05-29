import { describe, expect, it } from 'vitest';

import { ACQUISITION_SOURCE_CATALOG } from './acquisitionSourceCatalog';
import {
  ACQUISITION_PLANNER_STATE_STORAGE_KEY,
  clearAcquisitionPlannerInputState,
  createDefaultAcquisitionPlannerInputState,
  getCurrentInventoryItemInputs,
  getResolvedAcquisitionSharedAssumptions,
  getFuturePetProductionEntries,
  getOwnedNowItemInputs,
  getStoredPetInventoryItemInputs,
  loadAcquisitionPlannerInputState,
  normalizeAcquisitionPlannerInputState,
  replaceCurrentInventoryEntries,
  replaceStoredPetInventoryEntries,
  removeCurrentInventoryItemInput,
  removeFuturePetProductionEntryInput,
  removeStoredPetInventoryItemInput,
  resolveAcquisitionSourceInclusion,
  resolveAcquisitionSourceInclusionMap,
  saveAcquisitionPlannerInputState,
  upsertCurrentInventoryItemInput,
  upsertFuturePetProductionEntryInput,
  upsertOwnedNowItemInput,
  upsertStoredPetInventoryItemInput,
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
        entries: [],
      },
      inventory: {
        entries: [],
      },
      pets: {
        storedInventoryEntries: [],
        futureProduction: {
          enabled: false,
          horizonDays: 7,
          entries: [],
          respectSeasonality: true,
          offlineHoursCap: 48,
          crunchyOmeletteActive: false,
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
      inventory: {
        entries: [
          {
            itemName: 'Strange Ring',
            inventoryCount: '1000',
          },
          {
            itemName: '',
            inventoryCount: 10,
          },
        ],
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
        entries: [
          {
            canonicalItemKey: 'twine',
            itemName: 'twine',
            ownedCount: 10,
            sourceCategory: 'stockpile',
          },
        ],
      },
      inventory: {
        entries: [
          {
            canonicalItemKey: 'strange ring',
            itemName: 'Strange Ring',
            inventoryCount: 1000,
          },
        ],
      },
      pets: {
        storedInventoryEntries: [],
        futureProduction: {
          enabled: true,
          horizonDays: 14,
          entries: [],
          respectSeasonality: false,
          offlineHoursCap: 72,
          crunchyOmeletteActive: false,
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

  it('adds, updates, and removes owned-now stockpile entries through shared helpers', () => {
    const withBag = upsertOwnedNowItemInput(createDefaultAcquisitionPlannerInputState(), {
      itemName: 'Large Chest',
      ownedCount: 3,
      sourceCategory: 'container',
    });

    expect(getOwnedNowItemInputs(withBag)).toEqual([
      {
        canonicalItemKey: 'large chest',
        itemName: 'Large Chest',
        ownedCount: 3,
        sourceCategory: 'container',
      },
    ]);

    const updated = upsertOwnedNowItemInput(withBag, {
      itemName: 'large chest',
      ownedCount: 8,
      sourceCategory: 'container',
    });

    expect(getOwnedNowItemInputs(updated)).toEqual([
      {
        canonicalItemKey: 'large chest',
        itemName: 'large chest',
        ownedCount: 8,
        sourceCategory: 'container',
      },
    ]);

    const removed = upsertOwnedNowItemInput(updated, {
      itemName: 'large chest',
      ownedCount: 0,
      sourceCategory: 'container',
    });

    expect(getOwnedNowItemInputs(removed)).toEqual([]);
  });

  it('persists, hydrates, and safely normalizes owned-now planner state', () => {
    const storage = window.localStorage;
    clearAcquisitionPlannerInputState(storage);

    const savedState = saveAcquisitionPlannerInputState(
      upsertOwnedNowItemInput(createDefaultAcquisitionPlannerInputState(), {
        itemName: 'Mystery Bag',
        ownedCount: 5,
        sourceCategory: 'stockpile',
      }),
      storage,
    );

    expect(savedState.ownedNow.entries).toEqual([
      {
        canonicalItemKey: 'mystery bag',
        itemName: 'Mystery Bag',
        ownedCount: 5,
        sourceCategory: 'stockpile',
      },
    ]);
    expect(storage.getItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY)).toContain('"canonicalItemKey":"mystery bag"');

    expect(loadAcquisitionPlannerInputState(storage)).toEqual(savedState);

    storage.setItem(
      ACQUISITION_PLANNER_STATE_STORAGE_KEY,
      JSON.stringify({
        ownedNow: {
          entries: [
            {
              itemName: '  ',
              ownedCount: 10,
              sourceCategory: 'stockpile',
            },
          ],
        },
      }),
    );

    expect(loadAcquisitionPlannerInputState(storage).ownedNow.entries).toEqual([]);
  });

  it('adds, replaces, removes, and safely normalizes current inventory entries', () => {
    const initialState = createDefaultAcquisitionPlannerInputState();
    const withShells = upsertCurrentInventoryItemInput(initialState, {
      itemName: 'Frost Snapper Shell',
      inventoryCount: 5614,
    });

    expect(getCurrentInventoryItemInputs(withShells)).toEqual([
      {
        canonicalItemKey: 'frost snapper shell',
        itemName: 'Frost Snapper Shell',
        inventoryCount: 5614,
      },
    ]);

    const replaced = replaceCurrentInventoryEntries(withShells, [
      {
        canonicalItemKey: 'strange ring',
        itemName: 'Strange Ring',
        inventoryCount: 1000,
      },
      {
        canonicalItemKey: 'frost snapper shell',
        itemName: 'Frost Snapper Shell',
        inventoryCount: 6000,
      },
    ]);

    expect(getCurrentInventoryItemInputs(replaced)).toEqual([
      {
        canonicalItemKey: 'frost snapper shell',
        itemName: 'Frost Snapper Shell',
        inventoryCount: 6000,
      },
      {
        canonicalItemKey: 'strange ring',
        itemName: 'Strange Ring',
        inventoryCount: 1000,
      },
    ]);

    const removed = removeCurrentInventoryItemInput(replaced, 'Frost Snapper Shell');
    expect(getCurrentInventoryItemInputs(removed)).toEqual([
      {
        canonicalItemKey: 'strange ring',
        itemName: 'Strange Ring',
        inventoryCount: 1000,
      },
    ]);

    expect(
      normalizeAcquisitionPlannerInputState({
        inventory: {
          entries: [
            {
              itemName: '  ',
              inventoryCount: 5,
            },
            {
              canonicalItemKey: 'large net',
              inventoryCount: '3',
            },
          ],
        },
      }),
    ).toMatchObject({
      inventory: {
        entries: [
          {
            canonicalItemKey: 'large net',
            itemName: 'large net',
            inventoryCount: 3,
          },
        ],
      },
    });
  });

  it('adds, replaces, removes, and safely normalizes stored pet inventory entries', () => {
    const initialState = createDefaultAcquisitionPlannerInputState();
    const withHoney = upsertStoredPetInventoryItemInput(initialState, {
      itemName: 'Honey',
      storedCount: 12,
    });

    expect(getStoredPetInventoryItemInputs(withHoney)).toEqual([
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        storedCount: 12,
      },
    ]);

    const replaced = replaceStoredPetInventoryEntries(withHoney, [
      {
        canonicalItemKey: 'apple',
        itemName: 'Apple',
        storedCount: 25,
      },
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        storedCount: 9,
      },
    ]);

    expect(getStoredPetInventoryItemInputs(replaced)).toEqual([
      {
        canonicalItemKey: 'apple',
        itemName: 'Apple',
        storedCount: 25,
      },
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        storedCount: 9,
      },
    ]);

    const removed = removeStoredPetInventoryItemInput(replaced, 'Honey');
    expect(getStoredPetInventoryItemInputs(removed)).toEqual([
      {
        canonicalItemKey: 'apple',
        itemName: 'Apple',
        storedCount: 25,
      },
    ]);

    expect(
      normalizeAcquisitionPlannerInputState({
        pets: {
          storedInventoryByCanonicalKey: {
            honey: 5,
            apple: 3,
          },
        },
      }),
    ).toMatchObject({
      pets: {
        storedInventoryEntries: [
          {
            canonicalItemKey: 'apple',
            itemName: 'apple',
            storedCount: 3,
          },
          {
            canonicalItemKey: 'honey',
            itemName: 'honey',
            storedCount: 5,
          },
        ],
      },
    });
  });

  it('adds, removes, and safely normalizes future pet production entries and assumptions', () => {
    const initialState = createDefaultAcquisitionPlannerInputState();
    const withFutureEntry = upsertFuturePetProductionEntryInput(initialState, {
      itemName: 'Honey',
      petName: 'Owl',
      petLevel: 6,
      seasonalActive: true,
    });

    expect(getFuturePetProductionEntries(withFutureEntry)).toEqual([
      {
        canonicalItemKey: 'honey',
        itemName: 'Honey',
        petName: 'Owl',
        petLevel: 6,
        seasonalActive: true,
      },
    ]);
    expect(getStoredPetInventoryItemInputs(withFutureEntry)).toEqual([]);

    const removed = removeFuturePetProductionEntryInput(withFutureEntry, 'Honey', 'Owl');
    expect(getFuturePetProductionEntries(removed)).toEqual([]);

    expect(
      normalizeAcquisitionPlannerInputState({
        pets: {
          futureProduction: {
            enabled: true,
            horizonDays: '10',
            petLevelsByCanonicalKey: {
              honey: 3,
            },
            respectSeasonality: false,
            offlineHoursCap: '36',
            crunchyOmeletteActive: true,
          },
        },
      }),
    ).toMatchObject({
      pets: {
        futureProduction: {
          enabled: true,
          horizonDays: 10,
          entries: [
            {
              canonicalItemKey: 'honey',
              itemName: 'honey',
              petName: 'honey',
              petLevel: 3,
              seasonalActive: true,
            },
          ],
          respectSeasonality: false,
          offlineHoursCap: 36,
          crunchyOmeletteActive: true,
        },
      },
    });
  });
});
