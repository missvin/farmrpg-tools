import { describe, expect, it } from 'vitest';

import { deriveClientCoinMethodReviewCandidates } from './deriveClientCoinMethodReview';
import { CLIENTCOIN_MASTERY_RATING_COLUMNS, parseClientCoinMasteryRatingsCsv } from './loadClientCoinMasteryRatings';
import { parseMasteryDifficultyCsv } from './loadMasteryDifficulty';

const CLIENTCOIN_HEADER = CLIENTCOIN_MASTERY_RATING_COLUMNS.join(',');
const MASTERY_HEADER = 'item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row';

function clientCoinRow(values: string[]): string {
  return values.join(',');
}

describe('deriveClientCoinMethodReviewCandidates', () => {
  it('flags method mismatches, missing current methods, and missing current rows', () => {
    const clientCoinRatings = parseClientCoinMasteryRatingsCsv(`${CLIENTCOIN_HEADER}
${clientCoinRow(['Board', '', '', '13', '13', '', '', '', '', 'x', '', '', '', '', 'ClientCoin', '1', ''])}
${clientCoinRow(['Lima Bean', '', '', '12', '12', '', '', '', '', '', '', 'x', '', '', 'ClientCoin', '2', ''])}
${clientCoinRow(['Mystery Drop', '', '', '8', '8', '', '', '', 'x', '', '', '', '', '', 'ClientCoin', '3', ''])}
${clientCoinRow(['No Flag Item', '', '', '4', '4', '', '', '', '', '', '', '', '', '', 'ClientCoin', '4', ''])}`);
    const masteryDifficulty = parseMasteryDifficultyCsv(`${MASTERY_HEADER}
Board,1,Crafting,,,,,,,,
Lima Bean,12,Exploring,,,,,,,,
Mystery Drop,8,,,,,,,,,`);

    expect(deriveClientCoinMethodReviewCandidates(clientCoinRatings, masteryDifficulty)).toEqual([
      expect.objectContaining({
        itemName: 'Lima Bean',
        currentMethod: 'Exploring',
        clientcoinMethods: ['Farming'],
        reason: 'method_mismatch',
      }),
      expect.objectContaining({
        itemName: 'Mystery Drop',
        currentMethod: null,
        clientcoinMethods: ['Fishing'],
        reason: 'missing_current_method',
      }),
    ]);
  });

  it('flags ClientCoin rows that are missing from the current mastery difficulty source', () => {
    const clientCoinRatings = parseClientCoinMasteryRatingsCsv(`${CLIENTCOIN_HEADER}
${clientCoinRow(['New Item', '', '', '6', '6', '', '', '', '', '', 'x', '', '', '', 'ClientCoin', '8', ''])}`);
    const masteryDifficulty = parseMasteryDifficultyCsv(`${MASTERY_HEADER}
Board,1,Crafting,,,,,,,,`);

    expect(deriveClientCoinMethodReviewCandidates(clientCoinRatings, masteryDifficulty)).toEqual([
      expect.objectContaining({
        itemName: 'New Item',
        canonicalKey: 'new item',
        currentMethod: null,
        clientcoinMethods: ['Exploring'],
        reason: 'missing_current_rating_row',
        sourceRow: '8',
      }),
    ]);
  });

  it('accepts current methods that include one of several ClientCoin flags', () => {
    const clientCoinRatings = parseClientCoinMasteryRatingsCsv(`${CLIENTCOIN_HEADER}
${clientCoinRow(['Hybrid Item', '', '', '6', '6', '', '', '', 'x', 'x', '', '', '', '', 'ClientCoin', '8', ''])}`);
    const masteryDifficulty = parseMasteryDifficultyCsv(`${MASTERY_HEADER}
Hybrid Item,6,Fishing / Crafting,,,,,,,,`);

    expect(deriveClientCoinMethodReviewCandidates(clientCoinRatings, masteryDifficulty)).toEqual([]);
  });
});