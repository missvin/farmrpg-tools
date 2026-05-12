export const MUSEUM_COMPLETION_STATE_STORAGE_KEY = 'farmrpg-tools.museumCompletionState';

export type MuseumCompletionState = {
  schemaVersion: 1;
  savedAt: string | null;
  fullMuseumText: string;
  personalMuseumText: string;
};

export type SaveMuseumCompletionInput = {
  fullMuseumText: string;
  personalMuseumText: string;
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
  };
}

export function normalizeMuseumCompletionState(value: unknown): MuseumCompletionState {
  if (!value || typeof value !== 'object') {
    return createDefaultMuseumCompletionState();
  }

  const record = value as Partial<MuseumCompletionState>;

  return {
    schemaVersion: 1,
    savedAt: typeof record.savedAt === 'string' && record.savedAt.length > 0 ? record.savedAt : null,
    fullMuseumText: typeof record.fullMuseumText === 'string' ? record.fullMuseumText : '',
    personalMuseumText: typeof record.personalMuseumText === 'string' ? record.personalMuseumText : '',
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
    fullMuseumText: input.fullMuseumText,
    personalMuseumText: input.personalMuseumText,
  });
  const activeStorage = getLocalStorage(storage);

  activeStorage.setItem(MUSEUM_COMPLETION_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearMuseumCompletionState(storage?: Storage): void {
  const activeStorage = getLocalStorage(storage);
  activeStorage.removeItem(MUSEUM_COMPLETION_STATE_STORAGE_KEY);
}
