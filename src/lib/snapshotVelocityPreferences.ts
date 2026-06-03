export type SnapshotVelocityChartMode = 'mastery' | 'gain' | 'threshold';
export type SnapshotVelocityRangeMode = 'all' | 'recent';

export type SnapshotVelocityPreferences = {
  selectedCanonicalKeys: string[];
  hiddenDefaultCanonicalKeys: string[];
  chartMode: SnapshotVelocityChartMode;
  rangeMode: SnapshotVelocityRangeMode;
};

const STORAGE_KEY = 'farmrpg-tools.snapshotVelocityPreferences.v1';
const CHART_MODES = new Set<SnapshotVelocityChartMode>(['mastery', 'gain', 'threshold']);
const RANGE_MODES = new Set<SnapshotVelocityRangeMode>(['all', 'recent']);

export const DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES: SnapshotVelocityPreferences = {
  selectedCanonicalKeys: [],
  hiddenDefaultCanonicalKeys: [],
  chartMode: 'mastery',
  rangeMode: 'all',
};

function getStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }

  if ('localStorage' in globalThis) {
    return globalThis.localStorage;
  }

  return null;
}

function normalizeKeyList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((key): key is string => typeof key === 'string').map((key) => key.trim()).filter(Boolean))];
}

export function normalizeSnapshotVelocityPreferences(value: unknown): SnapshotVelocityPreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES;
  }

  const record = value as Partial<SnapshotVelocityPreferences>;

  return {
    selectedCanonicalKeys: normalizeKeyList(record.selectedCanonicalKeys),
    hiddenDefaultCanonicalKeys: normalizeKeyList(record.hiddenDefaultCanonicalKeys),
    chartMode: CHART_MODES.has(record.chartMode as SnapshotVelocityChartMode)
      ? (record.chartMode as SnapshotVelocityChartMode)
      : DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES.chartMode,
    rangeMode: RANGE_MODES.has(record.rangeMode as SnapshotVelocityRangeMode)
      ? (record.rangeMode as SnapshotVelocityRangeMode)
      : DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES.rangeMode,
  };
}

export function loadSnapshotVelocityPreferences(storage?: Storage): SnapshotVelocityPreferences {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES;
  }

  const rawValue = targetStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES;
  }

  try {
    return normalizeSnapshotVelocityPreferences(JSON.parse(rawValue));
  } catch {
    return DEFAULT_SNAPSHOT_VELOCITY_PREFERENCES;
  }
}

export function saveSnapshotVelocityPreferences(
  preferences: SnapshotVelocityPreferences,
  storage?: Storage,
): SnapshotVelocityPreferences {
  const normalizedPreferences = normalizeSnapshotVelocityPreferences(preferences);
  const targetStorage = getStorage(storage);

  if (targetStorage) {
    targetStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedPreferences));
  }

  return normalizedPreferences;
}

export function clearSnapshotVelocityPreferences(storage?: Storage): void {
  getStorage(storage)?.removeItem(STORAGE_KEY);
}
