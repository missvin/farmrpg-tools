import { toCanonicalItemKey } from './normalizeItemKey';

export const TOWER_MATERIAL_PREFERENCES_STORAGE_KEY = 'farmrpg-tools.towerMaterialPreferences.v1';

export type TowerMaterialPreferences = {
  schemaVersion: 1;
  showInlineAmounts: boolean;
  watches: Record<string, string[]>;
};

export function createDefaultTowerMaterialPreferences(): TowerMaterialPreferences {
  return { schemaVersion: 1, showInlineAmounts: false, watches: {} };
}

export function isValidTowerMaterialPreferences(value: unknown): value is TowerMaterialPreferences {
  if (!value || typeof value !== 'object') return false;
  const state = value as TowerMaterialPreferences;
  return state.schemaVersion === 1 && typeof state.showInlineAmounts === 'boolean'
    && !!state.watches && typeof state.watches === 'object' && !Array.isArray(state.watches)
    && Object.entries(state.watches).every(([key, materials]) => key !== '' && toCanonicalItemKey(key) === key
      && Array.isArray(materials) && materials.every((material) => typeof material === 'string'
        && material !== '' && toCanonicalItemKey(material) === material)
      && new Set(materials).size === materials.length);
}

export function loadTowerMaterialPreferences(storage: Storage = localStorage): TowerMaterialPreferences {
  const raw = storage.getItem(TOWER_MATERIAL_PREFERENCES_STORAGE_KEY);
  if (!raw) return createDefaultTowerMaterialPreferences();
  const parsed: unknown = JSON.parse(raw);
  if (!isValidTowerMaterialPreferences(parsed)) throw new Error('Saved Tower material preferences are invalid.');
  return parsed;
}

export function saveTowerMaterialPreferences(state: TowerMaterialPreferences, storage: Storage = localStorage): void {
  if (!isValidTowerMaterialPreferences(state)) throw new Error('Tower material preferences are invalid.');
  storage.setItem(TOWER_MATERIAL_PREFERENCES_STORAGE_KEY, JSON.stringify(state));
}

export function clearTowerMaterialPreferences(storage: Storage = localStorage): void {
  storage.removeItem(TOWER_MATERIAL_PREFERENCES_STORAGE_KEY);
}
