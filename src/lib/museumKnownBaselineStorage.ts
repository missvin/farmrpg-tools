import type { MuseumKnownBaseline } from './deriveMuseumRefreshWorkflow';

const MUSEUM_KNOWN_BASELINE_STORAGE_KEY = 'farmrpg-tools.museum-known-baseline.v1';

function getStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

function isMuseumKnownBaseline(value: unknown): value is MuseumKnownBaseline {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MuseumKnownBaseline>;
  return (
    typeof candidate.savedAt === 'string' &&
    Array.isArray(candidate.items) &&
    candidate.items.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.museumCategory === 'string' &&
        typeof item.category === 'string' &&
        typeof item.itemName === 'string' &&
        typeof item.canonicalKey === 'string' &&
        typeof item.obtainable === 'boolean' &&
        typeof item.generatedBuddySlug === 'string' &&
        (item.alternateBuddySlug === null || typeof item.alternateBuddySlug === 'string'),
    )
  );
}

export function loadMuseumKnownBaseline(storage?: Storage): MuseumKnownBaseline | null {
  const activeStorage = getStorage(storage);
  const rawValue = activeStorage.getItem(MUSEUM_KNOWN_BASELINE_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return null;
  }

  return isMuseumKnownBaseline(parsedValue) ? parsedValue : null;
}

export function saveMuseumKnownBaseline(baseline: MuseumKnownBaseline, storage?: Storage): void {
  const activeStorage = getStorage(storage);
  activeStorage.setItem(MUSEUM_KNOWN_BASELINE_STORAGE_KEY, JSON.stringify(baseline));
}

export function clearMuseumKnownBaseline(storage?: Storage): void {
  const activeStorage = getStorage(storage);
  activeStorage.removeItem(MUSEUM_KNOWN_BASELINE_STORAGE_KEY);
}
