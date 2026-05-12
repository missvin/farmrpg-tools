export const MUSEUM_COMPLETION_STATE_STORAGE_KEY = 'farmrpg-tools.museumCompletionState';

export type MuseumCompletionManualMissingEntry = {
  id: string;
  categoryKey: string;
  categoryName: string;
  itemName: string;
  canonicalKey: string;
  slotCount: number;
  note: string;
};

export type MuseumCompletionState = {
  schemaVersion: 1;
  savedAt: string | null;
  fullMuseumText: string;
  personalMuseumText: string;
  manualMissingItems: MuseumCompletionManualMissingEntry[];
};

export type SaveMuseumCompletionInput = {
  fullMuseumText?: string;
  personalMuseumText: string;
  manualMissingItems?: MuseumCompletionManualMissingEntry[];
  savedAt?: string;
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

export function createDefaultMuseumCompletionState(): MuseumCompletionState {
  return {
    schemaVersion: 1,
    savedAt: null,
    fullMuseumText: '',
    personalMuseumText: '',
    manualMissingItems: [],
  };
}

function normalizeManualMissingEntry(value: unknown): MuseumCompletionManualMissingEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<MuseumCompletionManualMissingEntry>;

  if (
    typeof record.id !== 'string' ||
    record.id.length === 0 ||
    typeof record.categoryKey !== 'string' ||
    record.categoryKey.length === 0 ||
    typeof record.categoryName !== 'string' ||
    record.categoryName.length === 0 ||
    typeof record.itemName !== 'string' ||
    record.itemName.length === 0 ||
    typeof record.canonicalKey !== 'string' ||
    record.canonicalKey.length === 0 ||
    typeof record.slotCount !== 'number' ||
    !Number.isFinite(record.slotCount) ||
    record.slotCount < 1
  ) {
    return null;
  }

  return {
    id: record.id,
    categoryKey: record.categoryKey,
    categoryName: record.categoryName,
    itemName: record.itemName,
    canonicalKey: record.canonicalKey,
    slotCount: Math.floor(record.slotCount),
    note: typeof record.note === 'string' ? record.note : '',
  };
}

export function normalizeMuseumCompletionState(value: unknown): MuseumCompletionState {
  if (!value || typeof value !== 'object') {
    return createDefaultMuseumCompletionState();
  }

  const record = value as Partial<MuseumCompletionState>;
  const manualMissingItems = Array.isArray(record.manualMissingItems)
    ? record.manualMissingItems
        .map((entry) => normalizeManualMissingEntry(entry))
        .filter((entry): entry is MuseumCompletionManualMissingEntry => entry !== null)
    : [];

  return {
    schemaVersion: 1,
    savedAt: typeof record.savedAt === 'string' && record.savedAt.length > 0 ? record.savedAt : null,
    fullMuseumText: typeof record.fullMuseumText === 'string' ? record.fullMuseumText : '',
    personalMuseumText: typeof record.personalMuseumText === 'string' ? record.personalMuseumText : '',
    manualMissingItems,
  };
}

export function loadMuseumCompletionState(storage?: Storage): MuseumCompletionState {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(MUSEUM_COMPLETION_STATE_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultMuseumCompletionState();
  }

  try {
    return normalizeMuseumCompletionState(JSON.parse(rawValue));
  } catch {
    return createDefaultMuseumCompletionState();
  }
}

export function saveMuseumCompletionState(
  input: MuseumCompletionState | SaveMuseumCompletionInput,
  storage?: Storage,
): MuseumCompletionState {
  const normalizedState = normalizeMuseumCompletionState({
    schemaVersion: 1,
    savedAt: 'savedAt' in input && input.savedAt ? input.savedAt : new Date().toISOString(),
    fullMuseumText: input.fullMuseumText ?? '',
    personalMuseumText: input.personalMuseumText,
    manualMissingItems: input.manualMissingItems ?? [],
  });
  const activeStorage = getLocalStorage(storage);

  activeStorage.setItem(MUSEUM_COMPLETION_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearMuseumCompletionState(storage?: Storage): void {
  const activeStorage = getLocalStorage(storage);
  activeStorage.removeItem(MUSEUM_COMPLETION_STATE_STORAGE_KEY);
}
