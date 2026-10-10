import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultTowerMaterialPreferences, isValidTowerMaterialPreferences, loadTowerMaterialPreferences, saveTowerMaterialPreferences, TOWER_MATERIAL_PREFERENCES_STORAGE_KEY } from './towerMaterialPreferences';

beforeEach(() => localStorage.removeItem(TOWER_MATERIAL_PREFERENCES_STORAGE_KEY));
describe('Tower material preferences', () => {
  it('defaults legacy storage off and preserves explicit on/off choices and item watches', () => {
    expect(loadTowerMaterialPreferences()).toEqual(createDefaultTowerMaterialPreferences());
    const state = { schemaVersion: 1 as const, showInlineAmounts: true, watches: { 'veggie juice': ['beet', 'tomato'] } };
    saveTowerMaterialPreferences(state);
    expect(loadTowerMaterialPreferences()).toEqual(state);
    saveTowerMaterialPreferences({ ...state, showInlineAmounts: false });
    expect(loadTowerMaterialPreferences()).toEqual({ ...state, showInlineAmounts: false });
  });
  it('rejects malformed, duplicate, noncanonical and future preference data without rewriting it', () => {
    for (const state of [
      { schemaVersion: 2, showInlineAmounts: true, watches: {} },
      { schemaVersion: 1, showInlineAmounts: 'false', watches: {} },
      { schemaVersion: 1, showInlineAmounts: true, watches: [] },
      { schemaVersion: 1, showInlineAmounts: true, watches: { Hat: ['steel'] } },
      { schemaVersion: 1, showInlineAmounts: true, watches: { hat: ['steel', 'steel'] } },
    ]) expect(isValidTowerMaterialPreferences(state)).toBe(false);
    localStorage.setItem(TOWER_MATERIAL_PREFERENCES_STORAGE_KEY, '{broken');
    expect(() => loadTowerMaterialPreferences()).toThrow();
    expect(localStorage.getItem(TOWER_MATERIAL_PREFERENCES_STORAGE_KEY)).toBe('{broken');
  });
});
