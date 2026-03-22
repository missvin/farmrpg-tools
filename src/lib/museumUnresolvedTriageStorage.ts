export type MuseumUnresolvedTriageMark = {
  triageKey: string;
  canonicalKey: string;
  itemName: string;
  unresolvedCaseType: string;
  generatedBuddySlug: string;
  alternateBuddySlug: string | null;
  reviewedAt: string;
};

const MUSEUM_UNRESOLVED_TRIAGE_STORAGE_KEY = 'farmrpg-tools.museum-unresolved-triage-marks.v1';

function getStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

function isMuseumUnresolvedTriageMark(value: unknown): value is MuseumUnresolvedTriageMark {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MuseumUnresolvedTriageMark>;
  return (
    typeof candidate.triageKey === 'string' &&
    typeof candidate.canonicalKey === 'string' &&
    typeof candidate.itemName === 'string' &&
    typeof candidate.unresolvedCaseType === 'string' &&
    typeof candidate.generatedBuddySlug === 'string' &&
    (candidate.alternateBuddySlug === null || typeof candidate.alternateBuddySlug === 'string') &&
    typeof candidate.reviewedAt === 'string'
  );
}

export function loadMuseumUnresolvedTriageMarks(storage?: Storage): MuseumUnresolvedTriageMark[] {
  const activeStorage = getStorage(storage);
  const rawValue = activeStorage.getItem(MUSEUM_UNRESOLVED_TRIAGE_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return [];
  }

  if (!Array.isArray(parsedValue) || !parsedValue.every(isMuseumUnresolvedTriageMark)) {
    return [];
  }

  return parsedValue;
}

function saveMuseumUnresolvedTriageMarks(marks: MuseumUnresolvedTriageMark[], storage?: Storage): void {
  const activeStorage = getStorage(storage);
  activeStorage.setItem(MUSEUM_UNRESOLVED_TRIAGE_STORAGE_KEY, JSON.stringify(marks));
}

export function markMuseumUnresolvedTriaged(mark: MuseumUnresolvedTriageMark, storage?: Storage): void {
  const existingMarks = loadMuseumUnresolvedTriageMarks(storage).filter((existing) => existing.triageKey !== mark.triageKey);
  saveMuseumUnresolvedTriageMarks([...existingMarks, mark], storage);
}

export function clearMuseumUnresolvedTriagedMark(triageKey: string, storage?: Storage): void {
  const existingMarks = loadMuseumUnresolvedTriageMarks(storage).filter((mark) => mark.triageKey !== triageKey);
  saveMuseumUnresolvedTriageMarks(existingMarks, storage);
}

export function clearMuseumUnresolvedTriageMarks(storage?: Storage): void {
  const activeStorage = getStorage(storage);
  activeStorage.removeItem(MUSEUM_UNRESOLVED_TRIAGE_STORAGE_KEY);
}
