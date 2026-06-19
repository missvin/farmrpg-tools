import { describe, expect, it } from 'vitest';

import {
  buildItemReferenceLookup,
  cleanCopiedText,
  cleanTradeItemName,
  parsePriceCell,
  parseTradePricePastedText,
  toTradePriceReferenceCsv,
} from './tradePriceReferenceParser.mjs';

const catalogCsv = [
  'item_name,canonical_key,mastery_possible,farmrpg_item_id,buddy_slug,source_datasets,notes',
  '3-leaf Clover,3-leaf clover,yes,1,3-leaf-clover,test,',
  'Acorn Pie,acorn pie,yes,2,acorn-pie,test,',
  'Apple,apple,yes,3,apple,test,',
  'Apple Basket,apple basket,yes,4,apple-basket,test,',
  'Welcome Card,welcome card,no,5,welcome-card,test,',
].join('\n');

const aliasCsv = [
  'alias_name,alias_key,canonical_item_name,canonical_key,review_status,source,notes',
  '3 Leaf Clover,3 leaf clover,3-leaf Clover,3-leaf clover,approved,test,test',
].join('\n');

function buildLookup() {
  return buildItemReferenceLookup({
    itemCatalogCsvText: catalogCsv,
    itemAliasesCsvText: aliasCsv,
  });
}

describe('trade price reference parser', () => {
  it('cleans copied mojibake and HTML fragments', () => {
    expect(cleanCopiedText('Â» Name Â«')).toBe('» Name «');
    expect(cleanCopiedText('Ã—')).toBe('×');
    expect(cleanTradeItemName('Acorn Pie (<i>meal</i>)')).toBe('Acorn Pie');
  });

  it('parses trade price statuses and numeric ranges', () => {
    expect(parsePriceCell('Ã—')).toMatchObject({ status: 'not_listed', raw: '×' });
    expect(parsePriceCell('PC')).toMatchObject({ status: 'price_check' });
    expect(parsePriceCell('Country Store')).toMatchObject({ status: 'country_store' });
    expect(parsePriceCell('1-1.5g/k')).toMatchObject({
      status: 'priced',
      min: '1',
      max: '1.5',
      currency: 'gold',
      quantityBasis: 'per_1000',
    });
    expect(parsePriceCell('4-6 AP/k')).toMatchObject({
      status: 'priced',
      min: '4',
      max: '6',
      currency: 'ap',
      quantityBasis: 'per_1000',
    });
    expect(parsePriceCell('40-95 OJ')).toMatchObject({
      status: 'priced',
      min: '40',
      max: '95',
      currency: 'oj',
      quantityBasis: 'each',
    });
    expect(parsePriceCell('2g/100')).toMatchObject({
      status: 'priced',
      min: '2',
      max: '2',
      currency: 'gold',
      quantityBasis: 'per_100',
    });
  });

  it('normalizes pasted table rows into known item reference rows', () => {
    const pasted = [
      'Farm RPG Price Check',
      'Item\tÂ» Name Â«\tGold\tAP\tOJ',
      '3-leaf Clover\t3-leaf Clover\tÃ—\t4-6 AP/k\t30-45 OJ/k',
      'Acorn Pie (<i>meal</i>)\tAcorn Pie (meal)\tÃ—\t5-12 AP\t40-95 OJ',
      'Apple\tApple\t1-1.5g/k\t15-20 AP/k\t115-155 OJ/k',
      'Welcome Card\tWelcome Card\tCountry Store\tÃ—\tÃ—',
    ].join('\n');
    const result = parseTradePricePastedText(pasted, {
      itemReferenceLookup: buildLookup(),
      capturedDate: '2026-06-19',
    });

    expect(result.unknownItems).toEqual([]);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[1]).toMatchObject({
      raw_item_label: 'Acorn Pie (meal)',
      item_name: 'Acorn Pie',
      canonical_key: 'acorn pie',
      ap_min: '5',
      ap_max: '12',
      oj_currency: 'oj',
    });
    expect(result.rows[3]).toMatchObject({
      item_name: 'Welcome Card',
      gold_status: 'country_store',
    });
  });

  it('fails with an unknown item review list by default', () => {
    const pasted = ['Item\tÂ» Name Â«\tGold\tAP\tOJ', 'Mystery Thing\tMystery Thing\t1g\tÃ—\tÃ—'].join('\n');

    expect(() =>
      parseTradePricePastedText(pasted, {
        itemReferenceLookup: buildLookup(),
        capturedDate: '2026-06-19',
      }),
    ).toThrow(/Mystery Thing/u);
  });

  it('produces stable CSV output for equivalent pasted exports', () => {
    const first = ['Item\tÂ» Name Â«\tGold\tAP\tOJ', 'Apple\tApple\t1-1.5g/k\t15-20 AP/k\tÃ—'].join('\n');
    const second = ['Item\t» Name «\tGold\tAP\tOJ', 'Apple\tApple\t1-1.5g/k\t15-20 AP/k\t×'].join('\n');
    const options = { itemReferenceLookup: buildLookup(), capturedDate: '2026-06-19' };

    expect(toTradePriceReferenceCsv(parseTradePricePastedText(first, options).rows)).toBe(
      toTradePriceReferenceCsv(parseTradePricePastedText(second, options).rows),
    );
  });
});
