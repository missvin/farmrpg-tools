import { toCanonicalItemKey } from './normalizeItemKey';

export const MASTERY_RACE_COUNTS_STORAGE_KEY = 'farmrpg-tools.masteryRaceCounts';

export type MasteryRaceCountEntry = {
  canonicalKey: string;
  itemName: string;
  masteredCount: number | null;
  grandMasteredCount: number | null;
  megaMasteredCount: number | null;
  updatedAt: string;
};

export type MasteryRaceCountsState = {
  schemaVersion: 1;
  entries: MasteryRaceCountEntry[];
};

export type UpsertMasteryRaceCountInput = {
  itemName: string;
  masteredCount?: number | null;
  grandMasteredCount?: number | null;
  megaMasteredCount?: number | null;
  now?: string;
};

function getLocalStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

function normalizeOptionalCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Math.floor(numericValue);
}

function normalizeEntry(value: unknown): MasteryRaceCountEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
  const canonicalKeyInput = typeof record.canonicalKey === 'string' ? record.canonicalKey.trim() : '';
  const canonicalKey = canonicalKeyInput.length > 0 ? toCanonicalItemKey(canonicalKeyInput) : toCanonicalItemKey(itemName);

  if (canonicalKey.length === 0) {
    return null;
  }

  return {
    canonicalKey,
    itemName: itemName.length > 0 ? itemName : canonicalKey,
    masteredCount: normalizeOptionalCount(record.masteredCount),
    grandMasteredCount: normalizeOptionalCount(record.grandMasteredCount),
    megaMasteredCount: normalizeOptionalCount(record.megaMasteredCount),
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt.length > 0
      ? record.updatedAt
      : new Date(0).toISOString(),
  };
}

export function createDefaultMasteryRaceCountsState(): MasteryRaceCountsState {
  return {
    schemaVersion: 1,
    entries: [],
  };
}

export function normalizeMasteryRaceCountsState(value: unknown): MasteryRaceCountsState {
  if (!value || typeof value !== 'object') {
    return createDefaultMasteryRaceCountsState();
  }

  const record = value as Partial<MasteryRaceCountsState>;
  const byCanonicalKey = new Map<string, MasteryRaceCountEntry>();

  if (Array.isArray(record.entries)) {
    for (const entry of record.entries) {
      const normalizedEntry = normalizeEntry(entry);

      if (normalizedEntry) {
        byCanonicalKey.set(normalizedEntry.canonicalKey, normalizedEntry);
      }
    }
  }

  return {
    schemaVersion: 1,
    entries: [...byCanonicalKey.values()].sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalKey.localeCompare(right.canonicalKey);
    }),
  };
}

export function loadMasteryRaceCountsState(storage?: Storage): MasteryRaceCountsState {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(MASTERY_RACE_COUNTS_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultMasteryRaceCountsState();
  }

  try {
    return normalizeMasteryRaceCountsState(JSON.parse(rawValue));
  } catch {
    return createDefaultMasteryRaceCountsState();
  }
}

export function saveMasteryRaceCountsState(
  state: MasteryRaceCountsState,
  storage?: Storage,
): MasteryRaceCountsState {
  const normalizedState = normalizeMasteryRaceCountsState(state);
  const activeStorage = getLocalStorage(storage);

  activeStorage.setItem(MASTERY_RACE_COUNTS_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearMasteryRaceCountsState(storage?: Storage): void {
  const activeStorage = getLocalStorage(storage);
  activeStorage.removeItem(MASTERY_RACE_COUNTS_STORAGE_KEY);
}

export function upsertMasteryRaceCount(
  state: MasteryRaceCountsState,
  input: UpsertMasteryRaceCountInput,
): MasteryRaceCountsState {
  const itemName = input.itemName.trim();
  const canonicalKey = toCanonicalItemKey(itemName);

  if (canonicalKey.length === 0) {
    return state;
  }

  const nextEntry: MasteryRaceCountEntry = {
    canonicalKey,
    itemName: itemName.length > 0 ? itemName : canonicalKey,
    masteredCount: normalizeOptionalCount(input.masteredCount),
    grandMasteredCount: normalizeOptionalCount(input.grandMasteredCount),
    megaMasteredCount: normalizeOptionalCount(input.megaMasteredCount),
    updatedAt: input.now ?? new Date().toISOString(),
  };
  const nextEntries = state.entries.filter((entry) => entry.canonicalKey !== canonicalKey);

  return normalizeMasteryRaceCountsState({
    schemaVersion: 1,
    entries: [...nextEntries, nextEntry],
  });
}

export function removeMasteryRaceCount(
  state: MasteryRaceCountsState,
  canonicalKey: string,
): MasteryRaceCountsState {
  const normalizedCanonicalKey = toCanonicalItemKey(canonicalKey);

  return normalizeMasteryRaceCountsState({
    schemaVersion: 1,
    entries: state.entries.filter((entry) => entry.canonicalKey !== normalizedCanonicalKey),
  });
}

export function buildMasteryRaceCountLookup(
  state: MasteryRaceCountsState,
): Record<string, MasteryRaceCountEntry> {
  return state.entries.reduce<Record<string, MasteryRaceCountEntry>>((result, entry) => {
    result[entry.canonicalKey] = entry;
    return result;
  }, {});
}
