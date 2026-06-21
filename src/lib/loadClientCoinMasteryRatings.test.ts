import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseItemAliasesCsv } from './itemAliases';
import {
  applyClientCoinRatingAliases,
  CLIENTCOIN_MASTERY_RATING_COLUMNS,
  parseClientCoinMasteryRatingsCsv,
} from './loadClientCoinMasteryRatings';

const HEADER = CLIENTCOIN_MASTERY_RATING_COLUMNS.join(',');

function csvRow(values: string[]): string {
  return values.join(',');
}

describe('parseClientCoinMasteryRatingsCsv', () => {
  it('parses ClientCoin ratings, counts, flags, and source metadata', () => {
    const result = parseClientCoinMasteryRatingsCsv(`${HEADER}
${csvRow([
  'Board',
  '',
  '5885',
  '13',
  '13',
  '2',
  '1',
  '1',
  'no',
  'yes',
  '0',
  'false',
  '',
  'x',
  'ClientCoin Rating 2024',
  '42',
  'Hard MM craft',
])}`);

    expect(result.entries).toHaveLength(1);
    expect(result.byCanonicalKey.board).toMatchObject({
      itemName: 'Board',
      canonicalKey: 'board',
      farmrpgItemId: '5885',
      clientcoinRating: 13,
      clientcoinRatingRaw: '13',
      towerCount: 2,
      gmCount: 1,
      mmCount: 1,
      fish: false,
      craft: true,
      explore: false,
      farm: false,
      cook: null,
      event: true,
      sourceSheet: 'ClientCoin Rating 2024',
      sourceRow: '42',
    });
  });

  it('treats blank and #NUM! ratings as unrated while preserving raw source text', () => {
    const result = parseClientCoinMasteryRatingsCsv(`${HEADER}
${csvRow(['Mystery Item', '', '', '#NUM!', '#NUM!', '', '', '', '', '', '', '', '', '', 'ClientCoin Rating 2024', '9', 'Formula unrated'])}
${csvRow(['Blank Rating', '', '', '', '', '', '', '', '', '', '', '', '', '', 'ClientCoin Rating 2024', '10', 'No score'])}`);

    expect(result.byCanonicalKey['mystery item']).toMatchObject({
      clientcoinRating: null,
      clientcoinRatingRaw: '#NUM!',
    });
    expect(result.byCanonicalKey['blank rating']).toMatchObject({
      clientcoinRating: null,
      clientcoinRatingRaw: null,
    });
  });

  it('rejects invalid ClientCoin schemas and row values', () => {
    expect(() =>
      parseClientCoinMasteryRatingsCsv(`item_name,clientcoin_rating
Board,13`),
    ).toThrow('Invalid ClientCoin mastery rating data schema');

    expect(() =>
      parseClientCoinMasteryRatingsCsv(`${HEADER}
${csvRow(['', '', '', '13', '13', '', '', '', '', '', '', '', '', '', '', '', ''])}`),
    ).toThrow('Missing required item_name');

    expect(() =>
      parseClientCoinMasteryRatingsCsv(`${HEADER}
${csvRow(['Board', 'wrong', '', '13', '13', '', '', '', '', '', '', '', '', '', '', '', ''])}`),
    ).toThrow('Canonical key mismatch');

    expect(() =>
      parseClientCoinMasteryRatingsCsv(`${HEADER}
${csvRow(['Board', '', '', '14', '14', '', '', '', '', '', '', '', '', '', '', '', ''])}`),
    ).toThrow('Invalid ClientCoin rating "14" for "Board".');

    expect(() =>
      parseClientCoinMasteryRatingsCsv(`${HEADER}
${csvRow(['Board', '', '', '13', '13', 'many', '', '', '', '', '', '', '', '', '', '', ''])}`),
    ).toThrow('Invalid tower_count "many" for "Board".');

    expect(() =>
      parseClientCoinMasteryRatingsCsv(`${HEADER}
${csvRow(['Board', '', '', '13', '13', '', '', '', 'maybe', '', '', '', '', '', '', '', ''])}`),
    ).toThrow('Invalid fish flag "maybe" for "Board".');
  });

  it('normalizes source headers that contain spaces or line-break artifacts', () => {
    const result = parseClientCoinMasteryRatingsCsv(
      `item_name,canonical_key,farmrpg_item_id,ClientCoin Rating 2024,clientcoin_rating_raw,tower_count,gm_count,mm_count,fish,craft,explore,farm,cook,event,source_sheet,source_row,notes
Board,,5885,13,13,,,,,x,,,,,ClientCoin Rating 2024,42,`,
    );

    expect(result.byCanonicalKey.board?.clientcoinRating).toBe(13);
  });


  it('resolves source-name variants through approved item aliases', () => {
    const ratings = parseClientCoinMasteryRatingsCsv(`${HEADER}
${csvRow(['Pinata Whop Stick', '', '', '8', '8', '', '', '', '', 'x', '', '', '', '', 'ClientCoin Rating 2024', '12', ''])}`);
    const aliases = parseItemAliasesCsv(`alias_name,alias_key,canonical_item_name,canonical_key,review_status,source,notes
Pinata Whop Stick,pinata whop stick,Piñata Whop Stick,piñata whop stick,approved,test,`);

    expect(applyClientCoinRatingAliases(ratings, aliases).byCanonicalKey['piñata whop stick']).toMatchObject({
      itemName: 'Pinata Whop Stick',
      canonicalKey: 'piñata whop stick',
    });
  });
  it('parses the checked-in local ClientCoin rating file', () => {
    const ratings = parseClientCoinMasteryRatingsCsv(
      readFileSync(join(process.cwd(), 'data', 'clientcoin_mastery_ratings.csv'), 'utf8'),
    );

    expect(ratings.entries).toHaveLength(0);
  });
});
