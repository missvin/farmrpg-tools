import { describe, expect, it } from 'vitest';
import {
  createDefaultTowerProductionRates, estimateTowerProductionHours, isValidTowerProductionRates,
  loadTowerProductionRates, normalizeTowerProductionRates, saveTowerProductionRates,
} from './towerProductionRates';

describe('Tower production rates', () => {
  it('starts unknown, keeps valid independent hourly rates, and rejects invalid backup values', () => {
    expect(createDefaultTowerProductionRates()).toEqual({ schemaVersion: 1, steelPerHour: null, steelWirePerHour: null });
    expect(normalizeTowerProductionRates({ steelPerHour: 500, steelWirePerHour: '250' }))
      .toEqual({ schemaVersion: 1, steelPerHour: 500, steelWirePerHour: 250 });
    expect(isValidTowerProductionRates({ schemaVersion: 1, steelPerHour: 500, steelWirePerHour: null })).toBe(true);
    expect(isValidTowerProductionRates({ schemaVersion: 1, steelPerHour: 0, steelWirePerHour: null })).toBe(false);
  });

  it('saves rates and rounds production time up without combining material routes', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    } as Storage;
    const saved = saveTowerProductionRates({ schemaVersion: 1, steelPerHour: 500, steelWirePerHour: 200 }, storage);
    expect(loadTowerProductionRates(storage)).toEqual(saved);
    expect(estimateTowerProductionHours(35918, saved.steelPerHour)).toBe(72);
    expect(estimateTowerProductionHours(1500, saved.steelWirePerHour)).toBe(8);
    expect(estimateTowerProductionHours(100, null)).toBeNull();
    expect(estimateTowerProductionHours(null, 100)).toBeNull();
    expect(estimateTowerProductionHours(0, 100)).toBe(0);
  });
});
