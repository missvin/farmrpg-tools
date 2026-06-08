import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES,
  loadSnapshotVelocityPreferences,
  normalizeSnapshotVelocityPreferences,
  saveSnapshotVelocityPreferences,
} from './snapshotVelocityPreferences';

describe('snapshotVelocityPreferences', () => {
  it('normalizes malformed preference payloads to safe defaults', () => {
    expect(
      normalizeSnapshotVelocityPreferences({
        selectedCanonicalKeys: ['apple', 'apple', '', 12],
        hiddenDefaultCanonicalKeys: ['carrot'],
        chartMode: 'nope',
        rangeMode: 'recent',
        showMegaMasteredItems: true,
      }),
    ).toEqual({
      selectedCanonicalKeys: ['apple'],
      hiddenDefaultCanonicalKeys: ['carrot'],
      chartMode: 'mastery',
      rangeMode: 'recent',
      showMegaMasteredItems: true,
    });
  });

  it('saves and loads preferences from local storage', () => {
    const storage = window.localStorage;
    storage.clear();

    saveSnapshotVelocityPreferences(
      {
        selectedCanonicalKeys: ['apple'],
        hiddenDefaultCanonicalKeys: ['carrot'],
        chartMode: 'gain',
        rangeMode: 'recent',
        showMegaMasteredItems: true,
      },
      storage,
    );

    expect(loadSnapshotVelocityPreferences(storage)).toEqual({
      selectedCanonicalKeys: ['apple'],
      hiddenDefaultCanonicalKeys: ['carrot'],
      chartMode: 'gain',
      rangeMode: 'recent',
      showMegaMasteredItems: true,
    });
  });

  it('falls back when stored JSON is invalid', () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem('farmrpg-tools.snapshotVelocityPreferences.v1', '{nope');

    expect(loadSnapshotVelocityPreferences(storage)).toEqual(DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES);
  });
});
