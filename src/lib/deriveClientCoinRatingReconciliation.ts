import {
  deriveClientCoinMethodReviewCandidates,
  type ClientCoinMethodReviewCandidate,
} from './deriveClientCoinMethodReview';
import type { ClientCoinMasteryRatingData } from './loadClientCoinMasteryRatings';
import type { MasteryDifficultyData } from './loadMasteryDifficulty';

export type ClientCoinRatingReviewReason =
  | 'missing_current_rating_row'
  | 'current_unrated'
  | 'clientcoin_unrated'
  | 'rating_mismatch'
  | 'method_review';

export type ClientCoinRatingReconciliationRow = {
  itemName: string;
  canonicalKey: string;
  currentDifficulty: number | null;
  currentMethod: string | null;
  clientcoinRating: number | null;
  clientcoinRatingRaw: string | null;
  clientcoinMethods: string[];
  reviewReasons: ClientCoinRatingReviewReason[];
  sourceSheet: string | null;
  sourceRow: string | null;
  notes: string | null;
};

export type ClientCoinReviewedRatingUpdateInput = {
  canonicalKey: string;
  newGmRating: string;
  newMmRating: string;
};

function escapeCsvValue(value: string): string {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

function clientCoinMethodsFor(candidate: ClientCoinMethodReviewCandidate | null): string[] {
  return candidate?.clientcoinMethods ?? [];
}

export function deriveClientCoinRatingReconciliationRows(
  clientCoinRatings: ClientCoinMasteryRatingData,
  masteryDifficulty: MasteryDifficultyData,
): ClientCoinRatingReconciliationRow[] {
  const methodCandidates = deriveClientCoinMethodReviewCandidates(clientCoinRatings, masteryDifficulty);
  const methodCandidatesByKey = methodCandidates.reduce<Record<string, ClientCoinMethodReviewCandidate>>(
    (indexByKey, candidate) => {
      indexByKey[candidate.canonicalKey] = candidate;
      return indexByKey;
    },
    {},
  );

  return clientCoinRatings.entries
    .map((entry) => {
      const currentEntry = masteryDifficulty.byCanonicalKey[entry.canonicalKey] ?? null;
      const methodCandidate = methodCandidatesByKey[entry.canonicalKey] ?? null;
      const reviewReasons: ClientCoinRatingReviewReason[] = [];

      if (!currentEntry) {
        reviewReasons.push('missing_current_rating_row');
      } else if (currentEntry.difficulty === null && entry.clientcoinRating !== null) {
        reviewReasons.push('current_unrated');
      } else if (currentEntry.difficulty !== null && entry.clientcoinRating === null) {
        reviewReasons.push('clientcoin_unrated');
      } else if (
        currentEntry.difficulty !== null &&
        entry.clientcoinRating !== null &&
        currentEntry.difficulty !== entry.clientcoinRating
      ) {
        reviewReasons.push('rating_mismatch');
      }

      if (methodCandidate) {
        reviewReasons.push('method_review');
      }

      return {
        itemName: currentEntry?.itemName ?? entry.itemName,
        canonicalKey: entry.canonicalKey,
        currentDifficulty: currentEntry?.difficulty ?? null,
        currentMethod: currentEntry?.method ?? null,
        clientcoinRating: entry.clientcoinRating,
        clientcoinRatingRaw: entry.clientcoinRatingRaw,
        clientcoinMethods: clientCoinMethodsFor(methodCandidate),
        reviewReasons,
        sourceSheet: entry.sourceSheet,
        sourceRow: entry.sourceRow,
        notes: entry.notes,
      };
    })
    .filter((row) => row.reviewReasons.length > 0);
}

export function toClientCoinRatingReconciliationCsv(rows: ClientCoinRatingReconciliationRow[]): string {
  const csvRows = [
    'item_name,canonical_key,current_difficulty,current_method,clientcoin_rating,clientcoin_rating_raw,clientcoin_methods,review_reasons,source_sheet,source_row,notes',
  ];

  for (const row of rows) {
    csvRows.push(
      [
        row.itemName,
        row.canonicalKey,
        row.currentDifficulty?.toString() ?? '',
        row.currentMethod ?? '',
        row.clientcoinRating?.toString() ?? '',
        row.clientcoinRatingRaw ?? '',
        row.clientcoinMethods.join('; '),
        row.reviewReasons.join('; '),
        row.sourceSheet ?? '',
        row.sourceRow ?? '',
        row.notes ?? '',
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return csvRows.join('\n');
}

export function toClientCoinReviewedRatingUpdateCsv(
  rows: ClientCoinRatingReconciliationRow[],
  updates: ClientCoinReviewedRatingUpdateInput[],
): string {
  const rowsByKey = rows.reduce<Record<string, ClientCoinRatingReconciliationRow>>((indexByKey, row) => {
    indexByKey[row.canonicalKey] = row;
    return indexByKey;
  }, {});
  const csvRows = [
    'item_name,canonical_key,current_gm_rating,clientcoin_mm_rating,new_gm_rating,new_mm_rating,review_reasons,source_sheet,source_row',
  ];

  for (const update of updates) {
    const row = rowsByKey[update.canonicalKey];
    const newGmRating = update.newGmRating.trim();
    const newMmRating = update.newMmRating.trim();

    if (!row || (!newGmRating && !newMmRating)) {
      continue;
    }

    csvRows.push(
      [
        row.itemName,
        row.canonicalKey,
        row.currentDifficulty?.toString() ?? '',
        row.clientcoinRating?.toString() ?? '',
        newGmRating,
        newMmRating,
        row.reviewReasons.join('; '),
        row.sourceSheet ?? '',
        row.sourceRow ?? '',
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return csvRows.join('\n');
}

export function downloadClientCoinRatingReconciliationCsv(rows: ClientCoinRatingReconciliationRow[]): void {
  const csvText = toClientCoinRatingReconciliationCsv(rows);
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clientcoin-rating-reconciliation-review.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadClientCoinReviewedRatingUpdateCsv(
  rows: ClientCoinRatingReconciliationRow[],
  updates: ClientCoinReviewedRatingUpdateInput[],
): void {
  const csvText = toClientCoinReviewedRatingUpdateCsv(rows, updates);
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clientcoin-reviewed-rating-updates.csv';
  link.click();
  URL.revokeObjectURL(url);
}