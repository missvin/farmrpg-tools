export type MuseumCandidateReviewMark = {
  reviewKey: string;
  canonicalKey: string;
  itemName: string;
  generatedBuddySlug: string;
  alternateBuddySlug: string | null;
  flags: string[];
  reviewedAt: string;
};

const MUSEUM_CANDIDATE_REVIEW_STORAGE_KEY = 'farmrpg-tools.museum-candidate-review-marks.v1';

function getStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

function isMuseumCandidateReviewMark(value: unknown): value is MuseumCandidateReviewMark {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MuseumCandidateReviewMark>;
  return (
    typeof candidate.reviewKey === 'string' &&
    typeof candidate.canonicalKey === 'string' &&
    typeof candidate.itemName === 'string' &&
    typeof candidate.generatedBuddySlug === 'string' &&
    (candidate.alternateBuddySlug === null || typeof candidate.alternateBuddySlug === 'string') &&
    Array.isArray(candidate.flags) &&
    candidate.flags.every((flag) => typeof flag === 'string') &&
    typeof candidate.reviewedAt === 'string'
  );
}

export function loadMuseumCandidateReviewMarks(storage?: Storage): MuseumCandidateReviewMark[] {
  const activeStorage = getStorage(storage);
  const rawValue = activeStorage.getItem(MUSEUM_CANDIDATE_REVIEW_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return [];
  }

  if (!Array.isArray(parsedValue) || !parsedValue.every(isMuseumCandidateReviewMark)) {
    return [];
  }

  return parsedValue;
}

function saveMuseumCandidateReviewMarks(marks: MuseumCandidateReviewMark[], storage?: Storage): void {
  const activeStorage = getStorage(storage);
  activeStorage.setItem(MUSEUM_CANDIDATE_REVIEW_STORAGE_KEY, JSON.stringify(marks));
}

export function markMuseumCandidateReviewed(mark: MuseumCandidateReviewMark, storage?: Storage): void {
  const existingMarks = loadMuseumCandidateReviewMarks(storage).filter((existing) => existing.reviewKey !== mark.reviewKey);
  saveMuseumCandidateReviewMarks([...existingMarks, mark], storage);
}

export function clearMuseumCandidateReviewedMark(reviewKey: string, storage?: Storage): void {
  const existingMarks = loadMuseumCandidateReviewMarks(storage).filter((mark) => mark.reviewKey !== reviewKey);
  saveMuseumCandidateReviewMarks(existingMarks, storage);
}

export function clearMuseumCandidateReviewMarks(storage?: Storage): void {
  const activeStorage = getStorage(storage);
  activeStorage.removeItem(MUSEUM_CANDIDATE_REVIEW_STORAGE_KEY);
}
