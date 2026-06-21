import { describe, expect, it } from 'vitest';

import {
  deriveClientCoinRatingReconciliationRows,
  toClientCoinRatingReconciliationCsv,
  toClientCoinReviewedRatingUpdateCsv,
} from './deriveClientCoinRatingReconciliation';
import { CLIENTCOIN_MASTERY_RATING_COLUMNS, parseClientCoinMasteryRatingsCsv } from './loadClientCoinMasteryRatings';
import { parseMasteryDifficultyCsv } from './loadMasteryDifficulty';

const CLIENTCOIN_HEADER = CLIENTCOIN_MASTERY_RATING_COLUMNS.join(',');
const MASTERY_HEADER = 'item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row';

function row(values: string[]): string {
  return values.join(',');
}

describe('deriveClientCoinRatingReconciliationRows', () => {
  it('surfaces rating and method review rows without including aligned rows', () => {
    const clientCoinRatings = parseClientCoinMasteryRatingsCsv(`${CLIENTCOIN_HEADER}
${row(['Aligned Board', '', '', '1', '1', '', '', '', '', 'x', '', '', '', '', 'ClientCoin', '1', ''])}
${row(['Different Rating', '', '', '9', '9', '', '', '', '', 'x', '', '', '', '', 'ClientCoin', '2', ''])}
${row(['Missing Current', '', '', '7', '7', '', '', '', '', '', 'x', '', '', '', 'ClientCoin', '3', ''])}
${row(['Method Mismatch', '', '', '5', '5', '', '', '', '', '', '', 'x', '', '', 'ClientCoin', '4', ''])}`);
    const masteryDifficulty = parseMasteryDifficultyCsv(`${MASTERY_HEADER}
Aligned Board,1,Crafting,,,,,,,,
Different Rating,5,Crafting,,,,,,,,
Method Mismatch,5,Exploring,,,,,,,,`);

    expect(deriveClientCoinRatingReconciliationRows(clientCoinRatings, masteryDifficulty)).toEqual([
      expect.objectContaining({
        itemName: 'Different Rating',
        currentDifficulty: 5,
        clientcoinRating: 9,
        reviewReasons: ['rating_mismatch'],
      }),
      expect.objectContaining({
        itemName: 'Missing Current',
        currentDifficulty: null,
        clientcoinRating: 7,
        reviewReasons: ['missing_current_rating_row', 'method_review'],
      }),
      expect.objectContaining({
        itemName: 'Method Mismatch',
        currentDifficulty: 5,
        clientcoinRating: 5,
        clientcoinMethods: ['Farming'],
        reviewReasons: ['method_review'],
      }),
    ]);
  });

  it('exports reconciliation rows as CSV for broad review', () => {
    const clientCoinRatings = parseClientCoinMasteryRatingsCsv(`${CLIENTCOIN_HEADER}
${row(['Different Rating', '', '', '9', '9', '', '', '', '', 'x', '', '', '', '', 'ClientCoin', '2', 'Review this'])}`);
    const masteryDifficulty = parseMasteryDifficultyCsv(`${MASTERY_HEADER}
Different Rating,5,Crafting,,,,,,,,`);

    expect(toClientCoinRatingReconciliationCsv(deriveClientCoinRatingReconciliationRows(clientCoinRatings, masteryDifficulty))).toContain(
      'Different Rating,different rating,5,Crafting,9,9,,rating_mismatch,ClientCoin,2,Review this',
    );
  });

  it('exports only reviewed rating updates with entered values', () => {
    const clientCoinRatings = parseClientCoinMasteryRatingsCsv(`${CLIENTCOIN_HEADER}
${row(['Different Rating', '', '', '9', '9', '', '', '', '', 'x', '', '', '', '', 'ClientCoin', '2', 'Review this'])}
${row(['Missing Current', '', '', '7', '7', '', '', '', '', '', 'x', '', '', '', 'ClientCoin', '3', ''])}`);
    const masteryDifficulty = parseMasteryDifficultyCsv(`${MASTERY_HEADER}
Different Rating,5,Crafting,,,,,,,,`);
    const rows = deriveClientCoinRatingReconciliationRows(clientCoinRatings, masteryDifficulty);

    expect(
      toClientCoinReviewedRatingUpdateCsv(rows, [
        { canonicalKey: 'different rating', newGmRating: '', newMmRating: '9' },
        { canonicalKey: 'missing current', newGmRating: '', newMmRating: '' },
      ]),
    ).toBe(
      'item_name,canonical_key,current_gm_rating,clientcoin_mm_rating,new_gm_rating,new_mm_rating,review_reasons,source_sheet,source_row\nDifferent Rating,different rating,5,9,,9,rating_mismatch,ClientCoin,2',
    );
  });
});