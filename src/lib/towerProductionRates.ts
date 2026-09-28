export const TOWER_PRODUCTION_RATES_STORAGE_KEY = 'farmrpg-tools.towerProductionRates.v1';

export type TowerProductionRates = {
  schemaVersion: 1;
  steelPerHour: number | null;
  steelWirePerHour: number | null;
};

export function createDefaultTowerProductionRates(): TowerProductionRates {
  return { schemaVersion: 1, steelPerHour: null, steelWirePerHour: null };
}

function normalizeRate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function normalizeTowerProductionRates(value: unknown): TowerProductionRates {
  if (!value || typeof value !== 'object') return createDefaultTowerProductionRates();
  const record = value as Partial<TowerProductionRates>;
  return {
    schemaVersion: 1,
    steelPerHour: normalizeRate(record.steelPerHour),
    steelWirePerHour: normalizeRate(record.steelWirePerHour),
  };
}

export function isValidTowerProductionRates(value: unknown): value is TowerProductionRates {
  if (!value || typeof value !== 'object') return false;
  const record = value as TowerProductionRates;
  const validRate = (rate: unknown) => rate === null || (typeof rate === 'number' && Number.isFinite(rate) && rate > 0);
  return record.schemaVersion === 1 && validRate(record.steelPerHour) && validRate(record.steelWirePerHour);
}

function activeStorage(storage?: Storage): Storage {
  if (storage) return storage;
  if (!('localStorage' in globalThis)) throw new Error('localStorage is not available in this browser.');
  return globalThis.localStorage;
}

export function loadTowerProductionRates(storage?: Storage): TowerProductionRates {
  const raw = activeStorage(storage).getItem(TOWER_PRODUCTION_RATES_STORAGE_KEY);
  if (!raw) return createDefaultTowerProductionRates();
  try { return normalizeTowerProductionRates(JSON.parse(raw)); }
  catch { return createDefaultTowerProductionRates(); }
}

export function saveTowerProductionRates(state: TowerProductionRates, storage?: Storage): TowerProductionRates {
  const normalized = normalizeTowerProductionRates(state);
  activeStorage(storage).setItem(TOWER_PRODUCTION_RATES_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearTowerProductionRates(storage?: Storage): void {
  activeStorage(storage).removeItem(TOWER_PRODUCTION_RATES_STORAGE_KEY);
}

export function estimateTowerProductionHours(quantity: number | null, rate: number | null): number | null {
  if (quantity === null || !Number.isFinite(quantity) || quantity < 0 || rate === null || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.ceil(quantity / rate);
}
