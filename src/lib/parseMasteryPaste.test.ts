import { describe, expect, it } from 'vitest';

import { parseMasteryPaste } from './parseMasteryPaste';

describe('parseMasteryPaste', () => {
  it('parses counts with commas and detects numeric tiers', () => {
    const result = parseMasteryPaste(`
      Apple 1,234 / 100,000 Progress
      Orange Juice 10 / 1,000 Progress
    `);

    expect(result.masteryByItem).toEqual({
      apple: 1234,
      'orange juice': 10,
    });
    expect(result.parseSummary.itemsParsed).toBe(2);
    expect(result.parseSummary.tiersDetected).toEqual([100000, 1000]);
    expect(result.parseSummary.unknownItemsCount).toBe(0);
  });

  it('detects infinity targets', () => {
    const result = parseMasteryPaste('Ancient Coin 12,345 / infinity Progress');

    expect(result.masteryByItem).toEqual({
      'ancient coin': 12345,
    });
    expect(result.parseSummary.tiersDetected).toEqual(['INF']);
  });

  it('tolerates extra trailing tokens such as percentages', () => {
    const result = parseMasteryPaste('Magic Bean 500 / 10,000 Progress 5% Complete');

    expect(result.masteryByItem).toEqual({
      'magic bean': 500,
    });
    expect(result.parseSummary.tiersDetected).toEqual([10000]);
  });

  it('ignores unrelated lines', () => {
    const result = parseMasteryPaste(`
      Mastery Overview
      Total Items: 2
      Carrot 100 / 1,000 Progress
      Some unrelated footer
    `);

    expect(result.masteryByItem).toEqual({
      carrot: 100,
    });
    expect(result.parseSummary.itemsParsed).toBe(1);
  });

  it('keeps the maximum count for duplicate rows and emits a warning', () => {
    const result = parseMasteryPaste(`
      Farmer’s Hat 120 / 10,000 Progress
      Farmer's Hat 250 / 10,000 Progress 2.5%
    `);

    expect(result.masteryByItem).toEqual({
      "farmer's hat": 250,
    });
    expect(result.parseSummary.warnings).toHaveLength(1);
    expect(result.parseSummary.warnings[0]).toContain('Duplicate mastery row');
  });

  it('supports the infinity symbol target', () => {
    const result = parseMasteryPaste('Orb of Wisdom 42 / ∞ Progress');

    expect(result.masteryByItem).toEqual({
      'orb of wisdom': 42,
    });
    expect(result.parseSummary.tiersDetected).toEqual(['INF']);
  });
});
