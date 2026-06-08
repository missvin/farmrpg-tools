import { describe, expect, it } from 'vitest';

import {
  createDefaultLargeNetPlannerState,
  LARGE_NET_PLANNER_STATE_STORAGE_KEY,
  loadLargeNetPlannerState,
  normalizeLargeNetPlannerState,
  saveLargeNetPlannerState,
} from './largeNetPlannerState';

describe('largeNetPlannerState', () => {
  it('creates default planner state with the requested Crunchy assumption', () => {
    expect(createDefaultLargeNetPlannerState({ crunchyOmeletteActive: true })).toMatchObject({
      directLargeNetsPerDay: '2000',
      waitDays: '7',
      craftOutputMultiplier: '1.45',
      catchMultiplier: '1.1',
      crunchyOmeletteActive: true,
    });
  });

  it('normalizes and keeps manual Large Nets per drop values', () => {
    const state = normalizeLargeNetPlannerState({
      schemaVersion: 1,
      dailyAntlers: '123',
      directLargeNetsPerDay: '',
      waitDays: '14',
      craftOutputMultiplier: '1.45',
      catchMultiplier: '1.1',
      crunchyOmeletteActive: true,
      targets: [
        {
          id: 'frost',
          itemName: 'Frost Snapper Shell',
          targetQuantity: '15000',
          regularInventoryOverride: '515',
          storedPetInventoryOverride: '5730',
          petNameOverride: 'Seal',
          petLevelOverride: '9',
          manualLargeNetsPerDrop: '39.46',
        },
      ],
    });

    expect(state.targets[0]?.manualLargeNetsPerDrop).toBe('39.46');
    expect(state.waitDays).toBe('14');
    expect(state.targets[0]?.regularInventoryOverride).toBe('515');
    expect(state.targets[0]?.storedPetInventoryOverride).toBe('5730');
    expect(state.targets[0]?.petNameOverride).toBe('Seal');
    expect(state.targets[0]?.petLevelOverride).toBe('9');
    expect(state.targets[0]?.itemName).toBe('Frost Snapper Shell');
  });

  it('saves and reloads planner state from local storage', () => {
    const storage = window.localStorage;
    const state = createDefaultLargeNetPlannerState({ crunchyOmeletteActive: true });

    state.targets[0] = {
      ...state.targets[0],
      manualLargeNetsPerDrop: '39.46',
      storedPetInventoryOverride: '5730',
      petLevelOverride: '9',
    };
    state.waitDays = '30';

    saveLargeNetPlannerState(state, storage);

    expect(storage.getItem(LARGE_NET_PLANNER_STATE_STORAGE_KEY)).toContain('30');
    expect(storage.getItem(LARGE_NET_PLANNER_STATE_STORAGE_KEY)).toContain('39.46');
    expect(loadLargeNetPlannerState(storage)?.waitDays).toBe('30');
    expect(loadLargeNetPlannerState(storage)?.targets[0]?.manualLargeNetsPerDrop).toBe('39.46');
    expect(loadLargeNetPlannerState(storage)?.targets[0]?.storedPetInventoryOverride).toBe('5730');
    expect(loadLargeNetPlannerState(storage)?.targets[0]?.petLevelOverride).toBe('9');
  });

  it('defaults old saved state without wait days to the current wait horizon default', () => {
    const state = normalizeLargeNetPlannerState({
      schemaVersion: 1,
      dailyAntlers: '',
      directLargeNetsPerDay: '2000',
      craftOutputMultiplier: '1.45',
      catchMultiplier: '1.1',
      crunchyOmeletteActive: false,
      targets: [
        {
          id: 'spiked',
          itemName: 'Spiked Shell',
          targetQuantity: '10000',
          manualLargeNetsPerDrop: '6.1',
        },
      ],
    });

    expect(state.waitDays).toBe('7');
  });
});
