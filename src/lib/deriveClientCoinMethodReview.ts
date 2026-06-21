import type { ClientCoinMasteryRatingData, ClientCoinMasteryRatingEntry } from './loadClientCoinMasteryRatings';
import type { MasteryDifficultyData, MasteryDifficultyEntry } from './loadMasteryDifficulty';

export type ClientCoinMethodReviewReason = 'missing_current_method' | 'method_mismatch' | 'missing_current_rating_row';

export type ClientCoinMethodReviewCandidate = {
  itemName: string;
  canonicalKey: string;
  currentMethod: string | null;
  clientcoinMethods: string[];
  clientcoinRating: number | null;
  reason: ClientCoinMethodReviewReason;
  sourceSheet: string | null;
  sourceRow: string | null;
};

const FLAG_METHODS: { field: keyof Pick<ClientCoinMasteryRatingEntry, 'fish' | 'craft' | 'explore' | 'farm' | 'cook' | 'event'>; method: string }[] = [
  { field: 'fish', method: 'Fishing' },
  { field: 'craft', method: 'Crafting' },
  { field: 'explore', method: 'Exploring' },
  { field: 'farm', method: 'Farming' },
  { field: 'cook', method: 'Cooking' },
  { field: 'event', method: 'Event' },
];

function getClientCoinMethods(entry: ClientCoinMasteryRatingEntry): string[] {
  return FLAG_METHODS.filter(({ field }) => entry[field] === true).map(({ method }) => method);
}

function methodIncludes(currentMethod: string, clientcoinMethods: string[]): boolean {
  const normalizedMethod = currentMethod.toLowerCase();
  return clientcoinMethods.some((method) => normalizedMethod.includes(method.toLowerCase()));
}

function toCandidate(
  entry: ClientCoinMasteryRatingEntry,
  currentEntry: MasteryDifficultyEntry | null,
  reason: ClientCoinMethodReviewReason,
  clientcoinMethods: string[],
): ClientCoinMethodReviewCandidate {
  return {
    itemName: currentEntry?.itemName ?? entry.itemName,
    canonicalKey: entry.canonicalKey,
    currentMethod: currentEntry?.method ?? null,
    clientcoinMethods,
    clientcoinRating: entry.clientcoinRating,
    reason,
    sourceSheet: entry.sourceSheet,
    sourceRow: entry.sourceRow,
  };
}

export function deriveClientCoinMethodReviewCandidates(
  clientCoinRatings: ClientCoinMasteryRatingData,
  masteryDifficulty: MasteryDifficultyData,
): ClientCoinMethodReviewCandidate[] {
  const candidates: ClientCoinMethodReviewCandidate[] = [];

  for (const entry of clientCoinRatings.entries) {
    const clientcoinMethods = getClientCoinMethods(entry);

    if (clientcoinMethods.length === 0) {
      continue;
    }

    const currentEntry = masteryDifficulty.byCanonicalKey[entry.canonicalKey] ?? null;

    if (!currentEntry) {
      candidates.push(toCandidate(entry, null, 'missing_current_rating_row', clientcoinMethods));
      continue;
    }

    if (!currentEntry.method) {
      candidates.push(toCandidate(entry, currentEntry, 'missing_current_method', clientcoinMethods));
      continue;
    }

    if (!methodIncludes(currentEntry.method, clientcoinMethods)) {
      candidates.push(toCandidate(entry, currentEntry, 'method_mismatch', clientcoinMethods));
    }
  }

  return candidates;
}