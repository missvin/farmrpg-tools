import { describe, expect, it } from 'vitest';
import {
  createDefaultTowerProductionRates, estimateTowerProductionHours, formatTowerProductionHours, isValidTowerProductionRates,
  loadTowerProductionRates, normalizeTowerProductionRates, saveTowerProductionRates,
} from './towerProductionRates';

describe('Tower production rates', () => {
  it('starts unknown, keeps valid independent hourly rates, and rejects invalid backup values', () => {
    expect(createDefaultTowerProductionRates()).toEqual({ schemaVersion: 1, steelPerHour: null, steelWirePerHour: null, oakPerHour: null });
    expect(normalizeTowerProductionRates({ steelPerHour: 500, steelWirePerHour: '250' }))
      .toEqual({ schemaVersion: 1, steelPerHour: 500, steelWirePerHour: 250, oakPerHour: null });
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

  it('uses days and remainder hours only above 24 hours', () => {
    expect(formatTowerProductionHours(0)).toBe('0h');
    expect(formatTowerProductionHours(24)).toBe('24h');
    expect(formatTowerProductionHours(25)).toBe('1d 1h');
    expect(formatTowerProductionHours(48)).toBe('2d 0h');
    expect(formatTowerProductionHours(49)).toBe('2d 1h');
  });

  it('preserves legacy Steel rates and validates Oak without inventing a rate', () => {
    expect(normalizeTowerProductionRates({ schemaVersion: 1, steelPerHour: 500, steelWirePerHour: 200 }))
      .toEqual({ schemaVersion: 1, steelPerHour: 500, steelWirePerHour: 200, oakPerHour: null });
    for (const oakPerHour of [0, -1, Infinity, '750']) {
      expect(isValidTowerProductionRates({ schemaVersion: 1, steelPerHour: null, steelWirePerHour: null, oakPerHour })).toBe(false);
    }
    const rates = normalizeTowerProductionRates({ oakPerHour: 750 });
    expect(rates.oakPerHour).toBe(750);
    expect(estimateTowerProductionHours(18001, rates.oakPerHour ?? null)).toBe(25);
  });
});
