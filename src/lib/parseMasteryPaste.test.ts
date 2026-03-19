import { describe, expect, it } from 'vitest';

import { parseMasteryPaste } from './parseMasteryPaste';

describe('parseMasteryPaste', () => {
  it('parses an item, progress, and percent block', () => {
    const result = parseMasteryPaste(`
      Gold Cucumber
      967,174 / 1,000,000 Progress
      96.7174%
    `);

    expect(result.masteryByItem).toEqual({
      'gold cucumber': 967174,
    });
    expect(result.parseSummary.parsedRowsCount).toBe(1);
    expect(result.parseSummary.duplicateRowsCount).toBe(0);
    expect(result.parseSummary.skippedNonItemLinesCount).toBe(0);
    expect(result.parseSummary.tiersDetected).toEqual([1000000]);
    expect(result.parsedRows).toEqual([
      {
        rawItemName: 'Gold Cucumber',
        canonicalKey: 'gold cucumber',
        count: 967174,
        targetTier: 1000000,
        sourceLineIndex: 1,
      },
    ]);
  });

  it('parses an item and progress block without a percent line', () => {
    const result = parseMasteryPaste(`
      Board
      272,829,930 / \u221e Progress
    `);

    expect(result.masteryByItem).toEqual({
      board: 272829930,
    });
    expect(result.parseSummary.tiersDetected).toEqual(['INF']);
    expect(result.parsedRows[0]?.targetTier).toBe('INF');
  });

  it('ignores a junk header line before a valid block', () => {
    const result = parseMasteryPaste(`
      Tier V (MM) chevron_down
      Gold Cucumber
      967,174 / 1,000,000 Progress
      96.7174%
    `);

    expect(result.masteryByItem).toEqual({
      'gold cucumber': 967174,
    });
    expect(result.parseSummary.itemsParsed).toBe(1);
  });

  it('ignores unrelated text that has no progress line after it', () => {
    const result = parseMasteryPaste(`
      Home
      Mastery
      Mega Mastered
      Some summary text about mastery progress
      Navigation

      Red Diamond Fish
      8,835 / 10,000 Progress
      88.35%
    `);

    expect(result.masteryByItem).toEqual({
      'red diamond fish': 8835,
    });
    expect(result.parseSummary.itemsParsed).toBe(1);
  });

  it('parses blocks even when blank lines separate the item name and progress line', () => {
    const result = parseMasteryPaste(`
      Ancient Coin

      12,345 / infinity Progress
    `);

    expect(result.masteryByItem).toEqual({
      'ancient coin': 12345,
    });
    expect(result.parseSummary.tiersDetected).toEqual(['INF']);
  });

  it('keeps the maximum count for duplicate rows and emits a warning', () => {
    const result = parseMasteryPaste(`
      Farmer\u2019s Hat
      120 / 10,000 Progress
      1.2%

      Farmer's Hat
      250 / 10,000 Progress
      2.5%
    `);

    expect(result.masteryByItem).toEqual({
      "farmer's hat": 250,
    });
    expect(result.parseSummary.duplicateRowsCount).toBe(1);
    expect(result.parseSummary.warnings).toHaveLength(1);
    expect(result.parseSummary.warnings[0]).toContain('Duplicate mastery row');
    expect(result.parsedRows).toHaveLength(2);
  });

  it('tracks skipped non-item lines for validation reporting', () => {
    const result = parseMasteryPaste(`Farm RPG
Back
Item Mastery

Gold Cucumber
967,174 / 1,000,000 Progress
96.7174%

Settings`);

    expect(result.parseSummary.skippedNonItemLinesCount).toBe(4);
    expect(result.parseSummary.skippedNonItemLineSamples).toEqual([
      { lineNumber: 1, text: 'Farm RPG' },
      { lineNumber: 2, text: 'Back' },
      { lineNumber: 3, text: 'Item Mastery' },
      { lineNumber: 9, text: 'Settings' },
    ]);
  });

  it('returns tiers in ascending order with INF last', () => {
    const result = parseMasteryPaste(`
      Mega Mastered

      Board
      272,829,930 / \u221e Progress

      Berry
      7 / 10 Progress
      70%

      Carrot
      100 / 1,000 Progress
      10%

      Gold Cucumber
      967,174 / 1,000,000 Progress
      96.7174%

      Red Diamond Fish
      8,835 / 10,000 Progress
      88.35%

      Turnip
      25 / 100 Progress
      25%
    `);

    expect(result.parseSummary.tiersDetected).toEqual([10, 100, 1000, 10000, 1000000, 'INF']);
  });

  it('supports progress lines with extra trailing text', () => {
    const result = parseMasteryPaste(`
      Magic Bean
      500 / 10,000 Progress tracked from export
      5%
    `);

    expect(result.masteryByItem).toEqual({
      'magic bean': 500,
    });
    expect(result.parseSummary.tiersDetected).toEqual([10000]);
    expect(result.parseSummary.unknownItemsCount).toBe(0);
  });
});
